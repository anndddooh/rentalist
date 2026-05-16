"""Rentalist のカタログモデル群。"""
from django.conf import settings
from django.db import models
from django.db.models import Max


class Series(models.Model):
    """漫画シリーズ。進捗・お気に入り度・店頭で探す手掛かり情報を持つ。"""

    STATUS_ACTIVE = "active"
    STATUS_WISHLIST = "wishlist"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "進行中"),
        (STATUS_WISHLIST, "いつか読みたい"),
        (STATUS_COMPLETED, "読破済み"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="series",
        verbose_name="所有ユーザー",
    )
    title = models.CharField("タイトル", max_length=200)
    author = models.CharField("作者名", max_length=200, blank=True)
    author_kana = models.CharField("作者ふりがな", max_length=200, blank=True)
    publisher = models.CharField("出版社名", max_length=200, blank=True)
    magazine_label = models.CharField(
        "掲載誌・レーベル", max_length=200, blank=True,
        help_text="例: 週刊少年ジャンプ / ジャンプコミックス",
    )
    status = models.CharField(
        "ステータス", max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE
    )
    current_volume = models.PositiveIntegerField(
        "読了済み巻数", default=0,
        help_text="読破記録の最大巻から自動再計算される",
    )
    total_volumes = models.PositiveIntegerField(
        "全巻数", null=True, blank=True, help_text="完結作品のみ。連載中は空",
    )
    favorite_score = models.PositiveSmallIntegerField("お気に入り度", default=3)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "シリーズ"
        verbose_name_plural = "シリーズ"
        # お気に入り度降順 → 出版社昇順（セカンドキー） → タイトル昇順
        ordering = ["-favorite_score", "publisher", "title"]

    def __str__(self):
        return self.title

    @property
    def cart_count(self):
        """このシリーズで現在カートに入っている巻数。"""
        return self.cart_items.count()

    @property
    def next_volume(self):
        """次にレンタルすべき巻 = 読了済み + カート内 + 1。"""
        return self.current_volume + self.cart_count + 1

    def recalculate_current_volume(self, commit=True):
        """読破記録から current_volume を再計算し、完結遷移も行う。"""
        agg = self.histories.aggregate(m=Max("volume_number"))
        self.current_volume = agg["m"] or 0
        # 完結の自動遷移は active <-> completed の間でのみ行う（wishlist は対象外）
        if self.status in (self.STATUS_ACTIVE, self.STATUS_COMPLETED):
            if self.total_volumes and self.current_volume >= self.total_volumes:
                self.status = self.STATUS_COMPLETED
            else:
                self.status = self.STATUS_ACTIVE
        if commit:
            self.save(update_fields=["current_volume", "status", "updated_at"])


class VolumeCover(models.Model):
    """巻ごとの表紙画像（楽天キャッシュ・手動URL・アップロードを統合）。"""

    SOURCE_RAKUTEN = "rakuten"
    SOURCE_MANUAL = "manual"
    SOURCE_UPLOAD = "upload"
    SOURCE_CHOICES = [
        (SOURCE_RAKUTEN, "楽天"),
        (SOURCE_MANUAL, "手動URL"),
        (SOURCE_UPLOAD, "アップロード"),
    ]

    series = models.ForeignKey(
        Series, on_delete=models.CASCADE, related_name="covers", verbose_name="シリーズ"
    )
    volume_number = models.PositiveIntegerField("巻数")
    image_url = models.URLField("画像URL", max_length=500, blank=True)
    image_file = models.ImageField("アップロード画像", upload_to="covers/", blank=True, null=True)
    source = models.CharField("取得元", max_length=10, choices=SOURCE_CHOICES)
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "巻の表紙"
        verbose_name_plural = "巻の表紙"
        unique_together = ("series", "volume_number")

    def __str__(self):
        return f"{self.series.title} {self.volume_number}巻"

    @property
    def resolved_url(self):
        """表示に使う URL。アップロード画像があればそれを優先。"""
        if self.image_file:
            return self.image_file.url
        return self.image_url


class CartItem(models.Model):
    """レンタル予定（カート）の1巻。"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cart_items"
    )
    series = models.ForeignKey(
        Series, on_delete=models.CASCADE, related_name="cart_items", verbose_name="シリーズ"
    )
    volume_number = models.PositiveIntegerField("巻数")
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "カートアイテム"
        verbose_name_plural = "カートアイテム"
        unique_together = ("user", "series", "volume_number")
        ordering = ["added_at"]

    def __str__(self):
        return f"{self.series.title} {self.volume_number}巻"


class RentalHistory(models.Model):
    """読破記録。確定または手動追加で生成される。"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="histories"
    )
    series = models.ForeignKey(
        Series, on_delete=models.CASCADE, related_name="histories", verbose_name="シリーズ"
    )
    volume_number = models.PositiveIntegerField("巻数")
    rented_at = models.DateTimeField("レンタル日時")

    class Meta:
        verbose_name = "レンタル履歴"
        verbose_name_plural = "レンタル履歴"
        unique_together = ("user", "series", "volume_number")
        ordering = ["-rented_at"]

    def __str__(self):
        return f"{self.series.title} {self.volume_number}巻"


class RentalShop(models.Model):
    """レンタルショップ（ユーザーごとのマスタ）。"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shops"
    )
    name = models.CharField("店名", max_length=100)
    memo = models.TextField("メモ", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "レンタルショップ"
        verbose_name_plural = "レンタルショップ"
        ordering = ["name"]

    def __str__(self):
        return self.name


class ShopAvailability(models.Model):
    """シリーズ × ショップ の貸出状況。レコード不在 = 未確認。"""

    STATUS_AVAILABLE = "available"
    STATUS_UNAVAILABLE = "unavailable"
    STATUS_CHOICES = [
        (STATUS_AVAILABLE, "貸出あり"),
        (STATUS_UNAVAILABLE, "貸出なし"),
    ]
    STATUS_UNKNOWN = "unknown"  # API レスポンス上の正規化値（DB には保存しない）

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="availabilities"
    )
    series = models.ForeignKey(
        Series, on_delete=models.CASCADE, related_name="availabilities", verbose_name="シリーズ"
    )
    shop = models.ForeignKey(
        RentalShop, on_delete=models.CASCADE, related_name="availabilities", verbose_name="ショップ"
    )
    status = models.CharField("貸出状況", max_length=15, choices=STATUS_CHOICES)
    checked_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "貸出状況"
        verbose_name_plural = "貸出状況"
        unique_together = ("series", "shop")

    def __str__(self):
        return f"{self.series.title} @ {self.shop.name}: {self.get_status_display()}"
