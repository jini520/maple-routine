// 격자는 **그리기만** 한다([[ADR-169]] 결정 7) — 어떤 칸이 서는가는 `lib/calendar-month` 이 정하고
// 그쪽 테스트가 못 박는다. 여기서 보는 것은 «받은 것을 어떻게 보이느냐» 다.
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
      marks={{}}
      onSelectDate={jest.fn()}
      {...overrides}
    />,
  )
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

    // 8월 격자에는 7/26 과 8/26 이 **둘 다** 있다 — 숫자만으로는 못 집으므로 칸 안에서 찾는다.
    const 칸 = (dateKey: string, day: string) =>
      flattenStyle(within(view.getByTestId(`calendar-day-${dateKey}`)).getByText(day).props.style)

    const 이번달 = 칸('2026-08-11', '11')
    const 앞달 = 칸('2026-07-26', '26')

    expect(이번달.color).toBe(기본테마.text)
    expect(앞달.color).toBe(기본테마.textDisabled)
  })
})

describe('CalendarMonth — 표식 ([[ADR-169]] 결정 5)', () => {
  it('수익·지출 표식이 각각 선다', async () => {
    const view = await 그리기({
      marks: {
        '2026-08-11': { income: true, expense: false },
        '2026-08-12': { income: false, expense: true },
        '2026-08-13': { income: true, expense: true },
      },
    })

    expect(view.queryByTestId('calendar-mark-income-2026-08-11')).toBeTruthy()
    expect(view.queryByTestId('calendar-mark-expense-2026-08-11')).toBeNull()

    expect(view.queryByTestId('calendar-mark-income-2026-08-12')).toBeNull()
    expect(view.queryByTestId('calendar-mark-expense-2026-08-12')).toBeTruthy()

    expect(view.queryByTestId('calendar-mark-income-2026-08-13')).toBeTruthy()
    expect(view.queryByTestId('calendar-mark-expense-2026-08-13')).toBeTruthy()
  })

  it('수익과 지출은 다른 색이다 — 한 칸에 둘이 서면 갈려 보여야 한다', async () => {
    const view = await 그리기({ marks: { '2026-08-13': { income: true, expense: true } } })

    const 수익 = flattenStyle(view.getByTestId('calendar-mark-income-2026-08-13').props.style)
    const 지출 = flattenStyle(view.getByTestId('calendar-mark-expense-2026-08-13').props.style)

    expect(수익.backgroundColor).toBe(기본테마.riseInk)
    expect(지출.backgroundColor).toBe(기본테마.fallInk)
    expect(수익.backgroundColor).not.toBe(지출.backgroundColor)
  })

  // [[ADR-169]] 결정 5 — 칸이 마흔둘이라 표식이 들어올 때 격자가 흔들리면 화면 전체가 튄다
  // ([[ADR-168]] 정정 1 과 같은 이유).
  it('표식이 없어도 표식 줄은 자리를 차지한다', async () => {
    const view = await 그리기({ marks: {} })

    expect(view.getAllByTestId(/^calendar-marks-/)).toHaveLength(42)
  })

  // 공급원이 아직 없다([[ADR-169]] 결정 6) — 빈 지도를 넘겨도 터지지 않아야 한다.
  it('빈 지도를 넘겨도 격자는 온전하다', async () => {
    const view = await 그리기({ marks: {} })

    expect(view.getAllByTestId(/^calendar-day-/)).toHaveLength(42)
    expect(view.queryByTestId('calendar-mark-income-2026-08-11')).toBeNull()
  })
})
