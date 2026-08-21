import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 이 저장소에 **vite 로 빌드하는 앱은 없다**([[ADR-155]]). 앱은 Expo(Metro)로 빌드되고, 이 파일이
// 남아 있는 이유는 둘뿐이다 — 종전 루트 설정이 캐패시터 앱 설정을 그대로 re-export 하던 자리를
// 대신한다(그 앱과 함께 사라졌다).
//
//   ① `npm test` — `packages/core` 의 vitest 실행. vitest 는 cwd 에서 설정을 찾으므로 루트에 하나가 있어야
//      한다. RN 쪽(`packages/app-rn`)은 **jest** 로 돌므로 아래 `exclude` 로 뺀다 — 안 빼면 vitest 가 그것까지
//      집어삼키고 `react-native` import 에서 죽는다.
//   ② `npm run theme:gen` — `vite-node` 로 도는 스크립트. `@core/*` 를 해석해야 하는데 vite-node 도
//      cwd 의 `vite.config.*` 만 본다(`vitest.config.ts` 라는 이름은 못 찾는다).
//
// `@core/*` alias 가 여기 또 있는 이유: tsc·Metro·jest 셋은 `tsconfig.json` 의 `paths` 하나에서
// 파생되지만([[ADR-128]] 결정 3) vite 계열만 그 파생에 안 낀다. 즉 선언은 **두 벌뿐**이고, 둘이
// 갈라지면 `core-wiring` 계열 테스트가 아니라 여기서 도는 1,800여 개가 통째로 빨개진다.
const coreSrc = fileURLToPath(new URL('./packages/core/src', import.meta.url))

// vitest 는 `setupFiles` 를 설정 파일이 아니라 `root`(= cwd) 기준으로 푼다. 절대 경로로 못박아
// 어디서 돌리든 같은 파일을 집게 한다.
const setupFile = fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))

export default defineConfig({
  // `.tsx` 테스트(훅 6개가 `@testing-library/react` 로 돈다)의 JSX 변환에 필요하다.
  plugins: [react()],
  resolve: {
    // 접두 문자열이 아니라 정규식으로 잡는다 — `'@core'` 문자열 alias 는 `@core-foo` 같은 이름까지
    // 함께 삼킨다.
    alias: [{ find: /^@core\//, replacement: `${coreSrc}/` }],
  },
  test: {
    environment: 'node',
    setupFiles: [setupFile],
    // 기본 제외 목록을 덮어쓰지 않도록 그 위에 얹는다.
    exclude: [...configDefaults.exclude, 'packages/app-rn/**'],
  },
})
