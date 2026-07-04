# Rentalist iOS アプリ（Expo / React Native）実装プラン

## Context

漫画レンタル管理アプリ Rentalist（Django REST + React/Vite Web 版、家族利用）の iOS アプリを作る。
要望は「iOS の UI/UX を活かしながら、Web 版の機能やデザインを踏襲」。grill-me セッションで確定した方針:

- **Expo (React Native) managed workflow**。日常開発は Expo Go 実機確認（この Mac は Xcode 15.2 のためローカル iOS ビルド不可）、配布は EAS Build（クラウド）→ TestFlight（既存 Apple Developer Program + 新規 Expo 無料アカウント）
- 同一リポに **`mobile/`** を追加（backend/ frontend/ と並列）
- **v1 で全機能パリティ**（ログイン / 招待サインアップ / ホーム+ショップ絞り込み / カート→確定 / 読みたい / 履歴+統計 / 読破 / シリーズ追加(楽天) / シリーズ詳細一式 / 設定+招待発行）
- ナビは Web 版モバイルと同じ **5 タブ**（ホーム/読みたい/履歴/読破/設定）+ ヘッダーカート（バッジ）+ ホームのナビバー「＋」でシリーズ追加
- **v1 からダークモード対応**（OS 追従。ブランドバイオレット #5b21b6 踏襲）
- **3 環境**: dev（ローカル Django）/ staging（**Dokku に `rentalist-api-staging` を今回新規構築**、income_and_expense の staging 方式を踏襲）/ prod（`rentalist-api`、VPS 167.172.65.18）
- オフラインは**表示のみキャッシュ**（クエリキャッシュ永続化。書き込みはオンライン必須 + エラートースト）

## 技術選定

| 項目 | 採用 | 補足 |
|---|---|---|
| SDK | 開始時点の最新 Expo SDK (TypeScript) | Expo Go は最新 SDK しか動かないため開始時に固定、期間中アップグレードしない |
| ルーティング | expo-router（タブ+スタック） | web の react-router パス構造と対応。将来 Universal Links にも乗る |
| データ | TanStack Query v5 + axios | [client.js](frontend/src/api/client.js) の単一飛行 refresh・[errors.js](frontend/src/lib/errors.js) をほぼそのまま移植 |
| スタイル | NativeWind v4（web の [tailwind.config.js](frontend/tailwind.config.js) の brand 色を継承） | `dark:` バリアントで OS 追従ダーク。セマンティックトークン（surface/card/ink/brand-accent）を定義し直書き禁止 |
| トークン | expo-secure-store（refresh）+ メモリ（access） | 起動時に SecureStore → メモリへロード、完了までスプラッシュ維持 |
| オフライン | AsyncStorage + tanstack query-async-storage-persister + netinfo | gcTime/maxAge 7日、staleTime 30s の cache-and-network。オフラインバナー表示 |
| 画像 | expo-image（ディスクキャッシュ） | 表紙のオフライン表示も兼ねる |
| グラフ | react-native-svg | [ReadingStats.jsx](frontend/src/components/ReadingStats.jsx) の手書き SVG をほぼ 1:1 移植 |
| 紙吹雪 | reanimated で [Celebration.jsx](frontend/src/components/Celebration.jsx) を移植（Expo Go 同梱依存のみ） | 難航時は react-native-confetti-cannon |
| その他 | expo-haptics（確定=Success、カート追加/★=Light）、gesture-handler スワイプ削除、ActionSheetIOS/Alert、react-native-toast-message、expo-image-picker | |

## ディレクトリ構成（mobile/）

```
mobile/
├── app.config.ts / eas.json / tailwind.config.js / global.css
├── assets/（icon.png, splash.png — brand色+ロゴ意匠のプレースホルダ）
├── app/                      # expo-router
│   ├── _layout.tsx           # QueryClient+persister / Auth / Toast / 認証ゲート
│   ├── (auth)/login.tsx, signup.tsx
│   ├── (tabs)/_layout.tsx    # 5タブ + ヘッダー右カート(バッジ)・追加ボタン
│   ├── (tabs)/index.tsx（ホーム）, wishlist.tsx, history.tsx, completed.tsx, settings.tsx
│   ├── cart.tsx, add-series.tsx（モーダル presentation）
│   └── series/[id].tsx
└── src/
    ├── api/    # client.ts, auth.ts, series.ts, cart.ts, history.ts, shops.ts（frontend/src/api/ と同分割）
    ├── lib/    # errors.ts, tokens.ts, queryClient.ts, coverUrl.ts（楽天 _ex=200x200→400x400 書き換え）
    ├── hooks/  # useSeries, useCart, useHistoryStats, useAuth...
    ├── components/  # CoverImage, SeriesCard, StarRating, Badge, Celebration, ReadingStatsChart, ShopStatusSheet...
    └── theme/colors.ts
```

## 環境切替（app.config.ts）

- `APP_ENV` で 3 分岐: development = Metro の `hostUri` から Mac LAN IP を導出し `http://<Mac IP>:8000`（`EXPO_PUBLIC_API_URL` 指定で Expo Go のまま staging 接続に切替可）/ staging = `https://rentalist-api-staging.167.172.65.18.nip.io`・`com.ando.Rentalist.staging`・「Rentalist (Staging)」 / production = `https://rentalist-api.167.172.65.18.nip.io`・`com.ando.Rentalist`
- `userInterfaceStyle: "automatic"`。API パスは web 同様 `${BASE}/api` + 末尾スラッシュ

## 認証・API 層

- [client.js](frontend/src/api/client.js) 移植: access メモリ / refresh SecureStore、401 → 単一飛行 refresh → 1 回リトライ、失敗時トークンクリア + `router.replace("/login")`
- `AppState` → TanStack `focusManager` 接続（フォアグラウンド復帰で再検証、access 30 分失効対策）
- 招待サインアップ: Universal Links は v1 なし。Signup 画面にリンク/トークン貼り付け → token 抽出 → `invite/check/` 検証 → `signup`（[Signup.jsx](frontend/src/pages/Signup.jsx) 踏襲）
- ホームは series serializer の `next_cover_url` を直接使い、`next_cover_is_fallback` 時のみ `/cover/` を追撃（web 同様の N+1 回避）

## 画面別ポイント（web → iOS イディオム）

| 画面 | ポート元 | iOS 化 |
|---|---|---|
| ホーム | [Home.jsx](frontend/src/pages/Home.jsx) | FlatList グリッド、pull-to-refresh、shopMode チップ+貸出バッジ |
| カート | [Cart.jsx](frontend/src/pages/Cart.jsx) | モーダル、スワイプ削除、確定→`completed_series[]` で Celebration+ハプティクス |
| 履歴 | [History.jsx](frontend/src/pages/History.jsx) | useInfiniteQuery で DRF ページネーション追従、統計グラフ（月/年トグル）、手動追加モーダル、スワイプ削除 |
| シリーズ詳細 | [SeriesDetail.jsx](frontend/src/pages/SeriesDetail.jsx)（最重量） | ★タップ編集、貸出状況は ActionSheetIOS（未確認=削除 PUT）、bulk_add_history、表紙 URL 設定+image-picker アップロード、**削除はシリーズ名入力の強確認モーダルを維持**（Alert 不可） |
| シリーズ追加 | [AddSeries.jsx](frontend/src/pages/AddSeries.jsx) | 楽天検索デバウンス + 手動フォールバック |
| 設定 | [Settings.jsx](frontend/src/pages/Settings.jsx) | ショップ CRUD、招待リンク発行（admin のみ）→ RN `Share` で共有 |

デザイン移植元: [SeriesCard.jsx](frontend/src/components/SeriesCard.jsx)（ピルバッジ emerald/slate/amber）、[StarRating.jsx](frontend/src/components/StarRating.jsx)、[CoverImage.jsx](frontend/src/components/CoverImage.jsx)（「表紙なし」プレースホルダ + 楽天 URL 書き換え）。

## ステージングバックエンド構築（DEPLOY.md 方式のミラー）

1. Neon: 既存プロジェクトに `staging` ブランチ作成（データコピー付き＝即テストデータ）→ pooled URL 取得
2. VPS で `dokku apps:create rentalist-api-staging` → monorepo/python buildpack 追加 → `config:set`（APP_BASE=backend, 新 SECRET_KEY, DEBUG=False, ALLOWED_HOSTS=rentalist-api-staging.167.172.65.18.nip.io, DATABASE_URL=Neon staging, RAKUTEN キー流用, USE_R2=False）→ `letsencrypt:enable`
3. ローカルに `git remote add dokku-staging dokku@167.172.65.18:rentalist-api-staging`（作業ブランチを `git push dokku-staging <branch>:main` で先行検証）
4. DEPLOY.md にステージング節を追記

## EAS / TestFlight

- 新規 Expo 無料アカウントで `eas init`。プロファイル: `preview`（APP_ENV=staging、internal 配布 = `eas device:create` で UDID 登録、審査・ASC 登録不要）/ `production`（com.ando.Rentalist → `eas submit` で TestFlight）
- 証明書は EAS 管理（Mac に Xcode 不要）。無料枠温存のため日常は Expo Go、EAS ビルドは preview 1 回 + production 1 回を基本

## 検証

- jest-expo + RNTL: client.ts の 401→refresh→リトライ/単一飛行/ログアウト（axios-mock-adapter）、errors.ts、coverUrl.ts、純ロジック
- 静的: `tsc --noEmit`、`npx expo-doctor`、`npx expo export --platform ios`（ローカル iOS ビルド不可の代替バンドル検証）
- 手動（Expo Go × staging）: ログイン→ホーム→shopMode→カート→確定（完結セレブレーション）→履歴/統計→シリーズ追加→詳細編集・表紙アップロード→招待発行→サインアップ→ダーク切替→機内モードでキャッシュ表示

## フェーズ

1. **足場**: create-expo-app、NativeWind、タブ骨格、テーマトークン、app.config 環境切替
2. **API 層 + 認証**: client/errors 移植、SecureStore、ログイン/サインアップ（ローカル Django `runserver 0.0.0.0:8000` 相手）
3. **コアループ**: ホーム（shopMode）+ CoverImage + カート + 確定
4. **残画面**: 読みたい/読破/履歴/シリーズ詳細/シリーズ追加/設定
5. **磨き込み**: 統計グラフ、Celebration+ハプティクス、スワイプ削除、ダーク監査、オフライン persister、空/エラー状態
6. **ステージング構築** + フル手動回帰
7. **EAS/TestFlight**: アイコン、preview → production → 家族配布

## リスク・注意

- Expo Go の SDK 固定（自動更新で旧 SDK が動かなくなる）→ 最新 SDK で開始し期間中固定
- 実機→Mac: 同一 Wi-Fi + `runserver 0.0.0.0:8000` + ALLOWED_HOSTS に LAN IP。スタンドアロンビルドは ATS で https 必須（staging/prod は https なので OK）
- DRF multipart: FormData に `{uri, name, type}`、**Content-Type を手動設定しない**（boundary 欠落 400 の定番罠）
- reanimated/gesture-handler は `npx expo install` で SDK 同梱バージョン厳守
- Neon 無料枠は compute 合算（staging はアイドル自動停止、コールドスタート数秒許容）
- EAS 無料枠は月間クレジット制 → Expo Go で粘る
