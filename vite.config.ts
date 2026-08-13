// 저장소 루트에는 앱이 없다([[ADR-128]] 0단계 — 앱은 `packages/app-capacitor` 로 내려갔다).
// 이 파일이 남아 있는 이유는 둘뿐이다.
//
//   ① `npm test` — 저장소 **전체**를 한 번에 도는 vitest 실행(패키지별로 쪼개면 "몇 파일 / 몇 개"를
//      한 번에 확인할 수 없다). vitest 는 cwd 에서 설정을 찾으므로 루트에 하나가 있어야 한다.
//   ② `npm run theme:gen` — `vite-node` 로 도는 스크립트. `@core/*` 를 해석해야 하는데 vite-node 도
//      cwd 의 `vite.config.*` 만 본다(`vitest.config.ts` 라는 이름은 못 찾는다).
//
// 둘 다 앱과 **같은 해석 규칙**(`@core/*` alias · JSX 변환 · 테스트 setup)을 써야 하므로 규칙을 두
// 벌로 두지 않고 앱 설정을 그대로 쓴다. 두 벌이면 한쪽만 고쳐져도 아무도 모른다.
//
// 앱 빌드는 이 파일을 보지 않는다 — `vite build` 는 자기 패키지 디렉터리에서 돌며 그쪽 설정을 읽는다.
// (그래서 `vite` 를 루트에서 직접 띄우지 말 것 — 여기엔 `index.html` 이 없다.)
import appConfig from './packages/app-capacitor/vite.config'

export default appConfig
