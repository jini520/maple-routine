// 모션 줄이기(OS 접근성 설정)를 테스트에서 켜고 끄는 자리.
//
// ## 왜 모듈을 통째로 목으로 덮나
//
// `motion-reduce:` 변형이 RN 에는 클래스 문자열로 안 남아서, 두 스피너의
// 웹 테스트가 *"motion-reduce 클래스를 포함한다"* 로 계약을 지켰다. RN 에는 그 자리가 없다.
// `useReducedMotion` 이 낸 boolean 이 **분기**로 소비되므로, 설정이 켜졌을 때의 그림을 보려면 그 훅이
// 다른 값을 내게 해야 한다. Reanimated 는 그 값을 네이티브 접근성 관리자에서 읽어 테스트에서 바꿀
// 공개 경로가 없다.
//
// `jest.spyOn` 이 아닌 이유는 훅이 ESM 이름 내보내기라 재할당이 막혀 있어서고, 실제 모듈을
// `requireActual` 로 펴서 훅 하나만 갈아끼우는 것이라 **나머지 API 는 진짜**다(`Animated.View` 의
// 프롭 레지스트리·`createAnimatedComponent` 가 그대로 살아 있어야 이 저장소의 모션이 검사된다).
//
// ## 쓰는 법
//
// ```ts
// jest.mock('react-native-reanimated', =>
//   require('../../../__tests__/reduced-motion').reanimatedWithReducedMotion,
// )
// ```
//
// `jest.mock` 의 팩토리는 import 보다 위로 끌어올려지므로 **밖의 값을 참조할 수 없다**. 그래서
// 팩토리 안에서 `require` 로 이 파일을 가져온다. 테스트 파일이 위쪽에서 `import` 한 것과 같은 모듈
// 인스턴스라 아래 상태가 공유된다.
//
// 값은 **다음 렌더부터** 반영된다(훅은 렌더 중에 읽힌다). 그리고 모듈 스코프라 한 파일 안에서 계속
// 살아 있으므로, 켠 테스트는 `afterEach` 로 되돌려야 한다.

let reduceMotion = false

/** 다음 렌더부터 `useReducedMotion` 이 낼 값을 심는 도우미. */
export function mockReducedMotion(next: boolean): void {
  reduceMotion = next
}

/**
 * `withRepeat` 이 불렸는지. 두 스피너에서 모션 줄이기를 **볼 수 있는 창은 이것뿐**이다.
 *
 * SVG 속성 애니메이션은 `useAnimatedProps` 를 거쳐 UI 스레드가 갱신하므로, jest 의 렌더 트리에는
 * 켜 놨을 때나 꺼 놨을 때나 **똑같이** `strokeDashoffset: null` 만 남는다(두 모드의 트리가
 * 문자 단위로 같다). 그래서 "무엇이 그려졌나"로는 이 계약을 지킬 수 없고, 대신 *"반복 애니메이션을
 * 걸었는가"* 를 본다. 클래스를 렌더 결과에서 읽던 자리를
 * 대신하는 것이라, 구현 세부가 아니라 그 자리의 계약 자체다.
 */
export const withRepeatSpy = jest.fn()

/**
 * `jest.mock('react-native-reanimated', …)` 의 팩토리 몸통.
 *
 * `default` 를 손으로 다시 얹는 이유. Reanimated 의 진입점은 그것을 **열거되지 않는 getter** 로
 * 정의해서 전개(`...`)가 데려오지 못한다. 빠뜨리면 `import Animated from 'react-native-reanimated'`
 * 가 `undefined` 가 되고, `nativewind-interop` 의 `cssInterop(Animated.View, …)` 가
 * *"Cannot read properties of undefined (reading 'displayName')"* 로 죽는다.
 */
export function reanimatedWithReducedMotion(): unknown {
  const actual = jest.requireActual('react-native-reanimated') as {
    default: unknown
    withRepeat: (...args: unknown[]) => unknown
  }

  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    useReducedMotion: () => reduceMotion,
    // 기록만 하고 진짜에 그대로 넘긴다. 동작을 바꾸면 이 목이 검사 대상을 대체해 버린다.
    withRepeat: (...args: unknown[]) => {
      withRepeatSpy(...args)
      return actual.withRepeat(...args)
    },
  }
}
