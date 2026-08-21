// 보스 한 줄 — 웹 `BossProfitScreen.test.tsx` 가 화면 통합으로 지키던 행 계약을 이 단위로 옮겼다.
//
// **[[ADR-124]]·[[ADR-032]] 의 "모르는 금액에 0을 쓰지 않는다"가 이 파일의 중심이다.** 미완료와
// 가격 미확정은 둘 다 `payoutMeso === null` 인데, 그 자리에 `0 메소` 를 그리면 "안 잡았다"와
// "0원 벌었다"가 같은 화면이 된다.
import { act, fireEvent } from '@testing-library/react-native'

import valuableDropsData from '../../../data/valuable-drops.json'
import { isValuableDrop } from '../../../lib/valuable-drops'
import { clearCountUpMemory } from '../../../lib/use-count-up'
import type { RecordedDrop } from '../../../types/drops'

import { BossProfitBossRow } from '../BossProfitBossRow'
import { 보스행, 컨텍스트값, renderProfit, 주간보스 } from './harness'

// 카운트업은 모듈 수준 기억을 갖는다([[ADR-087]] 결정 8) — 케이스 사이로 새지 않게 비운다.
beforeEach(() => {
  clearCountUpMemory()
})

const 값매긴드롭: RecordedDrop[] = [
  {
    category: 'equipment',
    itemName: '파풀라투스 마크',
    quantity: 1,
    priceState: 'entered',
    priceMeso: 3_000_000_000,
    priceShare: 3,
  },
]

describe('BossProfitBossRow — 금액을 모르는 행', () => {
  it('미완료 placeholder 는 금액 대신 「미완료」 배지다', async () => {
    const { getByText, queryByText } = await renderProfit(
      <BossProfitBossRow row={보스행({ isComplete: false, payoutMeso: null })} drops={[]} />,
    )

    expect(getByText('미완료')).toBeTruthy()
    expect(queryByText(/메소/)).toBeNull()
  })

  it('가격 미확정 보스는 금액 대신 「가격 미확정」 배지다', async () => {
    const { getByText, queryByText } = await renderProfit(
      <BossProfitBossRow row={보스행({ priceMeso: null, payoutMeso: null })} drops={[]} />,
    )

    expect(getByText('가격 미확정')).toBeTruthy()
    expect(queryByText(/메소/)).toBeNull()
  })

  it('두 경우 모두 파티 스테퍼를 비활성한다 — 조정해도 계산이 0으로 고정된다', async () => {
    const { getByLabelText } = await renderProfit(
      <BossProfitBossRow row={보스행({ isComplete: false, payoutMeso: null })} drops={[]} />,
    )

    expect(getByLabelText(`지내우시 ${주간보스} 하드 파티원 수 증가`).props.accessibilityState.disabled).toBe(true)
    expect(getByLabelText(`지내우시 ${주간보스} 하드 파티원 수 감소`).props.accessibilityState.disabled).toBe(true)
  })
})

describe('BossProfitBossRow — 금액과 아이템 칩', () => {
  it('드롭이 없으면 결정석 금액만 낸다 — 칩 래퍼조차 만들지 않는다', async () => {
    const { getByText, queryByLabelText } = await renderProfit(<BossProfitBossRow row={보스행()} drops={[]} />)

    expect(getByText('6,800,000,000 메소')).toBeTruthy()
    expect(queryByLabelText(`${주간보스} 아이템 수익 확인`)).toBeNull()
  })

  it('값을 매긴 드롭이 있으면 금액에 더하고 칩을 세운다', async () => {
    const { getByText, getByLabelText } = await renderProfit(
      <BossProfitBossRow row={보스행()} drops={값매긴드롭} />,
    )

    // 결정석 68억 + 아이템 30억/3인 = 10억
    expect(getByText('7,800,000,000 메소')).toBeTruthy()
    expect(getByLabelText(`${주간보스} 아이템 수익 확인`)).toBeTruthy()
    expect(getByText('아이템 +10.0억')).toBeTruthy()
  })

  // 값이 안 매겨진 드롭은 금액을 바꾸지 않는다 — 칩도 서지 않는다([[ADR-124]]).
  it('미입력 드롭만 있으면 금액도 칩도 종전 그대로다', async () => {
    const { getByText, queryByLabelText } = await renderProfit(
      <BossProfitBossRow
        row={보스행()}
        drops={[{ category: 'equipment', itemName: '가디언 엔젤 링', quantity: 1 }]}
      />,
    )

    expect(getByText('6,800,000,000 메소')).toBeTruthy()
    expect(queryByLabelText(`${주간보스} 아이템 수익 확인`)).toBeNull()
  })

  it('칩을 누르면 내역 팝오버가 뜬다', async () => {
    const { getByLabelText, queryByTestId, getByTestId } = await renderProfit(
      <BossProfitBossRow row={보스행()} drops={값매긴드롭} />,
    )

    expect(queryByTestId('item-revenue-popover')).toBeNull()
    await act(async () => {
      fireEvent.press(getByLabelText(`${주간보스} 아이템 수익 확인`))
    })

    expect(getByTestId('item-revenue-popover')).toBeTruthy()
  })
})

describe('BossProfitBossRow — 드롭 지시자 ([[ADR-038]])', () => {
  it('드롭이 없으면 "＋ 드롭 추가" 칩이다', async () => {
    const { getByText } = await renderProfit(<BossProfitBossRow row={보스행()} drops={[]} />)

    expect(getByText('＋ 드롭 추가')).toBeTruthy()
  })

  it('네 개 이상이면 셋만 보이고 나머지는 개수로 접는다', async () => {
    const drops: RecordedDrop[] = ['가', '나', '다', '라', '마'].map((name) => ({
      category: 'equipment',
      itemName: name,
      quantity: 1,
    }))

    const { getByText, queryByText } = await renderProfit(<BossProfitBossRow row={보스행()} drops={drops} />)

    expect(getByText('+2')).toBeTruthy()
    expect(queryByText('＋ 드롭 추가')).toBeNull()
  })
})

describe('BossProfitBossRow — 고가 드롭 강조 ([[ADR-045]] 결정 5)', () => {
  // 판정은 `isValuableDrop` 한 곳이 하고([[ADR-038]]) 이 테스트는 그 판정을 베끼지 않는다 —
  // 목록에서 실제로 하나 뽑고, 없는 이름 하나를 반대편으로 쓴다.
  const 고가아이템 = valuableDropsData.items[0]

  it('고가 목록 밖 아이템에는 골드 배경이 없다', async () => {
    const { queryByTestId } = await renderProfit(<BossProfitBossRow row={보스행()} drops={값매긴드롭} />)

    expect(isValuableDrop(값매긴드롭[0].itemName)).toBe(false)
    expect(queryByTestId('valuable-drop-row-tint')).toBeNull()
  })

  it('고가 목록에 든 아이템이면 틴트와 글로우가 함께 선다', async () => {
    const { getByTestId } = await renderProfit(
      <BossProfitBossRow
        row={보스행()}
        drops={[{ category: 'equipment', itemName: 고가아이템, quantity: 1 }]}
      />,
    )

    expect(getByTestId('valuable-drop-row-tint')).toBeTruthy()
    expect(getByTestId('valuable-drop-row-glow')).toBeTruthy()
  })
})

describe('BossProfitBossRow — 파티원 수 ([[ADR-032]]·[[ADR-063]])', () => {
  it('+ 를 누르면 스토어에 1 늘린 값을 저장한다', async () => {
    const setPartySize = jest.fn().mockResolvedValue(undefined)
    const row = 보스행()
    const { getByLabelText } = await renderProfit(
      <BossProfitBossRow row={row} drops={[]} />,
      컨텍스트값({ setPartySize }),
    )

    await act(async () => {
      fireEvent.press(getByLabelText(`지내우시 ${주간보스} 하드 파티원 수 증가`))
    })

    expect(setPartySize).toHaveBeenCalledWith(row, 4)
  })

  it('상한에서는 + 가, 1에서는 − 가 비활성이다', async () => {
    const atMax = await renderProfit(<BossProfitBossRow row={보스행({ partySize: 6 })} drops={[]} />)
    expect(atMax.getByLabelText(`지내우시 ${주간보스} 하드 파티원 수 증가`).props.accessibilityState.disabled).toBe(
      true,
    )

    const atMin = await renderProfit(<BossProfitBossRow row={보스행({ partySize: 1 })} drops={[]} />)
    expect(atMin.getByLabelText(`지내우시 ${주간보스} 하드 파티원 수 감소`).props.accessibilityState.disabled).toBe(
      true,
    )
  })
})
