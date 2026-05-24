# Rentalist デプロイ手順

バックエンドを Heroku、フロントエンドを Cloudflare Pages、画像を Cloudflare R2 に公開する。
構成は `backend/`（Django）と `frontend/`（React）のモノレポ。

順番は **1 → 2 →（3）→ 4 → 5**。3（R2）は画像アップロード機能を使う場合のみ必要で、後回しでもよい。

---

## 1. 楽天ブックスAPI の登録

シリーズ検索と表紙取得に使う。未登録でもアプリは動く（モックデータになる）が、実データにするには必要。

1. <https://webservice.rakuten.co.jp/> にアクセスし、楽天会員でログイン
2. 「アプリID発行」からアプリを新規登録。フォーム記入内容:
   - アプリ名: 任意 / アプリURL: 仮で可
   - **アプリケーションタイプ**: ウェブアプリ（applicationId のみで利用するためIP制限なし）
   - **データ利用目的**: 例「家族向けの漫画レンタル進捗管理アプリで、漫画の検索と
     書影表示に利用。非営利・個人利用」
   - **予想QPS**: `1`（表紙はキャッシュするため実リクエストは少ない）
3. 発行画面で **applicationId** を控える → `RAKUTEN_APP_ID`。
   未設定なら実APIを呼ばずモック動作になる
   - accessKey は本アプリでは使用しない（IP登録不要の applicationId 単独で運用）
   - 楽天の推奨レート「1秒1リクエスト程度」はバックエンドのスロットリングで担保

---

## 2. バックエンド（Heroku）

### 2-1. 準備
- Heroku アカウント作成、Heroku CLI をインストール（`brew install heroku/brew/heroku`）
- `heroku login`

### 2-2. アプリ作成と monorepo 設定
`backend/` をサブディレクトリのままデプロイするため monorepo buildpack を使う。

```bash
cd /Users/hironori/Documents/01-Project/Rentalist
heroku create rentalist-api          # アプリ名は任意。控えておく

# backend/ をルートとして扱う buildpack 構成
heroku buildpacks:add -i 1 https://github.com/lstoll/heroku-buildpack-monorepo
heroku buildpacks:add heroku/python
heroku config:set APP_BASE=backend

# Postgres
heroku addons:create heroku-postgresql:essential-0
```

### 2-3. 環境変数
```bash
heroku config:set \
  SECRET_KEY="$(python3 -c 'import secrets;print(secrets.token_urlsafe(50))')" \
  DEBUG=False \
  RAKUTEN_APP_ID="（手順1のapplicationId）" \
  CORS_ALLOWED_ORIGINS="https://（手順4のPagesのURL）" \
  USE_R2=False
```
- 楽天APIは applicationId 単独で呼ぶためIP制限なし。静的IPアドオン（Fixie 等）は不要
- `DATABASE_URL` は Postgres アドオンが自動設定する
- `ALLOWED_HOSTS` は未設定でOK（`.herokuapp.com` を自動許可）
- フロントの URL が未確定なら、手順4のあとで `CORS_ALLOWED_ORIGINS` を設定し直す

### 2-4. デプロイ
```bash
git push heroku feature/mvp-build:main   # main にマージ済みなら git push heroku main
```
- `release` フェーズで `migrate` が自動実行される（Procfile）
- 静的ファイルは buildpack が `collectstatic` を自動実行

### 2-5. 管理者アカウント作成
```bash
heroku run python manage.py createsuperuser
```

---

## 3.（任意）画像ストレージ Cloudflare R2

「表紙の画像アップロード」機能を本番で使う場合のみ必要。
楽天取得・URL指定の表紙は R2 なしでも動く（Heroku のファイルシステムは再起動で消えるため、
アップロード機能だけは R2 が無いと保存が消える）。

1. Cloudflare ダッシュボード → R2 → バケット作成（例: `rentalist-media`）
2. R2 API トークンを発行 → アクセスキーID / シークレットキーを控える
3. バケットを公開（Public Development URL を有効化）し、公開URLを控える
4. Heroku に設定:
```bash
heroku config:set \
  USE_R2=True \
  R2_ACCESS_KEY_ID=... \
  R2_SECRET_ACCESS_KEY=... \
  R2_BUCKET_NAME=rentalist-media \
  R2_ENDPOINT_URL=https://（アカウントID）.r2.cloudflarestorage.com \
  R2_PUBLIC_URL=https://（公開URL）
```

---

## 4. フロントエンド（Cloudflare Pages）

1. コードを GitHub にプッシュ（Pages は GitHub 連携が簡単）
2. Cloudflare ダッシュボード → Workers & Pages → Pages → Git 連携でリポジトリを選択
3. ビルド設定:
   - **ルートディレクトリ**: `frontend`
   - **ビルドコマンド**: `npm run build`
   - **出力ディレクトリ**: `dist`
4. 環境変数: `VITE_API_BASE_URL` = `https://（手順2のHerokuアプリURL）`
   （アプリのルートURL。`/api` は付けない・末尾スラッシュも付けない）
5. デプロイ実行 → 払い出された `https://xxx.pages.dev` を控える
6. SPA ルーティングは `frontend/public/_redirects` で対応済み

### 4-1. CORS の最終調整
手順2-3で仮置きした `CORS_ALLOWED_ORIGINS` を、確定した Pages の URL に更新:
```bash
heroku config:set CORS_ALLOWED_ORIGINS="https://xxx.pages.dev"
```

---

## 5. 家族アカウントの発行

1. `https://xxx.pages.dev` を開き、手順2-5で作った管理者でログイン
2. 設定画面 →「招待リンク」を発行
3. 発行された `/signup?token=...` のリンクを家族に共有 → 各自サインアップ

---

## 環境変数まとめ

### Heroku（バックエンド）
| 変数 | 値 |
|---|---|
| `SECRET_KEY` | ランダム文字列 |
| `DEBUG` | `False` |
| `RAKUTEN_APP_ID` | 楽天の applicationId |
| `CORS_ALLOWED_ORIGINS` | Pages の URL |
| `DATABASE_URL` | Postgres アドオンが自動設定 |
| `APP_BASE` | `backend` |
| `USE_R2` ほか R2 系 | R2 を使う場合のみ |

### Cloudflare Pages（フロントエンド）
| 変数 | 値 |
|---|---|
| `VITE_API_BASE_URL` | Heroku アプリの URL |
