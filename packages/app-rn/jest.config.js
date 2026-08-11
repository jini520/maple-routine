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
const { coreShimModuleNameMapper } = require('./core-shims')

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.[jt]s?(x)'],
  globalSetup: '<rootDir>/jest.global-setup.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: coreShimModuleNameMapper(),
}
