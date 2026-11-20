import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 린트하지 않는 곳. 안 적으면 `dist/` 의 번들 결과물까지 린트 대상이 된다. `android/` · `ios/` 는 커밋하지만
  // 소스가 아니고, `.expo/` 는 Expo 가 만드는 캐시 · 생성 타입이다.
  //
  // `.claude/` 에는 워크트리 사본이 있다. ESLint 는 파일마다 가장 가까운 설정 파일을 쓰므로 사본은 사본의 설정으로
  // 린트되고, 그러면 typescript-eslint 가 tsconfig 위치를 하나로 못 정해 파일마다 파싱 오류를 낸다.
  //
  // 확장자가 `.mjs` 인 이유: 루트 `package.json` 에 `type: module` 이 없다. metro · babel · jest · nativewind ·
  // tailwind 설정이 전부 CJS 라 ESM 으로 뒤집으면 번들러가 안 뜬다. 이 파일은 `import` 를 쓰므로 확장자로 ESM 을 말한다.
  {
    ignores: ['dist', 'android', 'ios', '.expo', 'dist-site', 'phases', '.claude'],
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
      // 나머지 전개로 칸 하나를 빼려고 받은 이름은 안 쓰는 변수가 아니다.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  // 글자 배수 클램프는 atom 둘이 쥔다. `react-native` 에서 직접
  // 가져오면 그 자리만 조용히 OS 배수를 그대로 받는데, 기본 크기(배수 1.0)로 개발하는 동안에는
  // 화면도 스냅샷도 멀쩡해서 **안 드러난다**. 같은 규칙을 테스트도 지킨다
  // (`src/__tests__/font-scaling-policy.test.ts`). 린트는 고치는 순간, 테스트는 CI 에서 잡는다.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Text', 'TextInput'],
              message:
                "글자는 'components/atoms/Text/Text', 입력 칸은 'components/atoms/TextInput/TextInput' 에서 가져올 것. 시스템 글자 크기 클램프가 거기 있다. 칸에 묶여 못 커지는 자리는 `fixed` 프롭.",
            },
          ],
        },
      ],
    },
  },
  // 테스트는 **jest 의 CJS 관례**를 따른다.
  //
  // - `require()`: `jest.resetModules()` 뒤에 모듈을 다시 집는 방법이 이것뿐이다(동적 `import()` 는
  //   jest 의 CJS VM 에서 못 쓴다). 타입은 `as typeof import('…')` 로 그대로 붙든다.
  // - `var`: 목 팩토리는 **import 보다 먼저** 끌어올려지므로, 팩토리가 참조하는 값은 `const` 면
  //   TDZ 에 걸린다. `var` 로 올려 두고 팩토리가 처음 불릴 때 채운다.
  //
  // 둘 다 제품 코드에서는 여전히 금지다. 이 완화는 테스트 파일에만 건다.
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-var': 'off',
    },
  },
  // 예외. ① 클램프를 실제로 거는 atom 둘 ② 테스트. 픽스처가 그리는 글자는 제품 UI 가 아니고,
  // 오히려 **클램프 없는 원본**과 대조해야 할 때가 있다(정책 테스트도 `__tests__` 를 훑지 않는다).
  {
    files: [
      'src/components/atoms/Text/Text.tsx',
      'src/components/atoms/TextInput/TextInput.tsx',
      'src/**/__tests__/**',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
)
