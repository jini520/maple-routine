// 격자는 **그리기만** 한다([[ADR-169]] 결정 7) — 어떤 칸이 서는가는 `lib/calendar-month` 이 정하고
// 그쪽 테스트가 못 박는다. 여기서 보는 것은 «받은 것을 어떻게 보이느냐» 다.
//
// **칸이 표식 둘에서 금액 두 줄로 바뀌었다**([[ADR-169]] 정정 1, 사용자 레퍼런스 2026-08-23).
import { fireEvent, within } from '@testing-library/react-native'

import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { buildCalendarMonth } from '../../../../lib/calendar-month'
import { CalendarMonth } from '../CalendarMonth'

const 팔월 = buildCalendarMonth('2026-08')

function 그리기(overrides: Partial<React.ComponentProps<typeof CalendarMonth>> = {}) {
  return renderAtom(
    <CalendarMonth
      weeks={팔월}
      selectedDateKey="2026-08-23"
      todayDateKey="2026-08-23"
      amounts={{}}
      onSelectDate={jest.fn()}
      {...overrides}
    />,
  )
}

/** 칸 안에서 찾는다 — 같은 숫자가 앞뒤 달에도 있어 화면 전체로는 못 집는다(7/26 과 8/26). */
function 칸(view: ReturnType<typeof renderAtom> extends Promise<infer T> ? T : never, dateKey: string) {
  return within(view.getByTestId(`calendar-day-${dateKey}`))
}

describe('CalendarMonth — 격자', () => {
  it('요일 머리를 일요일부터 일곱 개 그린다', async () => {
    const view = await 그리기()

    for (const label of ['일', '월', '화', '수', '목', '금', '토']) {
      expect(view.getByText(label)).toBeTruthy()
    }
  })

  it('받은 주의 모든 칸을 그린다 — 8월은 여섯 주 마흔두 칸', async () => {
    const view = await 그리기()

    expect(view.getAllByTestId(/^calendar-day-/)).toHaveLength(42)
    expect(view.getByTestId('calendar-day-2026-08-01')).toBeTruthy()
    // 앞뒤 달로 채운 칸도 실재한다([[ADR-169]] 결정 7).
    expect(view.getByTestId('calendar-day-2026-07-26')).toBeTruthy()
  })

  it('칸을 누르면 그 날짜 키로 알린다', async () => {
    const onSelectDate = jest.fn()
    const view = await 그리기({ onSelectDate })

    await fireEvent.press(view.getByTestId('calendar-day-2026-08-11'))

    expect(onSelectDate).toHaveBeenCalledWith('2026-08-11')
  })

  // 앞뒤 달 칸을 죽여 두면 «보이는데 안 눌리는» 칸이 생긴다. 누르면 그 날을 고르고, 달을 옮기는
  // 것은 받는 쪽(화면)의 일이다.
  it('앞뒤 달로 채운 칸도 누를 수 있다', async () => {
    const onSelectDate = jest.fn()
    const view = await 그리기({ onSelectDate })

    await fireEvent.press(view.getByTestId('calendar-day-2026-09-05'))

    expect(onSelectDate).toHaveBeenCalledWith('2026-09-05')
  })
})

describe('CalendarMonth — 오늘과 고른 날', () => {
  it('고른 칸만 aria-selected 다', async () => {
    const view = await 그리기({ selectedDateKey: '2026-08-11' })

    // RN 이 `aria-selected` 를 `accessibilityState.selected` 로 정규화한다(`DifficultySegment` 와 같다).
    expect(view.getByTestId('calendar-day-2026-08-11').props.accessibilityState.selected).toBe(true)
    expect(view.getByTestId('calendar-day-2026-08-12').props.accessibilityState.selected).toBe(false)
  })

  // 오늘과 고른 날이 **같은 칸일 수 있다** — 두 표현이 겹치면 안 되므로 이름으로도 갈라 둔다.
  it('오늘 칸은 이름에 «오늘» 이 붙는다', async () => {
    const view = await 그리기({ selectedDateKey: '2026-08-11', todayDateKey: '2026-08-23' })

    expect(view.getByLabelText('8월 23일 (일) 오늘')).toBeTruthy()
    expect(view.getByLabelText('8월 11일 (화)')).toBeTruthy()
  })

  it('앞뒤 달 칸의 날짜는 흐리다', async () => {
    const view = await 그리기()

    expect(flattenStyle(칸(view, '2026-08-11').getByText('11').props.style).color).toBe(기본테마.text)
    expect(flattenStyle(칸(view, '2026-07-26').getByText('26').props.style).color).toBe(
      기본테마.textDisabled,
    )
  })
})

describe('CalendarMonth — 금액 두 줄 ([[ADR-169]] 정정 1)', () => {
  const 금액 = {
    '2026-08-11': { incomeMeso: 12_940_000_000, expenseMeso: 500_000_000 },
    '2026-08-12': { incomeMeso: 2_840_000_000, expenseMeso: 0 },
    '2026-08-13': { incomeMeso: 0, expenseMeso: 120_000_000 },
  }

  it('수익은 +, 지출은 − 를 달고 줄여 적는다', async () => {
    const view = await 그리기({ amounts: 금액 })

    expect(칸(view, '2026-08-11').getByTestId('calendar-income-2026-08-11')).toHaveTextContent(
      '+129.4억',
    )
    expect(칸(view, '2026-08-11').getByTestId('calendar-expense-2026-08-11')).toHaveTextContent(
      '−5억',
    )
  })

  // 사용자가 고른 시안 그대로다 — 수익 줄은 0 도 «0» 으로 적고, 지출 줄은 0 이면 비운다.
  it('수익이 없는 날은 «0», 지출이 없는 날은 빈 줄이다', async () => {
    const view = await 그리기({ amounts: 금액 })

    expect(칸(view, '2026-08-13').getByTestId('calendar-income-2026-08-13')).toHaveTextContent('0')
    // `toHaveTextContent('')` 는 무엇에나 통하므로 «− 가 없다» 로 못 박는다.
    expect(칸(view, '2026-08-12').getByTestId('calendar-expense-2026-08-12')).not.toHaveTextContent(
      '−',
    )
  })

  it('기록이 아예 없는 날도 수익 줄에 «0» 이 선다', async () => {
    const view = await 그리기({ amounts: {} })

    expect(칸(view, '2026-08-11').getByTestId('calendar-income-2026-08-11')).toHaveTextContent('0')
  })

  // 두 줄이 늘 서 있어야 격자가 안 흔들린다 — 칸이 마흔둘이라 한 줄만 생겨도 화면이 통째로 튄다.
  it('두 줄은 값이 없어도 칸마다 자리를 차지한다', async () => {
    const view = await 그리기({ amounts: {} })

    expect(view.getAllByTestId(/^calendar-income-/)).toHaveLength(42)
    expect(view.getAllByTestId(/^calendar-expense-/)).toHaveLength(42)
  })

  it('수익과 지출은 다른 색이다', async () => {
    const view = await 그리기({ amounts: 금액 })

    const 수익 = flattenStyle(칸(view, '2026-08-11').getByTestId('calendar-income-2026-08-11').props.style)
    const 지출 = flattenStyle(칸(view, '2026-08-11').getByTestId('calendar-expense-2026-08-11').props.style)

    expect(수익.color).toBe(기본테마.riseInk)
    expect(지출.color).toBe(기본테마.fallInk)
  })
})

describe('CalendarMonth — 열지도 ([[ADR-169]] 정정 1)', () => {
  it('많이 번 날이 더 진하다 — 그 달 안에서 상대적이다', async () => {
    const view = await 그리기({
      amounts: {
        '2026-08-11': { incomeMeso: 100_000_000_000, expenseMeso: 0 },
        '2026-08-12': { incomeMeso: 10_000_000_000, expenseMeso: 0 },
      },
    })

    const 진하기 = (dateKey: string): number =>
      Number(flattenStyle(view.getByTestId(`calendar-heat-${dateKey}`).props.style).opacity ?? 0)

    expect(진하기('2026-08-11')).toBeGreaterThan(진하기('2026-08-12'))
    expect(진하기('2026-08-12')).toBeGreaterThan(0)
  })

  it('수익이 없는 날은 안 칠한다', async () => {
    const view = await 그리기({
      amounts: { '2026-08-11': { incomeMeso: 100_000_000_000, expenseMeso: 0 } },
    })

    expect(flattenStyle(view.getByTestId('calendar-heat-2026-08-12').props.style).opacity).toBe(0)
  })

  // 앞뒤 달 칸의 금액이 이번 달의 최댓값을 정해 버리면 대비가 엉뚱해진다.
  it('진하기의 기준은 **이번 달** 칸뿐이다', async () => {
    const view = await 그리기({
      amounts: {
        '2026-07-26': { incomeMeso: 999_000_000_000, expenseMeso: 0 },
        '2026-08-11': { incomeMeso: 10_000_000_000, expenseMeso: 0 },
      },
    })

    // 8월 최댓값이 8/11 이므로 그 칸이 최고 단계여야 한다 — 7/26 은 기준에 안 든다.
    const 팔월십일 = Number(flattenStyle(view.getByTestId('calendar-heat-2026-08-11').props.style).opacity)
    const 빈날 = Number(flattenStyle(view.getByTestId('calendar-heat-2026-08-12').props.style).opacity)

    expect(팔월십일).toBeGreaterThan(빈날)
    // 7/26 이 기준이었다면 8/11 은 1% 도 안 되어 가장 옅은 단계로 떨어졌을 것이다.
    expect(팔월십일).toBeGreaterThan(0.2)
  })

  it('그 달이 통째로 비어 있어도 칠하지 않는다 — NaN 이 안 실린다', async () => {
    const view = await 그리기({ amounts: {} })

    for (const heat of view.getAllByTestId(/^calendar-heat-/)) {
      expect(flattenStyle(heat.props.style).opacity).toBe(0)
    }
  })
})
