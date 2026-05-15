from django.contrib import admin

from .models import (
    CartItem,
    RentalHistory,
    RentalShop,
    Series,
    ShopAvailability,
    VolumeCover,
)


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "status", "current_volume", "total_volumes",
                    "favorite_score")
    list_filter = ("status", "favorite_score")
    search_fields = ("title", "author", "publisher")


@admin.register(VolumeCover)
class VolumeCoverAdmin(admin.ModelAdmin):
    list_display = ("series", "volume_number", "source", "fetched_at")
    list_filter = ("source",)


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("user", "series", "volume_number", "added_at")


@admin.register(RentalHistory)
class RentalHistoryAdmin(admin.ModelAdmin):
    list_display = ("user", "series", "volume_number", "rented_at")
    list_filter = ("rented_at",)


@admin.register(RentalShop)
class RentalShopAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "created_at")


@admin.register(ShopAvailability)
class ShopAvailabilityAdmin(admin.ModelAdmin):
    list_display = ("series", "shop", "status", "checked_at")
    list_filter = ("status",)
