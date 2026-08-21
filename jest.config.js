// RN 쪽 테스트 러너는 **jest** 다(사용자 결정, 2026-08-11). 캐패시터가 걷힌 뒤에도 vitest 는 남았다 —
// 그것이 돌던 대상이 «웹 앱» 이 아니라 **core** 였기 때문이다([[ADR-155]] 결정 6). 그래서 러너 둘이
// 대상을 나눠 갖는다: jest 는 `src/`, vitest 는 `core/`. 경계는 양쪽에서 한 번씩 못박는다 —
// 아래 `testPathIgnorePatterns` 와 `vite.config.ts` 의 `test.exclude`.
//
// **alias 가 하나도 없다**([[ADR-155]] 결정 3). `core` 가 `src/` 로 녹으면서 `@core/*` 가 사라졌고,
// 모든 import 가 상대 경로라 tsc·Metro·jest 가 같은 것을 본다 — 풀어 줄 매핑 자체가 없으니 셋이
// 갈라질 자리도 없다.
//
// NativeWind 배선은 두 파일로 나뉜다([[ADR-128]] 3단계) — `globalSetup` 이 `global.css` 를 실행당
// 한 번 컴파일하고, `setupFilesAfterEnv` 가 그 결과를 테스트마다 주입한다. 나눈 이유는 컴파일이
// 비동기라 `setupFiles`(동기)에 못 들어가고, 매 테스트 파일마다 다시 하면 느리기 때문이다.
//
// `testMatch` 를 **파일 이름으로** 좁힌다. `jest-expo` 기본값은 `**/__tests__/**/*.[jt]s?(x)` 라
// 그 디렉터리에 둔 **보조 파일까지 테스트 스위트로 집어** *"must contain at least one test"* 로
// 빨개진다(`src/navigation/__tests__/harness.tsx`). 보조 파일을 밖으로 빼는 대신 규칙을 좁힌 이유는
// 그 파일이 테스트 전용이라 소스 트리에 있으면 어디에도 안 어울리기 때문이고, 이 저장소의 테스트가
// 이미 전부 `*.test.ts(x)` 라 잃는 것이 없기 때문이다.
//
// **ESM 만 내보내는 의존성 하나 때문에 프리셋을 두 군데 고친다**(`lucide-react-native` — step 4).
// 그 패키지는 `exports` 맵에서 `react-native` 조건에 `.mjs` 만 두는데, Metro 는 그것을 그대로 먹지만
// jest 는 `SyntaxError: Unexpected token 'export'` 로 죽는다(실측). 두 곳이 각각 다른 이유로 막는다.
//
// ① `transformIgnorePatterns` — `node_modules` 는 기본 제외이고, **하나라도 걸리면 제외**라 항목을
//    더해서 예외를 만들 수 없다. 프리셋 패턴의 부정 룩어헤드 안에 이름을 끼워 넣는 것이 유일한 방법.
// ② `transform` — 프리셋의 babel 패턴이 `\.[jt]sx?$` 라 **`.mjs` 는 애초에 트랜스포머가 없다**.
//    ①만 고치면 여전히 같은 자리에서 죽는다(실측).
//
// 둘 다 프리셋의 값에 의존하므로, 프리셋이 그 문자열을 바꾸면 **다시 같은 SyntaxError 로 시끄럽게**
// 깨진다(조용히 통과하지 않는다).
//
// CJS 빌드로 매핑하는 안(`moduleNameMapper`)도 되지만, 그러면 **jest 는 CJS·Metro 는 ESM** 을 보게
// 된다. 같은 소스의 두 빌드라 실질 차이는 없어도, 이 패키지는 "두 도구가 같은 파일을 본다"를
// 원칙으로 두고 있어(`core-shims.js` 「한 벌로 두는 이유」) 그 쪽을 고르지 않았다.
const expoPreset = require('jest-expo/jest-preset')

/** `react-native` 조건에서 ESM 만 내보내는 의존성 — jest 가 트랜스폼해야 한다. */
const ESM_ONLY_DEPS = ['lucide-react-native']

const NEGATIVE_LOOKAHEAD = '(?!('

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.[jt]s?(x)'],
  // `*.spec.*` 는 **vitest 의 몫**이다([[ADR-155]] 결정 6 — 경계는 경로가 아니라 확장자다.
  // `vite.config.ts` 에 그 이유가 적혀 있다). 위 `testMatch` 가 `*.test.*` 만 잡으므로 그 규칙 하나로
  // 이미 갈리고, 여기서는 기본값만 유지한다.
  // reanimated 4 가 `react-native-worklets` 위에 서 있고 그 패키지의 `.native.*` 변형이 jest 에서
  // 즉시 죽는다 — 프리셋의 해석기를 대체하는 것이 아니라 **겹친다**(`jest.resolver.js`).
  resolver: '<rootDir>/jest.resolver.js',
  globalSetup: '<rootDir>/jest.global-setup.js',
  // `react-native-gesture-handler` 의 네이티브 모듈 목 — 프리셋의 `setupFiles` **뒤에** 붙인다
  // (`GestureHandlerRootView` 가 렌더 시 `RNGestureHandlerModule.install()` 을 부르는데, 목이
  // 없으면 *"install is not a function"* 으로 죽는다). 라이브러리가 공식으로 주는 파일이다.
  setupFiles: [...expoPreset.setupFiles, require.resolve('react-native-gesture-handler/jestSetup')],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern) =>
    pattern.includes(NEGATIVE_LOOKAHEAD)
      ? pattern.replace(NEGATIVE_LOOKAHEAD, `${NEGATIVE_LOOKAHEAD}${ESM_ONLY_DEPS.join('|')}|`)
      : pattern,
  ),
  // `babel-jest` 를 옵션 없이 두면 이 패키지의 `babel.config.js` 를 그대로 쓴다 — 우리 소스와 같은
  // 파이프라인이라 프리셋의 babel 옵션을 베낄 필요가 없다.
  transform: { ...expoPreset.transform, '\\.mjs$': 'babel-jest' },
}
