/** @type {import('tailwindcss').Config} */
// web (frontend/tailwind.config.js) の brand 色を継承しつつ、
// ダークモード対応のためセマンティックトークンを CSS 変数（src/global.css）で定義する。
// 画面コードでは bg-surface / bg-card / text-ink 等のセマンティッククラスを使い、
// slate 系の直書きをしない。
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "rgb(var(--color-brand) / <alpha-value>)",
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
    },
  },
  plugins: [],
};
