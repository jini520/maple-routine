/**
 * 초상화 둘레에 서는 링 셋. 이 앱이 그리는 링은 여기 다 있다.
 *
 * - `ProgressArc` 온전한 원 하나 또는 좌·우 반원 둘 (`rail`)
 * - `EmptyRing` 링을 안 그리는 화면이 링 자리에 세우는 얇은 선 (`rail`)
 * - `SegmentedRing` 처치 한도만큼 쪼갠 칸 링 (`compact`)
 *
 * 앞의 둘은 호출부의 `<Svg>` 안에 들어가고 `SegmentedRing` 만 자기 `<Svg>` 를 갖는다. 색이
 * `className` 이 아니라 `stroke` 프롭인 것은 `react-native-svg` 도형이 `cssInterop` 에 없어서다.
 *
 * @see [[ADR-204]] 정정 1·2. 셋이 한 파일에 모인 경위와 채우는 셈을 atom 으로 내린 이유.
 */
import { View } from 'react-native'
import { Circle, Path } from 'react-native-svg'

import { useThemeAppearance } from '../../../theme/context'
import { ProgressRing } from '../../atoms'

import { isFullTurn, portraitRingArcPath, portraitRingSpan, ringRatio } from './portrait-arc'
import { PORTRAIT_COMPACT, PORTRAIT_RAIL } from './portrait-metrics'

/** 링 한 칸이 받는 값. `label` 은 `일간`·`주간`·`월간` 으로 접근성 이름에 들어간다. */
export interface PortraitRingProgress {
  label: string
  completed: number
  total: number
}

const RING_STROKE_PROPS = {
  fill: 'none',
  strokeWidth: PORTRAIT_RAIL.ringStroke,
  strokeLinecap: 'round',
} as const

/** 한 바퀴는 호로 못 그린다(시작점과 끝점이 같다). 그 자리만 `Circle` 이다. */
function FullRing(props: { testID: string; color: string }): React.JSX.Element {
  return (
    <Circle
      testID={props.testID}
      cx={PORTRAIT_RAIL.centerX}
      cy={PORTRAIT_RAIL.centerY}
      r={PORTRAIT_RAIL.ringR}
      stroke={props.color}
      {...RING_STROKE_PROPS}
    />
  )
}

/**
 * 링을 안 그리는 관리 화면이 링 자리에 세우는 선([[ADR-188]] 결정 3).
 *
 * 얼굴 `View` 의 `borderWidth` 로 안 그리는 것은 그만큼 이미지가 안으로 밀려 그 칸의 얼굴만
 * 작아 보이기 때문이다.
 */
export function EmptyRing(props: { color: string }): React.JSX.Element {
  return (
    <Circle
      testID="portrait-empty-ring"
      cx={PORTRAIT_RAIL.centerX}
      cy={PORTRAIT_RAIL.centerY}
      r={PORTRAIT_RAIL.ringR}
      fill="none"
      stroke={props.color}
      strokeWidth={PORTRAIT_RAIL.emptyRingStroke}
    />
  )
}

/** 트랙 위에 찬 만큼을 덧그린다. 구간은 `portraitRingSpan` 이 정한다. */
export function ProgressArc(props: {
  half: 'left' | 'right' | 'full'
  progress: PortraitRingProgress
  color: string
  track: string
}): React.JSX.Element {
  const span = portraitRingSpan(props.half)
  const wholeTurn = isFullTurn(span)
  const ratio = ringRatio(props.progress.completed, props.progress.total)
  const filledTo = span.from + (span.to - span.from) * ratio
  const filled = portraitRingArcPath(span.from, filledTo)

  return (
    <>
      {wholeTurn ? (
        <FullRing testID="portrait-ring-track" color={props.track} />
      ) : (
        <Path
          testID="portrait-ring-track"
          d={portraitRingArcPath(span.from, span.to)}
          stroke={props.track}
          {...RING_STROKE_PROPS}
        />
      )}

      {wholeTurn && ratio >= 1 ? (
        <FullRing testID="portrait-ring-fill" color={props.color} />
      ) : (
        filled !== '' && (
          <Path testID="portrait-ring-fill" d={filled} stroke={props.color} {...RING_STROKE_PROPS} />
        )
      )}
    </>
  )
}

/**
 * 처치 한도만큼 쪼갠 칸 링. 채우는 셈은 `atoms/ProgressRing` 이 들고 여기 남는 것은 치수와 이름이다.
 *
 * 이름의 주기(`label`)는 탭을 따라간다([[ADR-059]] 결정 7). 고정하면 한쪽 탭에서 거짓이 된다.
 * 진행률을 링만 표현하므로 이 이름이 곧 그 정보다([[ADR-054]] 정정 7).
 */
export function SegmentedRing(props: {
  cleared: number
  total: number
  label: string
}): React.JSX.Element {
  const { definition } = useThemeAppearance()

  return (
    <View
      pointerEvents="none"
      role="img"
      aria-label={`${props.label} 보스 처치 ${props.cleared} / ${props.total}`}
      className="absolute inset-0"
    >
      <ProgressRing
        size={PORTRAIT_COMPACT.slot}
        stroke={PORTRAIT_COMPACT.ringStroke}
        direction="ccw"
        track={definition.border}
        fill={definition.primary}
        progress={{
          kind: 'segments',
          cleared: props.cleared,
          total: props.total,
          gap: PORTRAIT_COMPACT.ringGap,
        }}
      />
    </View>
  )
}
