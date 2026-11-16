/**
 * 작은 꺾은선과 그 아래 옅은 채움. MASPI 카드 · 시세 줄 · today 위젯이 같이 쓴다.
 *
 * 눈금 · 축 · 누르기가 없는 모양만의 그래프다. 폭은 부모가 정하고 높이는 `height` 다. 값이 둘 미만이면 가운데에 평평한
 * 선을 긋는다. 값을 받지 못한 today 위젯이 이 선을 그린다.
 *
 * @example <SparkLine values={spark} color={definition.fallInk} height={32} strokeWidth={1.5} inset={3} />
 */
import { Circle } from '@shopify/react-native-skia'
import { View } from 'react-native'
import { Area, CartesianChart, Line } from 'victory-native'

import { NO_AXIS_LINES } from './axis'

export interface SparkLineProps {
  values: readonly number[]
  color: string
  height: number
  strokeWidth: number
  /** 선이 위아래 끝에 닿지 않게 비우는 폭. 채움은 이 폭과 상관없이 바닥까지 찬다 */
  inset: number
  /** 채움의 불투명도. 안 주면 채우지 않는다 */
  fillOpacity?: number
  /** 선의 불투명도. 글자 밑에 까는 today 위젯이 낮춘다 */
  lineOpacity?: number
  /** 마지막 날에 찍는 점의 반지름. 안 주면 찍지 않는다 */
  endDotRadius?: number
  testID?: string
}

/** 값이 둘 미만일 때 그리는 평평한 선의 점. 범위를 ±1 로 두어 가운데에 선다. */
const FLAT = [
  { index: 0, value: 0 },
  { index: 1, value: 0 },
]

export function SparkLine(props: SparkLineProps): React.JSX.Element {
  const data = props.values.length < 2 ? FLAT : props.values.map((value, index) => ({ index, value }))
  const min = Math.min(...data.map((point) => point.value))
  const max = Math.max(...data.map((point) => point.value))
  // 값이 모두 같으면 범위가 0 이라 선이 위나 아래로 붙는다. 위아래로 1 씩 벌려 가운데에 둔다.
  const domain: [number, number] = min === max ? [min - 1, max + 1] : [min, max]

  return (
    <View testID={props.testID} style={{ height: props.height, alignSelf: 'stretch' }} aria-hidden>
      <CartesianChart
        data={data}
        xKey="index"
        yKeys={['value']}
        domain={{ y: domain }}
        // 여백을 `padding` 으로 주면 라이브러리가 그림을 그 안쪽으로 잘라 채움이 바닥에 못 닿는다. 값 범위 안쪽 여유로 준다.
        domainPadding={{ top: props.inset, bottom: props.inset }}
        yAxis={NO_AXIS_LINES}
      >
        {({ points, canvasSize }) => (
          <>
            {props.fillOpacity !== undefined && (
              <Area points={points.value} y0={canvasSize.height} color={props.color} opacity={props.fillOpacity} />
            )}
            <Line
              points={points.value}
              color={props.color}
              strokeWidth={props.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
              opacity={props.lineOpacity ?? 1}
            />
            {props.endDotRadius !== undefined && props.values.length >= 2 && (
              <Circle cx={points.value.at(-1)?.x ?? 0} cy={points.value.at(-1)?.y ?? 0} r={props.endDotRadius} color={props.color} />
            )}
          </>
        )}
      </CartesianChart>
    </View>
  )
}
