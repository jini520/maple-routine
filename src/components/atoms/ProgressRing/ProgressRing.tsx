/**
 * 진행률 링 atom([[ADR-204]] 정정 2). 링을 채우는 셈이 여기 한 곳에 있다.
 *
 * **색을 프롭으로 받는다.** 링 색은 `className` 으로 못 준다. `react-native-svg` 의 도형이
 * `cssInterop` 에 없고, 등록해도 한 `<Svg>` 안에서 한 색만 통한다. 그래서 이 부품은 테마를 안 읽고
 * 도메인도 모른다. 읽어 주는 이름도 호출부 몫이다(무엇을 셌는지는 화면이 안다).
 *
 * 반원 둘로 가르는 링은 여기 없다. 그것만 `Path` 로 그리고 곡선 글자와 같은 중심을 읽어
 * `organisms/CharacterPortrait/portrait-ring` 에 남는다.
 */
import { Circle } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'

/** 연속은 비율 하나, 쪼갠 것은 칸 수와 찬 칸 수. 갈리는 것은 채움 모양뿐이다. */
export type RingProgress =
  | { kind: 'continuous'; ratio: number }
  | {
      kind: 'segments'
      cleared: number
      total: number
      /** 칸 사이 간격(둘레 위의 길이). 칸이 하나면 안 쓴다. */
      gap: number
    }

export interface ProgressRingProps {
  /** 상자 한 변(px). 링은 이 안에 들어온다. */
  readonly size: number
  readonly stroke: number
  /** 12시에서 시작해 시계(`cw`)로 도는가 반시계(`ccw`)로 도는가. */
  readonly direction: 'cw' | 'ccw'
  /** 안 찬 자리의 색. */
  readonly track: string
  /** 찬 자리의 색. */
  readonly fill: string
  readonly progress: RingProgress
  readonly testID?: string
}

/**
 * SVG 원의 경로는 **3시에서 시작해 시계방향**으로 돈다. 두 갈래 다 12시에서 시작해야 한다.
 *
 * `cw` 는 상자를 4분의 1 바퀴 되돌린다. `ccw` 는 좌우를 뒤집어 진행 방향을 반시계로 만드는데 그러면
 * 시작점이 9시로 가므로, 거기서 시계방향 90도를 더해 시작점만 12시로 되돌린다.
 */
const TRANSFORM = {
  cw: [{ rotate: '270deg' }],
  ccw: [{ rotate: '90deg' }, { scaleX: -1 }],
} as const

/**
 * 두 갈래가 함께 넘기는 도형 값. 채움 모양만 갈리고 이것들은 같다.
 *
 * **`fill` 을 안 담는다.** 이 부품에서 `fill` 은 «찬 자리의 색» 이라 SVG 의 `fill` 속성과 이름이
 * 겹친다. 함께 담으면 색 프롭이 그것을 덮어 `<Circle>` 이 `fill` 없이 나가고, SVG 기본값이 검정이라
 * **링 안이 까맣게 칠해진다**. 그래서 `fill="none"` 은 도형마다 직접 적는다.
 */
interface RingCircle {
  cx: number
  cy: number
  r: number
  strokeWidth: number
}

/** stroke 는 경로의 **가운데**에 그려진다. 절반만큼 안으로 들어와야 링이 상자를 안 넘는다. */
function radiusOf(size: number, stroke: number): number {
  return (size - stroke) / 2
}

export function ProgressRing(props: ProgressRingProps): React.JSX.Element {
  const radius = radiusOf(props.size, props.stroke)
  const circumference = 2 * Math.PI * radius
  const circle: RingCircle = {
    cx: props.size / 2,
    cy: props.size / 2,
    r: radius,
    strokeWidth: props.stroke,
  }

  return (
    <Svg
      testID={props.testID}
      width={props.size}
      height={props.size}
      viewBox={`0 0 ${props.size} ${props.size}`}
      style={{ transform: TRANSFORM[props.direction] }}
    >
      {props.progress.kind === 'continuous' ? (
        <ContinuousFill
          circle={circle}
          circumference={circumference}
          ratio={props.progress.ratio}
          track={props.track}
          fill={props.fill}
        />
      ) : (
        <Segments
          circle={circle}
          circumference={circumference}
          stroke={props.stroke}
          progress={props.progress}
          track={props.track}
          fill={props.fill}
        />
      )}
    </Svg>
  )
}

function ContinuousFill(props: {
  circle: RingCircle
  circumference: number
  ratio: number
  track: string
  fill: string
}): React.JSX.Element {
  const filled = props.circumference * props.ratio

  return (
    <>
      <Circle testID="progress-ring-track" fill="none" {...props.circle} stroke={props.track} />
      {/* 0 이면 호를 아예 안 그린다. `round` 캡이 길이 0 인 호에 점 하나를 찍어 아직 아무것도 안
          했다는 것이 조금 했다로 보인다. */}
      {filled > 0 && (
        <Circle
          testID="progress-ring-fill"
          fill="none"
          {...props.circle}
          stroke={props.fill}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${props.circumference - filled}`}
        />
      )}
    </>
  )
}

function Segments(props: {
  circle: RingCircle
  circumference: number
  stroke: number
  progress: Extract<RingProgress, { kind: 'segments' }>
  track: string
  fill: string
}): React.JSX.Element {
  const { circumference, stroke, progress } = props
  const segment = circumference / progress.total
  // `round` 캡은 칸 양끝을 stroke 의 절반씩 **더** 그린다([[ADR-054]] 정정 5). 그만큼 dash 를 미리
  // 줄여야 보이는 칸 길이와 간격이 butt 일 때와 같다. 안 빼면 간격이 2.4 에서 0.4 로 뭉개져 12칸이
  // 한 원처럼 보인다.
  const dash = Math.max(segment - progress.gap - stroke, 0.5)
  // 캡이 시작점 뒤로 절반만큼 튀어나오므로 그만큼 밀어야 칸이 제자리에 앉는다.
  const capOffset = stroke / 2
  // 칸이 하나뿐이면 dash 를 안 건다([[ADR-059]] 정정 1). 간격은 칸과 칸을 나누는 장치라 나눌 상대가
  // 없으면 나눔이 아니라 결손으로 읽힌다. 값을 0 으로 두는 대신 속성을 통째로 빼는 것은 dash 양끝의
  // 둥근 캡이 정확히 겹쳐 이음매가 비치는 것을 피하기 위해서다.
  const single = progress.total === 1

  return (
    <>
      {Array.from({ length: progress.total }, (_, index) => (
        <Circle
          key={index}
          testID="progress-ring-segment"
          fill="none"
          {...props.circle}
          strokeLinecap="round"
          stroke={index < progress.cleared ? props.fill : props.track}
          strokeDasharray={single ? undefined : `${dash} ${circumference - dash}`}
          strokeDashoffset={single ? undefined : -(index * segment + capOffset)}
        />
      ))}
    </>
  )
}
