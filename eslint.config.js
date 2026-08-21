import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 앱 빌드 산출물과 네이티브 프로젝트. 저장소 루트에 있던 것이 `packages/app-capacitor/` 로
  // 내려갔다([[ADR-128]] 0단계) — 경로를 안 고치면 `dist/` 의 번들 결과물까지 린트 대상이 된다.
  // `app-rn` 도 같은 이유로 제외한다(`android/`·`ios/` 는 커밋하지만 소스가 아니고, `.expo/` 는
  // Expo 가 만드는 캐시·생성 타입이다).
  {
    ignores: [
      'packages/app-rn/dist',
      'packages/app-rn/android',
      'packages/app-rn/ios',
      'packages/app-rn/.expo',
    ],
  },
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
  // 글자 배수 클램프는 `Text` atom 한 곳이 쥔다([[ADR-152]] 결정 4). `react-native` 에서 직접
  // 가져오면 그 자리만 조용히 OS 배수를 그대로 받는데, 기본 크기(배수 1.0)로 개발하는 동안에는
  // 화면도 스냅샷도 멀쩡해서 **안 드러난다**. 같은 규칙을 테스트도 지킨다
  // (`src/__tests__/font-scaling-policy.test.ts`) — 린트는 «고치는 순간», 테스트는 «CI 에서» 잡는다.
  {
    files: ['packages/app-rn/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Text', 'TextInput'],
              message:
                "글자는 'components/atoms/Text/Text' 에서 가져올 것 — 시스템 글자 크기 클램프가 거기 있다([[ADR-152]]). 칸에 묶여 못 커지는 자리는 `fixed` 프롭.",
            },
          ],
        },
      ],
    },
  },
  // 예외 둘. ① 클램프를 실제로 거는 자리 ② 테스트 — 픽스처가 그리는 글자는 제품 UI 가 아니고,
  // 오히려 «클램프 없는 원본» 과 대조해야 할 때가 있다(정책 테스트도 `__tests__` 를 훑지 않는다).
  {
    files: [
      'packages/app-rn/src/components/atoms/Text/Text.tsx',
      'packages/app-rn/**/__tests__/**',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
)
