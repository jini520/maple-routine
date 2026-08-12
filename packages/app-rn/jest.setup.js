// NativeWind 런타임을 테스트 환경에 붙인다([[ADR-128]] 3단계).
//
// **`nativewind/test` 가 아니라 그 아래 `react-native-css-interop/test` 를 쓴다.** 두 가지 이유가
// 있는데 둘 다 실측이다:
//   ① `nativewind/dist/test.js` 는 4.2.6 기준 **JSX 가 트랜스파일되지 않은 채로 배포**돼 있어
//      jest 가 `node_modules` 를 변환하지 않는 기본 설정에서 `SyntaxError` 로 죽는다.
//   ② 그쪽 `render()` 는 **넘긴 JSX 에 직접 적힌 `className` 만** 훑어 컴파일한다. step 3~6 은
//      컴포넌트를 렌더하고 그 **안쪽** 클래스가 풀리기를 기대하므로 그 방식으로는 빈 스타일이 된다.
//
// 순서가 계약이다 — `react-native-css-interop/test` 는 모듈 최상위에서 `beforeEach` 를 걸어 스타일
// 데이터를 **비운다**(테스트 간 격리). 그러니 주입은 그 뒤에 등록해야 한다. 먼저 등록하면 매번
// 주입 직후 지워져 스타일이 하나도 안 남는다.
const { registerCSS, setupAllComponents } = require('react-native-css-interop/test')

const { readFileSync } = require('node:fs')

const { COMPILED_CSS_PATH, INLINE_REM } = require('./nativewind.config')

// RN 프리미티브(`View`·`Text` …)가 `className` 을 받도록 등록한다.
setupAllComponents()

// `require` 가 아니라 `readFileSync` 인 이유: 이 파일은 `globalSetup` 이 만들어 두는 산출물이라
// 모듈 캐시에 물고 있으면 재실행 때 옛 내용을 쓸 수 있다. 파일이 없으면 여기서 바로 던지므로
// "스타일이 왜 안 붙지" 를 조용히 겪지 않는다.
const compiledCss = readFileSync(COMPILED_CSS_PATH, 'utf8')

beforeEach(() => {
  registerCSS(compiledCss, { inlineRem: INLINE_REM })
})
