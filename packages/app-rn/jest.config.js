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
module.exports = {
  preset: 'jest-expo',
}
