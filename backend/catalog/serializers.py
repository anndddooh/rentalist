"""カタログ API のシリアライザ。"""
from rest_framework import serializers

from .models import (
    CartItem,
    RentalHistory,
    RentalShop,
    Series,
    ShopAvailability,
    VolumeCover,
)
from .services import rakuten


class VolumeCoverSerializer(serializers.ModelSerializer):
    resolved_url = serializers.ReadOnlyField()

    class Meta:
        model = VolumeCover
        fields = ("id", "volume_number", "image_url", "image_file", "source",
                  "resolved_url", "fetched_at")
        read_only_fields = ("id", "source", "resolved_url", "fetched_at")


class SeriesSerializer(serializers.ModelSerializer):
    next_volume = serializers.ReadOnlyField()
    cart_count = serializers.ReadOnlyField()
    next_cover_url = serializers.SerializerMethodField()
    first_volume_cover_url = serializers.SerializerMethodField()
    availability_status = serializers.SerializerMethodField()
    availability_map = serializers.SerializerMethodField()

    class Meta:
        model = Series
        fields = (
            "id", "title", "author", "author_kana", "publisher", "magazine_label",
            "status", "current_volume", "total_volumes", "favorite_score",
            "next_volume", "cart_count", "next_cover_url", "first_volume_cover_url",
            "availability_status", "availability_map", "created_at", "updated_at",
        )
        read_only_fields = ("id", "current_volume", "created_at", "updated_at")

    def get_next_cover_url(self, obj):
        """次の巻のキャッシュ済み表紙URL。未キャッシュなら 1 巻表紙にフォールバック。

        ホーム画面で表紙未取得のシリーズが N 件並列で /cover/ を叩く嵐を防ぐ目的。
        フォールバックでも遅延取得はしない（楽天 API は呼ばない）。
        """
        cover = next(
            (c for c in obj.covers.all() if c.volume_number == obj.next_volume), None
        )
        if cover:
            return cover.resolved_url
        first = next(
            (c for c in obj.covers.all() if c.volume_number == 1), None
        )
        return first.resolved_url if first else None

    def get_first_volume_cover_url(self, obj):
        """1巻のキャッシュ済み表紙URL（読破ページ等で初期表示に使う）。"""
        cover = next(
            (c for c in obj.covers.all() if c.volume_number == 1), None
        )
        return cover.resolved_url if cover else None

    def get_availability_status(self, obj):
        """context に shop_id があれば、そのショップでの貸出状況を3値で返す。"""
        shop_id = self.context.get("shop_id")
        if not shop_id:
            return None
        avail = next(
            (a for a in obj.availabilities.all() if a.shop_id == int(shop_id)), None
        )
        return avail.status if avail else ShopAvailability.STATUS_UNKNOWN

    def get_availability_map(self, obj):
        """全ショップ分の貸出状況 {shop_id: status}。レコード不在のショップは含まない。"""
        return {a.shop_id: a.status for a in obj.availabilities.all()}

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        series = super().create(validated_data)
        # 1巻の表紙を楽天から取得してキャッシュする（見つからない・手動入力・
        # APIキー未設定なら None で何もしない）。発売前の仮表紙はキャッシュせず、
        # 次回 cover GET 時に再取得させて本表紙差し替えを拾う。
        cover_url, provisional = rakuten.find_volume_cover(series.title, 1)
        if cover_url and not provisional:
            VolumeCover.objects.create(
                series=series,
                volume_number=1,
                image_url=cover_url,
                source=VolumeCover.SOURCE_RAKUTEN,
            )
        return series


class CartItemSerializer(serializers.ModelSerializer):
    series_title = serializers.CharField(source="series.title", read_only=True)
    series_id = serializers.PrimaryKeyRelatedField(
        source="series", queryset=Series.objects.all(), write_only=True
    )

    class Meta:
        model = CartItem
        fields = ("id", "series", "series_id", "series_title", "volume_number", "added_at")
        read_only_fields = ("id", "series", "volume_number", "added_at")


class RentalHistorySerializer(serializers.ModelSerializer):
    series_title = serializers.CharField(source="series.title", read_only=True)
    series_id = serializers.PrimaryKeyRelatedField(
        source="series", queryset=Series.objects.all(), write_only=True
    )

    class Meta:
        model = RentalHistory
        fields = ("id", "series", "series_id", "series_title", "volume_number", "rented_at")
        read_only_fields = ("id", "series")

    def validate(self, attrs):
        """同一シリーズ・同一巻の重複登録を防ぐ。"""
        user = self.context["request"].user
        series = attrs.get("series")
        volume = attrs.get("volume_number")
        if RentalHistory.objects.filter(
            user=user, series=series, volume_number=volume
        ).exists():
            raise serializers.ValidationError(
                {"volume_number": f"{volume}巻は既に履歴に登録されています。"}
            )
        return attrs


class RentalShopSerializer(serializers.ModelSerializer):
    class Meta:
        model = RentalShop
        fields = ("id", "name", "memo", "created_at")
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class AvailabilityUpdateSerializer(serializers.Serializer):
    """シリーズの貸出状況更新（shop_id + status の3値）。"""

    shop_id = serializers.IntegerField()
    status = serializers.ChoiceField(
        choices=[
            ShopAvailability.STATUS_AVAILABLE,
            ShopAvailability.STATUS_UNAVAILABLE,
            ShopAvailability.STATUS_UNKNOWN,
        ]
    )
