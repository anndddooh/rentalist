"""楽天 API マッチング判定のテスト。

実 HTTP は呼ばず、requests.get をモックして find_volume_cover の判定ロジックを検証する。
"""
from unittest.mock import MagicMock, patch

from django.test import override_settings

from catalog.services import rakuten


def _fake_response(items):
    """楽天 API の {"Items": [{"Item": {...}}, ...]} 形を返す Mock レスポンス。"""
    response = MagicMock()
    response.raise_for_status = MagicMock()
    response.json.return_value = {"Items": [{"Item": item} for item in items]}
    return response


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_matches_by_series_name_with_noisy_title():
    """seriesName が一致すれば、title に出版社タグ等が付いていても採用する。"""
    items = [
        {
            "title": "鬼滅の刃 1 (ジャンプコミックスDIGITAL)",
            "seriesName": "鬼滅の刃",
            "largeImageUrl": "https://example.com/kim1.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url = rakuten.find_volume_cover("鬼滅の刃", 1)
    assert url == "https://example.com/kim1.jpg"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_matches_by_stem_after_stripping_trailing_tag():
    """seriesName が空でも、末尾の括弧タグを剥がして stem を比較する。"""
    items = [
        {
            "title": "進撃の巨人(34) (講談社コミックス)",
            "seriesName": "",
            "largeImageUrl": "https://example.com/sng34.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url = rakuten.find_volume_cover("進撃の巨人", 34)
    assert url == "https://example.com/sng34.jpg"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_matches_by_stem_when_series_name_differs_but_stem_matches():
    """seriesName が「(デジタル版)」付きで一致しなくても、stem 一致なら採用する fallback。"""
    items = [
        {
            "title": "ONE PIECE 100",
            "seriesName": "ONE PIECE (デジタル版)",
            "largeImageUrl": "https://example.com/op100.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url = rakuten.find_volume_cover("ONE PIECE", 100)
    assert url == "https://example.com/op100.jpg"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_rejects_other_series_with_same_volume():
    """別シリーズで同巻数のものは採用しない（誤マッチ防止）。"""
    items = [
        {
            "title": "別作品 1 (講談社コミックス)",
            "seriesName": "別作品",
            "largeImageUrl": "https://example.com/other.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url = rakuten.find_volume_cover("鬼滅の刃", 1)
    assert url is None


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_rejects_when_volume_mismatch_even_if_series_matches():
    """seriesName が一致しても巻数が違えば採用しない。"""
    items = [
        {
            "title": "鬼滅の刃 2 (ジャンプコミックスDIGITAL)",
            "seriesName": "鬼滅の刃",
            "largeImageUrl": "https://example.com/kim2.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url = rakuten.find_volume_cover("鬼滅の刃", 1)
    assert url is None


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_picks_correct_volume_from_multiple_candidates():
    """複数候補から正しい巻だけを選ぶ。"""
    items = [
        {
            "title": "鬼滅の刃 1 (ジャンプコミックスDIGITAL)",
            "seriesName": "鬼滅の刃",
            "largeImageUrl": "https://example.com/kim1.jpg",
        },
        {
            "title": "鬼滅の刃 2 (ジャンプコミックスDIGITAL)",
            "seriesName": "鬼滅の刃",
            "largeImageUrl": "https://example.com/kim2.jpg",
        },
        {
            "title": "鬼滅の刃 3 (ジャンプコミックスDIGITAL)",
            "seriesName": "鬼滅の刃",
            "largeImageUrl": "https://example.com/kim3.jpg",
        },
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url = rakuten.find_volume_cover("鬼滅の刃", 2)
    assert url == "https://example.com/kim2.jpg"
