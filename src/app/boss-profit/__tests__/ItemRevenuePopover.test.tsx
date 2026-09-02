// ** 의 표시 층 계약이 여기 산다.**
//
// 합산은 `dropPayoutMeso` 가 스킵과 미입력을 똑같이 0으로 접지만(core, 의도된 설계) **화면은
// 그 둘도 0원도 서로 다르게 말해야 한다** — 미입력에 `0` 을 쓰면 사용자가 적지 않은 사실이
// "0원에 팔았다"는 기록으로 굳는다. 눈으로는 안 보이는 종류의 거짓이라 테스트로 고정한다.
import { render } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import type { RecordedDrop } from '../../../types/drops'

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
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

describe('ItemRevenuePopover — 미입력은 0원이 아니다', () => {
  // 일부러 `priceMeso` 는 있고 `priceState` 만 없는 기록을 준다 — 상태를 안 보고 금액만 읽는
  // 구현(`priceMeso ?? 0` 계열)이면 여기서 `30.0억` 이 새어 나온다.
  it('값을 안 매긴 기록은 금액 대신 "미입력" 이라고 말한다', async () => {
    const { getByText, queryByText } = await renderPopover({
      drops: [drop({ priceMeso: 3_000_000_000, priceShare: 3 })],
    })

    expect(getByText('미입력')).toBeTruthy()
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

  it('1인이면 분배 줄을 만들지 않는다 — 나눈 것이 없다', async () => {
    const { queryByText } = await renderPopover({
      drops: [drop({ priceState: 'entered', priceMeso: 3_000_000_000, priceShare: 1 })],
    })

    expect(queryByText(/÷/)).toBeNull()
  })

  it('스킵(excluded)은 목록에서 아예 뺀다 — 값을 안 매기기로 한 것이라 할 말이 없다', async () => {
    const { queryByText, getByText } = await renderPopover({
      drops: [drop({ itemName: '거대한 공포', priceState: 'excluded' }), drop({ itemName: '가디언 엔젤 링' })],
    })

    expect(queryByText('거대한 공포')).toBeNull()
    expect(getByText('가디언 엔젤 링')).toBeTruthy()
  })

  it('값이 큰 것부터 낸다 — 미입력은 자연히 바닥으로 간다', async () => {
    const { getAllByText } = await renderPopover({
      drops: [
        drop({ itemName: '정렬-미입력' }),
        drop({ itemName: '정렬-작은', priceState: 'entered', priceMeso: 1_000_000_000 }),
        drop({ itemName: '정렬-큰', priceState: 'entered', priceMeso: 9_000_000_000 }),
      ],
    })

    // 이름 텍스트만 모아 순서를 본다(뒤의 `false` 는 등급 뱃지 자리의 빈 분기다).
    const names = getAllByText(/^정렬-/).map((node) => node.props.children)
    expect(names).toEqual([
      ['정렬-큰', false],
      ['정렬-작은', false],
      ['정렬-미입력', false],
    ])
  })

  it('아이템이 없어도 상자는 뜨고 결정석·합계를 말한다', async () => {
    const { getByText, getAllByText } = await renderPopover({ drops: [], crystalMeso: 5_000_000, itemMeso: 0 })

    expect(getByText('기록된 아이템이 없어요')).toBeTruthy()
    // 아이템이 0이라 결정석 줄과 합계 줄이 같은 숫자다 — 둘 다 있어야 맞다.
    expect(getAllByText('5,000,000')).toHaveLength(2)
  })

  it('합계는 목록이 아니라 넘겨받은 두 값으로 만든다 — 낱개로 못 펼치는 몫이 있다', async () => {
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

describe('ItemRevenuePopover — 좌표를 모르면 그리되 보이지 않는다', () => {
  // 웹은 탭 핸들러 안에서 동기로 쟀지만 RN 의 측정은 콜백으로 온다. 그 사이 아무 데나 그리지
  // 않는다 — 내용은 트리에 있고 `opacity: 0` 으로 기다린다(컴포넌트 파일 머리 ①).
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
