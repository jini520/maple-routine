// RN 쪽 테스트 러너는 **jest** 다(사용자 결정, 2026-08-11). 전환의 최종 상태는 RN-only 이고 그때
// `app-capacitor` 와 함께 vitest 도 걷힌다 — 지금 vitest 에 RN 을 억지로 태우면 나중에 한 번 더 옮겨야
// 한다. 반대편(저장소 전체 vitest)에서는 이 패키지를 탐색에서 빼 둔다
// (`packages/app-capacitor/vite.config.ts` 의 `test.exclude`).
//
// `@core/*` alias 는 여기 없다 — **`tsconfig.json` 의 `paths` 하나가 tsc·Metro·jest 를 전부 푼다.**
// jest-expo 프리셋이 마지막에 `withTypescriptMapping()` 을 걸어 cwd 의 `tsconfig.json` 에서
// `compilerOptions.paths` 를 읽고 `moduleNameMapper` 로 옮긴다
// (`@core/*` → `^@core/(.*)$` → `<rootDir>/../core/src/$1`). `metro.config.js` 가 alias 를 안 두는 것과
// 같은 이유이고, 같은 이득이다 — 선언이 한 벌이라 "타입은 통과하는데 테스트에서만 죽는" 어긋남이
// 생길 자리가 없다.
//
// 대신 그 파생은 **cwd 기준**이다(jest-expo 가 `path.resolve('tsconfig.json')` 을 쓴다). 그래서 이
// 패키지는 반드시 자기 디렉터리에서 돌려야 한다 — 루트 `npm test` 가 `-w @maple-routine/app-rn` 로
// 부르는 이유이기도 하다. 매핑이 실제로 풀리는지는 `src/__tests__/core-wiring.test.ts` 가 지킨다.
//
// NativeWind 배선은 두 파일로 나뉜다([[ADR-127]] 3단계) — `globalSetup` 이 `global.css` 를 실행당
// 한 번 컴파일하고, `setupFilesAfterEnv` 가 그 결과를 테스트마다 주입한다. 나눈 이유는 컴파일이
// 비동기라 `setupFiles`(동기)에 못 들어가고, 매 테스트 파일마다 다시 하면 느리기 때문이다.
//
// `moduleNameMapper` 가 여기 있는 것은 `@core/*` 때문이 **아니다**(그건 위 문단대로 tsconfig 이 푼다).
// Vite 전용 API 를 쓰는 core 모듈을 RN 구현으로 갈아끼우는 표이고, 그 표는 `core-shims.js` 에 있어
// Metro 와 공유한다 — 따로 적으면 "앱은 도는데 테스트만 죽는"(또는 반대) 어긋남이 조용히 생긴다.
// jest 는 preset 의 매퍼와 여기 매퍼를 **합치므로** `@core/*` 매핑은 그대로 살아 있고, 이 항목들이
// 먼저 검사된다.
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
const { coreShimModuleNameMapper } = require('./core-shims')
const expoPreset = require('jest-expo/jest-preset')

/** `react-native` 조건에서 ESM 만 내보내는 의존성 — jest 가 트랜스폼해야 한다. */
const ESM_ONLY_DEPS = ['lucide-react-native']

const NEGATIVE_LOOKAHEAD = '(?!('

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.[jt]s?(x)'],
  globalSetup: '<rootDir>/jest.global-setup.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: coreShimModuleNameMapper(),
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern) =>
    pattern.includes(NEGATIVE_LOOKAHEAD)
      ? pattern.replace(NEGATIVE_LOOKAHEAD, `${NEGATIVE_LOOKAHEAD}${ESM_ONLY_DEPS.join('|')}|`)
      : pattern,
  ),
  // `babel-jest` 를 옵션 없이 두면 이 패키지의 `babel.config.js` 를 그대로 쓴다 — 우리 소스와 같은
  // 파이프라인이라 프리셋의 babel 옵션을 베낄 필요가 없다.
  transform: { ...expoPreset.transform, '\\.mjs$': 'babel-jest' },
}
