# Rentalist デプロイ手順

バックエンドを **VPS (DigitalOcean) + Dokku**、フロントエンドを Cloudflare Pages、
画像を Cloudflare R2、DB を Neon に公開する。
構成は `backend/`（Django）と `frontend/`（React）のモノレポ。

順番は **1 → 2 → 3 →（4）→ 5 → 6**。4（R2）は画像アップロード機能を使う場合のみ必要で、後回しでもよい。

---

## 1. 楽天ブックスAPI の登録

シリーズ検索と表紙取得に使う。未登録でもアプリは動く（モックデータになる）が、実データにするには必要。

1. <https://webservice.rakuten.co.jp/> にアクセスし、楽天会員でログイン
2. 「アプリID発行」からアプリを新規登録。フォーム記入内容:
   - アプリ名: 任意 / アプリURL: 仮で可
   - **アプリケーションタイプ**: バックエンドサービス（Django がサーバー間で呼ぶため）
   - **許可されたIPアドレス**: 後で VPS の IP を登録する（手順2-1参照）。
     ローカル開発機の IP も追加可
   - **データ利用目的**: 例「家族向けの漫画レンタル進捗管理アプリで、漫画の検索と
     書影表示に利用。非営利・個人利用」
   - **予想QPS**: `1`（表紙はキャッシュ + バックエンドでスロットリングするため実リクエストは少ない）
3. 発行画面で **applicationId** と **accessKey** の両方を控える
   → それぞれ `RAKUTEN_APP_ID`・`RAKUTEN_ACCESS_KEY`。
   両方そろわないと実APIを呼ばずモック動作になる

---

## 2. VPS（DigitalOcean）+ Dokku 構築

### 2-1. Droplet 作成
1. <https://www.digitalocean.com/> にサインアップ（新規 $200/60日クレジット）
2. **Create → Droplets** で以下を選択:
   - **Region**: Singapore（東京リージョンが新規閉鎖中の場合）
   - **Image**: Ubuntu 24.04 LTS x64
   - **Size**: Basic Regular SSD **$6/月**（1GB / 1vCPU / 25GB SSD）
   - **Authentication**: SSH Key（ローカル `~/.ssh/id_ed25519.pub` を登録）
   - **Hostname**: `dokku-host` など
3. 作成完了後、**割り当てられた IPv4 アドレス**を控える（例: `139.59.123.45`）
4. **楽天デベロッパーポータルでこのIPを「許可されたIPアドレス」に追加**（手順1で
   登録したアプリの設定画面）

### 2-2. Dokku インストール
SSH で接続して Dokku の公式インストーラを実行:

```bash
ssh root@<VPS_IP>

# 1GB RAM の Droplet では Dokku のビルドが OOM しがちなので、保険で 2GB swap を作成
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo "/swapfile none swap sw 0 0" >> /etc/fstab

# システム更新
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
  -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

# Dokku 最新版インストール（10〜15分ほどかかる）
# 注: v0.38.x 以降が Ubuntu 24.04 をサポート（古いバージョンは未サポート）
wget -NP . https://dokku.com/install/v0.38.8/bootstrap.sh
sudo DOKKU_TAG=v0.38.8 bash bootstrap.sh

# 全体ドメイン設定（apps.<VPS_IP>.nip.io を使う：DNS不要）
# nip.io は IP をホスト名としてそのまま返してくれる無料サービス
dokku domains:set-global <VPS_IP>.nip.io

# SSH 公開鍵を登録（あなたの ~/.ssh/id_ed25519.pub の内容を渡す）
echo "<your-ssh-pubkey>" | dokku ssh-keys:add admin
```

### 2-3. Let's Encrypt プラグイン（HTTPS化）
```bash
sudo dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git
dokku letsencrypt:set --global email <your-email@example.com>
dokku letsencrypt:cron-job --add  # 自動更新の cron 設定
```

### 2-4. rentalist-api アプリ作成
```bash
# アプリ作成
dokku apps:create rentalist-api

# モノレポ対応（buildpack で backend/ をルート扱い）
dokku buildpacks:add rentalist-api https://github.com/lstoll/heroku-buildpack-monorepo
dokku buildpacks:add rentalist-api https://github.com/heroku/heroku-buildpack-python
dokku config:set rentalist-api APP_BASE=backend

# 環境変数
dokku config:set rentalist-api \
  SECRET_KEY="$(openssl rand -base64 50)" \
  DEBUG=False \
  RAKUTEN_APP_ID="（手順1のapplicationId）" \
  RAKUTEN_ACCESS_KEY="（手順1のaccessKey）" \
  DATABASE_URL="（Neon のpostgresql://...?sslmode=require）" \
  CORS_ALLOWED_ORIGINS="https://（手順5のPagesのURL）" \
  USE_R2=False
```

### 2-5. ローカルから push（手元の作業）
```bash
cd /Users/hironori/Documents/01-Project/Rentalist
git remote add dokku dokku@<VPS_IP>:rentalist-api
git push dokku main
```
- `release` フェーズで `migrate` が自動実行（Procfile）
- 静的ファイルは `collectstatic` 自動実行

### 2-6. HTTPS 化
```bash
ssh root@<VPS_IP>
dokku letsencrypt:enable rentalist-api
```

これで `https://rentalist-api.<VPS_IP>.nip.io` でアクセス可能。

### 2-7. 管理者アカウント作成
```bash
dokku run rentalist-api python manage.py createsuperuser
```

---

## 3. データベース（Neon）

Neon は Heroku から切り出し済の前提。Neon ダッシュボードの connection string
（`postgresql://...neon.tech/neondb?sslmode=require`）を手順2-4 の `DATABASE_URL`
に設定する。

新規 Neon プロジェクトを作る場合:
1. <https://console.neon.tech/> でサインアップ
2. **Create Project** → リージョンは AWS Asia Pacific (Singapore) など
3. Connection Details の `Pooled connection` の URL を控える
4. Free プランは 0.5GB / 月191時間で家族用途には十分

---

## 4.（任意）画像ストレージ Cloudflare R2

「表紙の画像アップロード」機能を本番で使う場合のみ必要。
楽天取得・URL指定の表紙は R2 なしでも動く（VPS のファイルシステムは
デプロイで消える可能性があり、永続化が必要なファイル保存だけ R2 が要る）。

1. Cloudflare ダッシュボード → R2 → バケット作成（例: `rentalist-media`）
2. R2 API トークンを発行 → アクセスキーID / シークレットキーを控える
3. バケットを公開（Public Development URL を有効化）し、公開URLを控える
4. Dokku に設定:
```bash
dokku config:set rentalist-api \
  USE_R2=True \
  R2_ACCESS_KEY_ID=... \
  R2_SECRET_ACCESS_KEY=... \
  R2_BUCKET_NAME=rentalist-media \
  R2_ENDPOINT_URL=https://（アカウントID）.r2.cloudflarestorage.com \
  R2_PUBLIC_URL=https://（公開URL）
```

---

## 5. フロントエンド（Cloudflare Pages）

1. コードを GitHub にプッシュ（Pages は GitHub 連携が簡単）
2. Cloudflare ダッシュボード → Workers & Pages → Pages → Git 連携でリポジトリを選択
3. ビルド設定:
   - **ルートディレクトリ**: `frontend`
   - **ビルドコマンド**: `npm run build`
   - **出力ディレクトリ**: `dist`
4. 環境変数: `VITE_API_BASE_URL` = `https://rentalist-api.<VPS_IP>.nip.io`
   （アプリのルートURL。`/api` は付けない・末尾スラッシュも付けない）
5. デプロイ実行 → 払い出された `https://xxx.pages.dev` を控える
6. SPA ルーティングは `wrangler.jsonc` で対応済み

### 5-1. CORS の最終調整
手順2-4で仮置きした `CORS_ALLOWED_ORIGINS` を、確定した Pages の URL に更新:
```bash
dokku config:set rentalist-api CORS_ALLOWED_ORIGINS="https://xxx.pages.dev"
```

---

## 6. 家族アカウントの発行

1. `https://xxx.pages.dev` を開き、手順2-7で作った管理者でログイン
2. 設定画面 →「招待リンク」を発行
3. 発行された `/signup?token=...` のリンクを家族に共有 → 各自サインアップ

---

## 7. DB バックアップ（Neon → R2 オフサイト退避）

Neon の Point-in-Time Restore は無料プランだと数時間〜最大24時間しか遡れない。
誤操作や Neon 側障害に備え、`backup_db` 管理コマンドで日次の論理バックアップを
Cloudflare R2 に退避する。データが小さいので `pg_dump` ではなく Django の
`dumpdata`（JSON + gzip、追加バイナリ不要）を使う。

### 7-1. バックアップ用 R2 バケットの用意
画像用バケットとは**分ける**（誤削除・取り違え防止）。手順4と同じ要領で
`rentalist-backups` などのバケットを作成する。**公開は不要**（非公開のまま）。
認証情報は画像用と同じトークンを使い回してよい（その場合 `BACKUP_R2_*` は
省略でき、`R2_*` に自動フォールバックする）。

```bash
dokku config:set rentalist-api \
  BACKUP_R2_BUCKET_NAME=rentalist-backups
  # 画像用と別のトークンにする場合のみ以下も設定:
  # BACKUP_R2_ACCESS_KEY_ID=... BACKUP_R2_SECRET_ACCESS_KEY=... \
  # BACKUP_R2_ENDPOINT_URL=https://（アカウントID）.r2.cloudflarestorage.com
  # 保持世代を変える場合（既定30）: BACKUP_RETENTION=30
```

USE_R2=False（画像はローカル運用）のままでも、上記のバックアップ用認証情報さえ
あれば DB バックアップは動く。

### 7-2. 手動実行で動作確認
```bash
dokku run rentalist-api python manage.py backup_db
# → s3://rentalist-backups/db-backups/rentalist-YYYYMMDDThhmmssZ.json.gz が作られ、
#    30世代を超えた古い分は自動削除される
```
ネット接続なしで中身だけ確認したい場合は `--local-only`（カレントに gz を出力）。

### 7-3. cron で日次自動実行
Dokku ホストの crontab に登録する（毎日 03:15 JST に実行する例）:
```bash
ssh root@<VPS_IP>
crontab -e
# 以下を追記（dokku はフル パスで呼ぶと cron 環境でも確実）
15 18 * * * /usr/bin/dokku run rentalist-api python manage.py backup_db >> /var/log/rentalist-backup.log 2>&1
```
- cron の時刻は UTC。`15 18` = 翌 03:15 JST。
- 実行ログは `/var/log/rentalist-backup.log` に残る。失敗時はここを確認。

### 7-4. リストア手順（復旧時）
新しい空 DB（Neon の新ブランチ／新プロジェクト等）に流し込む。`dokku run` は
都度クリーンなコンテナを作りホストのファイルが見えないため、**手元の作業マシンで
`DATABASE_URL` を復旧先に向けて実行する**のが確実。

```bash
cd backend
# 1. R2 から最新ダンプを取得（Cloudflare ダッシュボード or rclone/aws s3 cp）
#    例: aws s3 cp s3://rentalist-backups/db-backups/rentalist-XXXX.json.gz . \
#          --endpoint-url https://（アカウントID）.r2.cloudflarestorage.com
gunzip rentalist-XXXX.json.gz          # → rentalist-XXXX.json（loaddata は .json 拡張子が必要）

# 2. 復旧先 DB を指定してスキーマを作成 → データ投入
export DATABASE_URL="postgresql://...（復旧先 Neon）...?sslmode=require"
./venv/bin/python manage.py migrate --noinput
./venv/bin/python manage.py loaddata rentalist-XXXX.json
```
マイグレーションはリポジトリにあるので `migrate` → `loaddata` だけで戻る。
（contenttypes / permission / session は除外済みで `migrate` が再生成する。）
復旧確認後、Dokku の `DATABASE_URL` をこの新 DB に差し替える。

---

## 8. ステージング環境（rentalist-api-staging）

iOS アプリ（`mobile/`）や検証ブランチを本番データを汚さず試すための、
同一 VPS 上の別 Dokku アプリ。**構築済み**（2026-07）。

| | 本番 | ステージング |
|---|---|---|
| アプリ名 | `rentalist-api` | `rentalist-api-staging` |
| URL | `https://rentalist-api.167.172.65.18.nip.io` | `https://rentalist-api-staging.167.172.65.18.nip.io` |
| git remote | `dokku` | `dokku-staging` |
| DB | Neon（本番ブランチ） | Neon の **staging 用 DB**（下記 8-2） |

### 8-1. 構築コマンド（実施済みの記録）
```bash
ssh dokku@167.172.65.18 apps:create rentalist-api-staging
ssh dokku@167.172.65.18 buildpacks:add rentalist-api-staging https://github.com/lstoll/heroku-buildpack-monorepo
ssh dokku@167.172.65.18 buildpacks:add rentalist-api-staging https://github.com/heroku/heroku-buildpack-python
ssh dokku@167.172.65.18 config:set rentalist-api-staging \
  APP_BASE=backend DEBUG=False SECRET_KEY=（新規生成） \
  ALLOWED_HOSTS=rentalist-api-staging.167.172.65.18.nip.io \
  RAKUTEN_APP_ID=（本番から複製） RAKUTEN_ACCESS_KEY=（本番から複製) \
  USE_R2=False
git remote add dokku-staging dokku@167.172.65.18:rentalist-api-staging
git push dokku-staging <検証ブランチ>:main   # ← 検証ブランチをそのままデプロイできる
ssh dokku@167.172.65.18 letsencrypt:enable rentalist-api-staging
```

### 8-2. ステージング用 DB（Neon）
`DATABASE_URL` 未設定の間はコンテナ内 SQLite で動く（**再デプロイでデータが消える**）。
恒久的なステージング DB にするには Neon で staging 用ブランチ（または DB）を作る:

1. <https://console.neon.tech/> → 本番プロジェクト → **Branches → Create branch**
   （名前: `staging`。本番データのコピー付きで作られるので即テストデータになる）
2. その branch の **Pooled connection** URL を控える
3. `ssh dokku@167.172.65.18 config:set rentalist-api-staging DATABASE_URL="postgresql://...?sslmode=require"`

Neon Free プランの compute 時間はブランチ合算だが、アイドル自動停止するので
家族用途では実質問題ない（初回アクセスのコールドスタート数秒は許容）。

### 8-3. テストアカウント
```bash
ssh dokku@167.172.65.18 run rentalist-api-staging python manage.py createsuperuser
```
（SQLite 運用の間は再デプロイごとに消えるので、都度作り直すか 8-2 を先に済ませる）

### 8-4. 使い分け
- **iOS アプリ**: `mobile/` の staging 環境（`APP_ENV=staging` / Expo Go では
  `EXPO_PUBLIC_API_URL=https://rentalist-api-staging.167.172.65.18.nip.io npx expo start`）が
  このステージングを向く。詳細は `mobile/README.md`。
- **Web/バックエンドの検証**: 検証ブランチを `git push dokku-staging <branch>:main` で
  デプロイして本番相当で確認 → OK なら main にマージして本番へ。

---

## 環境変数まとめ

### Dokku（バックエンド）
| 変数 | 値 |
|---|---|
| `SECRET_KEY` | ランダム文字列 |
| `DEBUG` | `False` |
| `RAKUTEN_APP_ID` | 楽天の applicationId |
| `RAKUTEN_ACCESS_KEY` | 楽天の accessKey |
| `DATABASE_URL` | Neon の connection string |
| `CORS_ALLOWED_ORIGINS` | Pages の URL |
| `APP_BASE` | `backend` |
| `USE_R2` ほか R2 系 | R2 を使う場合のみ |
| `BACKUP_R2_BUCKET_NAME` | DB バックアップ退避先バケット（手順7。画像用と分ける） |
| `BACKUP_R2_*` / `BACKUP_RETENTION` | バックアップ用の認証・保持世代（手順7。未設定の認証は `R2_*` を流用） |

### Cloudflare Pages（フロントエンド）
| 変数 | 値 |
|---|---|
| `VITE_API_BASE_URL` | Dokku アプリの URL（`https://rentalist-api.<VPS_IP>.nip.io`） |

---

## 運用 Tips

### OS アップデート
```bash
ssh root@<VPS_IP>
apt update && apt upgrade -y
reboot
```
月1回程度。

### ログ確認
```bash
dokku logs rentalist-api -t   # tail -f 相当
```

### 別アプリの追加
同じ VPS に追加料金なしで複数アプリを乗せられる:
```bash
dokku apps:create another-app
dokku buildpacks:add another-app ...
dokku config:set another-app ...
# ローカルで git remote add dokku-another dokku@<VPS_IP>:another-app && git push dokku-another main
dokku letsencrypt:enable another-app
```

### バックアップ
- DB: Neon の Point-in-Time Restore（リストアウィンドウ）。**Free プランは最大24時間**
  （デフォルトは約6〜7時間程度）。7日保持にしたい場合は有料プラン（Launch 以上）が必要。
  これを補うため日次の論理バックアップを R2 に退避する仕組みを用意済み
  → **手順7（`backup_db` + cron）** を参照。
- VPS: DigitalOcean の Snapshot 機能（$0.06/GB/月、月1スナップショット推奨）
