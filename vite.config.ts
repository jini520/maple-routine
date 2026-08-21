import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 이 저장소에 **vite 로 빌드하는 앱은 없다**([[ADR-155]]). 앱은 Expo(Metro)로 빌드된다. 이 파일이
// 남아 있는 이유는 둘뿐이다.
//
//   ① `npm test` 의 앞 절반 — **`*.spec.*` 를 도는 vitest**. 뒤 절반은 jest 가 `*.test.*` 를 돈다.
//      cwd 에서 설정을 찾으므로 루트에 하나가 있어야 한다.
//   ② `npm run theme:gen` — `vite-node` 로 도는 스크립트(`vitest.config.ts` 라는 이름은 못 찾는다).
//
// **러너 둘이 한 트리를 나눠 갖는 방법이 확장자다**([[ADR-155]] 결정 6). core 가 `src/` 로 녹으면서
// (결정 3) 두 러너의 테스트가 같은 `__tests__` 디렉터리에 섞였고, 경로로는 더 이상 가를 수 없다.
// 그래서 경계를 파일 이름으로 옮겼다:
//
//   *.spec.ts(x)  → vitest — react-native 을 안 쓰는 순수 로직·데이터·저장소 테스트(node 환경)
//   *.test.ts(x)  → jest   — RN 을 렌더하거나 RN 모듈을 목하는 테스트(jest-expo 프리셋)
//
// 한쪽이 다른 쪽 파일을 집으면 그 자리에서 죽으므로(vitest 가 `react-native` 를 import 하면,
// jest 가 `vitest` 를 import 하면) 이 경계는 **조용히 어긋나지 않는다**.
const setupFile = fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))

export default defineConfig({
  // `.tsx` 스펙(훅 6개가 `@testing-library/react` 로 돈다)의 JSX 변환에 필요하다.
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: [setupFile],
    include: ['**/*.spec.{ts,tsx,mjs}'],
    exclude: ['node_modules/**', 'dist/**', 'android/**', 'ios/**'],
  },
})
