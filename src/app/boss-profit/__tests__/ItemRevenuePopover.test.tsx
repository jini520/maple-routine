// ** 의 표시 층 계약이 여기 산다.**
//
// 합산은 `dropPayoutMeso` 가 기록 안함과 미입력을 똑같이 0으로 접는다(core, 의도된 설계). 상자는
// 그 둘을 아예 싣지 않는다. 미입력에 `0` 을 쓰면 사용자가 적지 않은 사실이 "0원에 팔았다"는 기록으로
// 굳고, 미입력이 있다는 신호는 아이템 가격 입력 버튼의 배지가 받는다.
import { render, within } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import type { RecordedDrop } from '../../../types/drops'

import valuableDropsData from '../../../data/valuable-drops.json'
import { 테스트_안전영역 } from '../../../components/__tests__/render-atom'
import { ThemeProvider } from '../../../theme/ThemeProvider'
import { ItemRevenuePopover } from '../ItemRevenuePopover'

const ANCHOR = { left: 200, top: 300, width: 80, height: 20 }

function drop(overrides: Partial<RecordedDrop> = {}): RecordedDrop {
  return { category: 'equipment', itemName: '가디언 엔젤 링', quantity: 1, ...overrides }
}

function renderPopover(props: {
  drops: RecordedDrop[]
  crystalMeso?: number
  itemMeso?: number
  anchor?: typeof ANCHOR | null
  weeklyLines?: { periodKey: string; label: string; meso: number }[]
  limit?: number
}): ReturnType<typeof render> {
  return render(
    <SafeAreaProvider initialMetrics={테스트_안전영역}>
      <ThemeProvider>
        <ItemRevenuePopover
          drops={props.drops}
          crystalMeso={props.crystalMeso ?? 0}
          itemMeso={props.itemMeso ?? 0}
          anchor={props.anchor === undefined ? ANCHOR : props.anchor}
          onClose={jest.fn()}
          weeklyLines={props.weeklyLines}
          limit={props.limit}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

function entered(itemName: string, priceMeso: number): RecordedDrop {
  return drop({ itemName, priceState: 'entered', priceMeso, priceShare: 1 })
}

describe('ItemRevenuePopover: 미입력은 싣지 않는다', () => {
  // 일부러 `priceMeso` 는 있고 `priceState` 만 없는 기록을 준다. 상태를 안 보고 금액만 읽는
  // 구현(`priceMeso ?? 0` 계열)이면 여기서 `30.0억` 이 새어 나온다.
  it('값을 안 매긴 기록은 목록에 안 선다', async () => {
    const { queryByText } = await renderPopover({
      drops: [drop({ priceMeso: 3_000_000_000, priceShare: 3 })],
    })

    expect(queryByText('가디언 엔젤 링')).toBeNull()
    expect(queryByText('미입력')).toBeNull()
    expect(queryByText('10.0억')).toBeNull()
    expect(queryByText('30.0억 ÷ 3인')).toBeNull()
  })

  it('값을 매긴 기록만 금액을 낸다', async () => {
    const { getByText } = await renderPopover({
      drops: [drop({ priceState: 'entered', priceMeso: 3_000_000_000, priceShare: 3 })],
      itemMeso: 1_000_000_000,
    })

    expect(getByText('10.0억')).toBeTruthy()
    // 나눠 가졌을 때만 분배를 말한다.
    expect(getByText('30.0억 ÷ 3인')).toBeTruthy()
  })

  it('1인이면 분배 줄을 만들지 않는다. 나눈 것이 없다', async () => {
    const { queryByText } = await renderPopover({
      drops: [drop({ priceState: 'entered', priceMeso: 3_000_000_000, priceShare: 1 })],
    })

    expect(queryByText(/÷/)).toBeNull()
  })

  it('기록 안함(excluded)도 목록에서 뺀다. 값을 안 매기기로 한 것이라 할 말이 없다', async () => {
    const { queryByText, getByText } = await renderPopover({
      drops: [drop({ itemName: '거대한 공포', priceState: 'excluded' }), entered('가디언 엔젤 링', 1_000)],
    })

    expect(queryByText('거대한 공포')).toBeNull()
    expect(getByText('가디언 엔젤 링')).toBeTruthy()
  })

  it('자르지 않으면 연출 먼저, 그다음 값이 큰 순이다(보스 행 · 주차 소계 상자)', async () => {
    const 연출아이템 = valuableDropsData.items[0]
    const { getAllByText } = await renderPopover({
      drops: [
        entered('정렬-작은', 1_000_000_000),
        entered('정렬-큰', 9_000_000_000),
        entered(연출아이템, 1),
      ],
    })

    // 이름 텍스트만 모아 순서를 본다(뒤의 `false` 는 등급 뱃지 자리의 빈 분기다).
    const names = getAllByText(new RegExp(`^(정렬-|${연출아이템})`)).map((node) => node.props.children)
    expect(names).toEqual([
      [연출아이템, false],
      ['정렬-큰', false],
      ['정렬-작은', false],
    ])
  })

  it('아이템이 없어도 상자는 뜨고 결정석·합계를 말한다', async () => {
    const { getByText, getAllByText } = await renderPopover({ drops: [], crystalMeso: 5_000_000, itemMeso: 0 })

    expect(getByText('가격을 입력한 아이템이 없어요')).toBeTruthy()
    // 아이템이 0이라 결정석 줄과 합계 줄이 같은 숫자다. 둘 다 있어야 맞다.
    expect(getAllByText('5,000,000')).toHaveLength(2)
  })

  // 기록이 없는 기간과 미입력만 있는 기간이 같은 문장을 쓴다. 옛 문구는 뒤쪽에서 거짓이었다.
  it('미입력만 있어도 같은 빈 목록 문구다', async () => {
    const { getByText, queryByText } = await renderPopover({ drops: [drop(), drop({ priceState: 'excluded' })] })

    expect(getByText('가격을 입력한 아이템이 없어요')).toBeTruthy()
    expect(queryByText('기록된 아이템이 없어요')).toBeNull()
  })

  it('합계는 목록이 아니라 넘겨받은 두 값으로 만든다. 낱개로 못 펼치는 몫이 있다', async () => {
    // 목록은 미입력 하나뿐인데 아이템 합은 40억이다(월간 탭의 주차 소계처럼 뭉쳐 들어온 몫).
    const { getByText } = await renderPopover({
      drops: [drop()],
      crystalMeso: 1_000_000_000,
      itemMeso: 4_000_000_000,
    })

    expect(getByText('5,000,000,000')).toBeTruthy()
  })

  it('주차별 줄은 받았을 때만 그린다', async () => {
    const { getByText } = await renderPopover({
      drops: [],
      weeklyLines: [{ periodKey: '2026-07-30', label: '지난 주', meso: 2_000_000 }],
    })

    expect(getByText('주차별')).toBeTruthy()
    expect(getByText('2,000,000 메소')).toBeTruthy()
  })
})

describe('ItemRevenuePopover: 자르는 수를 받으면 비싼 순 상위 N 건과 나머지 한 줄이다', () => {
  it('값만으로 줄 세워 N 건을 싣는다. 연출 아이템을 앞에 두지 않는다', async () => {
    const 연출아이템 = valuableDropsData.items[0]
    const { getAllByText, queryByText } = await renderPopover({
      drops: [entered(연출아이템, 1), entered('정렬-큰', 9_000_000_000), entered('정렬-작은', 1_000_000_000)],
      limit: 2,
    })

    const names = getAllByText(/^정렬-/).map((node) => node.props.children)
    expect(names).toEqual([
      ['정렬-큰', false],
      ['정렬-작은', false],
    ])
    expect(queryByText(연출아이템)).toBeNull()
  })

  it('나머지 줄은 건수와 몫 합을 목록 줄처럼 줄여 쓰고, 목록 스크롤 안에 선다', async () => {
    const { getByTestId } = await renderPopover({
      drops: [
        entered('정렬-큰', 9_000_000_000),
        entered('나머지-하나', 60_000_000),
        entered('나머지-둘', 50_000_000),
        drop({ itemName: '미입력' }),
      ],
      limit: 1,
    })

    const list = within(getByTestId('item-revenue-list'))
    expect(list.getByText('외 2건')).toBeTruthy()
    expect(list.getByText('1.1억')).toBeTruthy()
  })

  it('순위 밖이 없으면 나머지 줄이 안 선다', async () => {
    const { queryByText } = await renderPopover({
      drops: [entered('정렬-큰', 9_000_000_000), drop({ itemName: '미입력' })],
      limit: 1,
    })

    expect(queryByText(/^외 /)).toBeNull()
  })

  it('자르는 수를 안 받으면 나머지 줄이 없다', async () => {
    const { queryByText } = await renderPopover({
      drops: [entered('가', 1), entered('나', 2), entered('다', 3)],
    })

    expect(queryByText(/^외 /)).toBeNull()
  })
})

describe('ItemRevenuePopover: 좌표를 모르면 그리되 보이지 않는다', () => {
// 측정이 콜백으로 온다. 그 사이 아무 데나 그리지
  // 않는다. 내용은 트리에 있고 `opacity: 0` 으로 기다린다(컴포넌트).
  it('anchor 가 null 이면 투명하다', async () => {
    const { getByTestId } = await renderPopover({ drops: [], anchor: null })

    const style = getByTestId('item-revenue-popover').props.style
    expect(style.opacity).toBe(0)
  })

  it('anchor 를 알면 트리거 아래에 앉고 불투명해진다', async () => {
    const { getByTestId } = await renderPopover({ drops: [] })

    const style = getByTestId('item-revenue-popover').props.style
    expect(style.opacity).toBeUndefined()
    // 트리거 밑변(300 + 20) + 간격 8
    expect(style.top).toBe(328)
  })
})
