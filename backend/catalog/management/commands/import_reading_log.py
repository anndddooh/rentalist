"""外部の読書記録（例: サービス終了した Readee のエクスポート）を読破記録として取り込む。

入力は JSON（ファイルパス、または "-" で標準入力）:

    {"series": [
      {"title": "NARUTO -ナルト-",          # 新規作成時のシリーズ名
       "aliases": ["NARUTO", "ナルト"],      # 既存シリーズとの照合にだけ使う別名
       "author": "岸本斉史", "publisher": "集英社",
       "total_volumes": 72,                 # 完結済みなら全巻数、不明なら null
       "volumes": [{"number": 1, "read_at": "2020-03-28T22:11:00+09:00"}, ...]}
    ]}

挙動:
  - 既存シリーズとの照合は、タイトル・別名を正規化（NFKC・大小文字・空白/記号除去）
    して完全一致したものだけ。似た名前（部分一致）の既存シリーズは「要確認」として
    表示するだけで、自動では統合しない（重複作成の見落とし防止のため dry-run で確認する）。
  - 既存シリーズの巻: 読破記録があれば日付を入力値で上書き、無ければ追加する。
    入力に無い巻の記録には触れない（Rentalist で付けた記録を壊さない）。
    既存シリーズのステータス・全巻数は変更しない（current_volume の再計算のみ）。
  - 新規シリーズ: total_volumes があり全巻読んでいれば「読破済み」、それ以外は「進行中」。
  - --covers: 取り込んだシリーズの 1 巻と次に借りる巻（読破済みは 1 巻のみ）の表紙を
    楽天から取得して保存する。既に表紙がある巻・発売前の仮表紙はスキップ。

デフォルトは dry-run（DB を変更しない）。反映には --commit を付ける。

例:
  python manage.py import_reading_log data.json --user hironori
  python manage.py import_reading_log - --user hironori --commit --covers < data.json
"""
import json
import re
import sys
import unicodedata

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from catalog.models import RentalHistory, Series, VolumeCover
from catalog.services import rakuten

_STRIP_CHARS = re.compile(
    r"[\s・･·!！?？、。,.:：;；'\"“”‘’「」『』【】()（）\[\]〈〉<>＜＞~〜～\-‐–—×/／]"
)


def normalize_title(title):
    """照合用にタイトルを正規化する（表記ゆれ・空白・記号の差を吸収）。"""
    text = unicodedata.normalize("NFKC", title or "").lower()
    return _STRIP_CHARS.sub("", text)


class Command(BaseCommand):
    help = "外部の読書記録 JSON を読破記録として取り込む（デフォルト dry-run）"

    def add_arguments(self, parser):
        parser.add_argument("source", help='入力 JSON のパス。"-" で標準入力')
        parser.add_argument("--user", required=True, help="取り込み先のユーザー名")
        parser.add_argument("--commit", action="store_true", help="DB に反映する")
        parser.add_argument(
            "--covers", action="store_true",
            help="--commit 時に 1 巻と次に借りる巻の表紙を楽天から取得する",
        )

    # ------------------------------------------------------------------ 入出力
    def _load(self, source):
        try:
            if source == "-":
                data = json.load(sys.stdin)
            else:
                with open(source, encoding="utf-8") as f:
                    data = json.load(f)
        except (OSError, ValueError) as exc:
            raise CommandError(f"入力 JSON を読めません: {exc}") from exc
        entries = data.get("series") if isinstance(data, dict) else None
        if not isinstance(entries, list):
            raise CommandError('入力 JSON には "series" 配列が必要です。')
        for i, entry in enumerate(entries):
            if not entry.get("title"):
                raise CommandError(f"series[{i}] に title がありません。")
            volumes = {}
            for v in entry.get("volumes", []):
                number = int(v["number"])
                read_at = parse_datetime(v["read_at"])
                if number < 1 or read_at is None or read_at.tzinfo is None:
                    raise CommandError(
                        f"{entry['title']}: 巻 {v} が不正です（巻数は1以上、"
                        "read_at はタイムゾーン付き ISO 8601）。"
                    )
                volumes[number] = read_at  # 同じ巻の重複は後勝ち
            entry["_volumes"] = volumes
        return entries

    # ------------------------------------------------------------------ 計画
    def _plan(self, user, entries):
        existing = list(Series.objects.filter(user=user).prefetch_related("histories"))
        by_key = {}
        for s in existing:
            by_key.setdefault(normalize_title(s.title), []).append(s)

        plans, errors = [], []
        claimed = {}
        for entry in entries:
            keys = {normalize_title(t) for t in [entry["title"], *entry.get("aliases", [])]}
            keys.discard("")
            matches = {s.pk: s for k in keys for s in by_key.get(k, [])}
            if len(matches) > 1:
                names = "、".join(s.title for s in matches.values())
                errors.append(f"{entry['title']}: 既存シリーズが複数一致します（{names}）")
                continue
            series = next(iter(matches.values()), None)
            if series is not None:
                if series.pk in claimed:
                    errors.append(
                        f"{entry['title']}: 既存「{series.title}」は"
                        f"「{claimed[series.pk]}」にも一致しています"
                    )
                    continue
                claimed[series.pk] = entry["title"]
            near = []
            if series is None:
                for s in existing:
                    k = normalize_title(s.title)
                    if len(k) >= 2 and any(len(x) >= 2 and (k in x or x in k) for x in keys):
                        near.append(s.title)
            plans.append({"entry": entry, "series": series, "near": near})
        return existing, plans, errors

    # ------------------------------------------------------------------ 実行
    def handle(self, **options):
        User = get_user_model()
        try:
            user = User.objects.get(username=options["user"])
        except User.DoesNotExist as exc:
            raise CommandError(f"ユーザー {options['user']} が見つかりません。") from exc

        entries = self._load(options["source"])
        existing, plans, errors = self._plan(user, entries)
        self._report(existing, plans, errors)

        if errors:
            raise CommandError("照合エラーがあるため中止しました。入力を直して再実行してください。")
        if not options["commit"]:
            self.stdout.write(self.style.WARNING("dry-run のため DB は変更していません（--commit で反映）。"))
            return

        touched = self._apply(user, plans)
        self.stdout.write(self.style.SUCCESS(f"反映しました: {len(touched)} シリーズ"))
        if options["covers"]:
            self._fetch_covers(touched)

    def _apply(self, user, plans):
        touched = []
        with transaction.atomic():
            for plan in plans:
                entry, series = plan["entry"], plan["series"]
                if series is None:
                    series = Series.objects.create(
                        user=user,
                        title=entry["title"],
                        author=entry.get("author", "")[:200],
                        publisher=entry.get("publisher", "")[:200],
                        total_volumes=entry.get("total_volumes") or None,
                    )
                current = {h.volume_number: h for h in series.histories.all()}
                to_update, to_create = [], []
                for number, read_at in entry["_volumes"].items():
                    h = current.get(number)
                    if h is None:
                        to_create.append(RentalHistory(
                            user=user, series=series, volume_number=number, rented_at=read_at,
                        ))
                    elif h.rented_at != read_at:
                        h.rented_at = read_at
                        to_update.append(h)
                RentalHistory.objects.bulk_create(to_create)
                RentalHistory.objects.bulk_update(to_update, ["rented_at"])
                series.recalculate_current_volume()
                touched.append(series)
        return touched

    def _fetch_covers(self, series_list):
        fetched = skipped = missing = 0
        for series in series_list:
            # next_volume はカートを参照するため最新状態で取り直す
            series = Series.objects.prefetch_related("cart_items").get(pk=series.pk)
            volumes = [1]
            nxt = series.next_volume
            if (
                series.status != Series.STATUS_COMPLETED
                and nxt != 1
                and not (series.total_volumes and nxt > series.total_volumes)
            ):
                volumes.append(nxt)
            have = set(series.covers.values_list("volume_number", flat=True))
            for volume in volumes:
                if volume in have:
                    skipped += 1
                    continue
                url, provisional = rakuten.find_volume_cover(series.title, volume)
                if url is None or provisional:
                    missing += 1
                    self.stdout.write(f"  表紙なし: {series.title} {volume}巻")
                    continue
                VolumeCover.objects.create(
                    series=series, volume_number=volume, image_url=url,
                    source=VolumeCover.SOURCE_RAKUTEN,
                )
                fetched += 1
        self.stdout.write(self.style.SUCCESS(
            f"表紙: 取得 {fetched} / 既存スキップ {skipped} / 見つからず {missing}"
        ))

    # ------------------------------------------------------------------ 表示
    def _report(self, existing, plans, errors):
        w = self.stdout.write
        matched = [p for p in plans if p["series"] is not None]
        new = [p for p in plans if p["series"] is None]

        w(f"=== 既存シリーズへの反映: {len(matched)} シリーズ ===")
        for p in matched:
            series, vols = p["series"], p["entry"]["_volumes"]
            current = {h.volume_number: h.rented_at for h in series.histories.all()}
            add = sorted(set(vols) - set(current))
            upd = sorted(n for n in vols if n in current and current[n] != vols[n])
            untouched = sorted(set(current) - set(vols))
            line = f"- {series.title}（入力名: {p['entry']['title']}）: 追加 {len(add)}巻 / 日付更新 {len(upd)}巻"
            if add:
                line += f" / 追加巻 {_ranges(add)}"
            w(line)
            if untouched:
                dates = sorted({current[n].date().isoformat() for n in untouched})
                w(f"    入力に無い既存記録 {_ranges(untouched)}（日付: {', '.join(dates[:5])}"
                  f"{' …' if len(dates) > 5 else ''}）→ 変更しません")

        w(f"=== 新規作成: {len(new)} シリーズ ===")
        for p in new:
            e = p["entry"]
            vols = sorted(e["_volumes"])
            total = e.get("total_volumes")
            done = bool(total and vols and max(vols) >= total)
            w(f"- {e['title']}: {_ranges(vols)}（{len(vols)}巻）"
              f"{f' 全{total}巻' if total else ''} → {'読破済み' if done else '進行中'}")
            if p["near"]:
                w(self.style.WARNING(f"    ⚠ 似た既存シリーズ: {'、'.join(p['near'])}（同じ作品なら aliases に追加）"))

        used = {p["series"].pk for p in matched}
        rest = [s.title for s in existing if s.pk not in used]
        w(f"=== 入力と一致しなかった既存シリーズ: {len(rest)} 件 ===")
        for t in sorted(rest):
            w(f"- {t}")

        for e in errors:
            w(self.style.ERROR(f"✗ {e}"))


def _ranges(numbers):
    """[1,2,3,5,7,8] → '1-3,5,7-8'"""
    out, start, prev = [], None, None
    for n in sorted(numbers):
        if start is None:
            start = prev = n
        elif n == prev + 1:
            prev = n
        else:
            out.append(f"{start}-{prev}" if start != prev else f"{start}")
            start = prev = n
    if start is not None:
        out.append(f"{start}-{prev}" if start != prev else f"{start}")
    return ",".join(out)
