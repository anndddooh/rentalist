# 一括履歴追加（bulk_add_history）設計

## 背景・目的

既に紙で読破済みのシリーズを Rentalist に登録するときに、現状は
読破記録を 1 巻ずつ手で入力するか、cart → checkout を巻数分繰り返す必要がある。
全巻読破済みの大型シリーズ（例: 全 77 巻）を登録する手間が大きすぎる。

「N 巻まで読んだ」というメタ情報だけ与えれば、1..N 巻分の RentalHistory を
一気に作成する操作を追加する。

## スコープ

含む:
- 新規 API エンドポイント `POST /api/series/<id>/bulk_add_history/`
- SeriesDetail ページからの呼び出し UI
- AddSeries ページからの呼び出し UI（シリーズ作成と続けて）

含まない:
- 既存 RentalHistory CRUD の変更
- 別の巻範囲（例: M〜N）を扱う UI（YAGNI。要望が出たら追加）
- rented_at のユーザー指定（全件「今日」固定）

## 仕様

### バックエンド

**エンドポイント**: `POST /api/series/<id>/bulk_add_history/`

リクエスト:
```json
{ "to_volume": <int> }
```

挙動:
1. 他ユーザーの series_id を指定された場合は 404（既存パターン: `SeriesViewSet.get_queryset` がユーザでフィルタしているため `get_object()` が自然に Http404 を返す）。
2. `to_volume < 1` または整数でなければ 400 (`detail: "to_volume must be >= 1"`).
3. `RentalHistory.objects.bulk_create([RentalHistory(user, series, volume_number=v, rented_at=now) for v in 1..to_volume], ignore_conflicts=True)` で投入。
   `unique_together=(user, series, volume_number)` により既存巻は自動スキップ。
4. `series.recalculate_current_volume()` を呼ぶ
   （既存メソッド：max(volume_number) → current_volume、`total_volumes` に達していれば status=completed 自動遷移）。
5. レスポンス (200):
   ```json
   {
     "detail": "<N>件の読破記録を追加しました。",
     "created": <int>,        // 実際に作成された件数（重複スキップ後）
     "current_volume": <int>,
     "status": "<active|completed>"
   }
   ```

`bulk_create` の戻り値は SQLite では作成件数を返すが Postgres でも同様。
`ignore_conflicts=True` の場合返り値長 ≠ 実作成件数の DB もあるため、
件数は **作成前後の count 差分** で確実に取得する。

### フロントエンド API ヘルパー

`frontend/src/api/history.js` に追加:
```js
export async function bulkAddHistory(seriesId, toVolume) {
  const { data } = await api.post(`/series/${seriesId}/bulk_add_history/`, {
    to_volume: toVolume,
  });
  return data;
}
```

### SeriesDetail UI

「読破記録」セクションのヘッダ右側に `+ N巻まで一括追加` ボタン。クリックで
セクション内に折り畳み展開:

```
┌─────────────────────────────────────────┐
│ 読破記録               + N巻まで一括追加 │
│                                         │
│ [展開時]                                │
│ ┌─ N巻まで一括追加 ─────────────────┐ │
│ │ 巻数: [    ]                        │ │
│ │ 1〜N 巻の読破記録を追加します。     │ │
│ │ 既に登録済みの巻はそのまま残ります。│ │
│ │ [追加]  [キャンセル]                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 既存の履歴リスト                        │
└─────────────────────────────────────────┘
```

実行成功で:
- トースト相当のメッセージ「X件の読破記録を追加しました」を 5 秒表示
- 履歴とシリーズを再取得して描画更新

### AddSeries UI

「全巻数（完結作品のみ・任意）」フィールドの直下に新フィールド:

```
既に読んだ巻数（任意）  [    ]
└ 「N巻まで読んだ既存シリーズ」を登録する時に使うと、
   そのまま N 件の読破記録を作成します。
```

送信時の挙動:
1. `createSeries(payload)` → 新規シリーズ id を取得
2. `read_up_to` が空でなく > 0 なら `bulkAddHistory(newId, read_up_to)` を続けて呼ぶ
3. どちらの段階で失敗したかが分かるようにエラー表示を分ける:
   - 作成失敗: 既存通り
   - 履歴投入のみ失敗: 「シリーズは作成されましたが、履歴の一括追加に失敗しました。シリーズ詳細から再試行できます。」を表示し、SeriesDetail に遷移

## エッジケース

| ケース | 挙動 |
|---|---|
| `to_volume == 0` / 負数 | 400 |
| `to_volume` 巨大値（例 9999） | 制約しない。bulk_create は十分速い |
| 全件既に存在 | 200・`created: 0` |
| status=wishlist で bulk_add | 履歴は作成されるが status は wishlist のまま（既存 `recalculate_current_volume` の仕様により wishlist からの自動遷移はしない）。「読みたい」リストに居続けるのを意図的に残したいケースもあるため、ステータスを変えたい場合は SeriesDetail で手動編集する |
| 他ユーザーの series_id 指定 | 404（SeriesViewSet.get_queryset がユーザでフィルタしているため） |
| 楽天 API 表紙取得 | bulk_add_history 自体は楽天を呼ばない（個別 GET /cover/ で従来通り） |

## テスト

### バックエンド (pytest)

新規 `test_bulk_add_history.py` または既存 `catalog/tests.py` に追加:

1. `test_bulk_add_history_creates_volumes_one_to_n` — 5 を投入して 1〜5 巻分が作成
2. `test_bulk_add_history_skips_existing_volumes` — vol 2,3 が既に存在する状態で to_volume=5 → vol 1,4,5 のみ作成 (`created==3`)
3. `test_bulk_add_history_updates_current_volume` — `series.current_volume == to_volume`
4. `test_bulk_add_history_auto_completes_when_reaches_total_volumes` — `total_volumes=5` で `to_volume=5` → status=completed
5. `test_bulk_add_history_rejects_zero` — `to_volume=0` で 400
6. `test_bulk_add_history_rejects_other_users_series` — other_user の series に対する 404

### フロントエンド

UI テスト基盤が無いため新規追加なし。dev で手動確認:
- AddSeries に「既に読んだ巻数=5」で登録 → SeriesDetail で 1〜5 巻の履歴あり
- SeriesDetail で +1 巻追加（単発手動） → 既存と共存
- SeriesDetail で N=10 で一括追加 → 6〜10 が追加（既存 1〜5 は温存）
- N=total_volumes で status が「読破済み」に変わる

## 影響範囲

| ファイル | 変更 |
|---|---|
| `backend/catalog/views.py` | SeriesViewSet に `@action bulk_add_history` 追加 |
| `backend/catalog/tests.py` または新規 `test_bulk_add_history.py` | テスト追加 |
| `frontend/src/api/history.js` | `bulkAddHistory` 追加 |
| `frontend/src/pages/SeriesDetail.jsx` | 履歴セクションに UI 追加 |
| `frontend/src/pages/AddSeries.jsx` | フォームにフィールド追加、送信フロー更新 |

DB マイグレーションなし。
