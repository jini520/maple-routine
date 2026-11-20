// NativeWind 컴파일 설정. **Metro 와 jest 가 같은 값으로 컴파일해야** 테스트가 단언하는 스타일이 실제 화면과 같다.
// 두 곳에 따로 적으면 "테스트는 통과하는데 앱은 다른 크기로 그려지는" 어긋남이 조용히 생긴다.
//
// `.js`(CJS)인 이유: `metro.config.js` 가 CJS 라 `require` 로 읽어야 하고, 이 패키지에는
// `"type": "module"` 이 없다.

const path = require('node:path')

/** Tailwind 진입 CSS. `App.tsx` 도 같은 파일을 import 한다. */
const CSS_ENTRY = './global.css'

/**
 * jest 가 쓸 컴파일 결과를 두는 곳. `jest.global-setup.js` 가 쓰고 `jest.setup.js` 가 읽는다.
 * 경로만 여기 두는 이유: 읽는 쪽이 쓰는 쪽 모듈을 require 하면 **테스트 파일마다** postcss·tailwind
 * 툴체인이 딸려 들어온다. `node_modules` 아래라 따로 gitignore 하지 않아도 된다.
 */
const COMPILED_CSS_PATH = path.join(__dirname, 'node_modules/.cache/nativewind-jest/global.css')

/**
 * `rem` 을 px 로 굳힐 때 쓸 배수. **16 이어야 한다.**
 *
 * RN 에는 rem 이 없어 컴파일 시점에 px 로 인라인되는데, NativeWind 의 기본값은 **14** 다. 이 앱의 치수는
 * Tailwind v4 의 rem 값(`tailwind-v4-axes.cjs`)을 1rem = 16px 로 보고 정했다. 기본값으로 두면 rem 을 쓰는
 * 유틸리티 전부(`p-4`·`gap-2`·`rounded-lg` …)가 12.5% 작아진다. 클래스 이름은 같은데 값이 다른, 가장
 * 알아채기 어려운 종류의 어긋남이다.
 */
const INLINE_REM = 16

/**
 * jest 가 컴파일할 플랫폼.
 *
 * NativeWind 는 이 값이 없거나 `web` 이면 **web 프리셋**으로 컴파일한다
 * (`nativewind/dist/tailwind/index.js`). Metro 는 `options.platform` 을 넣지만 jest 는 아무도 안
 * 넣는다. 이 값을 정하지 않으면 테스트가 앱과 **다른 값**을 본다.
 *
 * `ios` 인 이유는 jest 의 `Platform.OS` 가 `ios` 라서다. 코드 분기와 스타일 컴파일이 같은
 * 플랫폼을 봐야 한 테스트 안에서 앞뒤가 맞는다.
 *
 * **두 네이티브 플랫폼은 `elevation` 하나만 갈린다**(실측. 컴파일 결과를 통째로 비교했다).
 * 안드로이드가 `.shadow`(3) · `.shadow-lg`(8) · `.elevation` 에 그 값을 더하고 나머지는 글자까지
 * 같다. 그 하나는 `src/__tests__/nativewind-preset.test.ts` 가 따로 지킨다.
 */
const JEST_NATIVEWIND_OS = 'ios'

module.exports = {
  COMPILED_CSS_PATH,
  CSS_ENTRY,
  INLINE_REM,
  JEST_NATIVEWIND_OS,
}
