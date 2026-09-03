/**
 * 고가 아이템을 획득한 행의 배경. 테두리·글로우가 아니라 배경 효과다. 콘텐츠보다 먼저 그려지므로
 * 자연히 뒤에 깔리고 z-index 다툼이 없다.
 */
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
  // 한 문서에 여러 행이 뜨므로 그라디언트 id 가 겹치면 안 된다. `react-native-svg` 의 defs
  // 조회도 id 문자열로 한다.
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
