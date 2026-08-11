/**
 * NativeWind 를 **써드파티 컴포넌트**에 붙이는 자리 — `react-native-svg` 의 `Svg` 와
 * `expo-linear-gradient` 의 `LinearGradient`.
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
import { cssInterop } from 'nativewind'
import { Svg } from 'react-native-svg'

cssInterop(Svg, {
  className: {
    target: 'style',
    nativeStyleToProp: { width: true, height: true, color: true },
  },
})

cssInterop(LinearGradient, { className: 'style' })

export { LinearGradient, Svg }
