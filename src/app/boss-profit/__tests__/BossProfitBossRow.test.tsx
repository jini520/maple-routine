// 보스 한 줄. 웹 `BossProfitScreen.test.tsx` 가 화면 통합으로 지키던 행 계약을 이 단위로 옮겼다.
//
// ** 의 "모르는 금액에 0을 쓰지 않는다"가 이 파일의 중심이다.** 미완료와
// 가격 미확정은 둘 다 `payoutMeso === null` 인데, 그 자리에 `0 메소` 를 그리면 "안 잡았다"와
// "0원 벌었다"가 같은 화면이 된다.
import { act, fireEvent, within } from '@testing-library/react-native'

import valuableDropsData from '../../../data/valuable-drops.json'
import { isValuableDrop } from '../../../lib/drop/valuable-drops'
import { clearCountUpMemory } from '../../../hooks/useCountUp'
import type { RecordedDrop } from '../../../types/drops'

import { flattenStyle } from '../../../components/__tests__/render-atom'
import { BossProfitBossRow } from '../BossProfitBossRow'
import { 보스행, 컨텍스트값, renderProfit, 주간보스 } from './harness'

// 카운트업은 모듈 수준 기억을 갖는다. 케이스 사이로 새지 않게 비운다.
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

describe('BossProfitBossRow: 금액을 모르는 행', () => {
  it('미완료 placeholder 는 금액 대신 `미완료` 배지다', async () => {
    const { getByText, queryByText } = await renderProfit(
      <BossProfitBossRow row={보스행({ isComplete: false, payoutMeso: null })} drops={[]} />,
    )

    expect(getByText('미완료')).toBeTruthy()
    expect(queryByText(/메소/)).toBeNull()
  })

  it('가격 미확정 보스는 금액 대신 `가격 미확정` 배지다', async () => {
    const { getByText, queryByText } = await renderProfit(
      <BossProfitBossRow row={보스행({ priceMeso: null, payoutMeso: null })} drops={[]} />,
    )

    expect(getByText('가격 미확정')).toBeTruthy()
    expect(queryByText(/메소/)).toBeNull()
  })

  it('두 경우 모두 파티 스테퍼를 비활성한다. 조정해도 계산이 0으로 고정된다', async () => {
    const { getByLabelText } = await renderProfit(
      <BossProfitBossRow row={보스행({ isComplete: false, payoutMeso: null })} drops={[]} />,
    )

    expect(getByLabelText(`지내우시 ${주간보스} 하드 파티원 수 증가`).props.accessibilityState.disabled).toBe(true)
    expect(getByLabelText(`지내우시 ${주간보스} 하드 파티원 수 감소`).props.accessibilityState.disabled).toBe(true)
  })
})

describe('BossProfitBossRow: 금액과 아이템 칩', () => {
  it('드롭이 없으면 결정석 금액만 낸다. 칩 래퍼조차 만들지 않는다', async () => {
    const { getByText, queryByLabelText } = await renderProfit(<BossProfitBossRow row={보스행()} drops={[]} />)

    expect(getByText('6,800,000,000 메소')).toBeTruthy()
    expect(queryByLabelText(`${주간보스} 아이템 수익 확인`)).toBeNull()
  })

  // 칩을 걷고 **금액 자체가 버튼**이 됐다(사용자 지시). 숫자만 남으면 눌린다는 것이 안 보이므로
  // 점선 밑줄이 그것을 말한다.
  it('값을 매긴 드롭이 있으면 금액에 더하고 금액이 버튼이 된다', async () => {
    const { getByText, getByLabelText, getByTestId, queryByText } = await renderProfit(
      <BossProfitBossRow row={보스행()} drops={값매긴드롭} />,
    )

    // 결정석 68억 + 아이템 30억/3인 = 10억
    expect(getByText('7,800,000,000 메소')).toBeTruthy()
    expect(getByLabelText(`${주간보스} 아이템 수익 확인`)).toBeTruthy()
    expect(getByTestId('item-revenue-underline')).toBeTruthy()
    expect(queryByText(/^아이템 \+/)).toBeNull()
  })

  // 결정석뿐인 줄은 열어도 볼 것이 없다. 어포던스가 붙으면 거짓말이다.
  it('아이템이 없으면 밑줄도 버튼도 없다', async () => {
    const { queryByTestId, queryByLabelText } = await renderProfit(
      <BossProfitBossRow row={보스행()} drops={[]} />,
    )

    expect(queryByTestId('item-revenue-underline')).toBeNull()
    expect(queryByLabelText(`${주간보스} 아이템 수익 확인`)).toBeNull()
  })

  // 값이 안 매겨진 드롭은 금액을 바꾸지 않는다. 칩도 서지 않는다.
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

describe('BossProfitBossRow: 드롭 지시자', () => {
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

// 고가 드롭 행의 숨쉬는 배경을 걷었다(사용자 지시, 다시 디자인할 예정). 같은 효과가 가격 기록
// 화면에는 그대로 남아 있어 컴포넌트 자체는 산다.
describe('BossProfitBossRow: 고가 드롭 배경이 없다', () => {
  const 고가아이템 = valuableDropsData.items[0]

  it('고가 목록에 든 아이템이어도 배경을 안 깐다', async () => {
    const { queryByTestId } = await renderProfit(
      <BossProfitBossRow
        row={보스행()}
        drops={[{ category: 'equipment', itemName: 고가아이템, quantity: 1 }]}
      />,
    )

    expect(isValuableDrop(고가아이템)).toBe(true)
    expect(queryByTestId('valuable-drop-row-tint')).toBeNull()
    expect(queryByTestId('valuable-drop-row-glow')).toBeNull()
  })
})

// 아이콘 스택은 셋만 보여준다. 이 순서가 곧 무엇이 보이는가라, 그 판의 사건이 `+N` 뒤에 숨으면
// 안 된다. 규칙 자체는 `lib/drop/drop-order` 가 갖고 여기서는 **화면이 그것을 쓰는가**만 본다.
// 차례는 팝오버 목록에서 읽는다. 스택은 그림뿐이라 이름을 안 든다.
describe('BossProfitBossRow: 아이템 차례', () => {
  const 고가아이템 = valuableDropsData.items[0]

  /** 팝오버를 열고 목록에 선 이름을 **선 차례대로** 읽는다. */
  async function 목록(drops: RecordedDrop[]): Promise<string[]> {
    const { getByLabelText, getByTestId } = await renderProfit(
      <BossProfitBossRow row={보스행()} drops={drops} />,
    )
    await act(async () => {
      fireEvent.press(getByLabelText(`${주간보스} 아이템 수익 확인`))
    })

    // 이름 줄의 자식은 `[이름, 레벨 배지 또는 false]` 라 통째로 문자열로 만들면 안 된다.
    const 이름 = new RegExp(`^(${drops.map((drop) => drop.itemName).join('|')})$`)
    return within(getByTestId('item-revenue-popover'))
      .getAllByText(이름)
      .map((node) => {
        const children = node.props.children as unknown
        return String(Array.isArray(children) ? children[0] : children)
      })
  }

  it('연출이 나는 아이템이 값을 매긴 것보다 앞이다', async () => {
    const 이름들 = await 목록([
      {
        category: 'equipment',
        itemName: '평범한 것',
        quantity: 1,
        priceState: 'entered',
        priceMeso: 9_000_000_000,
        priceShare: 1,
      },
      { category: 'equipment', itemName: 고가아이템, quantity: 1 },
    ])

    expect(이름들.indexOf(고가아이템)).toBeLessThan(이름들.indexOf('평범한 것'))
  })

  it('연출이 없는 것끼리는 비싼 순이다', async () => {
    const 이름들 = await 목록([
      { category: 'equipment', itemName: '싼 것', quantity: 1, priceState: 'entered', priceMeso: 100, priceShare: 1 },
      { category: 'equipment', itemName: '비싼 것', quantity: 1, priceState: 'entered', priceMeso: 900, priceShare: 1 },
    ])

    expect(이름들.indexOf('비싼 것')).toBeLessThan(이름들.indexOf('싼 것'))
  })
})

describe('BossProfitBossRow: 파티원 수', () => {
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

// 오른쪽이 두 줄(이름 줄 + 파티·금액 줄)이라 위쪽 정렬이면 초상만 위로 붙는다.
it('보스 초상은 행 전체의 세로 가운데에 선다', async () => {
  const { getByTestId } = await renderProfit(<BossProfitBossRow row={보스행()} drops={[]} />)

  expect(flattenStyle(getByTestId('boss-profit-boss-row').props.style)).toMatchObject({
    alignItems: 'center',
  })
})
