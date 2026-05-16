"""楽天ブックス書籍検索APIとの連携。

RAKUTEN_APP_ID が未設定の場合はモックデータを返すため、
APIキー取得前でもフロント／バックエンドの開発・テストが進められる。
"""
import logging
import re

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

RAKUTEN_ENDPOINT = (
    "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404"
)
BOOKS_COMIC_GENRE = "001001"  # 本 > コミック
REQUEST_TIMEOUT = 6


def _proxies():
    """静的IPプロキシが設定されていれば proxies 辞書を返す（楽天のIP制限対策）。"""
    url = settings.RAKUTEN_PROXY_URL
    return {"http": url, "https": url} if url else None


def _is_configured():
    """新方式の楽天API認証（applicationId + accessKey）が揃っているか。"""
    return bool(settings.RAKUTEN_APP_ID and settings.RAKUTEN_ACCESS_KEY)


def _auth_params():
    return {
        "applicationId": settings.RAKUTEN_APP_ID,
        "accessKey": settings.RAKUTEN_ACCESS_KEY,
    }


def _normalize_item(item):
    """楽天 API の Item を Rentalist の候補形式に変換する。"""
    return {
        "title": item.get("title", ""),
        "author": item.get("author", ""),
        "author_kana": item.get("authorKana", ""),
        "publisher": item.get("publisherName", ""),
        "isbn": item.get("isbn", ""),
        "cover_url": item.get("largeImageUrl", "") or item.get("mediumImageUrl", ""),
        "series_name": item.get("seriesName", ""),
        "sales_date": item.get("salesDate", ""),
    }


def _mock_search(query):
    """APIキー未設定時のモック候補。"""
    return [
        {
            "title": f"{query} {n}巻",
            "author": "サンプル 作者",
            "author_kana": "サンプル サクシャ",
            "publisher": "サンプル出版社",
            "isbn": f"978400000000{n}",
            "cover_url": "",
            "series_name": query,
            "sales_date": "2020年01月01日",
        }
        for n in range(1, 4)
    ]


def search_series(query):
    """タイトルでシリーズ候補を検索する。"""
    query = (query or "").strip()
    if not query:
        return []

    if not _is_configured():
        logger.info("楽天APIの認証情報が未設定のためモックデータを返します。")
        return _mock_search(query)

    params = {
        **_auth_params(),
        "title": query,
        "booksGenreId": BOOKS_COMIC_GENRE,
        "hits": 20,
        "format": "json",
        "sort": "sales",
    }
    try:
        resp = requests.get(
            RAKUTEN_ENDPOINT,
            params=params,
            timeout=REQUEST_TIMEOUT,
            proxies=_proxies(),
        )
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("楽天API検索に失敗しました: %s", exc)
        return []

    return [_normalize_item(entry["Item"]) for entry in data.get("Items", [])]


# 巻タイトル末尾の巻数表記（例: 「（2）」「 79」「 第3巻」）から数字を取り出す
_VOLUME_SUFFIX_RE = re.compile(r"[\s　]*[（(]?\s*第?\s*(\d+)\s*巻?\s*[）)]?\s*$")


def _split_volume(item_title):
    """巻タイトルを (シリーズ名, 巻数) に分解する。巻数表記が無ければ巻数は None。"""
    item_title = (item_title or "").strip()
    match = _VOLUME_SUFFIX_RE.search(item_title)
    if not match:
        return item_title, None
    stem = item_title[: match.start()].strip()
    return stem, int(match.group(1))


def find_volume_cover(title, volume_number):
    """シリーズ名で検索し、該当巻の表紙画像URLを返す。見つからなければ None。

    楽天の巻タイトルは作品ごとに「（N）」「 N」など表記がまちまちなので、
    巻数を付けずに検索し、各候補のタイトルから巻数をパースして一致巻を選ぶ。
    """
    title = (title or "").strip()
    if not title or not _is_configured():
        return None

    params = {
        **_auth_params(),
        "title": title,
        "booksGenreId": BOOKS_COMIC_GENRE,
        "hits": 30,
        "format": "json",
        "sort": "sales",
    }
    try:
        resp = requests.get(
            RAKUTEN_ENDPOINT,
            params=params,
            timeout=REQUEST_TIMEOUT,
            proxies=_proxies(),
        )
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("楽天API表紙取得に失敗しました: %s", exc)
        return None

    for entry in data.get("Items", []):
        item = entry["Item"]
        stem, volume = _split_volume(item.get("title", ""))
        # シリーズ名が一致し、かつ目的の巻であるものだけ採用（別シリーズ除外）
        if volume == volume_number and stem == title:
            return (
                item.get("largeImageUrl", "")
                or item.get("mediumImageUrl", "")
                or None
            )
    return None
