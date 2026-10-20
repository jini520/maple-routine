// 비중 도넛. 조각마다 경로 하나이고, 조각이 없으면 회색 링만 선다.
import { Text } from 'react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { DonutRing } from '../DonutRing'
import { donutSlicePaths } from '../donut-paths'

/** svg 가 색을 바꿔 담는 값(ARGB 정수) */
const argb = (hex: string): number => parseInt(`ff${hex.slice(1)}`, 16)
const fillOf = (node: { props: Record<string, unknown> }): unknown => (node.props.fill as { payload: unknown }).payload

describe('DonutRing', () => {
  it('값이 있는 조각마다 그 색의 경로를 그린다', async () => {
    const view = await renderAtom(
      <DonutRing
        size={112}
        thickness={14}
        emptyColor="#E4E1CE"
        slices={[
          { key: 'a', value: 3, color: '#E07A0A' },
          { key: 'b', value: 1, color: '#7A5AC8' },
        ]}
        label="캐릭터별 수익 분포"
      >
        <Text>3</Text>
      </DonutRing>,
    )

    expect(fillOf(view.getByTestId('donut-slice-a'))).toBe(argb('#E07A0A'))
    expect(fillOf(view.getByTestId('donut-slice-b'))).toBe(argb('#7A5AC8'))
    expect(view.queryByTestId('donut-empty')).toBeNull()
    expect(view.getByText('3')).toBeTruthy()
  })

  // 조각이 없을 때 도넛 자리를 비워 두지 않는다.
  it('값이 모두 0 이면 회색 링만 그린다', async () => {
    const view = await renderAtom(
      <DonutRing size={112} thickness={14} emptyColor="#E4E1CE" slices={[{ key: 'a', value: 0, color: '#E07A0A' }]} label="빈 분포" />,
    )

    expect(view.getByTestId('donut-empty')).toBeTruthy()
    expect(view.queryByTestId('donut-slice-a')).toBeNull()
  })
})

describe('donutSlicePaths', () => {
  // 좁은 조각은 폭이 허락하는 만큼만 깎는다. 다 깎으면 조각이 뒤집혀 그려진다.
  it('좁은 조각은 모서리 반지름을 줄인다', () => {
    const [넓은, 좁은] = donutSlicePaths([999, 1], { size: 112, thickness: 14, gap: 2, cornerRadius: 5 })

    expect(넓은!.strokeWidth).toBeCloseTo(10, 5)
    expect(좁은!.strokeWidth).toBeLessThan(10)
  })
})
