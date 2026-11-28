// NativeWind 런타임을 테스트 환경에 붙인다.
//
// **`nativewind/test` 가 아니라 그 아래 `react-native-css-interop/test` 를 쓴다.** 두 가지 이유가
// 있는데 둘 다 실측이다:
//   ① `nativewind/dist/test.js` 는 4.2.6 기준 **JSX 가 트랜스파일되지 않은 채로 배포**돼 있어
//      jest 가 `node_modules` 를 변환하지 않는 기본 설정에서 `SyntaxError` 로 죽는다.
//   ② 그쪽 `render()` 는 **넘긴 JSX 에 직접 적힌 `className` 만** 훑어 컴파일한다. 우리 테스트는
//      컴포넌트를 렌더하고 그 **안쪽** 클래스가 풀리기를 기대하므로 그 방식으로는 빈 스타일이 된다.
//
// 순서가 계약이다. `react-native-css-interop/test` 는 모듈 최상위에서 `beforeEach` 를 걸어 스타일
// 데이터를 **비운다**(테스트 간 격리). 그러니 주입은 그 뒤에 등록해야 한다. 먼저 등록하면 매번
// 주입 직후 지워져 스타일이 하나도 안 남는다.

// jsdom 환경(`@jest-environment jsdom` 을 단 스펙)에는 `TextEncoder` 가 없다. Node 20+ 의
// 전역인데 jsdom 이 자기 전역을 새로 만들면서 빠진다. 아래 NativeWind 배선이 그것을 쓰므로
// **setup 의 맨 앞**에서 채운다.
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('node:util')
  globalThis.TextEncoder = TextEncoder
  globalThis.TextDecoder = TextDecoder
}


const { registerCSS, setupAllComponents } = require('react-native-css-interop/test')

const { readFileSync } = require('node:fs')
const { format } = require('node:util')

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

// 포트의 테스트 기본값. 이것이 없으면 앱을 렌더하기만 하는 테스트가 `…가 주입되지 않았습니다` 에러를 던진다.
require('./src/storage/__tests__/fake-preferences').installFakePreferences()
require('./src/native/__tests__/fake-native-ports').installNoopNativePorts()

// keyboard-controller 는 네이티브 모듈이라 jest 에서는 링크가 안 된다. 라이브러리가 내주는 목을 건다.
// 안 걸면 입력 카드를 그리는 스위트가 import 단계에서 통째로 죽는다.
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'))

// 화면 모서리 반경도 네이티브 모듈이다. jest 에는 없어 앱 부팅을 그리는 스위트가 import 단계에서 죽는다. 반경을 모르는 기기로 둔다.
jest.mock('expo-screen-corner-radius', () => ({ getCornerRadiusSync: () => null, getCornerRadius: async () => null }))

// `expect(값, '메시지')`. **jest 는 두 번째 인자를 아무 말 없이 버린다.**
//
// 테스트가 이 두 번째 인자로 **어느 항목에서 틀렸는지** 를 말한다
// (`expect(tokens[key], `${name}.${key}`).toBeDefined()` 처럼 `it.each` 안에서 특히 중요하다.
// 없으면 어느 토큰이 빠졌는지 실패 메시지가 말해 주지 않는다).
//
// 그래서 인자를 버리는 대신 **실패 메시지 앞에 붙인다.** 패키지를 더하지 않는 이유는 하는 일이
// 아래 그대로이기 때문이다(`jest-expect-message` 와 같은 방식).
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

// `toHaveBeenCalledOnce` · `toHaveBeenCalledExactlyOnceWith` 매처. jest 에는 없다.
// **한 번만, 그리고 이 인자로** 는 두 단언으로 쪼개면 **한 번** 이 빠져도 통과하므로 매처 하나로 둔다.
expect.extend({
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

// Reanimated 가 **애니메이션 ref 에 네이티브 태그가 없다**고 내는 경고를 걷는다.
//
// 캐릭터 관리 화면이 끌기 자동 스크롤을 위해 `useAnimatedRef` 를 스크롤 뷰에 붙이고, 라이브러리가
// 그 ref 로 `useScrollOffset` 을 건다. 테스트 렌더러에는 네이티브 뷰가 없어 태그가 늘 없으므로,
// 이 경고는 **배선이 맞든 틀리든 매 렌더마다 뜬다.** jest 에서는 아무것도 알려 주지 않는 줄이다.
// 그래서 이 문장 하나만 걷고 나머지 경고는 그대로 흘린다.
const REANIMATED_NO_TAG = 'animatedRef is not initialized'
const baseWarn = console.warn

console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes(REANIMATED_NO_TAG)) return
  baseWarn(...args)
}

// React 의 `act()` 경고를 그 테스트의 실패로 만든다.
//
// 두 경고다. `not wrapped in act(...)` 는 상태가 `act` 밖에서 바뀌었다는 뜻이다. 테스트가 그 갱신을 기다리지
// 않고 검사했거나, 테스트가 끝난 뒤에 갱신이 일어났다. `overlapping act() calls` 는 앞의 비동기 `act` 가
// 끝나기 전에 다음 `act` 를 열었다는 뜻이다. 둘 다 경고만 내고 통과해서 26개 파일에 쌓였고, 새 경고가 묻혔다.
//
// 경고는 그대로 출력하고 모아 두었다가 케이스가 끝날 때 던진다. React 가 경고를 내는 자리에서 던지면 렌더
// 도중이라 다른 에러로 바뀐다. 이 `afterEach` 는 Testing Library 의 정리(언마운트) 뒤에 돈다. 맨 위의
// `react-native-css-interop/test` 가 Testing Library 를 불러 그 정리를 먼저 등록하기 때문이다. 그래서 케이스가 끝난 뒤
// 정리 전에 난 경고도 그 케이스의 실패로 나온다. 그 뒤에 도는 테스트 파일의 `afterEach` 에서 난 경고는 다음 케이스의
// 실패로, 마지막 케이스의 것은 `afterAll` 이 잡는다.
const ACT_WARNING = /not wrapped in act\(|overlapping act\(\) calls/
const actWarnings = []
const baseError = console.error

console.error = (...args) => {
  // React 는 컴포넌트 이름을 `%s` 의 인자로 넘긴다. 채워 두지 않으면 어느 컴포넌트가 늦게 바뀌었는지 실패에 남지 않는다.
  const text = typeof args[0] === 'string' ? format(...args) : args.map((arg) => String(arg)).join(' ')
  if (ACT_WARNING.test(text)) actWarnings.push(text.split('\n')[0])
  baseError(...args)
}

function throwActWarnings() {
  if (actWarnings.length === 0) return
  const found = actWarnings.splice(0)
  throw new Error(`act() 경고가 났다. 갱신을 기다리지 않고 검사했거나 테스트가 끝난 뒤에 갱신이 일어났다.\n${found.join('\n')}`)
}

afterEach(throwActWarnings)
afterAll(throwActWarnings)

// TanStack Query 의 구독자 알림을 마이크로태스크로 낸다.
//
// 기본값은 `setTimeout(0)` 이라, 쿼리가 `act` 안에서 끝나도 화면은 그 `act` 가 끝난 뒤에 다시 그려진다. 그 갱신이
// 위의 `act()` 경고가 되고, 테스트는 다시 그려지기 전의 화면을 검사한다. 가짜 타이머를 쓰는 파일에서는 알림이
// 아예 오지 않는다. 마이크로태스크로 내면 쿼리를 시작한 `act` 가 알림까지 흘려보낸다.
require('@tanstack/react-query').notifyManager.setScheduler((callback) => {
  void Promise.resolve().then(callback)
})

// 떠 있는 토스트의 **자동 소멸 타이머**를 매 케이스 뒤에 걷는다.
//
// 그 타이머는 토스트 스토어의 모듈 스코프에 살아서, 토스트를 띄운 채 끝난 케이스가 2~2.5초짜리
// 실제 `setTimeout` 을 남긴다. jest 가 `did not exit` 로 멈춰 서 있다가 워커 정리와 겹치면
// `SIGSEGV` 까지 간다.
//
// **개별 테스트가 아무것도 안 해도 되게** 여기서 건다. 앞으로 토스트를 띄우는 테스트가 늘어도
// 같은 새는 자리를 다시 만들지 않는다. 스토어를 목한 스위트에서는 그 목에 이 함수가 없으므로
// 옵셔널 호출이 조용히 지나간다.
afterEach(() => {
  try {
    require('./src/features/toast/store').__resetToastsForTest?.()
  } catch {
    // 이 스위트가 스토어를 아예 안 쓰는 경우다. 걷을 것도 없다.
  }
})

// `expo-blur` 는 네이티브 뷰다. 리애니메이티드가 그 위에 세기를 몰면 jest 의 JS 폴백이
// `setAttribute` 를 찾다가 죽는다. 평범한 `View` 로 갈아 끼워 **무엇이 어디에 섰는가**만 본다.
// 흐림이 실제로 그려지는지는 기기가 답한다.
jest.mock('expo-blur', () => {
  const { View } = require('react-native')
  return { BlurView: View }
})

// victory-native 는 Skia 네이티브 캔버스에 그린다. jest 에는 캔버스가 없고 패키지가 ESM 이라 import 단계에서 죽는다.
// 캔버스와 그리는 조각을 비운다. 테스트는 그래프 둘레의 글자와 칸만 본다. 선과 띠가 실제로 그려지는지는 기기가 답한다.
// `createElement` 로 `View` 를 그리면 NativeWind 의 babel 변환이 목 밖의 변수를 끌어와 jest 가 거절한다.
jest.mock('victory-native', () => {
  const nothing = () => null
  return {
    CartesianChart: nothing,
    Line: nothing,
    Area: nothing,
    AreaRange: nothing,
    useChartPressState: (init) => ({
      state: {
        isActive: { value: false },
        matchedIndex: { value: -1 },
        x: { value: { value: init.x }, position: { value: 0 } },
        y: Object.fromEntries(Object.keys(init.y).map((key) => [key, { value: { value: init.y[key] }, position: { value: 0 } }])),
        yIndex: { value: 0 },
      },
      isActive: false,
    }),
  }
})
// 하단바 렌즈(`BarLens.tsx`)가 쓰는 이름까지 둔다. 뷰를 뜨면 그림이 없다고 답해, 바는 렌즈 없이 앱 뷰로 그린다.
jest.mock('@shopify/react-native-skia', () => {
  const nothing = () => null
  return {
    Circle: nothing,
    DashPathEffect: nothing,
    Line: nothing,
    Path: nothing,
    Canvas: nothing,
    Fill: nothing,
    Shader: nothing,
    ImageShader: nothing,
    vec: (x, y) => ({ x, y }),
    makeImageFromView: () => Promise.resolve(null),
    Skia: { RuntimeEffect: { Make: () => null } },
    TileMode: { Clamp: 0 },
    ColorType: { RGBA_8888: 4 },
    AlphaType: { Premul: 2 },
  }
})
