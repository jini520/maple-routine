import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `@core/*` → `packages/core/src/*` ([[ADR-128]] 결정 3).
// 같은 매핑이 `tsconfig.base.json` 의 `paths` 에도 있어야 한다 — 한쪽만 있으면 타입은 맞는데 번들이
// 깨지거나(혹은 그 반대) 조용히 어긋난다. **vitest 는 이 `resolve.alias` 를 그대로 공유하므로**
// 테스트용 별도 설정은 두지 않는다(저장소 루트의 `vite.config.ts` 가 이 파일을 그대로 쓴다).
const coreSrc = fileURLToPath(new URL('../core/src', import.meta.url))

// 이 파일 기준 절대 경로여야 한다. vitest 는 `setupFiles` 를 **설정 파일이 아니라 `root`(= cwd)**
// 기준으로 풀기 때문에, 상대 경로로 두면 저장소 루트에서 도는 `npm test` 가 이 파일을 못 찾는다.
const setupFile = fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))

// 테스트의 root 는 **cwd 가 아니라 저장소 루트로 못박는다.** 빌드의 root(= 이 패키지)와는 다르다.
//
// 왜 못박아야 하는가: vite 는 root **안**의 에셋을 `/packages/core/src/assets/...` 로, 밖의 것을
// `/@fs/<절대경로>` 로 바꾼다. 그래서 cwd 가 저장소 루트냐 이 패키지냐에 따라 렌더된 `src` 속성이
// 달라지고, DOM 스냅샷([[ADR-094]] 결정 4)이 **그 차이만으로** 깨진다 — 화면은 하나도 안 바뀌었는데.
// root 를 고정하면 어디서 돌리든 같은 199파일·같은 스냅샷이 나온다(패키지별로 쪼개지 않는다는
// 규칙과도 같은 말이다).
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

// https://vite.dev/config/
// 화면 청크는 **라우트 단위가 아니라 탭 단위**로 묶는다([[ADR-120]] 결정 14).
//
// [[ADR-092]] 는 화면마다 청크를 쪼갰다. 그 목적(첫 페인트 번들 축소)은 그대로 유효하지만, 하위
// 페이지까지 따로 쪼갠 탓에 **탭에서 하위 페이지로 밀어 넣을 때 파일을 한 번 더 읽는다** — 실기기
// (iPhone 17, 2026-08-09)에서 그 읽기가 체감될 만큼 느려 전환이 늦게 시작됐다.
//
// 하위 페이지는 **부모 탭에서만 열린다.** 그러니 부모와 같은 청크에 두면 그 탭에 들어올 때 이미 함께
// 와 있어 추가 읽기가 없다. **첫 페인트 번들은 늘지 않는다** — 이 청크들은 어차피 그 탭에 들어갈 때
// 받는 것이고, 진입 번들(`index-*.js`)에는 들어가지 않는다.
//
// 정적 import 로 바꾸는 방법은 쓸 수 없다 — `App.tsx` 는 진입점이라 그 화면들이 첫 페인트 번들로
// 딸려 들어가 [[ADR-092]] 가 무효가 된다. `lazy()` + 동적 `import()` 는 그대로 두고 **번들 경계만**
// 바꾼다.
function screenChunk(id: string): string | undefined {
  if (id.includes('/src/app/content-scheduler/')) return 'screen-content'
  if (id.includes('/src/app/boss-scheduler/')) return 'screen-boss'
  if (id.includes('/src/app/boss-profit/')) return 'screen-profit'
  if (id.includes('/src/app/settings/')) return 'screen-settings'
  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // 접두 문자열이 아니라 정규식으로 잡는다 — `'@core'` 문자열 alias 는 `@core-foo` 같은 이름까지
    // 함께 삼킨다.
    alias: [{ find: /^@core\//, replacement: `${coreSrc}/` }],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => screenChunk(id),
      },
    },
  },
  test: {
    root: repoRoot,
    environment: 'node',
    setupFiles: [setupFile],
    // `packages/app-rn` 은 **jest** 로 돈다(그 패키지의 `jest.config.js` 참고). root 가 저장소
    // 루트라 여기서 빼지 않으면 vitest 가 RN 테스트까지 집어삼키고 `react-native` import 에서 죽는다.
    // 기본 제외 목록을 덮어쓰지 않도록 `configDefaults.exclude` 위에 얹는다.
    exclude: [...configDefaults.exclude, 'packages/app-rn/**'],
  },
})
