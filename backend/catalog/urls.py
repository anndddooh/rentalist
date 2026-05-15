"""カタログ API の URL（DRF ルーター）。"""
from rest_framework.routers import DefaultRouter

from .views import (
    CartItemViewSet,
    RentalHistoryViewSet,
    RentalShopViewSet,
    SeriesViewSet,
)

router = DefaultRouter()
router.register("series", SeriesViewSet, basename="series")
router.register("cart", CartItemViewSet, basename="cart")
router.register("history", RentalHistoryViewSet, basename="history")
router.register("shops", RentalShopViewSet, basename="shops")

urlpatterns = router.urls
