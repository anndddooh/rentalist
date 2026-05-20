/** Vite + React 18 向けの ESLint 設定。
 *
 * 推奨セットを基本とし、TypeScript を使わない JSX 構成で実用上ノイズになる
 * 以下のルールはプロジェクト方針に合わせて調整している:
 *   - react/prop-types: off
 *     PropTypes を全コンポーネントに付ける運用にしていない。型は将来 TS 化で担保する想定。
 *   - no-irregular-whitespace: 正規表現内（全角スペースを意図的に含むパターン）を許可。
 *   - react-refresh/only-export-components: off
 *     Context Provider と useXxx hook を同一ファイルから export する標準パターンや、
 *     コンポーネントと併置する小さな定数 export を許可。HMR の最適化向けの警告で
 *     コード品質の問題ではないため。
 *
 * react-hooks のルールは維持。
 */
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh'],
  rules: {
    'react/prop-types': 'off',
    'no-irregular-whitespace': ['error', { skipRegExps: true }],
    'react-refresh/only-export-components': 'off',
  },
}
