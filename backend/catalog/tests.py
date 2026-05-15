"""catalog アプリのテスト。"""
import pytest

from catalog.models import RentalHistory, Series

pytestmark = pytest.mark.django_db


def make_series(user, **kwargs):
    defaults = dict(title="テスト漫画", status=Series.STATUS_ACTIVE)
    defaults.update(kwargs)
    return Series.objects.create(user=user, **defaults)


def test_create_series(api):
    resp = api.post("/api/series/", {"title": "ワンピース", "author": "尾田"}, format="json")
    assert resp.status_code == 201
    assert resp.data["title"] == "ワンピース"
    assert resp.data["next_volume"] == 1  # current 0 + cart 0 + 1


def test_series_scoped_to_user(api, other_user):
    """他ユーザーのシリーズは一覧に出ない。"""
    make_series(other_user, title="他人の漫画")
    resp = api.get("/api/series/")
    assert resp.status_code == 200
    assert resp.data["count"] == 0


def test_cart_add_uses_next_volume_and_increments(api, user):
    series = make_series(user)
    first = api.post("/api/cart/", {"series_id": series.id}, format="json")
    assert first.status_code == 201
    assert first.data["volume_number"] == 1
    second = api.post("/api/cart/", {"series_id": series.id}, format="json")
    assert second.data["volume_number"] == 2  # 同シリーズ連番


def test_checkout_creates_history_and_advances_current_volume(api, user):
    series = make_series(user)
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    resp = api.post("/api/cart/checkout/", {}, format="json")
    assert resp.status_code == 200
    assert resp.data["count"] == 2
    series.refresh_from_db()
    assert series.current_volume == 2
    assert RentalHistory.objects.filter(series=series).count() == 2
    assert api.get("/api/cart/").data["count"] == 0


def test_checkout_empty_cart_fails(api):
    resp = api.post("/api/cart/checkout/", {}, format="json")
    assert resp.status_code == 400


def test_history_delete_rolls_back_current_volume(api, user):
    series = make_series(user)
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    api.post("/api/cart/checkout/", {}, format="json")
    history = RentalHistory.objects.filter(series=series).order_by("volume_number")
    # 2巻の履歴を削除 → current_volume は 1 に戻る
    api.delete(f"/api/history/{history[1].id}/")
    series.refresh_from_db()
    assert series.current_volume == 1


def test_manual_history_add(api, user):
    series = make_series(user)
    resp = api.post(
        "/api/history/",
        {"series_id": series.id, "volume_number": 8, "rented_at": "2025-01-01T10:00:00Z"},
        format="json",
    )
    assert resp.status_code == 201
    series.refresh_from_db()
    assert series.current_volume == 8


def test_manual_history_duplicate_rejected(api, user):
    series = make_series(user)
    payload = {"series_id": series.id, "volume_number": 3, "rented_at": "2025-01-01T10:00:00Z"}
    assert api.post("/api/history/", payload, format="json").status_code == 201
    assert api.post("/api/history/", payload, format="json").status_code == 400


def test_completion_auto_transition(api, user):
    """total_volumes に達したら completed に自動遷移する。"""
    series = make_series(user, total_volumes=2)
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    api.post("/api/cart/checkout/", {}, format="json")
    series.refresh_from_db()
    assert series.status == Series.STATUS_COMPLETED
    # 履歴削除で条件を外れたら active に戻る
    last = RentalHistory.objects.filter(series=series).order_by("-volume_number").first()
    api.delete(f"/api/history/{last.id}/")
    series.refresh_from_db()
    assert series.status == Series.STATUS_ACTIVE


def test_shop_availability_update_and_filter(api, user):
    series = make_series(user, title="絞り込み対象")
    other = make_series(user, title="絞り込み対象外")
    shop = api.post("/api/shops/", {"name": "TSUTAYA渋谷店"}, format="json").data

    # series を「貸出あり」に
    resp = api.put(
        f"/api/series/{series.id}/availability/",
        {"shop_id": shop["id"], "status": "available"},
        format="json",
    )
    assert resp.status_code == 200

    # shop 指定で一覧 → availability_status が注釈される
    listed = api.get(f"/api/series/?shop={shop['id']}").data["results"]
    by_id = {s["id"]: s for s in listed}
    assert by_id[series.id]["availability_status"] == "available"
    assert by_id[other.id]["availability_status"] == "unknown"  # レコード不在


def test_shop_availability_unknown_deletes_record(api, user):
    series = make_series(user)
    shop = api.post("/api/shops/", {"name": "店"}, format="json").data
    api.put(
        f"/api/series/{series.id}/availability/",
        {"shop_id": shop["id"], "status": "unavailable"},
        format="json",
    )
    # unknown に戻す → レコード削除
    api.put(
        f"/api/series/{series.id}/availability/",
        {"shop_id": shop["id"], "status": "unknown"},
        format="json",
    )
    listed = api.get(f"/api/series/?shop={shop['id']}").data["results"]
    assert listed[0]["availability_status"] == "unknown"


def test_series_search_returns_candidates(api):
    """楽天キー未設定でもモック候補が返る。"""
    resp = api.get("/api/series/search/?q=NARUTO")
    assert resp.status_code == 200
    assert len(resp.data) >= 1
    assert "title" in resp.data[0]


def test_series_delete_cascades(api, user):
    series = make_series(user)
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    api.delete(f"/api/series/{series.id}/")
    assert Series.objects.filter(id=series.id).count() == 0
    assert api.get("/api/cart/").data["count"] == 0
