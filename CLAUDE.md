# CLAUDE.md

このリポジトリで作業する際の Claude 向けメモ。
マンガレンタル管理アプリ。`frontend/`（React/Vite/Tailwind）と `mobile/`（Expo SDK 57 + NativeWind v4 + expo-router）の独立2コードベース + Django REST API。
詳細な知識は knowledge wiki の `wiki/projects/rentalist.md` に累積している。

<!-- BEGIN claude-knowledge (distill 自動管理 / この外側は温存) -->
## 既知の決定・ハマり所（自動蒸留 / 2026-07-10 更新）

- **デプロイは Dokku（DigitalOcean VPS 167.172.65.18, Singapore）**: `git push dokku main` で buildpack 自動デプロイ。**`dokku config:set` で env を変えた後は `dokku ps:rebuild <app>` が必要**（buildpack が env をビルド時に焼き込むため、config:set だけでは反映されない）。ステージングは `rentalist-api-staging.167.172.65.18.nip.io` + Neon staging ブランチ。
- **Neon DB**: Django 本番は Pooled URL（`-pooler`）で可。ただし **`pg_restore` は Direct URL（`-pooler` なし）必須**（pgbouncer transaction mode は startup parameters 不可）。
- **楽天 API の3つの罠**: ① UUID 形式 applicationId は **accessKey + VPS の IP 登録が必須セット**（外すと `accessKey must be present`）。② `seriesName` はレーベル名（「ジャンプコミックス」等）が入るためシリーズ判定に使わない。③ エラーログに API キーが漏れるので `logger.warning("%s", exc)` 禁止 → `_log_api_failure()` ヘルパーを使う。スロットリングは 0.2s（`threading.Lock`）。
- **DRF グローバル `PAGE_SIZE: 100` が全 ViewSet に波及**: 全件返却が必要な ViewSet（カート・履歴等）は `pagination_class = None` で明示上書き。フロントが `data.results ?? data` だと 101 件目以降がサイレントに消える。
- **N+1 は bulk_create で潰す**: Neon RTT が大きいため、100件超のループ `get_or_create()` は gunicorn 30s timeout になる。`bulk_create(items, ignore_conflicts=True)` に集約する（checkout / bulk_add_history で実績）。
- **実機確認は EAS Build → TestFlight**: Expo Go は SDK 57 未対応。`eas build --platform ios --profile production`。owner `anndddoooo` / bundle ID `com.ando.Rentalist`。`app.config.ts` に `usesNonExemptEncryption: false` 設定済み（無いとビルド毎にプロンプト）。
- **デザインは Claude Design「1a Refined」**: ライト `#f6f5f9`/`#fff`/`#1e1b2e`/`#5b21b6`、ダーク `#161226`/`#221c38`/`#f1eefb`/`#8b5cf6`。Tailwind セマンティックトークン経由でライト/ダーク切替。**UI リスタイル時はロジック（ハンドラ・データフェッチ・ルーティング）を変更しない**。
- **Playwright での API 認証**: `RefreshToken.for_user(user)` でトークン生成 → `page.evaluate()` で localStorage に注入（パスワード不要）。CORS は `localhost` 限定のため `127.0.0.1` 不可。
<!-- END claude-knowledge -->
