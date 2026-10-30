"""楽天ブックス書籍検索API・楽天Kobo電子書籍検索APIとの連携。

紙の書籍検索は書名の部分一致しかできず、ひらがな・カタカナ読み・表記ゆれで
0件になりやすい。Kobo の検索はキーワードの揺れに強く、紙で見つからない作品も
拾えるため、シリーズ検索と表紙取得の両方で併用する（同じ認証情報で呼べる）。

新方式の applicationId（UUID形式）は accessKey 必須で、楽天デベロッパー
ポータルに送信元IPを登録する必要がある。本番は静的IPを持つ VPS から
直接呼ぶ前提（プロキシ経由は不要）。

RAKUTEN_APP_ID と RAKUTEN_ACCESS_KEY の片方でも未設定ならモックデータを
返すため、APIキー取得前でも開発・テストが進められる。

バースト時の意図せぬブロックを防ぐため、モジュール内の簡易スロットリングで
呼び出し間隔を最低限確保する。
"""
import hashlib
import logging
import re
import threading
import time
import unicodedata

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

RAKUTEN_ENDPOINT = (
    "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404"
)
BOOKS_COMIC_GENRE = "001001"  # 本 > コミック
KOBO_ENDPOINT = (
    "https://openapi.rakuten.co.jp/services/api/Kobo/EbookSearch/20170426"
)
KOBO_COMIC_GENRE = "101904"  # 電子書籍 > 漫画（マンガ）
REQUEST_TIMEOUT = 6
# 429（回数制限）時に1回だけ再試行するまでの待ち時間。
# 紙と Kobo を続けて呼ぶ・本番と staging が同じキーを共有する等で、1秒間隔でも時々返る。
RATE_LIMIT_RETRY_WAIT_SEC = 1.0

# find_volume_cover_cached のキャッシュ期間。本表紙は呼び出し側が DB に保存するので対象外。
# 見つからない巻は滅多に状況が変わらないので長め、仮表紙は本表紙への差し替えを
# 早めに拾えるよう短め。キャッシュはプロセス内メモリ（Django 既定の LocMemCache）。
COVER_NOT_FOUND_TTL_SEC = 24 * 60 * 60
COVER_PROVISIONAL_TTL_SEC = 6 * 60 * 60

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


def _log_api_failure(operation, exc):
    """楽天 API 例外をログ出力する。URL のクエリ部（applicationId/accessKey）は出さない。"""
    request = getattr(exc, "request", None)
    response = getattr(exc, "response", None)
    raw_url = getattr(request, "url", "") if request is not None else ""
    url = raw_url.split("?", 1)[0] if raw_url else ""
    status = getattr(response, "status_code", None) if response is not None else None
    parts = [f"楽天API{operation}に失敗しました", type(exc).__name__]
    if status is not None:
        parts.append(f"HTTP {status}")
    if url:
        parts.append(url)
    logger.warning(" - ".join(parts))


def _auth_params():
    return {
        "applicationId": settings.RAKUTEN_APP_ID,
        "accessKey": settings.RAKUTEN_ACCESS_KEY,
    }


def _books_params(query):
    return {
        **_auth_params(),
        "title": query,
        "booksGenreId": BOOKS_COMIC_GENRE,
        "hits": 30,  # 楽天APIの1ページ最大件数
        "format": "json",
        "sort": "sales",
    }


def _kobo_params(query):
    return {
        **_auth_params(),
        "keyword": query,
        "koboGenreId": KOBO_COMIC_GENRE,
        "hits": 30,
        "format": "json",
    }


# (取得元, エンドポイント, パラメータ生成関数)
_SOURCES = (
    ("rakuten_books", RAKUTEN_ENDPOINT, _books_params),
    ("rakuten_kobo", KOBO_ENDPOINT, _kobo_params),
)


class _LookupFailed(Exception):
    """楽天 API の呼び出し自体が失敗した（「見つからない」とは区別する）。"""


def _fetch_items(endpoint, params, operation):
    """楽天 API を呼んで Item のリストを返す。失敗時は _LookupFailed を送出する。

    429（回数制限）は一時的なので、少し待って1回だけ再試行する。
    """
    _throttle()
    try:
        resp = requests.get(endpoint, params=params, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 429:
            time.sleep(RATE_LIMIT_RETRY_WAIT_SEC)
            _throttle()
            resp = requests.get(endpoint, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        _log_api_failure(operation, exc)
        raise _LookupFailed from exc
    return [entry["Item"] for entry in data.get("Items", [])]


def _normalize_item(item, source):
    """楽天 API の Item を Rentalist の候補形式に変換する。

    紙の seriesName にはレーベル名（「ジャンプコミックス」等）が入るので
    フロントは雑誌・レーベル欄に使う。Kobo の seriesName は作品名そのもの
    なので series_name には入れない。Kobo は英数字を全角で返すことが多い
    （例: 「五佰年ＢＯＸ」）ので、タイトルは NFKC で半角に揃える。
    """
    title = item.get("title", "")
    if source == "rakuten_kobo":
        title = unicodedata.normalize("NFKC", title)
    return {
        "title": title,
        "author": item.get("author", ""),
        "author_kana": item.get("authorKana", ""),
        "publisher": item.get("publisherName", ""),
        "isbn": item.get("isbn", "") or "",
        "cover_url": item.get("largeImageUrl", "") or item.get("mediumImageUrl", ""),
        "series_name": item.get("seriesName", "") if source == "rakuten_books" else "",
        "sales_date": item.get("salesDate", ""),
        "source": source,
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
            "source": "rakuten_books",
        }
        for n in range(1, 4)
    ]


# 通常の単行本ではない版（例: 「変な家　【連載版】（12）前」「合本版 …」
# 「狂四郎2030【期間限定無料】」「8巻特装版 小冊子付き」）。
# 1話・1冊ごとに別シリーズとして並んでしまうので検索候補から除く。
_NON_VOLUME_EDITION_RE = re.compile(
    r"連載版|分冊版|単話|合本|期間限定|無料|試し読み|特装版|通常版|限定版"
)

# シリーズの同一判定キーから除く文字（空白・記号・長音/ダッシュ類）
_KEY_STRIP_RE = re.compile(r"[\s・:：!！?？、,.。【】\[\]()（）〜~ー－―‐\-]")


def _series_key(name):
    """表記ゆれ（全角/半角・空白・記号）を吸収したシリーズ同一判定キー。"""
    return _KEY_STRIP_RE.sub("", unicodedata.normalize("NFKC", name or "").lower())


def _group_by_series(candidates):
    """巻ごとの候補をシリーズ単位にまとめる。[(キー, 候補)] を出現順で返す。

    代表には最も若い巻（通常は1巻）を選び、title はシリーズ名（巻数・タグ除去後）にする。
    """
    best = {}
    order = []
    for cand in candidates:
        stem, volume = _split_volume(cand["title"])
        # 「じゃりン子チエ【新訂版】 ： 1」のように巻数の前に区切り記号が残るケース
        stem = stem.rstrip(" 　:：,、")
        key = _series_key(stem)
        if not key:
            continue
        rank = volume if volume is not None else float("inf")
        if key not in best:
            order.append(key)
        elif rank >= best[key][0]:
            continue
        best[key] = (rank, {**cand, "title": stem})
    return [(key, best[key][1]) for key in order]


def search_series(query):
    """タイトルでシリーズ候補を検索する（楽天ブックス + 楽天Kobo）。

    候補は巻単位ではなくシリーズ単位で返す。両方に出てくるシリーズは紙の
    情報（出版社・レーベル）を優先する。並びは「入力文字列を含むシリーズ」を先頭に、
    次に Kobo の関連度順、最後に紙にしか無いシリーズ。片方の API が失敗しても
    もう片方の結果は返す。
    """
    query = (query or "").strip()
    if not query:
        return []

    if not _is_configured():
        logger.info("楽天APIの認証情報が未設定のためモックデータを返します。")
        return _mock_search(query)

    grouped = {}
    for source, endpoint, make_params in _SOURCES:
        try:
            items = _fetch_items(endpoint, make_params(query), "検索")
        except _LookupFailed:
            items = []
        candidates = [
            _normalize_item(item, source)
            for item in items
            if not _NON_VOLUME_EDITION_RE.search(item.get("title", ""))
        ]
        grouped[source] = _group_by_series(candidates)

    books = dict(grouped["rakuten_books"])
    merged = [(key, books.get(key, cand)) for key, cand in grouped["rakuten_kobo"]]
    seen = {key for key, _ in merged}
    merged += [(key, cand) for key, cand in grouped["rakuten_books"] if key not in seen]

    query_key = _series_key(query)
    merged.sort(key=lambda pair: 0 if query_key and query_key in pair[0] else 1)
    return [cand for _, cand in merged]


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
    # 全角/半角の違い（Kobo の「五佰年ＢＯＸ」と登録名「五佰年BOX」等）を吸収する
    return _series_stem_matches(
        unicodedata.normalize("NFKC", stem), unicodedata.normalize("NFKC", target_title)
    )


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
    return is_provisional_url(url)


def is_provisional_url(url):
    """URL が楽天の仮表紙パターン（<isbn>.gif）か判定する。

    既存 VolumeCover キャッシュのクリーンアップ等、DB 行に対しても
    使えるように外部公開している。
    """
    if not url:
        return False
    return bool(_PROVISIONAL_URL_RE.search(url))


def _search_and_match(endpoint, params, target_title, target_volume):
    """楽天を検索し、target_title の target_volume 巻に一致する (url, provisional) を返す。

    見つからなければ (None, False)。API 失敗時は _LookupFailed を送出する。
    """
    for item in _fetch_items(endpoint, params, "表紙取得"):
        if not _item_matches(item, target_title, target_volume):
            continue
        url = item.get("largeImageUrl", "") or item.get("mediumImageUrl", "") or None
        if url is None:
            continue
        return url, _is_provisional(item)
    return None, False


def _lookup_cover(title, volume_number):
    """紙 → Kobo の順に該当巻の表紙を探す。(url, provisional, API失敗の有無) を返す。

    各取得元で、まず title のみ、見つからなければ「title 巻番号」で検索する。
    楽天は上位30件しか返さないため、銀魂(77巻)のような高巻数シリーズでは
    中間巻が title のみの検索から漏れる。巻番号を含めると該当巻が直接ヒットしやすい。
    Kobo は紙の検索で見つからない作品（タイトル表記の違い等）の救済用。
    途中で API が失敗しても残りの検索は続ける。
    """
    failed = False
    for _source, endpoint, make_params in _SOURCES:
        for query in (title, f"{title} {volume_number}"):
            try:
                url, provisional = _search_and_match(
                    endpoint, make_params(query), title, volume_number
                )
            except _LookupFailed:
                failed = True
                continue
            if url is not None:
                return url, provisional, failed
    return None, False, failed


def find_volume_cover(title, volume_number):
    """シリーズ名で検索し、該当巻の (画像URL, 仮表紙フラグ) を返す。

    見つからなければ (None, False)。仮表紙（発売前のプレースホルダー）の場合は
    URL は返すが provisional=True を立て、呼び出し側が DB キャッシュを
    スキップして次回再取得できるようにする。
    """
    title = (title or "").strip()
    if not title or not _is_configured():
        return None, False
    url, provisional, _failed = _lookup_cover(title, volume_number)
    return url, provisional


def find_volume_cover_cached(title, volume_number):
    """find_volume_cover の結果のうち「見つからない」「仮表紙」を TTL 付きでキャッシュする。

    これらは DB に保存されないため、キャッシュしないとページ表示のたびに楽天を
    呼び直し、スロットリングで直列化して表紙の表示が遅くなる。
    API 失敗（タイムアウト等）が絡んだ「見つからない」は一時的なものなのでキャッシュしない。
    """
    title = (title or "").strip()
    if not title or not _is_configured():
        return None, False
    digest = hashlib.sha1(title.encode("utf-8")).hexdigest()
    key = f"rakuten:cover:{digest}:{volume_number}"
    hit = cache.get(key)
    if hit is not None:
        return tuple(hit)
    url, provisional, failed = _lookup_cover(title, volume_number)
    if url is None:
        if not failed:
            cache.set(key, (None, False), COVER_NOT_FOUND_TTL_SEC)
    elif provisional:
        cache.set(key, (url, True), COVER_PROVISIONAL_TTL_SEC)
    return url, provisional
