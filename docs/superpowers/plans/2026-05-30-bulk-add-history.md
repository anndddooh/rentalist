# 一括履歴追加（bulk_add_history） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** あるシリーズについて 1〜N 巻の RentalHistory を一気に作成する API と UI を追加し、既読シリーズの登録を 1 操作で済ませられるようにする。

**Architecture:** SeriesViewSet に `@action bulk_add_history` を追加。RentalHistory.objects.bulk_create + ignore_conflicts で 1..N 巻を投入し、既存メソッド `recalculate_current_volume` でステータス遷移も追従。フロントは SeriesDetail と AddSeries の両方に呼び出し UI を置く。

**Tech Stack:** Django 5.1 / DRF / pytest-django（backend）/ React + Vite（frontend）

**Spec:** [docs/superpowers/specs/2026-05-30-bulk-add-history-design.md](../specs/2026-05-30-bulk-add-history-design.md)

---

## Task 1: Backend — `bulk_add_history` エンドポイント

**Files:**
- Modify: `backend/catalog/views.py`（`SeriesViewSet` に `@action` 追加）
- Modify: `backend/catalog/tests.py`（テスト追記）

このタスクで作る挙動:
- `POST /api/series/<id>/bulk_add_history/` body `{"to_volume": N}`
- 1..N 巻の `RentalHistory` を `bulk_create(..., ignore_conflicts=True)` で投入
- `series.recalculate_current_volume()` で `current_volume` 更新 + `total_volumes` に達したら status=completed
- 入力エラー (`to_volume < 1` / 整数でない) で 400、他人のシリーズで 404
- レスポンス: `{"detail", "created", "current_volume", "status"}`

### - [ ] Step 1: テストを `backend/catalog/tests.py` の末尾に追記

`backend/catalog/tests.py` の最終行の後に以下を貼り付ける。

```python
def test_bulk_add_history_creates_volumes_one_to_n(api, user):
    series = make_series(user)
    resp = api.post(
        f"/api/series/{series.id}/bulk_add_history/",
        {"to_volume": 5},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["created"] == 5
    assert resp.data["current_volume"] == 5
    vols = sorted(
        RentalHistory.objects.filter(series=series).values_list(
            "volume_number", flat=True
        )
    )
    assert vols == [1, 2, 3, 4, 5]


def test_bulk_add_history_skips_existing_volumes(api, user):
    """既存巻はスキップし、欠けている巻だけ新規作成する（unique_together + ignore_conflicts）。"""
    from django.utils import timezone
    series = make_series(user)
    for v in [2, 3]:
        RentalHistory.objects.create(
            user=user, series=series, volume_number=v, rented_at=timezone.now()
        )
    resp = api.post(
        f"/api/series/{series.id}/bulk_add_history/",
        {"to_volume": 5},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["created"] == 3  # 1, 4, 5 のみ新規
    assert RentalHistory.objects.filter(series=series).count() == 5


def test_bulk_add_history_auto_completes_when_reaches_total_volumes(api, user):
    series = make_series(user, total_volumes=5)
    resp = api.post(
        f"/api/series/{series.id}/bulk_add_history/",
        {"to_volume": 5},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["status"] == "completed"
    series.refresh_from_db()
    assert series.status == Series.STATUS_COMPLETED
    assert series.current_volume == 5


def test_bulk_add_history_rejects_zero(api, user):
    series = make_series(user)
    resp = api.post(
        f"/api/series/{series.id}/bulk_add_history/",
        {"to_volume": 0},
        format="json",
    )
    assert resp.status_code == 400


def test_bulk_add_history_rejects_non_integer(api, user):
    series = make_series(user)
    resp = api.post(
        f"/api/series/{series.id}/bulk_add_history/",
        {"to_volume": "abc"},
        format="json",
    )
    assert resp.status_code == 400


def test_bulk_add_history_rejects_other_users_series(api, other_user):
    """他ユーザーの series は SeriesViewSet.get_queryset でフィルタされ 404 になる。"""
    series = make_series(other_user)
    resp = api.post(
        f"/api/series/{series.id}/bulk_add_history/",
        {"to_volume": 3},
        format="json",
    )
    assert resp.status_code == 404
    assert RentalHistory.objects.filter(series=series).count() == 0
```

### - [ ] Step 2: テストを走らせて全件失敗することを確認

Run:
```bash
cd backend && ./venv/bin/python -m pytest catalog/tests.py -k bulk_add_history -v
```

Expected: 6 件すべて FAILED（エンドポイント未実装のため 404 か AttributeError）。

### - [ ] Step 3: SeriesViewSet に `bulk_add_history` アクションを追加

`backend/catalog/views.py` の `SeriesViewSet` クラスの **最後のアクション（`availability`）の手前** に以下を追加する。`RentalHistory` のインポートが無ければ既存の `from .models import ...` 行に追加すること（既に import 済みかは要確認）。

```python
    @action(detail=True, methods=["post"], url_path="bulk_add_history")
    def bulk_add_history(self, request, pk=None):
        """1〜N 巻の読破記録を一括投入する（既読シリーズの登録向け）。

        - 既存巻は unique_together 違反として ignore_conflicts でスキップ。
        - 投入後 recalculate_current_volume で current_volume と完結遷移を更新。
        """
        series = self.get_object()  # 他ユーザー series は queryset でフィルタ→ 404
        try:
            to_volume = int(request.data.get("to_volume"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "to_volume must be an integer >= 1"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if to_volume < 1:
            return Response(
                {"detail": "to_volume must be >= 1"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # ignore_conflicts は DB によって返却件数の意味が違うので、
        # 作成前後の差分で正確な件数を出す。
        before = series.histories.count()
        now = timezone.now()
        RentalHistory.objects.bulk_create(
            [
                RentalHistory(
                    user=request.user,
                    series=series,
                    volume_number=v,
                    rented_at=now,
                )
                for v in range(1, to_volume + 1)
            ],
            ignore_conflicts=True,
        )
        created = series.histories.count() - before
        series.recalculate_current_volume()
        return Response(
            {
                "detail": f"{created}件の読破記録を追加しました。",
                "created": created,
                "current_volume": series.current_volume,
                "status": series.status,
            }
        )
```

import の確認: ファイル冒頭付近の `from .models import ...` に `RentalHistory` が含まれているか見て、無ければ追加。`timezone` / `status` / `Response` / `action` は既存コードで使われているのでそのまま使えるはず。

### - [ ] Step 4: テストを走らせて全件通ることを確認

Run:
```bash
cd backend && ./venv/bin/python -m pytest catalog/tests.py -k bulk_add_history -v
```

Expected: 6 件すべて PASSED。

### - [ ] Step 5: 全体テストで回帰が無いことを確認

Run:
```bash
cd backend && ./venv/bin/python -m pytest
```

Expected: 既存テスト + 新規 6 件、全部 PASSED。

### - [ ] Step 6: コミット

```bash
git add backend/catalog/views.py backend/catalog/tests.py
git commit -m "$(cat <<'EOF'
feat(catalog): N巻まで一括で読破履歴を投入する API を追加

POST /api/series/<id>/bulk_add_history/ で 1..N 巻分の RentalHistory を
bulk_create(ignore_conflicts=True) で投入。既存巻は unique_together により
スキップ、recalculate_current_volume で完結遷移も追従する。

既読シリーズの登録時に1巻ずつ手動 or cart→checkout を繰り返す手間を解消する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Frontend — API ヘルパー + SeriesDetail UI

**Files:**
- Modify: `frontend/src/api/history.js`（`bulkAddHistory` 追加）
- Modify: `frontend/src/pages/SeriesDetail.jsx`（読破記録セクションに UI 追加）

このタスクで作る挙動:
- `bulkAddHistory(seriesId, toVolume)` 関数
- SeriesDetail の「読破記録」セクションヘッダに `+ N巻まで一括追加` ボタン
- クリックで折り畳み展開、数値入力 + 説明文 + 実行/キャンセル
- 成功で `<X>件の読破記録を追加しました` メッセージを表示、履歴とシリーズを再取得

### - [ ] Step 1: `bulkAddHistory` を `frontend/src/api/history.js` に追加

ファイル末尾に以下を追加:

```js
export async function bulkAddHistory(seriesId, toVolume) {
  const { data } = await api.post(`/series/${seriesId}/bulk_add_history/`, {
    to_volume: toVolume,
  });
  return data;
}
```

### - [ ] Step 2: SeriesDetail.jsx で `bulkAddHistory` を import

`frontend/src/pages/SeriesDetail.jsx` の上部 import 文を変更:

```jsx
import { listHistory, bulkAddHistory } from "../api/history.js";
```

（元の `import { listHistory } from ...` を上記に置き換え）

### - [ ] Step 3: SeriesDetail.jsx に bulk-add 用の state とハンドラを追加

`useState` 群（`const [history, setHistory] = useState([])` の近く）に追加:

```jsx
  // 一括履歴追加 UI 用
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkToVolume, setBulkToVolume] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
```

`handleDelete` 関数の **直前** に新ハンドラを追加:

```jsx
  async function handleBulkAdd() {
    const n = Number(bulkToVolume);
    if (!Number.isInteger(n) || n < 1) {
      setError("巻数は 1 以上の整数を指定してください。");
      return;
    }
    setBulkBusy(true);
    setError("");
    try {
      const result = await bulkAddHistory(id, n);
      setBulkMessage(`${result.created}件の読破記録を追加しました。`);
      setBulkToVolume("");
      setBulkOpen(false);
      // 履歴とシリーズを再取得
      const [newHistory] = await Promise.all([
        listHistory(id),
        load(),
      ]);
      setHistory(newHistory);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  }
```

### - [ ] Step 4: SeriesDetail.jsx の「読破記録」セクションを UI 付きに差し替え

既存:
```jsx
      {/* 履歴 */}
      <div className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">読破記録</p>
        {history.length === 0 ? (
          <p className="text-xs text-slate-400">記録はありません。</p>
        ) : (
          <ul className="text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between py-0.5">
                <span>{h.volume_number}巻</span>
                <span className="text-xs text-slate-400">
                  {new Date(h.rented_at).toLocaleDateString("ja-JP")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
```

を以下に置き換え:

```jsx
      {/* 履歴 */}
      <div className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-600">読破記録</p>
          <button
            onClick={() => {
              setBulkOpen((v) => !v);
              setBulkMessage("");
            }}
            className="text-xs font-semibold text-brand underline"
          >
            {bulkOpen ? "閉じる" : "+ N巻まで一括追加"}
          </button>
        </div>

        {bulkMessage && (
          <p className="rounded bg-brand-light px-2 py-1 text-xs text-brand-dark">
            {bulkMessage}
          </p>
        )}

        {bulkOpen && (
          <div className="space-y-2 rounded border border-brand-light bg-brand-light/30 p-2">
            <Field label="巻数（N）">
              <input
                type="number"
                min="1"
                className="input"
                value={bulkToVolume}
                onChange={(e) => setBulkToVolume(e.target.value)}
                placeholder="例: 10"
              />
            </Field>
            <p className="text-xs text-slate-600">
              1〜N 巻の読破記録を追加します。既に登録済みの巻はそのまま残ります。
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleBulkAdd}
                disabled={bulkBusy}
                className="flex-1 rounded bg-brand py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {bulkBusy ? "追加中…" : "追加"}
              </button>
              <button
                onClick={() => {
                  setBulkOpen(false);
                  setBulkToVolume("");
                }}
                className="flex-1 rounded bg-slate-200 py-2 text-sm font-semibold text-slate-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {history.length === 0 ? (
          <p className="text-xs text-slate-400">記録はありません。</p>
        ) : (
          <ul className="text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between py-0.5">
                <span>{h.volume_number}巻</span>
                <span className="text-xs text-slate-400">
                  {new Date(h.rented_at).toLocaleDateString("ja-JP")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
```

### - [ ] Step 5: dev で動作確認

ローカル dev サーバが立っていなければ起動（バックエンド `manage.py runserver` + フロント `npm run dev`）。

ブラウザで:
1. 任意のシリーズ詳細を開く
2. 「読破記録」セクション右の `+ N巻まで一括追加` をクリック
3. 「巻数」に `5` を入れて「追加」
4. 「5件の読破記録を追加しました。」が出て、履歴リストに 1〜5 巻が並ぶ
5. もう一度開いて `10` を追加 → 「5件の読破記録を追加しました。」（6〜10）
6. `0` を入れて「追加」 → 「巻数は 1 以上の整数を指定してください。」

### - [ ] Step 6: コミット

```bash
git add frontend/src/api/history.js frontend/src/pages/SeriesDetail.jsx
git commit -m "$(cat <<'EOF'
feat(frontend): SeriesDetail に N巻まで一括追加 UI を追加

読破記録セクションに「+ N巻まで一括追加」ボタンを追加し、折り畳みで
数値入力 → bulk_add_history API を呼ぶ。既読シリーズの遡及登録を
1操作で完結させる。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Frontend — AddSeries に「既に読んだ巻数」フィールド

**Files:**
- Modify: `frontend/src/pages/AddSeries.jsx`

このタスクで作る挙動:
- 「全巻数」フィールドの直下に **「既に読んだ巻数（任意）」** 数値入力フィールド
- `handleCreate` で `createSeries` 成功後、入力があれば `bulkAddHistory(newId, N)` を続けて呼ぶ
- どちらの段階で失敗したかをエラーメッセージで分離

### - [ ] Step 1: AddSeries.jsx の import に `bulkAddHistory` を追加

ファイル冒頭の import 群に追加:

```jsx
import { bulkAddHistory } from "../api/history.js";
```

### - [ ] Step 2: EMPTY_FORM に `read_up_to` を追加

```jsx
const EMPTY_FORM = {
  title: "",
  author: "",
  author_kana: "",
  publisher: "",
  magazine_label: "",
  total_volumes: "",
  favorite_score: 3,
  status: "active",
  read_up_to: "",
};
```

### - [ ] Step 3: handleCreate を bulk-add 対応に書き換え

既存の `handleCreate`:
```jsx
  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = {
        ...form,
        total_volumes: form.total_volumes ? Number(form.total_volumes) : null,
      };
      await createSeries(payload);
      navigate(form.status === "wishlist" ? "/wishlist" : "/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
```

を以下に置き換え:

```jsx
  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // read_up_to はサーバには送らない（別 API で処理する）
      const { read_up_to, ...rest } = form;
      const payload = {
        ...rest,
        total_volumes: form.total_volumes ? Number(form.total_volumes) : null,
      };
      const created = await createSeries(payload);

      const readUpTo = Number(read_up_to);
      if (Number.isInteger(readUpTo) && readUpTo >= 1) {
        try {
          await bulkAddHistory(created.id, readUpTo);
        } catch (bulkErr) {
          // シリーズは作れたが履歴投入で失敗。シリーズ詳細に移動して
          // ユーザに対応してもらう。
          setError(
            "シリーズは作成されましたが、履歴の一括追加に失敗しました。シリーズ詳細から再試行できます。"
          );
          navigate(`/series/${created.id}`);
          return;
        }
      }
      navigate(form.status === "wishlist" ? "/wishlist" : "/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
```

`createSeries` は `data`（DRF のシリアライズ済みオブジェクト全体）を返すので `created.id` でアクセス可能（[frontend/src/api/series.js:16-19](../../../frontend/src/api/series.js#L16-L19)）。

### - [ ] Step 4: フォームの「全巻数」の直後に「既に読んだ巻数」フィールドを追加

`Labeled label="全巻数..."` の `</Labeled>` 直後に追加:

```jsx
        <Labeled label="既に読んだ巻数（任意）">
          <input
            type="number"
            min="1"
            className="input"
            {...field("read_up_to")}
            placeholder="例: 10"
          />
          <p className="mt-1 text-xs text-slate-500">
            「N巻まで読んだ既存シリーズ」を登録する時に使うと、1〜N 巻の読破記録を一気に作成します。
          </p>
        </Labeled>
```

### - [ ] Step 5: dev で動作確認

ブラウザで `/add` を開いて:
1. 「タイトル: テスト作品 / 既に読んだ巻数: 5」で登録 → ホームに戻る
2. テスト作品の詳細を開き、読破記録に 1〜5 巻が並ぶ
3. ステータスが想定通り（total_volumes 指定無しなら `active`、指定して N==total_volumes なら `completed`）
4. 「既に読んだ巻数」を空のまま登録 → 履歴は作成されない（従来通りの挙動）

### - [ ] Step 6: コミット

```bash
git add frontend/src/pages/AddSeries.jsx
git commit -m "$(cat <<'EOF'
feat(frontend): AddSeries に「既に読んだ巻数」フィールドを追加

シリーズ登録時に N を入力すると、作成直後に bulk_add_history を呼んで
1〜N 巻の読破記録を一気に作る。既読シリーズの遡及登録が1画面で完結する。

シリーズ作成成功後の bulk-add で失敗した場合は、シリーズ詳細にナビゲートして
ユーザが手動で再実行できるようにする。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 完了条件

- [ ] `pytest catalog/tests.py` がすべて PASS（既存 + 新規 6 件）
- [ ] SeriesDetail から N=5 で一括追加できる
- [ ] AddSeries に「既に読んだ巻数=5」を入れて登録すると、SeriesDetail で 1〜5 巻が並ぶ
- [ ] AddSeries で「既に読んだ巻数」空のままだと従来通り履歴は作られない
- [ ] `total_volumes=5` の状態で `to_volume=5` を一括追加するとステータスが `completed` に
- [ ] 3 つのコミットがメインブランチに乗っている
