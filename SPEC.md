# 漫画レンタル管理アプリ「Rentalist」— 仕様書

## Context
ユーザーは漫画のレンタル読書が趣味。家族とそれぞれが、レンタルショップで「次に借りるべき巻」を即座に把握し、レンタル → 会計 → 進捗繰り上げを片手で完結したい。読まずに返却した場合のロールバック、Wishlist管理、レンタル履歴（読破記録）も必要。さらに、店頭で漫画を探す手掛かり（掲載誌・レーベル / 出版社 / 作者ふりがな）の表示と、ショップごとの貸出有無の管理・絞り込みも行う。本ファイルは grill-me セッション（Q1〜Q15 + 追加グリル）で確定した仕様であり、本プロジェクトの正本。

---

## 1. スタック / インフラ

| レイヤ | 採用 |
|---|---|
| バックエンド | Django + Django REST Framework |
| フロントエンド | React (Vite) + Tailwind CSS（モバイルファースト、PWA化はしない） |
| バックエンドデプロイ | Heroku |
| フロントエンドデプロイ | Cloudflare Pages |
| DB | Heroku Postgres |
| 画像ストレージ | Cloudflare R2（S3互換、`django-storages` 経由） |
| 書籍検索/表紙API | 楽天ブックス書籍検索API |
| 認証 | JWT (`djangorestframework-simplejwt`) |

---

## 2. 認証 / ユーザー管理

- **JWT 認証**。フロントは access token を in-memory、refresh token を `localStorage`
- マルチユーザー（家族で共有利用）。データは **個人ごとにスコープ分離**（各テーブルに `user` FK）
- **招待リンク方式でアカウント発行**:
  - 初期管理者は `createsuperuser`
  - 管理者が招待リンク（ワンタイムトークン、有効期限7日）を発行 ← 設定画面から
  - `/signup?token=xxx` 経由でのみサインアップ画面が開く
  - トークンは1回使用で無効化
- 公開サインアップ画面・新規登録ボタンは無し（ログイン画面とトークン付きサインアップのみ）

```python
class InviteToken(models.Model):
    token       = UUIDField(default=uuid4, unique=True)
    created_by  = ForeignKey(User)
    created_at  = DateTimeField(auto_now_add=True)
    expires_at  = DateTimeField()              # created_at + 7日
    used_at     = DateTimeField(null=True)
    used_by     = OneToOneField(User, null=True)
```

---

## 3. データモデル

```python
class Series(models.Model):
    user            = ForeignKey(User)
    title           = CharField(max_length=200)
    author          = CharField(blank=True)               # 楽天 author から自動 + 手動可
    author_kana     = CharField(blank=True)               # 作者ふりがな。楽天 authorKana から自動 + 手動可
    publisher       = CharField(blank=True)               # 出版社名。楽天 publisherName から自動 + 手動可
    magazine_label  = CharField(blank=True)               # 掲載誌・レーベル（例: 週刊少年ジャンプ / ジャンプコミックス）。手入力のみ
    status          = CharField(choices=[
                        ('active', '進行中'),
                        ('wishlist', 'いつか読みたい'),
                        ('completed', '読破済み'),
                      ])
    current_volume  = PositiveIntegerField(default=0)      # = max(RentalHistory.volume_number) で常に再計算
    total_volumes   = PositiveIntegerField(null=True)      # 完結作品なら全巻数、連載中は null
    favorite_score  = PositiveSmallIntegerField(default=3) # 1〜5 の星
    created_at, updated_at

class VolumeCover(models.Model):                       # 巻ごとの表紙（楽天キャッシュ＋手動データ統合）
    series        = ForeignKey(Series)
    volume_number = PositiveIntegerField()
    image_url     = URLField(blank=True)               # 楽天CDN / 手動URL / R2アップロード後URL
    source        = CharField(choices=['rakuten', 'manual', 'upload'])
    fetched_at    = DateTimeField(auto_now=True)
    class Meta:
        unique_together = ('series', 'volume_number')

class CartItem(models.Model):                          # レンタル予定（カート）
    user          = ForeignKey(User)
    series        = ForeignKey(Series)
    volume_number = PositiveIntegerField()
    added_at      = DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ('user', 'series', 'volume_number')

class RentalHistory(models.Model):                     # 読破記録
    user          = ForeignKey(User)
    series        = ForeignKey(Series)
    volume_number = PositiveIntegerField()
    rented_at     = DateTimeField()
    class Meta:
        unique_together = ('user', 'series', 'volume_number')

class RentalShop(models.Model):                        # レンタルショップ（個人ごとマスタ）
    user       = ForeignKey(User)
    name       = CharField(max_length=100)             # 例: TSUTAYA渋谷店
    memo       = TextField(blank=True)                 # 営業時間・場所・棚の特徴など自由記述
    created_at = DateTimeField(auto_now_add=True)

class ShopAvailability(models.Model):                  # シリーズ × ショップ の貸出状況
    user       = ForeignKey(User)
    series     = ForeignKey(Series)
    shop       = ForeignKey(RentalShop)
    status     = CharField(choices=[
                   ('available', '貸出あり'),
                   ('unavailable', '貸出なし'),
                 ])                                    # 「未確認」はレコード不在で表現
    checked_at = DateTimeField(auto_now=True)
    class Meta:
        unique_together = ('series', 'shop')
```

- 削除挙動: `Series` 削除で `VolumeCover` / `CartItem` / `RentalHistory` / `ShopAvailability` は **CASCADE**
- 削除挙動: `RentalShop` 削除で `ShopAvailability` は **CASCADE**（通常確認モーダル）
- `current_volume` は単一の真実: **常に `max(該当シリーズの RentalHistory.volume_number, default=0)`**。確定・履歴手動追加・履歴削除のすべてで再計算
- **貸出状況の3値**: DB は `available` / `unavailable` の2値＋レコード不在。API レスポンスでは不在を `unknown`（未確認）に正規化して3値で返す

---

## 4. 主要ロジック / ステートマシン

### 「次に借りるべき巻」の計算
```
next_volume = series.current_volume + (該当シリーズのカート内アイテム数) + 1
```
同シリーズの「レンタル」を複数回タップすると連番でカートに積まれる（Q4=A）。

### レンタルフロー
```
[棚で漫画を発見] → 「レンタル」ボタンタップ
  → CartItem 追加（next_volume 巻）
[レジで会計] → 「確定」ボタンタップ
  → トランザクション:
     - 各 CartItem → RentalHistory レコード生成
     - 影響を受けた各 Series の current_volume を再計算
     - current_volume == total_volumes に達したら status=completed に自動遷移（Q8=A）
     - Cart 全削除
```

### ロールバック（読まずに返却 / Q9=B）
- 履歴画面から RentalHistory レコードを削除 → current_volume 再計算
- completed だったシリーズが条件を外れたら active に戻る（双方向）

### 履歴の手動追加（Q9=B）
- 履歴画面の「+ 追加」から シリーズ・巻数・借りた日 を入力
- `unique_together` で同巻の重複登録を防止
- 追加後 current_volume 再計算

### 新規シリーズ追加（Q12=A）
1. タイトル検索 → 楽天ブックスAPI → 候補を表紙サムネ付きで表示
2. 候補選択 → Series 作成（status を active / wishlist から選択）
   - 楽天から `author` / `authorKana` / `publisherName` を `author` / `author_kana` / `publisher` に自動マッピング
   - `magazine_label`（掲載誌・レーベル）は楽天非対応 → 常に空。後から手入力
3. 楽天にヒットしない場合「見つからない」リンク → 手動入力フォームへ
   - 手動入力: タイトル・著者・作者ふりがな・出版社・掲載誌/レーベル・総巻数（任意）・お気に入り度
   - 表紙画像URLの手動設定 / R2への画像アップロードも最初から可能
4. 表紙が無い巻はグレーの「表紙なし」プレースホルダを表示

### ショップ別貸出状況（追加グリル）
- 貸出有無は **シリーズ単位**で記録（巻単位では持たない）
- 状態は `貸出あり` / `貸出なし` / `未確認`。未確認 = `ShopAvailability` レコード不在
- ユーザーが「あり」「なし」をマークした時だけレコード生成。「未確認」に戻す操作はレコード削除
- ステータス編集はホーム / Wishlist / シリーズ詳細のどこからでも可能

### Wishlist → 進行中（Q7=A）
- Wishlist 画面の「読み始める」ボタンで `status` を wishlist → active に変更するのみ
- 1巻目のレンタルはホーム画面から通常フローで行う

### シリーズ削除（Q10=A）
- 強い警告モーダル: 「読破記録 N 件・カート K 件・貸出状況 L 件も完全削除、復元不可」
- シリーズ名をテキスト入力させて「削除」ボタンを有効化（GitHub repo 削除パターン）

---

## 5. 表紙画像（Q13=A）

- 「次の巻」表示時に `VolumeCover` を参照 → 無ければ楽天APIで `"<タイトル> <N>巻"` 検索 → 取得できれば `source=rakuten` で保存（遅延取得・キャッシュ）
- 手動URL設定・アップロードは同テーブルに `source=manual/upload` で上書き
- アップロード画像は Cloudflare R2 に保存（`django-storages` S3バックエンドを R2 エンドポイントへ）

---

## 6. UI 主要画面（モバイルファースト、レスポンシブのみ）

| 画面 | 内容 |
|---|---|
| ログイン | JWT ログイン。サインアップ導線なし |
| サインアップ | `/signup?token=xxx` 経由のみ。トークン検証後にフォーム表示 |
| ホーム | 進行中シリーズ一覧。「次の巻」表紙＋巻数＋★お気に入り度＋「レンタル」ボタン。お気に入り度降順ソート（デフォルト）。上部に**ショップ絞り込みドロップダウン**＋ステータストグル |
| カート | カート内容一覧。各アイテム削除可。「確定」ボタン |
| Wishlist | status=wishlist 一覧。「読み始める」ボタン。ショップ別ステータスの編集は可（絞り込みは無し） |
| 履歴 | RentalHistory 一覧。シリーズフィルタ、「+追加」、レコード削除 |
| シリーズ追加 | タイトル検索 → 楽天候補 → 選択／手動入力フォールバック |
| シリーズ詳細 | 現巻数・完結巻数・お気に入り度・掲載誌/レーベル・出版社・作者(ふりがな)・表紙設定・ショップ別状態編集・関連履歴・編集・削除（強警告） |
| 読破 | status=completed 一覧（読破済みシリーズ） |
| 設定 | ショップ管理（一覧・追加・編集・削除）、招待リンク発行（管理者のみ表示） |

### ホーム画面のショップ絞り込み（追加グリル）
- 上部に「ショップ選択」ドロップダウン。選択するとそのショップの貸出状況でフィルタ
- ステータスのトグルチップ: `あり` `未確認` `なし` — デフォルトは `あり`＋`未確認` ON、`なし` OFF
- **シリーズカードの適応表示**:
  - 通常時（ショップ未選択）: コンパクト（表紙・タイトル・次の巻・★・レンタルボタン）
  - ショップ絞り込み中（=店にいるモード）: 上記＋手掛かり情報（`掲載誌・レーベル` / `出版社` / `作者ふりがな`）＋ショップ状態バッジ＋状態切替ボタン（その場で あり/なし/未確認 を解決）

---

## 7. API エンドポイント（DRF ViewSet ベース）

```
POST   /api/auth/token/                 # JWT発行
POST   /api/auth/token/refresh/
POST   /api/auth/invite/                # 招待トークン発行（管理者のみ）
POST   /api/auth/signup/                # token + ユーザー情報でアカウント作成

GET    /api/series/?status=active|wishlist|completed&shop=<id>
POST   /api/series/
GET    /api/series/{id}/
PATCH  /api/series/{id}/
DELETE /api/series/{id}/                # CASCADE
GET    /api/series/search/?q=...        # 楽天ブックス検索プロキシ

GET    /api/series/{id}/cover/?volume=N # VolumeCover 取得（無ければ楽天遅延取得）
PUT    /api/series/{id}/cover/          # 表紙の手動URL設定 / 画像アップロード
PUT    /api/series/{id}/availability/   # body:{shop_id, status} status=unknown はレコード削除

GET    /api/cart/
POST   /api/cart/                       # body:{series_id} → next_volume をカート追加
DELETE /api/cart/{item_id}/
POST   /api/cart/checkout/              # 確定

GET    /api/history/?series_id=...
POST   /api/history/                    # 手動追加
DELETE /api/history/{id}/               # 読まずに返却 → current_volume 再計算

GET    /api/shops/
POST   /api/shops/
PATCH  /api/shops/{id}/
DELETE /api/shops/{id}/                 # ShopAvailability を CASCADE
```

- `GET /api/series/?shop=<id>` は各シリーズに対象ショップでの貸出状況（`available`/`unavailable`/`unknown`）を注釈して返す

---

## 8. プロジェクト構成

```
Rentalist/
├── backend/
│   ├── manage.py
│   ├── rentalist/              # settings.py 等
│   ├── accounts/               # User拡張・InviteToken・認証
│   ├── catalog/                # Series / VolumeCover / Cart / History / RentalShop / ShopAvailability
│   │   ├── models.py / serializers.py / views.py
│   │   ├── services/rakuten.py # 楽天API連携
│   │   └── tests/
│   ├── Procfile                # web: gunicorn rentalist.wsgi
│   ├── requirements.txt
│   └── runtime.txt
├── frontend/
│   ├── src/
│   │   ├── api/                # axios + JWT インターセプタ
│   │   ├── pages/              # Login / Signup / Home / Cart / Wishlist / History / AddSeries / SeriesDetail / Completed / Settings
│   │   ├── components/
│   │   └── hooks/
│   ├── package.json
│   └── (Cloudflare Pages 設定: _redirects で SPA ルーティング)
└── README.md
```

---

## 9. 実装フェーズ

**進め方: Phase 1〜4 を一括で実装し、最後に通しでレビュー（Q15=B）。** Phase 5（デプロイ）はユーザー側の事前準備完了後。

1. **Backend** — Django初期化、モデル6種、JWT認証、招待トークン、Series/Cart/History/Shop/Availability CRUD API
2. **Frontend** — Vite+React+Tailwind、ログイン／サインアップ、ホーム、カート→確定、履歴
3. **検索・表紙** — 楽天API連携、シリーズ追加フロー、VolumeCover 遅延取得、手動URL/R2アップロード
4. **付随機能** — Wishlist、お気に入り度ソート、履歴手動追加、削除の強警告、シリーズ詳細・編集、完結画面、ショップ管理・絞り込み、設定画面
5. **デプロイ** — Heroku（Postgres、env vars）、Cloudflare Pages、R2バケット、CORS設定、招待リンクで家族アカウント発行

ローカル開発は楽天APIキーがあれば全機能を実装可能。キー未取得の間は楽天連携部分をモックで進行可。R2 もローカルは Django のローカルファイルストレージで代替し、デプロイ時に R2 へ切替。

---

## 10. 検証方法

- バックエンド: `pytest`。レンタル→確定→履歴削除→current_volume 再計算 / 履歴手動追加 / 完結自動遷移 / ショップ別貸出状況の更新・絞り込み を統合テストで保証
- フロントエンド: Vitest + React Testing Library で主要コンポーネント
- E2E: Playwright で「招待リンクでサインアップ → シリーズ追加 → レンタル → 確定 → 履歴削除で巻数が戻る → ショップ絞り込み」を通し検証
- 手動: Heroku/Cloudflare デプロイ後、家族で実際にレンタルショップで使用

---

## 11. 事前準備（ユーザー対応事項）

- [ ] 楽天デベロッパー登録 → アプリID（API キー）取得 → Heroku env var に設定
- [ ] Cloudflare R2 バケット作成 → アクセスキー取得
- [ ] Heroku アカウント / アプリ作成
- [ ] Cloudflare Pages プロジェクト作成

## 12. デフォルト確定事項（軽微・実装時に微調整可）

- お気に入り度: ★1〜5、新規シリーズのデフォルトは ★3
- ホーム画面デフォルトソート: お気に入り度の降順 → 同点はタイトル昇順
- 作者ふりがな: 作者名の近傍に小さめテキストで表示
- ショップ状態バッジ: あり=緑 / なし=グレー / 未確認=黄
- アプリ名: 「Rentalist」（ディレクトリ名より）
