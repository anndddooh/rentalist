"""catalog アプリのテスト。"""
import pytest
from django.test import override_settings

from catalog.models import RentalHistory, RentalShop, Series, VolumeCover

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


def test_cart_clear_empties_without_advancing_volume(api, user):
    """全削除はカートを空にするだけで current_volume は繰り上げない。"""
    series = make_series(user)
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    resp = api.post("/api/cart/clear/", {}, format="json")
    assert resp.status_code == 200
    assert resp.data["count"] == 2
    assert api.get("/api/cart/").data["count"] == 0
    series.refresh_from_db()
    assert series.current_volume == 0
    assert RentalHistory.objects.filter(series=series).count() == 0


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


def test_setting_total_volumes_later_triggers_completion(api, user):
    """先に巻数が進んだ後、total_volumes を設定したら completed に遷移する。"""
    series = make_series(user)
    for vol in (1, 2, 3):
        api.post(
            "/api/history/",
            {"series_id": series.id, "volume_number": vol, "rented_at": "2025-01-01T00:00:00Z"},
            format="json",
        )
    series.refresh_from_db()
    assert series.status == Series.STATUS_ACTIVE  # まだ total_volumes が無い
    resp = api.patch(f"/api/series/{series.id}/", {"total_volumes": 3}, format="json")
    assert resp.status_code == 200
    series.refresh_from_db()
    assert series.status == Series.STATUS_COMPLETED


def test_checkout_reports_newly_completed_series(api, user):
    """確定で読破に到達したシリーズが completed_series で返る。"""
    series = make_series(user, total_volumes=2)
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    resp = api.post("/api/cart/checkout/", {}, format="json")
    assert resp.status_code == 200
    titles = [s["title"] for s in resp.data["completed_series"]]
    assert series.title in titles


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


@override_settings(RAKUTEN_APP_ID="", RAKUTEN_ACCESS_KEY="")
def test_series_search_returns_candidates(api):
    """認証情報が無いときはモック候補が返る（実APIを叩かない）。"""
    resp = api.get("/api/series/search/?q=NARUTO")
    assert resp.status_code == 200
    assert len(resp.data) >= 1
    assert "title" in resp.data[0]


def test_reading_stats_aggregates_by_period(api, user):
    """読書統計が月・年ごとに読破巻数を集計して返す。"""
    series = make_series(user)
    for vol, date in [
        (1, "2025-01-10"),
        (2, "2025-01-20"),
        (3, "2025-03-05"),
        (4, "2026-02-15"),
    ]:
        api.post(
            "/api/history/",
            {"series_id": series.id, "volume_number": vol,
             "rented_at": f"{date}T03:00:00Z"},
            format="json",
        )
    resp = api.get("/api/history/stats/")
    assert resp.status_code == 200
    assert resp.data["total"] == 4
    monthly = {r["period"]: r["count"] for r in resp.data["monthly"]}
    assert monthly == {"2025-01": 2, "2025-03": 1, "2026-02": 1}
    yearly = {r["period"]: r["count"] for r in resp.data["yearly"]}
    assert yearly == {"2025": 3, "2026": 1}


def test_series_delete_cascades(api, user):
    series = make_series(user)
    api.post("/api/cart/", {"series_id": series.id}, format="json")
    api.delete(f"/api/series/{series.id}/")
    assert Series.objects.filter(id=series.id).count() == 0
    assert api.get("/api/cart/").data["count"] == 0


def test_series_cover_get_returns_cached(api, user):
    """既にキャッシュされた表紙レコードがあればそれを返す（楽天は呼ばれない）。"""
    series = make_series(user)
    VolumeCover.objects.create(
        series=series,
        volume_number=1,
        image_url="https://example.com/cover.jpg",
        source=VolumeCover.SOURCE_RAKUTEN,
    )
    resp = api.get(f"/api/series/{series.id}/cover/?volume=1")
    assert resp.status_code == 200
    assert resp.data["volume_number"] == 1
    assert resp.data["resolved_url"] == "https://example.com/cover.jpg"


def test_series_cover_get_without_cache_returns_null_in_mock(api, user):
    """未キャッシュかつ楽天モック動作（_is_configured=False で None）の場合は resolved_url=null。"""
    series = make_series(user)
    resp = api.get(f"/api/series/{series.id}/cover/?volume=2")
    assert resp.status_code == 200
    assert resp.data["volume_number"] == 2
    assert resp.data["resolved_url"] is None
    # DB にも作成されない
    assert series.covers.filter(volume_number=2).count() == 0


def test_series_cover_get_defaults_to_next_volume(api, user):
    """volume パラメータ未指定時は next_volume を使う。"""
    series = make_series(user)
    resp = api.get(f"/api/series/{series.id}/cover/")
    assert resp.status_code == 200
    # current_volume=0 + cart=0 + 1 = 1
    assert resp.data["volume_number"] == 1


def test_series_cover_put_sets_manual_url(api, user):
    """PUT で手動URLを設定でき、レコードが作成される。"""
    series = make_series(user)
    resp = api.put(
        f"/api/series/{series.id}/cover/",
        {"volume_number": 1, "image_url": "https://example.com/manual.jpg"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["volume_number"] == 1
    assert resp.data["resolved_url"] == "https://example.com/manual.jpg"
    assert resp.data["source"] == VolumeCover.SOURCE_MANUAL
    assert series.covers.count() == 1


def test_series_cover_put_updates_existing(api, user):
    """既にレコードがある巻に対する PUT は update_or_create で更新される。"""
    series = make_series(user)
    VolumeCover.objects.create(
        series=series,
        volume_number=1,
        image_url="https://example.com/old.jpg",
        source=VolumeCover.SOURCE_RAKUTEN,
    )
    resp = api.put(
        f"/api/series/{series.id}/cover/",
        {"volume_number": 1, "image_url": "https://example.com/new.jpg"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["resolved_url"] == "https://example.com/new.jpg"
    assert resp.data["source"] == VolumeCover.SOURCE_MANUAL
    assert series.covers.count() == 1


def test_rental_shop_create_and_list_scoped_to_user(api, user, other_user):
    """ショップの作成・一覧がユーザーごとにスコープされる。"""
    RentalShop.objects.create(user=other_user, name="他人の店")

    create = api.post("/api/shops/", {"name": "TSUTAYA", "memo": "近所"}, format="json")
    assert create.status_code == 201
    assert create.data["name"] == "TSUTAYA"
    assert create.data["memo"] == "近所"

    listed = api.get("/api/shops/")
    assert listed.status_code == 200
    results = listed.data["results"]
    names = [s["name"] for s in results]
    assert "TSUTAYA" in names
    assert "他人の店" not in names
    # DB 上は他人の店も存在しているが API では返らない
    assert RentalShop.objects.filter(name="他人の店").count() == 1


def test_rental_shop_update_and_delete(api, user):
    """PATCH と DELETE が動作する。"""
    shop = api.post("/api/shops/", {"name": "店A"}, format="json").data
    upd = api.patch(f"/api/shops/{shop['id']}/", {"memo": "メモ追加"}, format="json")
    assert upd.status_code == 200
    assert upd.data["memo"] == "メモ追加"
    delete = api.delete(f"/api/shops/{shop['id']}/")
    assert delete.status_code == 204
    assert RentalShop.objects.filter(id=shop["id"]).count() == 0


def _populate_series_with_related(user, count):
    """count 件の Series と、各 series に紐づく cart/cover/availability を作成する。"""
    from catalog.models import CartItem, ShopAvailability

    Series.objects.filter(user=user).delete()
    shop = RentalShop.objects.create(user=user, name="店X")
    for i in range(count):
        s = make_series(user, title=f"S{i}")
        # prefetch 対象を実際に持たせる（キャッシュが効くかを意味のある形で検証する）
        CartItem.objects.create(user=user, series=s, volume_number=1)
        VolumeCover.objects.create(
            series=s, volume_number=1, image_url="https://example.com/c.jpg",
            source=VolumeCover.SOURCE_RAKUTEN,
        )
        ShopAvailability.objects.create(
            user=user, series=s, shop=shop, status=ShopAvailability.STATUS_AVAILABLE,
        )


def _measure_series_list_queries(api, user, count):
    """series を count 件作成し /api/series/ を呼んで発行クエリ数を返す。"""
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    _populate_series_with_related(user, count)
    with CaptureQueriesContext(connection) as ctx:
        resp = api.get("/api/series/")
    assert resp.status_code == 200
    assert resp.data["count"] == count
    return len(ctx.captured_queries)


def test_series_list_query_count_is_constant(api, user):
    """シリーズ一覧 API の発行クエリ数が series 件数に比例しないことを保証する。

    prefetch_related("covers", "availabilities", "cart_items") による N+1 解消の
    リグレッション防止ガード。1件・20件で同じクエリ数になることと、絶対値が
    想定範囲内に収まることの2点を検証する。
    """
    queries_1 = _measure_series_list_queries(api, user, 1)
    queries_20 = _measure_series_list_queries(api, user, 20)
    # series 件数が 1 → 20 になってもクエリ数は同一でなければならない。
    assert queries_1 == queries_20, (
        f"Series 一覧で N+1 が再発している可能性: 1件で {queries_1} 件、"
        f"20件で {queries_20} 件のクエリが発行された。"
    )
    # 絶対値ガード: 現状は COUNT + Series 本体 + covers/availabilities/cart_items
    # の prefetch 3本 = 計 5 クエリ。新たな N+1（select_related 漏れや loop 内
    # クエリの追加）を持ち込むとここで弾かれる。
    assert queries_1 <= 6, (
        f"Series 一覧で想定より多くのクエリが発行されている: {queries_1} 件。"
        f"prefetch / select_related の漏れが無いか確認すること。"
    )
