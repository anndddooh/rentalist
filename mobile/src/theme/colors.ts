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

export const palette: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    brand: "#5b21b6",
    brandStrong: "#4c1d95",
    brandSoft: "#ede9fe",
    brandText: "#5b21b6",
    surface: "#f1f5f9",
    card: "#ffffff",
    inset: "#e2e8f0",
    ink: "#1e293b",
    inkMuted: "#64748b",
    inkFaint: "#94a3b8",
    line: "#cbd5e1",
    barAmber: "#fbbf24", // 統計グラフのバー (amber-400)
  },
  dark: {
    brand: "#7c3aed",
    brandStrong: "#6d28d9",
    brandSoft: "#2e1065",
    brandText: "#a78bfa",
    surface: "#0f172a",
    card: "#1e293b",
    inset: "#334155",
    ink: "#f1f5f9",
    inkMuted: "#94a3b8",
    inkFaint: "#64748b",
    line: "#475569",
    barAmber: "#f59e0b",
  },
};

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? palette.dark : palette.light;
}
