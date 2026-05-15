"""カタログ API のビュー。すべて request.user でスコープされる。"""
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    CartItem,
    RentalHistory,
    RentalShop,
    Series,
    ShopAvailability,
    VolumeCover,
)
from .serializers import (
    AvailabilityUpdateSerializer,
    CartItemSerializer,
    RentalHistorySerializer,
    RentalShopSerializer,
    SeriesSerializer,
    VolumeCoverSerializer,
)
from .services import rakuten


class SeriesViewSet(viewsets.ModelViewSet):
    """シリーズの CRUD ＋ 検索・表紙・貸出状況。"""

    serializer_class = SeriesSerializer

    def get_queryset(self):
        qs = (
            Series.objects.filter(user=self.request.user)
            .prefetch_related("covers", "availabilities", "cart_items")
        )
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["shop_id"] = self.request.query_params.get("shop")
        return ctx

    @action(detail=False, methods=["get"])
    def search(self, request):
        """楽天ブックスでシリーズ候補を検索する。"""
        query = request.query_params.get("q", "")
        return Response(rakuten.search_series(query))

    @action(detail=True, methods=["get", "put"], url_path="cover")
    def cover(self, request, pk=None):
        """巻の表紙を取得（GET・未取得なら楽天遅延取得）／設定（PUT）。"""
        series = self.get_object()
        if request.method == "GET":
            volume = int(request.query_params.get("volume", series.next_volume))
            cover = series.covers.filter(volume_number=volume).first()
            if cover is None:
                url = rakuten.find_volume_cover(series.title, volume)
                if url:
                    cover = VolumeCover.objects.create(
                        series=series,
                        volume_number=volume,
                        image_url=url,
                        source=VolumeCover.SOURCE_RAKUTEN,
                    )
            if cover is None:
                return Response({"volume_number": volume, "resolved_url": None})
            return Response(VolumeCoverSerializer(cover).data)

        # PUT: 手動URL設定 または 画像アップロード
        volume = int(request.data.get("volume_number") or series.next_volume)
        image_file = request.FILES.get("image_file")
        if image_file:
            defaults = {
                "image_file": image_file,
                "image_url": "",
                "source": VolumeCover.SOURCE_UPLOAD,
            }
        else:
            defaults = {
                "image_url": request.data.get("image_url", ""),
                "image_file": None,
                "source": VolumeCover.SOURCE_MANUAL,
            }
        cover, _ = VolumeCover.objects.update_or_create(
            series=series, volume_number=volume, defaults=defaults
        )
        return Response(VolumeCoverSerializer(cover).data)

    @action(detail=True, methods=["put"], url_path="availability")
    def availability(self, request, pk=None):
        """ショップ別の貸出状況を更新する。status=unknown はレコード削除。"""
        series = self.get_object()
        serializer = AvailabilityUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shop = get_object_or_404(
            RentalShop, pk=serializer.validated_data["shop_id"], user=request.user
        )
        new_status = serializer.validated_data["status"]

        if new_status == ShopAvailability.STATUS_UNKNOWN:
            ShopAvailability.objects.filter(series=series, shop=shop).delete()
            return Response({"shop_id": shop.id, "status": ShopAvailability.STATUS_UNKNOWN})

        obj, _ = ShopAvailability.objects.update_or_create(
            series=series,
            shop=shop,
            defaults={"user": request.user, "status": new_status},
        )
        return Response(
            {"shop_id": shop.id, "status": obj.status, "checked_at": obj.checked_at}
        )


class CartItemViewSet(viewsets.ModelViewSet):
    """カート。追加時に次の巻を自動算出し、確定アクションを持つ。"""

    serializer_class = CartItemSerializer
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        return CartItem.objects.filter(user=self.request.user).select_related("series")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        series = serializer.validated_data["series"]
        if series.user_id != request.user.id:
            return Response(
                {"detail": "他ユーザーのシリーズは追加できません。"},
                status=status.HTTP_403_FORBIDDEN,
            )
        # next_volume = current_volume + 現在のカート内同シリーズ数 + 1
        item = CartItem.objects.create(
            user=request.user, series=series, volume_number=series.next_volume
        )
        return Response(
            CartItemSerializer(item).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["post"])
    def checkout(self, request):
        """確定: カート → 読破記録、current_volume 再計算、カート全削除。"""
        items = list(
            CartItem.objects.filter(user=request.user).select_related("series")
        )
        if not items:
            return Response(
                {"detail": "カートが空です。"}, status=status.HTTP_400_BAD_REQUEST
            )
        with transaction.atomic():
            affected = {}
            now = timezone.now()
            for item in items:
                RentalHistory.objects.get_or_create(
                    user=request.user,
                    series=item.series,
                    volume_number=item.volume_number,
                    defaults={"rented_at": now},
                )
                affected[item.series_id] = item.series
            CartItem.objects.filter(user=request.user).delete()
            for series in affected.values():
                series.recalculate_current_volume()
        return Response({"detail": "確定しました。", "count": len(items)})


class RentalHistoryViewSet(viewsets.ModelViewSet):
    """読破記録。手動追加と削除で current_volume を再計算する。"""

    serializer_class = RentalHistorySerializer
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        qs = RentalHistory.objects.filter(user=self.request.user).select_related("series")
        series_id = self.request.query_params.get("series_id")
        if series_id:
            qs = qs.filter(series_id=series_id)
        return qs

    def perform_create(self, serializer):
        history = serializer.save(user=self.request.user)
        history.series.recalculate_current_volume()

    def perform_destroy(self, instance):
        series = instance.series
        instance.delete()
        series.recalculate_current_volume()


class RentalShopViewSet(viewsets.ModelViewSet):
    """レンタルショップのマスタ管理。"""

    serializer_class = RentalShopSerializer

    def get_queryset(self):
        return RentalShop.objects.filter(user=self.request.user)
