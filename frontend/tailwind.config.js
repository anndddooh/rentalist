/** @type {import('tailwindcss').Config} */
// デザイン言語 1a「Refined」のセマンティックトークン。
// 値は src/index.css の CSS 変数（RGB 三つ組）で定義し、ライト/ダークを
// prefers-color-scheme で切り替える。画面コードでは bg-surface / bg-card /
// text-ink / text-ink-muted 等のセマンティッククラスを使い、slate 直書きをしない。
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "rgb(var(--color-brand) / <alpha-value>)",
          // 旧クラス名（brand-dark / brand-light）互換
          dark: "rgb(var(--color-brand-strong) / <alpha-value>)",
          light: "rgb(var(--color-brand-soft) / <alpha-value>)",
          strong: "rgb(var(--color-brand-strong) / <alpha-value>)",
          soft: "rgb(var(--color-brand-soft) / <alpha-value>)",
          text: "rgb(var(--color-brand-text) / <alpha-value>)",
        },
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        card: "rgb(var(--color-card) / <alpha-value>)",
        inset: "rgb(var(--color-inset) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          muted: "rgb(var(--color-ink-muted) / <alpha-value>)",
          faint: "rgb(var(--color-ink-faint) / <alpha-value>)",
        },
        line: "rgb(var(--color-line) / <alpha-value>)",
      },
      borderRadius: {
        card: "20px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(30,27,46,0.06)",
      },
    },
  },
  plugins: [],
};
