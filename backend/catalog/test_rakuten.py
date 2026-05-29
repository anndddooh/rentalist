"""楽天 API マッチング判定のテスト。

実 HTTP は呼ばず、requests.get をモックして find_volume_cover の判定ロジックを検証する。
find_volume_cover は (url, is_provisional) のタプルを返す。
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
            "largeImageUrl": "https://example.com/kim1_1_5.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, provisional = rakuten.find_volume_cover("鬼滅の刃", 1)
    assert url == "https://example.com/kim1_1_5.jpg"
    assert provisional is False


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_matches_by_stem_after_stripping_trailing_tag():
    """seriesName が空でも、末尾の括弧タグを剥がして stem を比較する。"""
    items = [
        {
            "title": "進撃の巨人(34) (講談社コミックス)",
            "seriesName": "",
            "largeImageUrl": "https://example.com/sng34_1_5.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, _ = rakuten.find_volume_cover("進撃の巨人", 34)
    assert url == "https://example.com/sng34_1_5.jpg"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_matches_by_stem_when_series_name_differs_but_stem_matches():
    """seriesName が「(デジタル版)」付きで一致しなくても、stem 一致なら採用する fallback。"""
    items = [
        {
            "title": "ONE PIECE 100",
            "seriesName": "ONE PIECE (デジタル版)",
            "largeImageUrl": "https://example.com/op100_1_5.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, _ = rakuten.find_volume_cover("ONE PIECE", 100)
    assert url == "https://example.com/op100_1_5.jpg"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_rejects_other_series_with_same_volume():
    """別シリーズで同巻数のものは採用しない（誤マッチ防止）。"""
    items = [
        {
            "title": "別作品 1 (講談社コミックス)",
            "seriesName": "別作品",
            "largeImageUrl": "https://example.com/other_1_5.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, _ = rakuten.find_volume_cover("鬼滅の刃", 1)
    assert url is None


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_rejects_when_volume_mismatch_even_if_series_matches():
    """seriesName が一致しても巻数が違えば採用しない。"""
    items = [
        {
            "title": "鬼滅の刃 2 (ジャンプコミックスDIGITAL)",
            "seriesName": "鬼滅の刃",
            "largeImageUrl": "https://example.com/kim2_1_5.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, _ = rakuten.find_volume_cover("鬼滅の刃", 1)
    assert url is None


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_matches_when_registered_title_has_furigana_subtitle():
    """銀魂のように「シリーズ名ーふりがなー 巻数」で登録されているケースを拾う。"""
    items = [
        {
            "title": "銀魂ーぎんたまー 32",
            "seriesName": "ジャンプコミックス",
            "largeImageUrl": "https://example.com/g32_1_5.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, _ = rakuten.find_volume_cover("銀魂", 32)
    assert url == "https://example.com/g32_1_5.jpg"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_rejects_unrelated_series_starting_with_target_name():
    """target がプレフィックスでも、続く文字が区切りでない別シリーズは採用しない。"""
    items = [
        {
            "title": "銀魂学園 32",
            "seriesName": "",
            "largeImageUrl": "https://example.com/gakuen32_1_5.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, _ = rakuten.find_volume_cover("銀魂", 32)
    assert url is None


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_falls_back_to_search_with_volume_in_query_when_first_misses():
    """1段目で該当巻が見つからなければ「title 巻番号」で再検索する。"""
    first_call = _fake_response(
        [
            {
                "title": "銀魂ーぎんたまー 1",
                "seriesName": "ジャンプコミックス",
                "largeImageUrl": "https://example.com/g1_1_5.jpg",
            },
        ]
    )
    second_call = _fake_response(
        [
            {
                "title": "銀魂ーぎんたまー 32",
                "seriesName": "ジャンプコミックス",
                "largeImageUrl": "https://example.com/g32_1_5.jpg",
            },
        ]
    )
    with patch.object(
        rakuten.requests, "get", side_effect=[first_call, second_call]
    ) as mock_get:
        url, _ = rakuten.find_volume_cover("銀魂", 32)
    assert url == "https://example.com/g32_1_5.jpg"
    assert mock_get.call_count == 2
    second_params = mock_get.call_args_list[1].kwargs["params"]
    assert second_params["title"] == "銀魂 32"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_does_not_call_fallback_when_first_search_succeeds():
    """1段目で当たれば2段目検索はスキップする（楽天APIコール節約）。"""
    items = [
        {
            "title": "鬼滅の刃 1",
            "seriesName": "",
            "largeImageUrl": "https://example.com/kim1_1_5.jpg",
        }
    ]
    with patch.object(
        rakuten.requests, "get", return_value=_fake_response(items)
    ) as mock_get:
        url, _ = rakuten.find_volume_cover("鬼滅の刃", 1)
    assert url == "https://example.com/kim1_1_5.jpg"
    assert mock_get.call_count == 1


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_picks_correct_volume_from_multiple_candidates():
    """複数候補から正しい巻だけを選ぶ。"""
    items = [
        {
            "title": "鬼滅の刃 1 (ジャンプコミックスDIGITAL)",
            "seriesName": "鬼滅の刃",
            "largeImageUrl": "https://example.com/kim1_1_5.jpg",
        },
        {
            "title": "鬼滅の刃 2 (ジャンプコミックスDIGITAL)",
            "seriesName": "鬼滅の刃",
            "largeImageUrl": "https://example.com/kim2_1_5.jpg",
        },
        {
            "title": "鬼滅の刃 3 (ジャンプコミックスDIGITAL)",
            "seriesName": "鬼滅の刃",
            "largeImageUrl": "https://example.com/kim3_1_5.jpg",
        },
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, _ = rakuten.find_volume_cover("鬼滅の刃", 2)
    assert url == "https://example.com/kim2_1_5.jpg"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_flags_provisional_when_availability_is_pre_release():
    """availability=5（発売日前）の item は provisional=True で返す。"""
    items = [
        {
            "title": "ありす、宇宙までも 7",
            "seriesName": "",
            "availability": "5",
            "largeImageUrl": "https://example.com/something_1_5.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, provisional = rakuten.find_volume_cover("ありす、宇宙までも", 7)
    assert url == "https://example.com/something_1_5.jpg"
    assert provisional is True


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_flags_provisional_when_image_url_is_placeholder_gif():
    """画像URLが <isbn>.gif パターン（_1_XX サフィックス無し）なら provisional=True。"""
    items = [
        {
            "title": "ありす、宇宙までも 7",
            "seriesName": "",
            "availability": "1",
            "largeImageUrl": "https://thumbnail.image.rakuten.co.jp/@0_mall/book/cabinet/0294/9784098640294.gif?_ex=200x200",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, provisional = rakuten.find_volume_cover("ありす、宇宙までも", 7)
    assert url.endswith("9784098640294.gif?_ex=200x200")
    assert provisional is True


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_flags_real_cover_as_not_provisional():
    """通常の本表紙（availability=1 かつ URL に _1_XX サフィックス）は provisional=False。"""
    items = [
        {
            "title": "ありす、宇宙までも 6",
            "seriesName": "",
            "availability": "1",
            "largeImageUrl": "https://thumbnail.image.rakuten.co.jp/@0_mall/book/cabinet/7782/9784098637782_1_28.jpg?_ex=200x200",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, provisional = rakuten.find_volume_cover("ありす、宇宙までも", 6)
    assert url.endswith("9784098637782_1_28.jpg?_ex=200x200")
    assert provisional is False
