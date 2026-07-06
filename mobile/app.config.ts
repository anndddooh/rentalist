import type { ConfigContext, ExpoConfig } from "expo/config";

type AppEnv = "development" | "staging" | "production";

const APP_ENV = (process.env.APP_ENV ?? "development") as AppEnv;

// development の apiBaseUrl は null。実行時に Metro の hostUri から
// Mac の LAN IP を導出する（src/lib/env.ts）。EXPO_PUBLIC_API_URL で上書き可。
const ENV: Record<
  AppEnv,
  { name: string; bundleId: string; apiBaseUrl: string | null }
> = {
  development: {
    name: "Rentalist (Dev)",
    bundleId: "com.ando.Rentalist.dev",
    apiBaseUrl: null,
  },
  staging: {
    name: "Rentalist (Staging)",
    bundleId: "com.ando.Rentalist.staging",
    apiBaseUrl: "https://rentalist-api-staging.167.172.65.18.nip.io",
  },
  production: {
    name: "Rentalist",
    bundleId: "com.ando.Rentalist",
    apiBaseUrl: "https://rentalist-api.167.172.65.18.nip.io",
  },
};

const env = ENV[APP_ENV];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: env.name,
  slug: "rentalist",
  owner: "anndddoooo",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "rentalist",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: env.bundleId,
    supportsTablet: false,
    // 暗号化は HTTPS(TLS) と Keychain のみ = 適用除外。輸出コンプライアンス申告を免除
    config: {
      usesNonExemptEncryption: false,
    },
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#5b21b6",
        image: "./assets/images/splash-icon.png",
        imageWidth: 96,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: APP_ENV,
    apiBaseUrl: env.apiBaseUrl,
    eas: {
      projectId: "41835654-c431-4872-9c87-53a5141116f5",
    },
  },
});
