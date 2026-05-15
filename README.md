# Rentalist — 漫画レンタル管理アプリ

家族でレンタルショップを使いながら、各漫画シリーズを「次に何巻を借りればいいか」管理するWebアプリA。
レンタル → 会計（確定）→ 巻数繰り上げ、読まずに返却した場合のロールバック、Wishlist、
読破履歴、ショップ別の貸出状況の管理・絞り込みに対応する。

仕様の詳細は [SPEC.md](./SPEC.md) を参照。

## 構成

| | |
|---|---|
| `backend/` | Django + Django REST Framework（JWT 認証）。Heroku デプロイ |
| `frontend/` | React (Vite) + Tailwind CSS。Cloudflare Pages デプロイ |

## ローカル開発

### バックエンド

```bash
cd backend
python3.12 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env            # 必要に応じて編集（RAKUTEN_APP_ID 等）
./venv/bin/python manage.py migrate
./venv/bin/python manage.py createsuperuser   # 初期管理者
./venv/bin/python manage.py runserver
```

- `RAKUTEN_APP_ID` 未設定でも、楽天連携はモックデータで動作する。
- アップロード画像は `USE_R2=False` の間はローカル `media/` に保存される。
- テスト: `./venv/bin/python -m pytest`

### フロントエンド

```bash
cd frontend
npm install
cp .env.example .env            # VITE_API_BASE_URL を確認
npm run dev                     # http://localhost:5173
npm run build                   # 本番ビルド → dist/
```

## アカウント発行（招待リンク方式）

1. 管理者を `createsuperuser` で作成
2. 管理者でログイン → 設定画面で「招待リンク」を発行
3. 発行された `/signup?token=...` を家族に共有 → サインアップ
4. トークンは7日間有効・1回のみ使用可能

## デプロイ

- **バックエンド (Heroku)**: Postgres アドオン、環境変数（`SECRET_KEY` / `DEBUG=False` /
  `RAKUTEN_APP_ID` / `CORS_ALLOWED_ORIGINS` / R2 関連 / `DATABASE_URL`）を設定。
  `Procfile` の `release` フェーズで自動マイグレーション。
- **フロントエンド (Cloudflare Pages)**: ビルドコマンド `npm run build`、出力 `dist/`。
  `public/_redirects` で SPA ルーティングに対応。`VITE_API_BASE_URL` に Heroku の URL を設定。
- **画像 (Cloudflare R2)**: バケットを作成し `USE_R2=True` と R2 認証情報を設定。
