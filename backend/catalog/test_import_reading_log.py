"""import_reading_log 管理コマンドのテスト。"""
import datetime
import json
from io import StringIO
from unittest import mock

import pytest
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError

from catalog.models import RentalHistory, Series, VolumeCover

pytestmark = pytest.mark.django_db

JST = datetime.timezone(datetime.timedelta(hours=9))


def _dt(day, hour=12):
    return datetime.datetime(2020, 4, day, hour, 0, tzinfo=JST)


def _vol(number, day):
    return {"number": number, "read_at": _dt(day).isoformat()}


@pytest.fixture
def alice():
    return User.objects.create_user(username="alice", password="x")


def _run(tmp_path, payload, *args):
    path = tmp_path / "in.json"
    path.write_text(json.dumps({"series": payload}, ensure_ascii=False), encoding="utf-8")
    out = StringIO()
    call_command("import_reading_log", str(path), "--user", "alice", *args, stdout=out)
    return out.getvalue()


def test_dry_run_changes_nothing(tmp_path, alice):
    output = _run(tmp_path, [{"title": "NARUTO", "volumes": [_vol(1, 1)]}])
    assert "dry-run" in output
    assert "新規作成: 1 シリーズ" in output
    assert Series.objects.count() == 0


def test_creates_new_series_and_completes_when_all_read(tmp_path, alice):
    _run(tmp_path, [
        {"title": "SLAM DUNK", "author": "井上雄彦", "publisher": "集英社",
         "total_volumes": 2, "volumes": [_vol(1, 1), _vol(2, 2)]},
        {"title": "キングダム", "volumes": [_vol(1, 3)]},
    ], "--commit")
    slam = Series.objects.get(title="SLAM DUNK")
    assert slam.status == Series.STATUS_COMPLETED
    assert slam.current_volume == 2
    assert slam.author == "井上雄彦"
    assert slam.histories.get(volume_number=2).rented_at == _dt(2)
    kingdom = Series.objects.get(title="キングダム")
    assert kingdom.status == Series.STATUS_ACTIVE
    assert kingdom.total_volumes is None


def test_matches_existing_by_normalized_title_and_alias(tmp_path, alice):
    existing = Series.objects.create(user=alice, title="ＤＲＡＧＯＮ　ＢＡＬＬ")
    naruto = Series.objects.create(user=alice, title="ナルト")
    _run(tmp_path, [
        {"title": "dragon ball", "volumes": [_vol(1, 1)]},
        {"title": "NARUTO -ナルト-", "aliases": ["ナルト"], "volumes": [_vol(1, 2)]},
    ], "--commit")
    assert Series.objects.count() == 2
    assert existing.histories.count() == 1
    assert naruto.histories.count() == 1


def test_existing_histories_get_dates_overwritten_and_others_untouched(tmp_path, alice):
    series = Series.objects.create(user=alice, title="鬼滅の刃", status=Series.STATUS_ACTIVE)
    later = datetime.datetime(2026, 5, 1, 12, tzinfo=JST)
    RentalHistory.objects.create(user=alice, series=series, volume_number=1, rented_at=later)
    RentalHistory.objects.create(user=alice, series=series, volume_number=3, rented_at=later)

    output = _run(tmp_path, [
        {"title": "鬼滅の刃", "total_volumes": 99, "volumes": [_vol(1, 1), _vol(2, 2)]},
    ], "--commit")

    assert "入力に無い既存記録 3" in output
    series.refresh_from_db()
    assert series.histories.get(volume_number=1).rented_at == _dt(1)
    assert series.histories.get(volume_number=2).rented_at == _dt(2)
    assert series.histories.get(volume_number=3).rented_at == later
    assert series.current_volume == 3
    # 既存シリーズの全巻数は入力値で上書きしない
    assert series.total_volumes is None


def test_near_match_is_warned_not_merged(tmp_path, alice):
    Series.objects.create(user=alice, title="ザ・ファブル")
    output = _run(tmp_path, [
        {"title": "ザ・ファブル The second contact", "volumes": [_vol(1, 1)]},
    ])
    assert "似た既存シリーズ: ザ・ファブル" in output


def test_ambiguous_match_aborts(tmp_path, alice):
    Series.objects.create(user=alice, title="銀魂")
    Series.objects.create(user=alice, title="銀 魂")
    with pytest.raises(CommandError):
        _run(tmp_path, [{"title": "銀魂", "volumes": [_vol(1, 1)]}], "--commit")
    assert RentalHistory.objects.count() == 0


def test_other_users_series_are_ignored(tmp_path, alice):
    bob = User.objects.create_user(username="bob", password="x")
    Series.objects.create(user=bob, title="ONE PIECE")
    _run(tmp_path, [{"title": "ONE PIECE", "volumes": [_vol(1, 1)]}], "--commit")
    assert Series.objects.filter(user=alice, title="ONE PIECE").exists()
    assert not RentalHistory.objects.filter(user=bob).exists()


def test_naive_datetime_is_rejected(tmp_path, alice):
    with pytest.raises(CommandError):
        _run(tmp_path, [{"title": "X", "volumes": [{"number": 1, "read_at": "2020-04-01T12:00:00"}]}])


def test_covers_first_and_next_volume_only_for_active(tmp_path, alice):
    calls = []

    def fake(title, volume):
        calls.append((title, volume))
        return f"https://example.com/{volume}.jpg", False

    with mock.patch("catalog.services.rakuten.find_volume_cover", side_effect=fake):
        _run(tmp_path, [
            {"title": "進行中", "volumes": [_vol(1, 1), _vol(2, 2)]},
            {"title": "完結", "total_volumes": 2, "volumes": [_vol(1, 1), _vol(2, 2)]},
        ], "--commit", "--covers")

    assert sorted(calls) == [("完結", 1), ("進行中", 1), ("進行中", 3)]
    active = Series.objects.get(title="進行中")
    assert set(active.covers.values_list("volume_number", flat=True)) == {1, 3}


def test_covers_skip_existing_and_provisional(tmp_path, alice):
    series = Series.objects.create(user=alice, title="既存")
    VolumeCover.objects.create(series=series, volume_number=1, image_url="https://e/1.jpg",
                               source=VolumeCover.SOURCE_RAKUTEN)
    with mock.patch(
        "catalog.services.rakuten.find_volume_cover",
        return_value=("https://e/x.gif", True),
    ) as fake:
        _run(tmp_path, [{"title": "既存", "volumes": [_vol(1, 1)]}], "--commit", "--covers")
    fake.assert_called_once_with("既存", 2)
    assert series.covers.count() == 1


def test_payload_option_accepts_gzip_base64(alice):
    import base64
    import gzip

    raw = json.dumps({"series": [{"title": "NARUTO", "volumes": [_vol(1, 1)]}]})
    payload = base64.b64encode(gzip.compress(raw.encode("utf-8"))).decode()
    call_command("import_reading_log", "--payload", payload, "--user", "alice", "--commit",
                 stdout=StringIO())
    assert Series.objects.get(title="NARUTO").histories.count() == 1


def test_source_and_payload_are_exclusive(alice):
    with pytest.raises(CommandError):
        call_command("import_reading_log", "--user", "alice", stdout=StringIO())


def test_covers_fall_back_to_isbn_when_title_lookup_fails(tmp_path, alice):
    with mock.patch(
        "catalog.services.rakuten.find_volume_cover", return_value=(None, False)
    ), mock.patch(
        "catalog.services.rakuten.find_cover_by_isbn",
        return_value=("https://e/isbn.jpg", False),
    ) as by_isbn:
        _run(tmp_path, [{
            "title": "版違い", "total_volumes": 1,
            "volumes": [{**_vol(1, 1), "isbn": "9784000000001"}],
        }], "--commit", "--covers")
    by_isbn.assert_called_once_with("9784000000001")
    cover = Series.objects.get(title="版違い").covers.get()
    assert cover.volume_number == 1 and cover.image_url == "https://e/isbn.jpg"


def test_wishlist_series_becomes_active_when_volumes_imported(tmp_path, alice):
    wish = Series.objects.create(user=alice, title="シマウマ", status=Series.STATUS_WISHLIST)
    done = Series.objects.create(user=alice, title="完結作", status=Series.STATUS_WISHLIST,
                                 total_volumes=2)
    output = _run(tmp_path, [
        {"title": "シマウマ", "volumes": [_vol(1, 1), _vol(3, 3)]},
        {"title": "完結作", "volumes": [_vol(1, 1), _vol(2, 2)]},
    ], "--commit")
    assert "いつか読みたい → 進行中" in output
    wish.refresh_from_db()
    done.refresh_from_db()
    assert wish.status == Series.STATUS_ACTIVE
    assert done.status == Series.STATUS_COMPLETED
