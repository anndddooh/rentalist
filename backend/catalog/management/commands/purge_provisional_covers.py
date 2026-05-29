"""指定シリーズの仮表紙キャッシュ（VolumeCover）を削除する管理コマンド。

楽天は発売前の巻に対し <isbn>.gif のプレースホルダー画像を返すことがある。
旧版コード（feat: 発売前の仮表紙はキャッシュせず...の前）ではそれを DB に
キャッシュしてしまっていたので、本コマンドで既存キャッシュを掃除する。

デフォルトは dry-run。実削除には --commit を付ける。

例:
  python manage.py purge_provisional_covers --series "ありす、宇宙までも" "サンダー3"
  python manage.py purge_provisional_covers --series "ありす、宇宙までも" --commit
  python manage.py purge_provisional_covers --series "ありす、宇宙までも" --user hironori --commit
"""
from django.core.management.base import BaseCommand

from catalog.models import Series, VolumeCover
from catalog.services import rakuten


class Command(BaseCommand):
    help = "指定シリーズの仮表紙キャッシュを削除する（デフォルト dry-run）"

    def add_arguments(self, parser):
        parser.add_argument(
            "--series",
            nargs="+",
            required=True,
            help="対象シリーズの title（完全一致、複数指定可）",
        )
        parser.add_argument(
            "--user",
            default=None,
            help="特定ユーザーのシリーズのみ対象にする（未指定なら全ユーザー）",
        )
        parser.add_argument(
            "--commit",
            action="store_true",
            help="実削除する。未指定なら削除候補の表示のみ。",
        )

    def handle(self, **options):
        titles = options["series"]
        username = options["user"]
        commit = options["commit"]

        series_qs = Series.objects.filter(title__in=titles).select_related("user")
        if username:
            series_qs = series_qs.filter(user__username=username)

        targets = []
        for series in series_qs:
            for cover in series.covers.all():
                if rakuten.is_provisional_url(cover.image_url):
                    targets.append((series, cover))

        if not targets:
            self.stdout.write("削除対象の仮表紙キャッシュはありませんでした。")
            return

        self.stdout.write(f"--- 削除候補: {len(targets)} 件 ---")
        for series, cover in targets:
            self.stdout.write(
                f"  series={series.title!r} user={series.user.username} "
                f"vol={cover.volume_number} id={cover.id}"
            )
            self.stdout.write(f"    url={cover.image_url}")

        if not commit:
            self.stdout.write(
                "\n(dry-run) 実削除するには --commit を付けてください。"
            )
            return

        deleted, _ = VolumeCover.objects.filter(
            id__in=[c.id for _, c in targets]
        ).delete()
        self.stdout.write(self.style.SUCCESS(f"\n削除しました: {deleted} 件"))
