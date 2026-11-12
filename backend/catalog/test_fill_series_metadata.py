"""fill_series_metadata 管理コマンドのテスト。"""
from io import StringIO
from unittest import mock

import pytest
from django.contrib.auth.models import User
from django.core.management import call_command

from catalog.models import Series

pytestmark = pytest.mark.django_db


def _cand(title, **kw):
    return {"title": title, "author": "", "author_kana": "", "publisher": "",
            "series_name": "", **kw}


@pytest.fixture
def alice(settings):
    settings.RAKUTEN_APP_ID = "x"
    settings.RAKUTEN_ACCESS_KEY = "y"
    return User.objects.create_user(username="alice", password="x")


def _run(*args):
    out = StringIO()
    call_command("fill_series_metadata", "--user", "alice", *args, stdout=out)
    return out.getvalue()


def test_fills_only_blank_fields_from_matching_candidate(alice):
    s = Series.objects.create(user=alice, title="鬼滅の刃", author="吾峠呼世晴", publisher="集英社")
    results = [
        _cand("鬼滅の刃 外伝", author_kana="ゴトウゲ", series_name="違う"),
        _cand("鬼滅の刃", author="別人", author_kana="ゴトウゲコヨハル",
              publisher="別社", series_name="ジャンプコミックス"),
    ]
    with mock.patch("catalog.services.rakuten.search_series", return_value=results):
        _run("--commit")
    s.refresh_from_db()
    assert s.author_kana == "ゴトウゲコヨハル"
    assert s.magazine_label == "ジャンプコミックス"
    assert s.author == "吾峠呼世晴"  # 既存値は上書きしない
    assert s.publisher == "集英社"


def test_accepts_subtitle_variant(alice):
    s = Series.objects.create(user=alice, title="銀魂")
    with mock.patch("catalog.services.rakuten.search_series",
                    return_value=[_cand("銀魂ーぎんたまー", author_kana="ソラチ")]):
        _run("--commit")
    s.refresh_from_db()
    assert s.author_kana == "ソラチ"


def test_unrelated_candidate_is_not_used_and_dry_run_keeps_db(alice):
    s = Series.objects.create(user=alice, title="銀魂")
    with mock.patch("catalog.services.rakuten.search_series",
                    return_value=[_cand("銀魂学園", author_kana="X")]):
        output = _run("--commit")
    assert "候補が見つからず: 1" in output
    s.refresh_from_db()
    assert s.author_kana == ""

    s2 = Series.objects.create(user=alice, title="キングダム")
    with mock.patch("catalog.services.rakuten.search_series",
                    return_value=[_cand("キングダム", author_kana="ハラ")]):
        assert "dry-run" in _run()
    s2.refresh_from_db()
    assert s2.author_kana == ""


def test_complete_series_are_not_searched(alice):
    Series.objects.create(user=alice, title="完備", author="a", author_kana="b",
                          publisher="c", magazine_label="d")
    with mock.patch("catalog.services.rakuten.search_series") as search:
        _run()
    search.assert_not_called()
