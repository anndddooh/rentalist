"""「中断」ステータスとシリーズ重複登録チェックのテスト。"""
from unittest import mock

import pytest

from catalog.models import Series

pytestmark = pytest.mark.django_db


def make_series(user, **kwargs):
    defaults = dict(title="テスト漫画", status=Series.STATUS_ACTIVE)
    defaults.update(kwargs)
    return Series.objects.create(user=user, **defaults)


def test_create_duplicate_title_is_rejected_with_existing_status(api, user):
    make_series(user, title="ＯＮＥ　ＰＩＥＣＥ", status=Series.STATUS_DROPPED)
    resp = api.post("/api/series/", {"title": "one piece"}, format="json")
    assert resp.status_code == 400
    assert "既に登録されています（中断）" in resp.data["title"][0]
    assert Series.objects.count() == 1


def test_duplicate_check_is_per_user(api, other_user):
    make_series(other_user, title="キングダム")
    resp = api.post("/api/series/", {"title": "キングダム"}, format="json")
    assert resp.status_code == 201


def test_update_keeps_own_title_but_rejects_renaming_to_other(api, user):
    a = make_series(user, title="銀魂")
    make_series(user, title="鬼滅の刃")
    assert api.patch(f"/api/series/{a.id}/", {"title": "銀魂", "favorite_score": 5},
                     format="json").status_code == 200
    resp = api.patch(f"/api/series/{a.id}/", {"title": "鬼滅の刃"}, format="json")
    assert resp.status_code == 400


def test_search_marks_candidates_already_registered(api, user):
    owned = make_series(user, title="NARUTO -ナルト-", status=Series.STATUS_WISHLIST)
    with mock.patch("catalog.services.rakuten.search_series", return_value=[
        {"title": "NARUTO－ナルト－"}, {"title": "BORUTO"},
    ]):
        resp = api.get("/api/series/search/?q=NARUTO")
    assert resp.data[0]["existing_series"] == {
        "id": owned.id, "title": "NARUTO -ナルト-", "status": "wishlist",
    }
    assert resp.data[1]["existing_series"] is None


def test_dropped_series_can_be_set_and_is_excluded_from_active_list(api, user):
    s = make_series(user, title="ゴールデンカムイ")
    assert api.patch(f"/api/series/{s.id}/", {"status": "dropped"},
                     format="json").status_code == 200
    assert api.get("/api/series/?status=active").data["count"] == 0
    assert api.get("/api/series/?status=dropped").data["count"] == 1


def test_dropped_stays_dropped_even_if_all_volumes_read(api, user):
    s = make_series(user, status=Series.STATUS_DROPPED, total_volumes=1, current_volume=1)
    s.recalculate_current_volume()
    s.refresh_from_db()
    assert s.status == Series.STATUS_DROPPED


def test_checkout_resumes_dropped_series(api, user):
    s = make_series(user, status=Series.STATUS_DROPPED)
    api.post("/api/cart/", {"series_id": s.id}, format="json")
    api.post("/api/cart/checkout/", {}, format="json")
    s.refresh_from_db()
    assert s.status == Series.STATUS_ACTIVE
    assert s.current_volume == 1
