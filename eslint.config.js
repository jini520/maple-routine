import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 앱 빌드 산출물과 네이티브 프로젝트. 저장소 루트에 있던 것이 `packages/app-capacitor/` 로
  // 내려갔다([[ADR-127]] 0단계) — 경로를 안 고치면 `dist/` 의 번들 결과물까지 린트 대상이 된다.
  { ignores: ['packages/app-capacitor/dist', 'packages/app-capacitor/android', 'packages/app-capacitor/ios'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
