"""楽天ブックス書籍検索APIとの連携。

新方式の applicationId（UUID形式）は accessKey 必須で、楽天デベロッパー
ポータルに送信元IPを登録する必要がある。本番は静的IPを持つ VPS から
直接呼ぶ前提（プロキシ経由は不要）。

RAKUTEN_APP_ID と RAKUTEN_ACCESS_KEY の片方でも未設定ならモックデータを
返すため、APIキー取得前でも開発・テストが進められる。

バースト時の意図せぬブロックを防ぐため、モジュール内の簡易スロットリングで
呼び出し間隔を最低限確保する。
"""
import logging
import re
import threading
import time

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

RAKUTEN_ENDPOINT = (
    "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404"
)
BOOKS_COMIC_GENRE = "001001"  # 本 > コミック
REQUEST_TIMEOUT = 6

# 楽天API呼び出しの最小間隔。accessKey + IP登録方式なので 1秒/req までは
# 締めず、バースト時のブロックリスクを抑えつつ未取得巻多数のホーム表示
# 速度を確保する妥協点として 0.2 秒（最大 5 req/sec）に設定。
_MIN_INTERVAL_SEC = 0.2
_throttle_lock = threading.Lock()
_last_call_at = 0.0


def _throttle():
    """直前の呼び出しから _MIN_INTERVAL_SEC 経つまでブロックする。

    プロセス内の threading.Lock なので gunicorn の複数ワーカ間では協調しないが、
    家族数人の利用規模なら実用上問題にならない想定。
    """
    global _last_call_at
    with _throttle_lock:
        wait = _MIN_INTERVAL_SEC - (time.monotonic() - _last_call_at)
        if wait > 0:
            time.sleep(wait)
        _last_call_at = time.monotonic()


def _is_configured():
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
        "hits": 30,  # 楽天APIの1ページ最大件数
        "format": "json",
        "sort": "sales",
    }
    _throttle()
    try:
        resp = requests.get(RAKUTEN_ENDPOINT, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("楽天API検索に失敗しました: %s", exc)
        return []

    return [_normalize_item(entry["Item"]) for entry in data.get("Items", [])]


# 巻タイトル末尾の巻数表記（例: 「（2）」「 79」「 第3巻」）から数字を取り出す
_VOLUME_SUFFIX_RE = re.compile(r"[\s　]*[（(]?\s*第?\s*(\d+)\s*巻?\s*[）)]?\s*$")

# 末尾に付くレーベル名・装丁などの括弧タグ（例: 「(ジャンプコミックスDIGITAL)」「【電子書籍版】」）。
# タグ内に括弧が再ネストするケースは想定しない（実データではほぼ無い）。
_TRAILING_TAG_RE = re.compile(r"\s*[（(\[【][^（()）\[\]【】]*[）)\]】]\s*$")


def _split_volume(item_title):
    """巻タイトルを (シリーズ名, 巻数) に分解する。巻数表記が無ければ巻数は None。

    楽天は「鬼滅の刃 1 (ジャンプコミックスDIGITAL)」のように巻数の後ろに
    レーベルタグが付くケースが多い。素の suffix regex が当たらない場合は
    末尾のタグを 1 段階だけ剥がして再試行する（「進撃の巨人(34) (講談社コミックス)」
    のように巻数自体が括弧で囲まれているケースを尊重するため、一気に剥がさない）。
    """
    s = (item_title or "").strip()
    while True:
        match = _VOLUME_SUFFIX_RE.search(s)
        if match:
            stem = s[: match.start()].strip()
            return stem, int(match.group(1))
        stripped = _TRAILING_TAG_RE.sub("", s).rstrip()
        if stripped == s:
            return s, None
        s = stripped


# シリーズ名と副題の間に来る区切り文字。例: 「銀魂ーぎんたまー」「ONE PIECE モノクロ版」
_NAME_SEPARATORS = set("　 ー－-（(【[・／/")


def _series_stem_matches(stem, target):
    """stem が target と一致、または「target + 区切り + 副題」の形か判定する。

    target がそのまま prefix で続く文字が区切り文字（長音符・空白・括弧等）
    なら、副題違いの同シリーズ表記と見做して採用する。
    例: target="銀魂", stem="銀魂ーぎんたまー" → True（次の文字 ー が区切り）
    例: target="銀魂", stem="銀魂学園" → False（次の文字 学 は区切りでない）
    """
    if stem == target:
        return True
    if not stem.startswith(target) or len(stem) == len(target):
        return False
    return stem[len(target)] in _NAME_SEPARATORS


def _item_matches(item, target_title, target_volume):
    """item が target_title の target_volume 巻に一致するか判定する。

    seriesName は楽天では「出版社のレーベル名」が入るケースが多く
    （例: 銀魂の seriesName は「ジャンプコミックス」）シリーズ判定キーとして
    信頼できないため使わない。title からパースした stem で比較する。
    """
    stem, volume = _split_volume(item.get("title", ""))
    if volume != target_volume:
        return False
    return _series_stem_matches(stem, target_title)


# 楽天が「発売前で本表紙未入稿」の巻に使うプレースホルダー画像のURL命名規則。
# 本表紙は <isbn>_1_<バージョン番号>.jpg、仮表紙は <isbn>.gif でくる。
_PROVISIONAL_URL_RE = re.compile(r"/\d+\.gif(\?|$)")


def _is_provisional(item):
    """item の表紙が「発売前の仮表紙」かを判定する。

    一次シグナル: availability='5'（楽天の「発売日前」コード）。
    補助シグナル: largeImageUrl が <isbn>.gif（_1_XX サフィックス無し）。
    """
    if str(item.get("availability") or "").strip() == "5":
        return True
    url = item.get("largeImageUrl") or item.get("mediumImageUrl") or ""
    return bool(_PROVISIONAL_URL_RE.search(url))


def _fetch_and_match(query, target_title, target_volume):
    """query で楽天検索し、target_title の target_volume 巻に一致する (url, provisional) を返す。

    見つからなければ (None, False)。
    """
    params = {
        **_auth_params(),
        "title": query,
        "booksGenreId": BOOKS_COMIC_GENRE,
        "hits": 30,
        "format": "json",
        "sort": "sales",
    }
    _throttle()
    try:
        resp = requests.get(RAKUTEN_ENDPOINT, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("楽天API表紙取得に失敗しました: %s", exc)
        return None, False

    for entry in data.get("Items", []):
        item = entry["Item"]
        if not _item_matches(item, target_title, target_volume):
            continue
        url = item.get("largeImageUrl", "") or item.get("mediumImageUrl", "") or None
        if url is None:
            continue
        return url, _is_provisional(item)
    return None, False


def find_volume_cover(title, volume_number):
    """シリーズ名で検索し、該当巻の (画像URL, 仮表紙フラグ) を返す。

    見つからなければ (None, False)。仮表紙（発売前のプレースホルダー）の場合は
    URL は返すが provisional=True を立て、呼び出し側が DB キャッシュを
    スキップして次回再取得できるようにする。

    1段目は title のみで検索（大多数の巻はこれで足りる）。
    2段目は「title 巻番号」で再検索する。楽天は sort=sales の上位30件しか
    返さないため、銀魂(77巻)のような高巻数シリーズでは中間巻が page 1 から
    漏れる。巻番号を含めて検索し直すと該当巻が直接ヒットしやすい。
    """
    title = (title or "").strip()
    if not title or not _is_configured():
        return None, False
    url, provisional = _fetch_and_match(title, title, volume_number)
    if url is not None:
        return url, provisional
    return _fetch_and_match(f"{title} {volume_number}", title, volume_number)
