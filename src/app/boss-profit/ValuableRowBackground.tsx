// 고가 아이템을 획득한 **행의 배경** — 테두리·글로우가 아니라 배경 효과다
// (사용자 요청). 콘텐츠보다 먼저 그려지므로 자연히 뒤에 깔린다(웹이 `li` 자체 배경으로 둔 것과
// 같은 자리 — z-index 다툼 없음).
//
// ── 웹의 한 클래스가 RN 에서는 셋으로 갈린다 ──────────────────────────────────────
//
// 웹 `index.css` 의 `.valuable-drop-row` 한 클래스가 셋을 했다: 정적 골드 틴트 · 오른쪽에서
// 배어나오는 radial 글로우 · 2.6s 맥동. RN 에는 그 셋의 짝이 전부 따로 있다 — 틴트는
// `backgroundColor`, 글로우는 **`react-native-svg` 의 `RadialGradient`**(RN 에 배경 그라디언트가
// 없다), 맥동은 Reanimated CSS 애니메이션이다. `@media (prefers-reduced-motion)` 짝은
// `useReducedMotion()` 이고, 값은 전부 `valuable-row-glow.ts` 가 갖는다.
//
// **step 6 이 `BossProfitBossRow` 안에 두었던 것을 step 8 이 꺼냈다** — 가격 기록 화면의 행이
// 두 번째 호출부다(그 파일 머리).
import { useId } from 'react'
import { StyleSheet, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import { AnimatedView, Svg } from '../../lib/nativewind-interop'
import {
  VALUABLE_ROW_GLOW_COLOR,
  VALUABLE_ROW_GLOW_STOPS,
  VALUABLE_ROW_PULSE,
  VALUABLE_ROW_TINT,
} from './valuable-row-glow'

export function ValuableRowBackground(): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  // 한 문서에 여러 행이 뜨므로 그라디언트 id 가 겹치면 안 된다(`DropEffectOverlay` 와 같은 이유 —
  // `react-native-svg` 의 defs 조회도 id 문자열로 한다).
  const gradientId = `valuable-row-glow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <AnimatedView
        testID="valuable-drop-row-tint"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: VALUABLE_ROW_TINT },
          reduceMotion ? null : VALUABLE_ROW_PULSE,
        ]}
      />
      <Svg testID="valuable-drop-row-glow" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={gradientId} cx="82%" cy="50%" rx="70%" ry="160%">
            {VALUABLE_ROW_GLOW_STOPS.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={VALUABLE_ROW_GLOW_COLOR}
                stopOpacity={stop.opacity}
              />
            ))}
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  )
}
