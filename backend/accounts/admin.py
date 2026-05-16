from django.contrib import admin

from .models import InviteToken


@admin.register(InviteToken)
class InviteTokenAdmin(admin.ModelAdmin):
    list_display = ("token", "created_by", "created_at", "expires_at", "used_by", "used_at")
    list_filter = ("created_at", "expires_at")
    readonly_fields = ("token", "created_at", "used_at", "used_by")
