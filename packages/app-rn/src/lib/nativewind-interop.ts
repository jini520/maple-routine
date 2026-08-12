/**
 * NativeWind 를 **써드파티 컴포넌트**에 붙이는 자리 — `react-native-svg` 의 `Svg`,
 * `expo-linear-gradient` 의 `LinearGradient`, `react-native-reanimated` 의 `Animated.View`.
 *
 * ## 왜 필요한가
 *
 * NativeWind 는 `react-native` 의 기본 컴포넌트(`View`·`Text`·`Pressable` …)만 자동으로 가로챈다.
 * 그 밖의 컴포넌트에 `className` 을 주면 **그대로 미지의 프롭으로 흘러가고 스타일은 안 붙는다**
 * (실측: `<Svg className="text-primary h-5 w-5">` 의 렌더 트리에 `className` 문자열이 그대로
 * 남아 있었다). 에러도 경고도 없어서, 등록을 빼먹으면 *"클래스는 썼는데 색·크기만 없는"* 상태가
 * 조용히 생긴다 — 테마 변수를 못 찾을 때와 같은 실패 모양이다(`theme-vars.ts` 주석 참고).
 *
 * ## `Svg` 의 매핑이 특별한 이유 — `currentColor`
 *
 * 웹의 아이콘·스피너는 전부 `stroke="currentColor"`/`fill="currentColor"` 로 그리고, 색은 호출부가
 * `className="text-primary"` 로 정한다. `react-native-svg` 에도 `currentColor` 가 있지만 그 값의
 * 출처는 CSS 상속이 아니라 **`Svg` 의 `color` 프롭**이다. 그래서 `nativeStyleToProp` 으로
 * `style.color` → `color` 프롭으로 옮겨 준다 — 그러면 웹과 **같은 `className`** 이 같은 결과를 낸다.
 *
 * `width`/`height` 도 같이 옮긴다(`h-5 w-5` → SVG 상자 크기). CSS 가 속성보다 우선하던 웹의 성질이
 * 그대로 살아, `size` 프롭으로 준 기본 크기를 호출부 클래스가 덮는다.
 *
 * ## 등록은 부수 효과다
 *
 * `cssInterop()` 은 컴포넌트를 감싼 새 것을 돌려주는 대신 **그 컴포넌트를 등록**한다(실측 — 등록만
 * 하고 원본을 그대로 렌더해도 클래스가 풀린다). 반환값을 쓰면 `SvgProps`·`LinearGradientProps` 타입이
 * 날아가므로 원본을 그대로 다시 내보낸다. 이 모듈을 거쳐 import 하는 것 자체가 등록을 보장한다 —
 * `react-native-svg` 에서 직접 가져오면 등록이 안 된 채로 쓸 수 있으니, SVG 를 쓰는 컴포넌트는
 * **반드시 여기서** 가져올 것.
 */

import { LinearGradient } from 'expo-linear-gradient'
import type { LucideIcon } from 'lucide-react-native'
import { cssInterop } from 'nativewind'
import Animated from 'react-native-reanimated'
import { Svg } from 'react-native-svg'

cssInterop(Svg, {
  className: {
    target: 'style',
    nativeStyleToProp: { width: true, height: true, color: true },
  },
})

cssInterop(LinearGradient, { className: 'style' })

/**
 * Reanimated 의 `Animated.View` — **step 7(animations)이 들여왔다.**
 *
 * ## 왜 `View` 로는 안 되나
 *
 * Reanimated 의 CSS 애니메이션(`animationName`·`transitionProperty` …)은 **애니메이션 컴포넌트에만**
 * 붙는다. `createAnimatedComponent` 가 감싸면서 프롭 레지스트리를 달아 주고, UI 스레드가 그 레지스트리를
 * 통해 스타일을 직접 갱신한다. 평범한 `View` 에 같은 스타일 키를 주면 **RN 이 모르는 키라 조용히 버린다**
 * — 이 파일이 내내 경고하는 그 실패 모양이다.
 *
 * ## 왜 여기에 등록하나
 *
 * `Animated.View` 는 `react-native` 의 기본 컴포넌트가 아니라 NativeWind 가 자동으로 안 가로챈다.
 * 등록을 다른 파일에 두면 **레지스트리가 둘**이 되어, 어느 쪽을 거쳐 import 했느냐로 클래스가 풀리기도
 * 안 풀리기도 한다(그리고 안 풀려도 에러가 없다). 그래서 `Svg` 와 같은 자리에 둔다 —
 * **애니메이션이 붙는 컴포넌트는 반드시 여기서 `AnimatedView` 를 가져올 것.**
 *
 * 매핑이 `'style'` 하나뿐인 것은 `Svg` 와 달리 옮겨 줄 프롭이 없기 때문이다(`View` 는 크기·색을 전부
 * `style` 로 받는다). 클래스가 만든 스타일과 애니메이션 스타일은 **같은 `style` 객체로 합쳐진다** —
 * `opacity-0`/`opacity-100` 같은 클래스 변화가 그대로 `transitionProperty: 'opacity'` 의 대상이 된다.
 */
cssInterop(Animated.View, { className: 'style' })

const AnimatedView = Animated.View

/**
 * lucide 아이콘 하나를 `className` 을 받는 컴포넌트로 등록한다 — **웹 호출부를 한 글자도 안 고치기
 * 위해서다**(`<AlertTriangle className="h-4 w-4 text-error-ink" strokeWidth={1.75} />`).
 *
 * `lucide-react-native` 는 `color`·`size` 프롭으로 색과 크기를 받고 `className` 은 그대로 안쪽
 * `Svg` 로 흘려보낸다. 그 `Svg` 는 위에서 등록해 뒀지만 **그 자리에서는 안 풀린다** — NativeWind 는
 * JSX 호출 시점에 컴포넌트가 등록됐는지 보는데, 그 `createElement` 는 우리 코드가 아니라
 * 라이브러리 안에 있다. 그래서 **아이콘 컴포넌트 자체**를 등록해 우리 JSX 에서 풀리게 한다.
 *
 * 매핑이 셋인 이유는 lucide 의 프롭 이름과 짝을 맞추기 위해서다.
 *   `text-*`   → `style.color`  → `color` 프롭 → `stroke`(아이콘 본체와 자식 도형 모두)
 *   `h-*`/`w-*` → `style.height`/`width` → `Svg` 의 상자. lucide 는 `size` 로 계산한 width/height
 *                 **뒤에** 나머지 프롭을 펼치므로 클래스가 이긴다(웹에서 CSS 가 속성을 이겼던 것과
 *                 같은 순서다).
 * 나머지 유틸리티(`shrink-0` 등)는 `target: 'style'` 로 `style` 프롭에 남아 lucide 의 `...rest` 를
 * 타고 `Svg` 에 닿는다 — `target: false` 로 두면 **그것들이 조용히 사라진다**(실측).
 *
 * 등록은 **부수 효과**다(`cssInterop` 은 감싼 것을 돌려주는 대신 그 컴포넌트를 등록한다). 그래서
 * 반환값을 쓰지 않고 원본을 그대로 다시 내보낸다 — 타입(`LucideIcon`)이 살아 있어야 `EmptyState` 의
 * `icon` 프롭에 그대로 들어간다.
 *
 * **여기서 내보내지 않은 lucide 아이콘을 직접 import 하면 `className` 이 조용히 무시된다** — SVG
 * 와 정확히 같은 실패 모양이다(에러도 경고도 없다). 아이콘을 새로 쓸 때는 반드시 `lib/icons.ts` 에
 * 더할 것.
 *
 * **`testID` 는 통하지 않는다** — lucide 의 `Icon` 이 그것을 가로채 `data-testid` 로 바꿔 넘기므로
 * (웹판과 코드를 공유하는 흔적) RNTL 의 `getByTestId` 로 못 찾는다. 아이콘을 테스트에서 지목해야
 * 하면 감싸는 `View` 에 `testID` 를 준다.
 */
function withIconInterop<T extends LucideIcon>(Icon: T): T {
  // `Icon as LucideIcon` — `cssInterop` 의 매핑 타입은 컴포넌트 프롭에서 파생되는데, 제네릭 `T` 로는
  // TS 가 그 조건부 타입을 못 푼다(`target: 'style'` 이 거부된다). 구체 타입으로 좁혀 주면 풀리고,
  // 모든 lucide 아이콘이 같은 프롭을 갖는다는 사실은 `LucideIcon` 자체가 보장한다.
  cssInterop(Icon as LucideIcon, {
    className: {
      target: 'style',
      nativeStyleToProp: { width: true, height: true, color: true },
    },
  })
  return Icon
}

export { AnimatedView, LinearGradient, Svg, withIconInterop }
