"""楽天ブックス書籍検索APIとの連携。

RAKUTEN_APP_ID が未設定の場合はモックデータを返すため、
APIキー取得前でもフロント／バックエンドの開発・テストが進められる。
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

RAKUTEN_ENDPOINT = "https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404"
BOOKS_COMIC_GENRE = "001001"  # 本 > コミック
REQUEST_TIMEOUT = 6


def _proxies():
    """静的IPプロキシが設定されていれば proxies 辞書を返す（楽天のIP制限対策）。"""
    url = settings.RAKUTEN_PROXY_URL
    return {"http": url, "https": url} if url else None


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

    if not settings.RAKUTEN_APP_ID:
        logger.info("RAKUTEN_APP_ID 未設定のためモックデータを返します。")
        return _mock_search(query)

    params = {
        "applicationId": settings.RAKUTEN_APP_ID,
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


def find_volume_cover(title, volume_number):
    """「<タイトル> <N>巻」で表紙画像URLを1件取得する。見つからなければ None。"""
    title = (title or "").strip()
    if not title:
        return None

    query = f"{title} {volume_number}"

    if not settings.RAKUTEN_APP_ID:
        return None

    params = {
        "applicationId": settings.RAKUTEN_APP_ID,
        "title": query,
        "booksGenreId": BOOKS_COMIC_GENRE,
        "hits": 1,
        "format": "json",
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

    items = data.get("Items", [])
    if not items:
        return None
    item = items[0]["Item"]
    return item.get("largeImageUrl", "") or item.get("mediumImageUrl", "") or None
