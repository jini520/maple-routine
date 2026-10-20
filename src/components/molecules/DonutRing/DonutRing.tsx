/**
 * 비중 도넛. 조각 사이에 틈을 두고 조각 모서리를 둥글게 깎는다. 가운데에는 받은 자식을 놓는다.
 *
 * 조각 색을 프롭으로 받는다. `react-native-svg` 의 도형이 `className` 을 받지 못하기 때문이다.
 * 조각이 없으면 회색 링만 그린다. 도넛 자리가 비면 카드가 무너져 보인다.
 */
import { View } from 'react-native'
import { Circle, Path } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'
import { donutSlicePaths } from './donut-paths'

export interface DonutSlice {
  key: string
  value: number
  color: string
}

export function DonutRing(props: {
  size: number
  thickness: number
  slices: readonly DonutSlice[]
  /** 조각이 없을 때의 링 색 */
  emptyColor: string
  /** 읽어 주는 이름. 조각의 뜻은 화면이 안다 */
  label: string
  children?: React.ReactNode
}): React.JSX.Element {
  const shown = props.slices.filter((slice) => slice.value > 0)
  const paths = donutSlicePaths(
    shown.map((slice) => slice.value),
    { size: props.size, thickness: props.thickness, gap: 2, cornerRadius: 5 },
  )
  const center = props.size / 2

  return (
    <View role="img" aria-label={props.label} style={{ width: props.size, height: props.size }}>
      <Svg width={props.size} height={props.size} viewBox={`0 0 ${props.size} ${props.size}`}>
        {shown.length === 0 ? (
          <Circle
            testID="donut-empty"
            cx={center}
            cy={center}
            r={center - 3 - props.thickness / 2}
            fill="none"
            stroke={props.emptyColor}
            strokeWidth={props.thickness}
          />
        ) : (
          shown.map((slice, index) => (
            <Path
              key={slice.key}
              testID={`donut-slice-${slice.key}`}
              d={paths[index]!.d}
              fill={slice.color}
              stroke={slice.color}
              strokeWidth={paths[index]!.strokeWidth}
              strokeLinejoin="round"
            />
          ))
        )}
      </Svg>
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        {props.children}
      </View>
    </View>
  )
}
