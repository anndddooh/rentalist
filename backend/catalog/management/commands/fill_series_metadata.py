"""シリーズの空いている書誌項目（作者ふりがな・レーベル等）を楽天検索で埋める。

シリーズ追加画面で候補を選んだときと同じ情報源（rakuten.search_series）を使う。
外部の読書記録から一括で作ったシリーズは、作者ふりがな・レーベルが空になるため。

- 対象は、作者・作者ふりがな・出版社・レーベルのどれかが空のシリーズ。
- 検索候補のうちシリーズ名が一致するもの（表記ゆれ・副題付きは許容）だけを使う。
  一致する候補が無いシリーズは推測で埋めず「見つからず」として表示する。
- 既に入っている値は上書きしない（空の項目だけ埋める）。
- デフォルトは dry-run。反映には --commit を付ける。

例:
  python manage.py fill_series_metadata --user hironori
  python manage.py fill_series_metadata --user hironori --commit
"""
import unicodedata

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from catalog.models import Series
from catalog.services import rakuten

# (Series のフィールド, 検索候補のキー)。レーベルは紙の seriesName（追加画面と同じ）
FIELDS = (
    ("author", "author"),
    ("author_kana", "author_kana"),
    ("publisher", "publisher"),
    ("magazine_label", "series_name"),
)


def pick_candidate(title, candidates):
    """候補からシリーズ名が一致するものを選ぶ。完全一致 → 副題付き一致の順。

    同じキーなら紙（レーベル・ふりがながある）を優先する（search_series が並べ済み）。
    """
    key = rakuten._series_key(title)
    exact = [c for c in candidates if rakuten._series_key(c["title"]) == key]
    if exact:
        return exact[0]
    # 「銀魂」⇔「銀魂ーぎんたまー」のような副題違い。区切り文字を見るので記号は残して比べる
    name = unicodedata.normalize("NFKC", title).strip()
    for c in candidates:
        other = unicodedata.normalize("NFKC", c["title"]).strip()
        if rakuten._series_stem_matches(other, name) or rakuten._series_stem_matches(name, other):
            return c
    return None


class Command(BaseCommand):
    help = "空いている作者ふりがな・レーベル等を楽天検索で埋める（デフォルト dry-run）"

    def add_arguments(self, parser):
        parser.add_argument("--user", required=True, help="対象ユーザー名")
        parser.add_argument("--commit", action="store_true", help="DB に反映する")

    def handle(self, **options):
        if not rakuten._is_configured():
            raise CommandError("楽天 API の認証情報が未設定です。")
        User = get_user_model()
        try:
            user = User.objects.get(username=options["user"])
        except User.DoesNotExist as exc:
            raise CommandError(f"ユーザー {options['user']} が見つかりません。") from exc

        blank = Q()
        for field, _ in FIELDS:
            blank |= Q(**{field: ""})
        targets = list(Series.objects.filter(user=user).filter(blank).order_by("title"))
        self.stdout.write(f"対象: {len(targets)} シリーズ")

        filled, not_found, still_blank = 0, [], []
        for series in targets:
            cand = pick_candidate(series.title, rakuten.search_series(series.title))
            if cand is None:
                not_found.append(series.title)
                continue
            changes = {
                field: (cand.get(key) or "").strip()[:200]
                for field, key in FIELDS
                if not getattr(series, field) and (cand.get(key) or "").strip()
            }
            missing = [f for f, _ in FIELDS if not getattr(series, f) and f not in changes]
            if missing:
                still_blank.append(f"{series.title}（{', '.join(missing)}）")
            if not changes:
                continue
            desc = " / ".join(f"{k}={v}" for k, v in changes.items())
            self.stdout.write(f"- {series.title}（候補: {cand['title']}）: {desc}")
            if options["commit"]:
                for field, value in changes.items():
                    setattr(series, field, value)
                series.save(update_fields=[*changes, "updated_at"])
            filled += 1

        self.stdout.write(f"=== 埋めた: {filled} シリーズ ===")
        self.stdout.write(f"=== 候補が見つからず: {len(not_found)} シリーズ ===")
        for t in not_found:
            self.stdout.write(f"- {t}")
        self.stdout.write(f"=== 候補はあったが空のまま残る項目: {len(still_blank)} シリーズ ===")
        for t in still_blank:
            self.stdout.write(f"- {t}")
        if not options["commit"]:
            self.stdout.write(self.style.WARNING("dry-run のため DB は変更していません（--commit で反映）。"))
