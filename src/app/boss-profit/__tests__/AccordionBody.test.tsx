// 펼친 카드의 본문. 주간(보스 행)과 월간(주차 소계 + 월간 보스)이다.
//
// ** 가 이 파일의 중심이다**: 여섯 상태 중 행동이 있는 둘만 버튼을 갖고,
// **금액을 모르는 상태에는 0을 쓰지 않는다.** 0을 쓰면 "조회한 적 없다"가 "0원 벌었다"가 된다.
// 드롭 가격 화면이 지키는 것과 같은 원칙이다.
import { act, fireEvent } from '@testing-library/react-native'

import { clearCountUpMemory } from '../../../hooks/useCountUp'
import type { WeeklySubtotalState } from '../../../features/boss-profit/store'

import { flattenStyle, 기본테마 } from '../../../components/__tests__/render-atom'
import { resolveCardBody } from '../../../theme/theme-vars'
import { MonthlyAccordionBody, WeeklyAccordionBody, WeeklySubtotalRow } from '../AccordionBody'
import { WEEKLY_BOSS_CLEAR_LIMIT } from '../../../lib/boss/boss-matching'
import { 다른주간보스, 월간보스, 보스행, 주차소계, 컨텍스트값, renderProfit } from './harness'

beforeEach(() => {
  clearCountUpMemory()
})

describe('WeeklyAccordionBody', () => {
// 마지막 행의 아래 테두리를 지우는 짝. RN 에 `:last-child` 가 없어 부모가 알려 준다.
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
    const { getByTestId } = await renderProfit(
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

    expect(getByTestId('item-revenue-underline')).toBeTruthy()
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

  it('그 주에 아이템이 섞이면 금액이 버튼이 되고 눌러 내역을 연다', async () => {
    const { getByLabelText, getByTestId } = await renderProfit(
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
      fireEvent.press(getByLabelText('이번 주 아이템 수익 확인'))
    })

    expect(getByTestId('item-revenue-popover')).toBeTruthy()
  })
})

describe('MonthlyAccordionBody', () => {
  it('주차별 합계만 그린다. 월간 보스 상세는 주간 탭으로 갔다', async () => {
    const { getByText, queryByTestId } = await renderProfit(
      <MonthlyAccordionBody
        bossRows={[보스행({ boss: 월간보스, cycle: 'monthly' })]}
        weeklySubtotals={[주차소계()]}
      />,
    )

    expect(getByText('주차별 합계')).toBeTruthy()
    // 행은 그룹에 실려 온다(아바타 진행 링이 센다). 그리지만 않는다.
    expect(queryByTestId('boss-profit-boss-row')).toBeNull()
  })

  // 기간 이동이 기록이 있는 기간으로만 착지하면서 이 고지가 서던 자리가 사라졌다(사용자 지정).
  it('주차 소계가 없고 조회도 불가하면 아무것도 안 그린다', async () => {
    const { queryByText, queryByTestId } = await renderProfit(
      <MonthlyAccordionBody bossRows={[]} weeklySubtotals={[]} />,
    )

    expect(queryByText('이 기간은 조회할 수 없습니다')).toBeNull()
    expect(queryByTestId('unavailable-notice')).toBeNull()
  })

  it('조회는 가능한데 행이 없으면 월간 보스 구획 자체를 만들지 않는다', async () => {
    const { queryByText } = await renderProfit(
      <MonthlyAccordionBody bossRows={[]} weeklySubtotals={[주차소계()]} />,
    )

    expect(queryByText('월간 보스 수익')).toBeNull()
  })
})


// 펼친 카드의 머리와 본문이 둘 다 흰 바탕이고 사이가 `border` 1px 하나라, 캐릭터 머리가 보스
// 목록의 첫 줄처럼 읽혔다. 본문이 자기 바탕을 갖는다.
describe('본문은 자기 바탕을 갖는다', () => {
  // 색은 38토큰에 없어 모드에서 파생한다. `surface-2` 는 라이트에서 칙칙하고 `bg` 를 쓰면
  // 본문이 페이지에 녹는다.
  it('주간 본문 바탕이 파생 토큰이다', async () => {
    const { getByTestId } = await renderProfit(<WeeklyAccordionBody rows={[보스행()]} />)

    expect(flattenStyle(getByTestId('accordion-body').props.style)).toMatchObject({
      backgroundColor: resolveCardBody(기본테마),
    })
  })

  it('월간 본문 바탕도 같다', async () => {
    const { getByTestId } = await renderProfit(
      <MonthlyAccordionBody bossRows={[보스행()]} weeklySubtotals={[주차소계()]} />,
    )

    expect(flattenStyle(getByTestId('accordion-body').props.style)).toMatchObject({
      backgroundColor: resolveCardBody(기본테마),
    })
  })

  // 머리(카드)와 페이지 둘 다와 갈려야 이 바탕이 값을 한다.
  it('카드와도 페이지와도 다른 색이다', async () => {
    expect(resolveCardBody(기본테마)).not.toBe(기본테마.surface)
    expect(resolveCardBody(기본테마)).not.toBe(기본테마.bg)
  })
})


// 월간 보스가 월간 탭에서 빠져 주간 목록 맨 위로 왔다(사용자 지정). 두 무리를 띠가 가른다.
describe('주간 본문의 띠 둘', () => {
  const 월간행 = () => 보스행({ boss: 월간보스, cycle: 'monthly', periodKey: '2026-08' })

  it('월간 띠는 월간 행이 있을 때만 선다', async () => {
    const 있음 = await renderProfit(<WeeklyAccordionBody rows={[월간행(), 보스행()]} />)
    expect(있음.getByText('월간')).toBeTruthy()

    const 없음 = await renderProfit(<WeeklyAccordionBody rows={[보스행()]} />)
    expect(없음.queryByText('월간')).toBeNull()
  })

  // 그 오른쪽 수가 주간 한도를 숫자로 말하는 유일한 자리다. 아바타 링은 그림으로만 말한다.
  it('주간 띠는 늘 선다. 오른쪽에 처치 수와 한도를 적는다', async () => {
    const { getByText, getByTestId } = await renderProfit(
      <WeeklyAccordionBody rows={[보스행(), 보스행({ boss: 다른주간보스, isComplete: false })]} />,
    )

    expect(getByText('주간')).toBeTruthy()
    expect(getByTestId('accordion-band-count').props.children).toBe(`1 / ${WEEKLY_BOSS_CLEAR_LIMIT}`)
  })

  // 월간 보스는 12 한도 밖이다. 그 줄이 분자에 섞이면 링과 이 수가 갈린다.
  it('월간 행은 그 수에 안 든다', async () => {
    const { getByTestId } = await renderProfit(<WeeklyAccordionBody rows={[월간행(), 보스행()]} />)

    expect(getByTestId('accordion-band-count').props.children).toBe(`1 / ${WEEKLY_BOSS_CLEAR_LIMIT}`)
  })

  // 띠도 알약도 높이가 값이다(`h-[26px]` · `h-[18px]`). 안쪽 글자가 OS 글자 배수를 따라 커지면
  // 그 높이를 넘어 잘린다. `fixed` 가 배수를 안 따르게 한다.
  it('띠 알약의 글자는 OS 글자 배수를 안 따른다', async () => {
    const { getByText } = await renderProfit(<WeeklyAccordionBody rows={[보스행()]} />)

    expect(getByText('주간').props.allowFontScaling).toBe(false)
  })

  // 오른쪽에 아무것도 안 적는다(사용자 지정). 그 줄이 한도 밖이라는 것은 띠가 갈라 놓은 것으로
  // 충분하고, 그 이상은 화면이 규칙을 설명하려 드는 것이다.
  it('월간 띠 오른쪽에는 수를 안 적는다', async () => {
    const { getAllByTestId } = await renderProfit(<WeeklyAccordionBody rows={[월간행(), 보스행()]} />)

    expect(getAllByTestId('accordion-band-count')).toHaveLength(1)
  })
})

// 월간 탭의 주차 행. **조회 불가 캐릭터는 기록이 있는 주만 아는 값**이고 나머지 주는 모르는
// 값이다. `0 메소` 로 그리면 그 주에 0원을 벌었다는 단정이 된다.
describe('조회 불가 캐릭터의 주차 합계', () => {
  it('기록이 있는 주는 금액을 그대로 그린다', async () => {
    const { getByText, queryByTestId } = await renderProfit(
      <WeeklySubtotalRow subtotal={주차소계({ state: 'recorded', totalMeso: 1_000 })} unavailable />,
    )

    expect(getByText(/메소/)).toBeTruthy()
    expect(queryByTestId('subtotal-issue')).toBeNull()
  })

  // 진행 중인 주가 특히 위험하다. `showsMeso` 가 참이라 조회를 못 하는데도 `0 메소` 가 선다.
  it('진행 중인 주는 금액 대신 배지가 선다', async () => {
    const { getByTestId, queryByText } = await renderProfit(
      <WeeklySubtotalRow subtotal={주차소계({ state: 'inProgress', totalMeso: 0 })} unavailable />,
    )

    expect(getByTestId('subtotal-issue')).toBeTruthy()
    expect(queryByText(/메소/)).toBeNull()
  })

  // 조회해서 0건을 확인한 주 도 조회 불가 캐릭터에서는 못 믿는다. 그 확인은 조회가 되던 시절의
  // 것이고, 지금은 그 뒤로 무슨 일이 있었는지 알 길이 없다.
  it('0건으로 확인된 주도 배지가 선다', async () => {
    const { getByTestId } = await renderProfit(
      <WeeklySubtotalRow subtotal={주차소계({ state: 'confirmedEmpty', totalMeso: 0 })} unavailable />,
    )

    expect(getByTestId('subtotal-issue')).toBeTruthy()
  })

  it('멀쩡한 캐릭터는 지금 그대로다', async () => {
    const { queryByTestId } = await renderProfit(
      <WeeklySubtotalRow subtotal={주차소계({ state: 'inProgress', totalMeso: 0 })} />,
    )

    expect(queryByTestId('subtotal-issue')).toBeNull()
  })
})
