import { useColorScheme } from "react-native";

/**
 * className（NativeWind）の外で色が必要な箇所（タブバー、グラフ、
 * ActivityIndicator 等）の単一ソース。値は src/global.css のトークンと同期。
 */
export interface ThemeColors {
  brand: string;
  brandStrong: string;
  brandSoft: string;
  brandText: string;
  surface: string;
  card: string;
  inset: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  line: string;
  barAmber: string;
}

// デザイン言語 1a「Refined」。値は src/global.css のトークンと同期。
export const palette: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    brand: "#5b21b6",
    brandStrong: "#4c1d95",
    brandSoft: "#ede9fe",
    brandText: "#5b21b6",
    surface: "#f6f5f9",
    card: "#ffffff",
    inset: "#f6f5f9",
    ink: "#1e1b2e",
    inkMuted: "#7c6f9b",
    inkFaint: "#a49bc0",
    line: "#eceaf2",
    barAmber: "#f59e0b", // 統計グラフのバー
  },
  dark: {
    brand: "#8b5cf6",
    brandStrong: "#6d28d9",
    brandSoft: "#37305a",
    brandText: "#c4b5fd",
    surface: "#161226",
    card: "#221c38",
    inset: "#2a2344",
    ink: "#f1eefb",
    inkMuted: "#9d92c2",
    inkFaint: "#7d719f",
    line: "#2e2749",
    barAmber: "#f59e0b",
  },
};

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? palette.dark : palette.light;
}
