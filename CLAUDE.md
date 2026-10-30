# CLAUDE.md

このリポジトリで作業する際の Claude 向けメモ。
マンガレンタル管理アプリ。`frontend/`（React/Vite/Tailwind）と `mobile/`（Expo SDK 57 + NativeWind v4 + expo-router）の独立2コードベース + Django REST API。
詳細な知識は knowledge wiki の `wiki/projects/rentalist.md` に累積している。

<!-- BEGIN claude-knowledge (distill 自動管理 / この外側は温存) -->
## 既知の決定・ハマり所（自動蒸留 / 2026-10-30 更新）

- **シリーズ検索・表紙取得は楽天ブックス＋楽天 Kobo の併用（2026-10-30 本番反映）**: 紙の書籍検索は `title` 部分一致でひらがな・カタカナ読み・表記ゆれに弱く（表記ゆれ42クエリで 18/42）、**Kobo 検索は 42/42**。Kobo は `seriesName` が本物のシリーズ名・`authorKana`・表紙あり（ISBN なし、出版社は電子配信元のことがある → 候補に「電子版」ラベル）。候補はシリーズ単位に集約し、両方にある作品は紙の出版社を優先。楽天は1秒間隔でも 429 を返すことがあり1回だけ再試行する。Google Books（キー必須）・NDL（タイムアウト多発）は見送り済みなので再調査しない。英語タイトル作品をカタカナで検索すると関連本が上に来る（例「ワンピース」）のは既知の未対応事項。

- **Web/iOS の UX は揃える**: 操作結果（成功・エラー）は両アプリとも画面上部トーストで出す（フォーム内メッセージは使わない）。iOS は Web の移植で、改善が片方にだけ入ることがあったので、片方を直したらもう片方の同パターンを grep する。
- **ダークモードの「濃色地＋白文字」反転に注意**: チップ・統計カード・サイドバーのカート・表紙上の巻数ラベルで読めなくなった。UI 修正後は Playwright でライト/ダーク × スマホ/PC 幅を撮って確認する（履歴グラフの棒が出ない既存バグもこれで発見）。
- **`develop` ブランチあり（2026-10-25 新設）**: develop から作業ブランチを切り、develop → main は `--no-ff`。マージ済み作業ブランチは `git branch -d` で削除できる（2026-10-30 確認）。
- **Web 本番は GitHub 連携で main への push が即デプロイ**。iOS は EAS Build → TestFlight が別途必要。

- **表示が遅い主因は Neon が us-east-1（VPS はシンガポール、1 クエリ約 0.2s）＋ gunicorn が sync 1 ワーカー**（2026-10-22 実測）。手順は `plans/perf-slow-page-load-handoff.md`。性能改善では N+1 より先に「DB 距離」と「ワーカー並列化」を疑う。Neon 移行時は新リージョンで新規プロジェクト作成（リージョン変更不可）。
- **対策1〜4（gthread / Neon シンガポール移行 / 起動時の /auth/me/ 省略 / 表紙の未取得結果キャッシュ）は 2026-10-25 に本番反映済み**（DB は Neon ap-southeast-1 の新プロジェクト。経緯は `plans/perf-slow-page-load-handoff.md`）。staging は新 Neon プロジェクトの `rentalist_staging` DB を使用中。staging 用 Web は `cd frontend && npm run deploy:staging`（https://rentalist-staging.annndddddooooooo.workers.dev）。
- **`conn_health_checks=True` は DB が VPS と同リージョンである前提**: DB が米国にあった間は確認クエリの往復で +0.23 秒/リクエスト悪化した（staging 実測）。ブランチでは移行に合わせて有効化済み（01d83a2）。
- 並列化の効果は「同時 N 本送信」で測る（1 本だけでは差が出ない）。
- Claude Code からは本番 VPS への root SSH・本番 `dokku run`・本番ログ読み取り・amend が権限拒否される。計測は curl と `dokku config:get` で行い、試験変更は一時ブランチで試す。楽天 API など VPS の IP 登録が要る API の実データ検証は staging の `dokku run rentalist-api-staging python -c ...` で行える（引数は dokku が eval し直すので base64 化＋括弧・引用符のエスケープが必要）。

- **デプロイは Dokku（DigitalOcean VPS 167.172.65.18, Singapore）**: `git push dokku main` で buildpack 自動デプロイ。**`dokku config:set` で env を変えた後は `dokku ps:rebuild <app>` が必要**（buildpack が env をビルド時に焼き込むため、config:set だけでは反映されない）。ステージングは `rentalist-api-staging.167.172.65.18.nip.io` + Neon staging ブランチ。
- **Neon DB**: Django 本番は Pooled URL（`-pooler`）で可。ただし **`pg_restore` は Direct URL（`-pooler` なし）必須**（pgbouncer transaction mode は startup parameters 不可）。
- **楽天 API の3つの罠**: ① UUID 形式 applicationId は **accessKey + VPS の IP 登録が必須セット**（外すと `accessKey must be present`）。② `seriesName` はレーベル名（「ジャンプコミックス」等）が入るためシリーズ判定に使わない。③ エラーログに API キーが漏れるので `logger.warning("%s", exc)` 禁止 → `_log_api_failure()` ヘルパーを使う。スロットリングは 0.2s（`threading.Lock`）。
- **DRF グローバル `PAGE_SIZE: 100` が全 ViewSet に波及**: 全件返却が必要な ViewSet（カート・履歴等）は `pagination_class = None` で明示上書き。フロントが `data.results ?? data` だと 101 件目以降がサイレントに消える。
- **N+1 は bulk_create で潰す**: Neon RTT が大きいため、100件超のループ `get_or_create()` は gunicorn 30s timeout になる。`bulk_create(items, ignore_conflicts=True)` に集約する（checkout / bulk_add_history で実績）。
- **実機確認は EAS Build → TestFlight**: Expo Go は SDK 57 未対応。`eas build --platform ios --profile production`。owner `anndddoooo` / bundle ID `com.ando.Rentalist`。`app.config.ts` に `usesNonExemptEncryption: false` 設定済み（無いとビルド毎にプロンプト）。
- **デザインは Claude Design「1a Refined」**: ライト `#f6f5f9`/`#fff`/`#1e1b2e`/`#5b21b6`、ダーク `#161226`/`#221c38`/`#f1eefb`/`#8b5cf6`。Tailwind セマンティックトークン経由でライト/ダーク切替。**UI リスタイル時はロジック（ハンドラ・データフェッチ・ルーティング）を変更しない**。
- **Playwright での API 認証**: `RefreshToken.for_user(user)` でトークン生成 → `page.evaluate()` で localStorage に注入（パスワード不要）。CORS は `localhost` 限定のため `127.0.0.1` 不可。
<!-- END claude-knowledge -->
