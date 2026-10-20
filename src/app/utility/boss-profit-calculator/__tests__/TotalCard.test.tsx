// 합계 카드의 범례. 다섯 캐릭터까지는 모두 적고, 그보다 많으면 나머지를 `그 외 n캐릭터` 로 묶어 팝오버로 보인다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../../components/__tests__/render-atom'
import { TotalCard, type TotalCardCharacter } from '../TotalCard'

function characters(count: number): TotalCardCharacter[] {
  return Array.from({ length: count }, (_, index) => ({
    ocid: `ocid-${index + 1}`,
    name: `캐릭${index + 1}`,
    meso: (count - index) * 100_000_000,
  }))
}

/** 범례 줄의 testID 차례 */
function legendOrder(view: Awaited<ReturnType<typeof renderOverlay>>): string[] {
  return view.getAllByTestId(/^calculator-legend-/).map((node) => String(node.props.testID).replace('calculator-legend-', ''))
}

describe('TotalCard', () => {
  it('금액이 큰 캐릭터부터 늘어놓고, 금액이 0 인 캐릭터는 그리지 않는다', async () => {
    const view = await renderOverlay(
      <TotalCard
        characters={[
          { ocid: 'a', name: '가', meso: 100_000_000 },
          { ocid: 'b', name: '나', meso: 0 },
          { ocid: 'c', name: '다', meso: 300_000_000 },
        ]}
        bossCount={3}
        selectedOcid="a"
      />,
    )

    expect(legendOrder(view)).toEqual(['c', 'a'])
    expect(view.queryByText('나')).toBeNull()
    expect(view.queryByTestId('donut-slice-b')).toBeNull()
  })

  // 0 인 캐릭터는 예외 없이 그리지 않는다. 가운데 캐릭터 수도 금액이 있는 캐릭터만 센다(사용자 지정).
  it('모든 캐릭터가 0 이면 범례를 비우고 가운데는 캐릭터 0 이다', async () => {
    const view = await renderOverlay(
      <TotalCard characters={characters(3).map((one) => ({ ...one, meso: 0 }))} bossCount={0} selectedOcid="ocid-1" />,
    )

    expect(view.queryAllByTestId(/^calculator-legend-/)).toHaveLength(0)
    expect(view.getByTestId('donut-empty')).toBeTruthy()
    expect(view.getByTestId('calculator-donut-count').props.children).toBe(0)
  })

  it('다섯 캐릭터면 모두 제 이름으로 적고 묶지 않는다', async () => {
    const view = await renderOverlay(<TotalCard characters={characters(5)} bossCount={10} selectedOcid="ocid-1" />)

    for (let index = 1; index <= 5; index += 1) expect(view.getByText(`캐릭${index}`)).toBeTruthy()
    expect(view.queryByText(/그 외/)).toBeNull()
  })

  // 캐릭터는 `명` 으로 세지 않는다(사용자 지정).
  it('여섯 이상이면 넷 뒤에 그 외 n캐릭터 를 두고, 누르면 묶인 캐릭터가 팝오버에 나온다', async () => {
    const view = await renderOverlay(<TotalCard characters={characters(6)} bossCount={10} selectedOcid="ocid-1" />)

    expect(view.getByText('그 외 2캐릭터')).toBeTruthy()
    expect(view.queryByText(/명/)).toBeNull()
    expect(view.queryByText('캐릭5')).toBeNull()

    await act(async () => {
      fireEvent.press(view.getByLabelText('그 외 2캐릭터 자세히'))
    })

    expect(view.getByText('캐릭5')).toBeTruthy()
    expect(view.getByText('캐릭6')).toBeTruthy()
  })
})
