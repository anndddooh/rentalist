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


@override_settings(RAKUTEN_APP_ID="SECRET_APP_ID_XYZ", RAKUTEN_ACCESS_KEY="SECRET_ACCESS_KEY_XYZ")
def test_log_on_http_failure_does_not_leak_api_credentials(caplog):
    """HTTPエラー時のログに applicationId/accessKey が出ないこと。

    楽天は認証情報をクエリパラメータで渡すため、例外の __str__ にURLが
    そのまま含まれるとログから API キーが漏れる。クエリ部分を伏字で扱う。
    """
    import logging
    import requests

    fake_url = (
        "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404"
        "?applicationId=SECRET_APP_ID_XYZ&accessKey=SECRET_ACCESS_KEY_XYZ&title=test"
    )
    fake_response = MagicMock()
    fake_response.status_code = 429
    fake_request = MagicMock()
    fake_request.url = fake_url
    http_error = requests.HTTPError(
        f"429 Client Error: Too Many Requests for url: {fake_url}",
        request=fake_request,
        response=fake_response,
    )

    raising_response = MagicMock()
    raising_response.raise_for_status = MagicMock(side_effect=http_error)

    with caplog.at_level(logging.WARNING, logger="catalog.services.rakuten"):
        with patch.object(rakuten.requests, "get", return_value=raising_response):
            rakuten.find_volume_cover("テスト", 1)

    log_text = "\n".join(rec.message for rec in caplog.records)
    assert "SECRET_APP_ID_XYZ" not in log_text
    assert "SECRET_ACCESS_KEY_XYZ" not in log_text
    # 失敗自体は記録されているはず（status / 操作種別が分かる程度）
    assert "失敗" in log_text


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


# --- find_volume_cover_cached: 「見つからない」「仮表紙」を TTL 付きでキャッシュ ---


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_cached_lookup_caches_not_found():
    """見つからなかった結果はキャッシュされ、2回目は楽天を呼ばない。"""
    with patch.object(rakuten.requests, "get", return_value=_fake_response([])) as get:
        assert rakuten.find_volume_cover_cached("存在しない作品", 3) == (None, False)
        calls = get.call_count
        assert rakuten.find_volume_cover_cached("存在しない作品", 3) == (None, False)
        assert get.call_count == calls


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_cached_lookup_caches_provisional():
    """仮表紙の結果もキャッシュされ、2回目は楽天を呼ばずに同じ URL を返す。"""
    items = [
        {
            "title": "ありす、宇宙までも 7",
            "seriesName": "ありす、宇宙までも",
            "largeImageUrl": "https://example.com/noimage.gif",
            "availability": "5",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)) as get:
        first = rakuten.find_volume_cover_cached("ありす、宇宙までも", 7)
        calls = get.call_count
        assert rakuten.find_volume_cover_cached("ありす、宇宙までも", 7) == first
        assert get.call_count == calls
    assert first[1] is True


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_cached_lookup_does_not_cache_api_failure():
    """楽天 API の失敗（タイムアウト等）はキャッシュせず、次回は再度問い合わせる。"""
    import requests

    with patch.object(rakuten.requests, "get", side_effect=requests.Timeout("t/o")):
        assert rakuten.find_volume_cover_cached("鬼滅の刃", 1) == (None, False)
    items = [
        {
            "title": "鬼滅の刃 1",
            "seriesName": "鬼滅の刃",
            "largeImageUrl": "https://example.com/kim1_1_5.jpg",
        }
    ]
    with patch.object(rakuten.requests, "get", return_value=_fake_response(items)):
        url, provisional = rakuten.find_volume_cover_cached("鬼滅の刃", 1)
    assert url == "https://example.com/kim1_1_5.jpg" and provisional is False


# --- 楽天Kobo 併用（シリーズ検索・表紙取得） ---


def _route_by_endpoint(books_items, kobo_items):
    """呼び出し先 URL で紙/Kobo のレスポンスを出し分ける requests.get の代役。

    値に例外を渡すとその取得元は失敗扱いになる。
    """

    def fake_get(url, params=None, timeout=None):
        items = kobo_items if url == rakuten.KOBO_ENDPOINT else books_items
        if isinstance(items, Exception):
            raise items
        return _fake_response(items)

    return fake_get


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_search_groups_volumes_into_one_candidate_per_series():
    """巻ごとの結果はシリーズ単位にまとめ、代表は1巻・title はシリーズ名にする。"""
    books = [
        {"title": "キングダム 3", "publisherName": "集英社", "largeImageUrl": "k3"},
        {"title": "キングダム 1", "publisherName": "集英社", "largeImageUrl": "k1"},
        {"title": "キングダム 公式ガイドブック", "publisherName": "集英社"},
    ]
    with patch.object(rakuten.requests, "get", side_effect=_route_by_endpoint(books, [])):
        results = rakuten.search_series("キングダム")
    assert [r["title"] for r in results] == ["キングダム", "キングダム 公式ガイドブック"]
    assert results[0]["cover_url"] == "k1"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_search_adds_kobo_only_series_and_prefers_books_data_for_shared_ones():
    """紙で見つからない作品は Kobo から補い、両方にある作品は紙の情報を使う。"""
    books = [
        {
            "title": "ONE PIECE 1 (ジャンプコミックス)",
            "publisherName": "集英社",
            "seriesName": "ジャンプコミックス",
        },
    ]
    kobo = [
        {"title": "ONE PIECE モノクロ版 1", "publisherName": "集英社", "seriesName": "ONE PIECE"},
        {"title": "ONE PIECE 1", "publisherName": "集英社/電子", "seriesName": "ONE PIECE"},
        {"title": "賭博堕天録カイジ 1", "publisherName": "フクモトプロ", "seriesName": "賭博堕天録カイジ"},
    ]
    with patch.object(rakuten.requests, "get", side_effect=_route_by_endpoint(books, kobo)):
        results = rakuten.search_series("ONE PIECE")
    by_title = {r["title"]: r for r in results}
    assert set(by_title) == {"ONE PIECE", "ONE PIECE モノクロ版", "賭博堕天録カイジ"}
    assert by_title["ONE PIECE"]["source"] == "rakuten_books"
    assert by_title["ONE PIECE"]["series_name"] == "ジャンプコミックス"
    kaiji = by_title["賭博堕天録カイジ"]
    assert kaiji["source"] == "rakuten_kobo"
    # Kobo の seriesName は作品名なのでレーベル欄（series_name）には入れない
    assert kaiji["series_name"] == ""
    # 入力文字列を含むシリーズが先頭に来る
    assert results[-1]["title"] == "賭博堕天録カイジ"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_search_excludes_serialized_editions_from_kobo():
    """【連載版】・分冊版・合本などの単行本でない電子版は候補に出さない。"""
    kobo = [
        {"title": "変な家　【連載版】（12）前"},
        {"title": "変な家 分冊版 3"},
        {"title": "合本版　変な家 1～3巻"},
        {"title": "変な家 1"},
    ]
    with patch.object(rakuten.requests, "get", side_effect=_route_by_endpoint([], kobo)):
        results = rakuten.search_series("変な家")
    assert [r["title"] for r in results] == ["変な家"]


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_search_merges_series_despite_notation_differences():
    """全角/半角や長音・空白の違いは同じシリーズとして1件にまとめる。"""
    books = [{"title": "１００万円の女たち（１）", "publisherName": "小学館"}]
    kobo = [{"title": "100万円の女たち 1", "publisherName": "小学館/電子"}]
    with patch.object(rakuten.requests, "get", side_effect=_route_by_endpoint(books, kobo)):
        results = rakuten.search_series("100万円の女たち")
    assert len(results) == 1
    assert results[0]["publisher"] == "小学館"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_search_returns_kobo_results_when_books_api_fails():
    """紙の検索 API が失敗しても Kobo の結果は返す。"""
    import requests

    kobo = [{"title": "メイキャッパー　1", "publisherName": "秋田書店"}]
    fake_get = _route_by_endpoint(requests.Timeout("t/o"), kobo)
    with patch.object(rakuten.requests, "get", side_effect=fake_get):
        results = rakuten.search_series("メイキャッパー")
    assert [r["title"] for r in results] == ["メイキャッパー"]


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_cover_falls_back_to_kobo_when_books_has_no_match():
    """紙の検索（2段とも）で見つからない巻は Kobo の表紙を使う。"""
    kobo = [{"title": "賭博堕天録カイジ 3", "largeImageUrl": "https://example.com/kobo3.jpg"}]
    with patch.object(
        rakuten.requests, "get", side_effect=_route_by_endpoint([], kobo)
    ) as mock_get:
        url, provisional = rakuten.find_volume_cover("賭博堕天録カイジ", 3)
    assert url == "https://example.com/kobo3.jpg"
    assert provisional is False
    urls = [c.args[0] for c in mock_get.call_args_list]
    assert urls == [rakuten.RAKUTEN_ENDPOINT, rakuten.RAKUTEN_ENDPOINT, rakuten.KOBO_ENDPOINT]


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_cached_lookup_does_not_cache_not_found_when_any_source_failed():
    """紙は見つからず Kobo が失敗した場合、「見つからない」をキャッシュしない。"""
    import requests

    fake_get = _route_by_endpoint([], requests.Timeout("t/o"))
    with patch.object(rakuten.requests, "get", side_effect=fake_get) as mock_get:
        assert rakuten.find_volume_cover_cached("未知の作品", 2) == (None, False)
        calls = mock_get.call_count
        assert rakuten.find_volume_cover_cached("未知の作品", 2) == (None, False)
        assert mock_get.call_count == calls * 2


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_search_excludes_free_trial_and_special_editions():
    """期間限定無料版・特装版などは別シリーズとして並べない。"""
    kobo = [
        {"title": "狂四郎2030【期間限定無料】 1"},
        {"title": "スーパーの裏でヤニ吸うふたり 8巻特装版 小冊子付き"},
        {"title": "狂四郎2030 1"},
    ]
    with patch.object(rakuten.requests, "get", side_effect=_route_by_endpoint([], kobo)):
        results = rakuten.search_series("狂四郎")
    assert [r["title"] for r in results] == ["狂四郎2030"]


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_search_normalizes_kobo_fullwidth_and_trailing_separator():
    """Kobo の全角英数字は半角に揃え、巻数前に残る区切り記号は落とす。"""
    kobo = [{"title": "五佰年ＢＯＸ（１）"}, {"title": "じゃりン子チエ【新訂版】 ： 1"}]
    with patch.object(rakuten.requests, "get", side_effect=_route_by_endpoint([], kobo)):
        results = rakuten.search_series("x")
    assert [r["title"] for r in results] == ["五佰年BOX", "じゃりン子チエ【新訂版】"]


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_cover_matches_fullwidth_kobo_title():
    """登録名が半角でも、Kobo の全角タイトルの巻に一致させる。"""
    kobo = [{"title": "五佰年ＢＯＸ（１）", "largeImageUrl": "https://example.com/box1.jpg"}]
    with patch.object(rakuten.requests, "get", side_effect=_route_by_endpoint([], kobo)):
        url, _ = rakuten.find_volume_cover("五佰年BOX", 1)
    assert url == "https://example.com/box1.jpg"


@override_settings(RAKUTEN_APP_ID="x", RAKUTEN_ACCESS_KEY="y")
def test_retries_once_on_rate_limit():
    """429（回数制限）のときは1回だけ待って再試行する。"""
    limited = MagicMock(status_code=429)
    ok = _fake_response([{"title": "メイキャッパー 1"}])
    ok.status_code = 200
    with patch.object(rakuten, "RATE_LIMIT_RETRY_WAIT_SEC", 0), patch.object(
        rakuten.requests, "get", side_effect=[limited, ok, _fake_response([])]
    ):
        results = rakuten.search_series("メイキャッパー")
    assert [r["title"] for r in results] == ["メイキャッパー"]
