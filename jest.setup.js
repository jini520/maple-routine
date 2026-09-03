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
// jsdom 환경(`@jest-environment jsdom` 을 단 훅 스펙 여섯)에는 `TextEncoder` 가 없다 — Node 20+ 의
// 전역인데 jsdom 이 자기 전역을 새로 만들면서 빠진다. 아래 NativeWind 배선이 그것을 쓰므로
// **setup 의 맨 앞**에서 채운다([[ADR-157]]).
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('node:util')
  globalThis.TextEncoder = TextEncoder
  globalThis.TextDecoder = TextDecoder
}


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

// ── vitest 에서 넘어온 두 가지 ([[ADR-157]]) ──────────────────────────────────────────

// ① 포트의 테스트 기본값. 종전 `vitest.setup.ts` 가 하던 일이고, 그 파일이 사라지면서 여기로 왔다.
//    이것이 없으면 앱을 렌더하기만 하는 테스트가 "포트 미주입" 에러를 던진다.
require('./src/storage/__tests__/fake-preferences').installFakePreferences()
require('./src/native/__tests__/fake-native-ports').installNoopNativePorts()

// ② `expect(값, '메시지')` — **vitest 에는 있고 jest 에는 없다.**
//
//    옮겨 온 테스트 170곳이 이 두 번째 인자로 «어느 항목에서 틀렸는지» 를 말한다
//    (`expect(tokens[key], `${name}.${key}`).toBeDefined()` 처럼 `it.each` 안에서 특히 중요하다 —
//    없으면 34개 토큰 중 무엇이 빠졌는지 실패 메시지가 말해 주지 않는다).
//
//    그래서 인자를 버리는 대신 **실패 메시지 앞에 붙인다.** 패키지를 더하지 않는 이유는 하는 일이
//    아래 그대로이기 때문이다(`jest-expect-message` 와 같은 방식).
const baseExpect = global.expect

function expectWithMessage(actual, message) {
  const matchers = baseExpect(actual)
  if (message === undefined) return matchers
  return new Proxy(matchers, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value
      return (...args) => {
        try {
          return value.apply(target, args)
        } catch (error) {
          if (error instanceof Error) error.message = `${message}\n\n${error.message}`
          throw error
        }
      }
    },
  })
}

// `expect.extend`·`expect.any`·`expect.objectContaining` … 정적 멤버를 그대로 물려준다.
Object.setPrototypeOf(expectWithMessage, baseExpect)
Object.assign(expectWithMessage, baseExpect)
global.expect = expectWithMessage

// vitest 의 `toHaveBeenCalledExactlyOnceWith` — jest 에는 없다([[ADR-157]]).
// «한 번만, 그리고 이 인자로» 는 두 단언으로 쪼개면 «한 번» 이 빠져도 통과하므로 그대로 옮긴다.
expect.extend({
  // vitest 의 `toHaveBeenCalledOnce`.
  toHaveBeenCalledOnce(received) {
    const calls = received?.mock?.calls ?? []
    return {
      pass: calls.length === 1,
      message: () => `정확히 한 번 호출돼야 하는데 ${calls.length}번 호출됐다`,
    }
  },

  toHaveBeenCalledExactlyOnceWith(received, ...expected) {
    const calls = received?.mock?.calls ?? []
    const once = calls.length === 1
    const matches = once && this.equals(calls[0], expected)
    return {
      pass: matches,
      message: () =>
        once
          ? `호출은 한 번이지만 인자가 다르다\n기대: ${this.utils.printExpected(expected)}\n실제: ${this.utils.printReceived(calls[0])}`
          : `정확히 한 번 호출돼야 하는데 ${calls.length}번 호출됐다`,
    }
  },
})

// Reanimated 가 «애니메이션 ref 에 네이티브 태그가 없다» 고 내는 경고를 걷는다.
//
// 캐릭터 관리 화면이 끌기 자동 스크롤을 위해 `useAnimatedRef` 를 스크롤 뷰에 붙이고, 라이브러리가
// 그 ref 로 `useScrollOffset` 을 건다. 테스트 렌더러에는 네이티브 뷰가 없어 태그가 늘 없으므로,
// 이 경고는 **배선이 맞든 틀리든 매 렌더마다 뜬다** — jest 에서는 아무것도 알려 주지 않는 줄이다.
// 그래서 이 문장 하나만 걷고 나머지 경고는 그대로 흘린다.
const REANIMATED_NO_TAG = 'animatedRef is not initialized'
const baseWarn = console.warn

console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes(REANIMATED_NO_TAG)) return
  baseWarn(...args)
}

// 떠 있는 토스트의 **자동 소멸 타이머**를 매 케이스 뒤에 걷는다([[ADR-157]]).
//
// 그 타이머는 토스트 스토어의 모듈 스코프에 살아서, 토스트를 띄운 채 끝난 케이스가 2~2.5초짜리
// 실제 `setTimeout` 을 남긴다 — jest 가 «did not exit» 로 멈춰 서 있다가 워커 정리와 겹치면
// `SIGSEGV` 까지 간다(러너를 합치며 드러났다. vitest 는 이 상태로도 그냥 끝났다).
//
// **개별 테스트가 아무것도 안 해도 되게** 여기서 건다 — 앞으로 토스트를 띄우는 테스트가 늘어도
// 같은 새는 자리를 다시 만들지 않는다. 스토어를 목한 스위트에서는 그 목에 이 함수가 없으므로
// 옵셔널 호출이 조용히 지나간다.
afterEach(() => {
  try {
    require('./src/features/toast/store').__resetToastsForTest?.()
  } catch {
    // 이 스위트가 스토어를 아예 안 쓰는 경우 — 걷을 것도 없다.
  }
})
