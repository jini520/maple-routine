// 펼친 카드의 본문. 주간(보스 행)과 월간(주차 소계 + 월간 보스)이다.
//
// ** 가 이 파일의 중심이다**: 여섯 상태 중 행동이 있는 둘만 버튼을 갖고,
// **금액을 모르는 상태에는 0을 쓰지 않는다.** 0을 쓰면 "조회한 적 없다"가 "0원 벌었다"가 된다.
//  가 드롭 가격에서 지키는 것과 같은 원칙이다.
import { act, fireEvent } from '@testing-library/react-native'

import { clearCountUpMemory } from '../../../hooks/useCountUp'
import type { WeeklySubtotalState } from '../../../features/boss-profit/store'

import { flattenStyle } from '../../../components/__tests__/render-atom'
import { MonthlyAccordionBody, WeeklyAccordionBody, WeeklySubtotalRow } from '../AccordionBody'
import { 다른주간보스, 월간보스, 보스행, 주차소계, 컨텍스트값, renderProfit } from './harness'

beforeEach(() => {
  clearCountUpMemory()
})

describe('WeeklyAccordionBody', () => {
  // 웹의 `last:border-b-transparent` 짝. RN 에는 `:last-child` 가 없어 부모가 알려 준다.
  // 테두리를 **빼지 않고 색만** 지우는 것이 요점이라 두께는 두 행이 같아야 한다.
  it('보스 행을 순서대로 그리고 마지막 행만 테두리 색을 지운다', async () => {
    const rows = [보스행(), 보스행({ boss: 다른주간보스 })]
    const { getByLabelText, getAllByTestId } = await renderProfit(<WeeklyAccordionBody rows={rows} />)

    expect(getByLabelText(`${rows[0].boss} 하드 드롭 아이템 관리`)).toBeTruthy()
    expect(getByLabelText(`${rows[1].boss} 하드 드롭 아이템 관리`)).toBeTruthy()

    const [first, last] = getAllByTestId('boss-profit-boss-row').map((node) => flattenStyle(node.props.style))
    expect(first.borderBottomWidth).toBe(last.borderBottomWidth)
    expect(first.borderBottomColor).not.toBe(last.borderBottomColor)
    // NativeWind 가 `transparent` 를 8자리 hex 로 편다.
    expect(last.borderBottomColor).toBe('#00000000')
  })

  it('행의 드롭은 (ocid, 보스, 난이도, 기간) 키로 찾아 넘긴다', async () => {
    const row = 보스행()
    const key = `${row.ocid}|${row.boss}|${row.difficulty}|${row.periodKey}`
    const { getByText } = await renderProfit(
      <WeeklyAccordionBody rows={[row]} />,
      컨텍스트값({
        dropsByRowKey: {
          [key]: [
            {
              category: 'equipment',
              itemName: '파풀라투스 마크',
              quantity: 1,
              priceState: 'entered',
              priceMeso: 3_000_000_000,
              priceShare: 1,
            },
          ],
        },
      }),
    )

    expect(getByText('아이템 +30.0억')).toBeTruthy()
  })
})

describe('WeeklySubtotalRow: 상태마다 얼굴이 다르다', () => {
  const 금액없는상태: { state: WeeklySubtotalState; label: string }[] = [
    { state: 'upcoming', label: '예정' },
    { state: 'outOfRange', label: '조회 불가' },
    { state: 'notCollected', label: '집계 전' },
  ]

  it.each(금액없는상태)('$state 는 금액 대신 `$label` 만 말한다', async ({ state, label }) => {
    const { getByText, queryByText } = await renderProfit(
      <WeeklySubtotalRow subtotal={주차소계({ state, totalMeso: 0 })} />,
    )

    expect(getByText(label)).toBeTruthy()
    expect(queryByText(/메소/)).toBeNull()
  })

  const 행동있는상태: { state: WeeklySubtotalState; label: string }[] = [
    { state: 'notChecked', label: '조회' },
    { state: 'failed', label: '다시 시도' },
  ]

  it.each(행동있는상태)('$state 에는 `$label` 버튼이 서고 누르면 그 기간을 다시 로드한다', async ({
    state,
    label,
  }) => {
    const onRetryPeriod = jest.fn()
    const { getByText } = await renderProfit(
      <WeeklySubtotalRow subtotal={주차소계({ state, totalMeso: 0 })} />,
      컨텍스트값({ onRetryPeriod }),
    )

    await act(async () => {
      fireEvent.press(getByText(label))
    })

    expect(onRetryPeriod).toHaveBeenCalled()
  })

  it('금액을 말할 수 있는 상태만 금액을 낸다', async () => {
    const { getByText } = await renderProfit(
      <WeeklySubtotalRow subtotal={주차소계({ state: 'recorded', totalMeso: 1_234_000_000 })} />,
    )

    expect(getByText('1,234,000,000 메소')).toBeTruthy()
  })

  it('조회해서 0건을 확인한 주는 0을 그대로 낸다. 그건 아는 사실이다', async () => {
    const { getByText } = await renderProfit(
      <WeeklySubtotalRow subtotal={주차소계({ state: 'confirmedEmpty', totalMeso: 0 })} />,
    )

    expect(getByText('0 메소')).toBeTruthy()
  })

  it('진행 중인 주에는 `진행 중` 배지가 함께 선다', async () => {
    const { getByText } = await renderProfit(
      <WeeklySubtotalRow subtotal={주차소계({ state: 'inProgress' })} />,
    )

    expect(getByText('진행 중')).toBeTruthy()
  })

  it('그 주에 아이템이 섞이면 칩이 서고 눌러 내역을 연다', async () => {
    const { getByText, getByTestId } = await renderProfit(
      <WeeklySubtotalRow
        subtotal={주차소계({
          totalMeso: 4_000_000_000,
          drops: [
            {
              category: 'equipment',
              itemName: '파풀라투스 마크',
              quantity: 1,
              priceState: 'entered',
              priceMeso: 1_000_000_000,
              priceShare: 1,
            },
          ],
        })}
      />,
    )

    await act(async () => {
      fireEvent.press(getByText('아이템 +10.0억'))
    })

    expect(getByTestId('item-revenue-popover')).toBeTruthy()
  })
})

describe('MonthlyAccordionBody', () => {
  it('주차 소계와 월간 보스를 각각 제목과 함께 그린다', async () => {
    const { getByText } = await renderProfit(
      <MonthlyAccordionBody
        bossRows={[보스행({ boss: 월간보스, cycle: 'monthly' })]}
        weeklySubtotals={[주차소계()]}
      />,
    )

    expect(getByText('주간 보스 수익 · 주차별 합계')).toBeTruthy()
    expect(getByText('월간 보스 수익')).toBeTruthy()
  })

  it('월간 보스 행이 없고 조회도 불가하면 그 사실을 고지한다. 빈 상태로 위장하지 않는다', async () => {
    const { getByText } = await renderProfit(
      <MonthlyAccordionBody bossRows={[]} weeklySubtotals={[]} />,
      컨텍스트값({ isMonthlyBossQueryable: false }),
    )

    expect(getByText('월간 보스 수익')).toBeTruthy()
    expect(getByText('이 기간은 조회할 수 없습니다')).toBeTruthy()
  })

  it('조회는 가능한데 행이 없으면 월간 보스 구획 자체를 만들지 않는다', async () => {
    const { queryByText } = await renderProfit(
      <MonthlyAccordionBody bossRows={[]} weeklySubtotals={[주차소계()]} />,
    )

    expect(queryByText('월간 보스 수익')).toBeNull()
  })
})
