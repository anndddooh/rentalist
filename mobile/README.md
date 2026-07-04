# Rentalist iOS アプリ（Expo / React Native）

Web 版（`frontend/`）の機能・デザインを踏襲した iOS アプリ。
同じ Django API（`backend/`）のクライアントとして動く。

- Expo managed workflow（expo-router / NativeWind v4 / TanStack Query v5）
- ダークモード対応（OS 追従。トークンは `src/global.css` + `src/theme/colors.ts`）
- オフラインは表示のみキャッシュ（クエリ永続化 + expo-image ディスクキャッシュ）

## 開発（Expo Go）

この Mac は Xcode 15.2 のためローカル iOS ビルド不可。日常開発は **Expo Go** で行う。

```bash
cd mobile
npm install
npx expo start        # 実機の Expo Go アプリで QR を読む（Mac と同一 Wi-Fi）
```

接続先 API は環境で切替（`app.config.ts` / `src/lib/env.ts`）:

| 環境 | 接続先 | 使い方 |
|---|---|---|
| development（既定） | `http://<MacのLAN IP>:8000`（Metro の hostUri から自動導出） | ローカル Django: `cd backend && ./venv/bin/python manage.py runserver 0.0.0.0:8000` |
| development + 上書き | `EXPO_PUBLIC_API_URL` の値 | `EXPO_PUBLIC_API_URL=https://rentalist-api-staging.167.172.65.18.nip.io npx expo start` |
| staging（EAS preview ビルド） | `https://rentalist-api-staging.167.172.65.18.nip.io` | TestFlight 前の検証配布 |
| production（EAS production ビルド） | `https://rentalist-api.167.172.65.18.nip.io` | TestFlight / 本番 |

ローカル Django に実機から繋ぐ場合は `backend/.env` の `ALLOWED_HOSTS` に Mac の LAN IP を足すこと。

## 検証

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest（API クライアントの refresh フロー等）
npm run lint        # expo lint
npx expo export --platform ios   # バンドル成立確認（ローカル iOS ビルド不可の代替）
```

## 配布（EAS Build → TestFlight）

日常開発では EAS ビルドは不要。配布時のみ（無料枠温存のため回数は最小限に）:

```bash
npm install -g eas-cli
eas login                          # Expo アカウント（無料）
eas build --platform ios --profile preview     # ステージング向け internal 配布（UDID 登録制）
eas build --platform ios --profile production  # 本番向け
eas submit --platform ios                      # TestFlight へアップロード
```

- バンドル ID: `com.ando.Rentalist`（staging は `.staging` サフィックス + 表示名「Rentalist (Staging)」）
- 証明書・プロビジョニングは EAS 管理に委任（この Mac に Xcode 不要）
- preview の internal 配布は `eas device:create` で実機 UDID を登録してから

## 構成

```
src/
├── app/            # expo-router（(auth)/ログイン・サインアップ、(tabs)/5タブ、cart・add-series モーダル、series/[id]）
├── api/            # frontend/src/api と同じ分割の axios クライアント（単一飛行 refresh）
├── components/     # SeriesCard / CoverImage / StarRating / Celebration / ReadingStatsChart ほか
├── hooks/          # useAuth（SecureStore 復元 + 認証ゲート連動）、useSeries / useCart / useShops
├── lib/            # env（環境切替）、tokens（Keychain）、queryClient（オフライン persister）、errors、coverUrl
└── theme/          # className 外で使う色の単一ソース
```

仕様の正本はリポジトリルートの `SPEC.md`、デプロイ・ステージングは `DEPLOY.md` を参照。
