"""招待リンクによるアカウント発行のためのモデル。"""
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

INVITE_VALID_DAYS = 7


def default_expiry():
    return timezone.now() + timedelta(days=INVITE_VALID_DAYS)


class InviteToken(models.Model):
    """管理者が発行するワンタイムの招待トークン。"""

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_invites",
        verbose_name="発行者",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="発行日時")
    expires_at = models.DateTimeField(default=default_expiry, verbose_name="有効期限")
    used_at = models.DateTimeField(null=True, blank=True, verbose_name="使用日時")
    used_by = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invite_used",
        verbose_name="使用者",
    )

    class Meta:
        verbose_name = "招待トークン"
        verbose_name_plural = "招待トークン"
        ordering = ["-created_at"]

    def __str__(self):
        return f"招待 {self.token}"

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_used(self):
        return self.used_at is not None

    @property
    def is_valid(self):
        return not self.is_used and not self.is_expired

    def mark_used(self, user):
        self.used_at = timezone.now()
        self.used_by = user
        self.save(update_fields=["used_at", "used_by"])
