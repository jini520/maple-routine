// 격자는 **그리기만** 한다. 어떤 칸이 서는가는 `lib/calendar` 이 정하고
// 그쪽 테스트가 못 박는다. 여기서 보는 것은 **받은 것을 어떻게 보이느냐** 다.
//
// **칸이 표식 둘에서 금액 두 줄로 바뀌었다**(사용자 레퍼런스 2026-08-23).
import { fireEvent, within } from '@testing-library/react-native'

import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import {
  WEEKDAY_LABELS_RESET,
  buildCalendarMonth,
  buildResetWeek,
  monthIncomeMax,
} from '../../../../lib/calendar'
import { CalendarGrid } from '../CalendarGrid'

const 팔월 = buildCalendarMonth('2026-08')

function 그리기(overrides: Partial<React.ComponentProps<typeof CalendarGrid>> = {}) {
  const weeks = overrides.weeks ?? 팔월
  const amounts = overrides.amounts ?? {}
  return renderAtom(
    <CalendarGrid
      weeks={weeks}
      selectedDateKey="2026-08-23"
      todayDateKey="2026-08-23"
      amounts={amounts}
      onSelectDate={jest.fn()}
      // 화면이 하는 일과 같다. 기준선은 **밖에서** 온다.
      incomeMax={monthIncomeMax(팔월, amounts)}
      {...overrides}
    />,
  )
}

/** 칸 안에서 찾는다. 같은 숫자가 앞뒤 달에도 있어 화면 전체로는 못 집는다(7/26 과 8/26). */
function 칸(view: ReturnType<typeof renderAtom> extends Promise<infer T> ? T : never, dateKey: string) {
  return within(view.getByTestId(`calendar-day-${dateKey}`))
}

describe('CalendarGrid: 격자', () => {
  it('요일 머리를 일요일부터 일곱 개 그린다', async () => {
    const view = await 그리기()

    for (const label of ['일', '월', '화', '수', '목', '금', '토']) {
      expect(view.getByText(label)).toBeTruthy()
    }
  })

  it('받은 주의 모든 칸을 그린다. 8월은 여섯 주 마흔두 칸', async () => {
    const view = await 그리기()

    expect(view.getAllByTestId(/^calendar-day-/)).toHaveLength(42)
    expect(view.getByTestId('calendar-day-2026-08-01')).toBeTruthy()
    // 앞뒤 달로 채운 칸도 실재한다.
    expect(view.getByTestId('calendar-day-2026-07-26')).toBeTruthy()
  })

  it('칸을 누르면 그 날짜 키로 알린다', async () => {
    const onSelectDate = jest.fn()
    const view = await 그리기({ onSelectDate })

    await fireEvent.press(view.getByTestId('calendar-day-2026-08-11'))

    expect(onSelectDate).toHaveBeenCalledWith('2026-08-11')
  })

  // 앞뒤 달 칸을 죽여 두면 **보이는데 안 눌리는** 칸이 생긴다. 누르면 그 날을 고르고, 달을 옮기는
  // 것은 받는 쪽(화면)의 일이다.
  it('앞뒤 달로 채운 칸도 누를 수 있다', async () => {
    const onSelectDate = jest.fn()
    const view = await 그리기({ onSelectDate })

    await fireEvent.press(view.getByTestId('calendar-day-2026-09-05'))

    expect(onSelectDate).toHaveBeenCalledWith('2026-09-05')
  })
})

describe('CalendarGrid: 고른 날 동그라미는 접히면 안 된다 (안드로이드, 2026-09-02)', () => {
  // 진짜 증상은 여기서 안 잡힌다. 배경 없는 View 를 네이티브 뷰 없이 접는 것은 안드로이드
  // 런타임이 하는 일이라 jest 에는 그 단계가 없다. 이 테스트가 막는 것은 **쓸모없어 보이는 프롭**
  // 으로 지워지는 것이다. 지우면 누른 날의 동그라미가 안드로이드에서 네모가 된다.
  // 근거는 `docs/foundation/design-system.md` 의 **안드로이드는 그릴 것이 없는 View 를 접는다**.
  it('collapsable={false} 를 달고 있다', async () => {
    const screen = await 그리기()

    const circle = 칸(screen, '2026-08-23').getByText('23').parent
    expect(circle?.props.collapsable).toBe(false)
  })
})

describe('CalendarGrid: 오늘과 고른 날', () => {
  it('고른 칸만 aria-selected 다', async () => {
    const view = await 그리기({ selectedDateKey: '2026-08-11' })

    // RN 이 `aria-selected` 를 `accessibilityState.selected` 로 정규화한다(`DifficultySegment` 와 같다).
    expect(view.getByTestId('calendar-day-2026-08-11').props.accessibilityState.selected).toBe(true)
    expect(view.getByTestId('calendar-day-2026-08-12').props.accessibilityState.selected).toBe(false)
  })

  // 오늘과 고른 날이 **같은 칸일 수 있다**. 두 표현이 겹치면 안 되므로 이름으로도 갈라 둔다.
  it('오늘 칸은 이름에 **오늘** 이 붙는다', async () => {
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

describe('CalendarGrid: 금액 두 줄', () => {
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

  //. **수익 줄도 0 이면 비운다.** 전에는 **0** 을
  // 적었는데, 아무것도 안 한 날이 대부분이라 격자가 **0** 으로 뒤덮여 실제 숫자가 묻혔다.
  // 자리는 그대로 지킨다(아래 **두 줄은 값이 없어도** 테스트).
  it('값이 0 이면 두 줄 다 빈다', async () => {
    const view = await 그리기({ amounts: 금액 })

    // `toHaveTextContent` 로는 **비었다** 를 못 박기 어렵다(빈 문자열은 무엇에나 통한다).
    // 그려 넣은 문자열을 직접 본다.
    expect(칸(view, '2026-08-13').getByTestId('calendar-income-2026-08-13').props.children).toBe(' ')
    expect(칸(view, '2026-08-12').getByTestId('calendar-expense-2026-08-12').props.children).toBe(' ')
  })

  // 앞뒤 달 칸의 돈은 기간 합계에도 열지도 기준에도 안 들어간다(`periodTotals`·`monthIncomeMax`).
  // 칸에만 남으면 ‘9월 수익’ 머리글 아래 8월 숫자가 서서 화면이 서로 다른 말을 한다.
  it('앞뒤 달로 채운 칸은 금액을 안 적는다 (2026-09-02)', async () => {
    const view = await 그리기({
      amounts: { '2026-07-31': { incomeMeso: 5_800_000_000, expenseMeso: 1_200_000_000 } },
    })

    expect(칸(view, '2026-07-31').getByTestId('calendar-income-2026-07-31').props.children).toBe(' ')
    expect(칸(view, '2026-07-31').getByTestId('calendar-expense-2026-07-31').props.children).toBe(' ')
  })

  // 주간 격자는 이레가 전부 `inPeriod` 라, 달을 걸치는 주에도 걸리는 칸이 없다.
  it('주간 격자는 달을 걸쳐도 그대로 적는다', async () => {
    const view = await 그리기({
      weeks: [buildResetWeek('2026-08-27')],
      selectedDateKey: '2026-08-27',
      amounts: { '2026-09-01': { incomeMeso: 5_800_000_000, expenseMeso: 0 } },
      incomeMax: 5_800_000_000,
    })

    expect(칸(view, '2026-09-01').getByTestId('calendar-income-2026-09-01')).toHaveTextContent('+58억')
  })

  it('기록이 아예 없는 날은 수익 줄도 빈다', async () => {
    const view = await 그리기({ amounts: {} })

    const 수익줄 = 칸(view, '2026-08-11').getByTestId('calendar-income-2026-08-11')
    expect(수익줄).not.toHaveTextContent('0')
    expect(수익줄.props.children).toBe(' ')
  })

  // 두 줄이 늘 서 있어야 격자가 안 흔들린다. 칸이 마흔둘이라 한 줄만 생겨도 화면이 통째로 튄다.
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

describe('CalendarGrid: 열지도', () => {
  it('많이 번 날이 더 진하다. 그 달 안에서 상대적이다', async () => {
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

  //. 타일의 안쪽 여백이 **좌우에만** 있어서,
  // 칠해진 날이 세로로 이어지면 한 덩어리로 붙고 둥근 모서리가 사라졌다. 네 방향을 맞춘다.
  it('열지도 타일은 네 방향으로 같은 만큼 물러난다', async () => {
    const view = await 그리기({
      amounts: { '2026-08-11': { incomeMeso: 10_000_000_000, expenseMeso: 0 } },
    })

    const 타일 = flattenStyle(view.getByTestId('calendar-heat-2026-08-11').props.style)

    expect(타일.top).toBe(타일.left)
    expect(타일.bottom).toBe(타일.left)
    expect(타일.right).toBe(타일.left)
    // 판별력: 넷 다 0 이면 위 셋이 통과한다.
    expect(Number(타일.left)).toBeGreaterThan(0)
  })

  // 앞뒤 달 칸의 수익은 기준선(`monthIncomeMax`)에 안 들어간다. 바탕만 칠하면 **이 달에 없는
  // 날**이 ‘많이 번 날’로 서고, 기준을 안 만든 값이 그 기준으로 칠해지는 셈이 된다.
  //
  // 이 달에도 수익이 있어야 증상이 난다. 기준선이 0 이면 `heatLevel` 이 어차피 0 을 돌려준다.
  it('앞뒤 달로 채운 칸은 안 칠한다 (2026-09-02)', async () => {
    const view = await 그리기({
      amounts: {
        '2026-07-31': { incomeMeso: 100_000_000_000, expenseMeso: 0 },
        '2026-08-11': { incomeMeso: 10_000_000_000, expenseMeso: 0 },
      },
    })

    const 진하기 = (dateKey: string): number =>
      Number(flattenStyle(view.getByTestId(`calendar-heat-${dateKey}`).props.style).opacity ?? 0)

    expect(진하기('2026-07-31')).toBe(0)
    // 판별력: 같은 격자의 이 달 칸은 칠해진다.
    expect(진하기('2026-08-11')).toBeGreaterThan(0)
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

    // 8월 최댓값이 8/11 이므로 그 칸이 최고 단계여야 한다. 7/26 은 기준에 안 든다.
    const 팔월십일 = Number(flattenStyle(view.getByTestId('calendar-heat-2026-08-11').props.style).opacity)
    const 빈날 = Number(flattenStyle(view.getByTestId('calendar-heat-2026-08-12').props.style).opacity)

    expect(팔월십일).toBeGreaterThan(빈날)
    // 7/26 이 기준이었다면 8/11 은 1% 도 안 되어 가장 옅은 단계로 떨어졌을 것이다.
    expect(팔월십일).toBeGreaterThan(0.2)
  })

  it('그 달이 통째로 비어 있어도 칠하지 않는다. NaN 이 안 실린다', async () => {
    const view = await 그리기({ amounts: {} })

    for (const heat of view.getAllByTestId(/^calendar-heat-/)) {
      expect(flattenStyle(heat.props.style).opacity).toBe(0)
    }
  })
})

// ══ 월간과 주간을 같은 격자가 그린다 ═══════════════════

describe('주간 격자', () => {
  const 팔월넷째주 = buildResetWeek('2026-08-20')

  it('주 하나만 넘기면 이레만 그린다. 새 컴포넌트가 아니다', async () => {
    const view = await 그리기({ weeks: [팔월넷째주] })

    for (const day of ['20', '21', '22', '23', '24', '25', '26']) {
      expect(view.getByTestId(`calendar-day-2026-08-${day}`)).toBeTruthy()
    }
    expect(view.queryByTestId('calendar-day-2026-08-19')).toBeNull()
    expect(view.queryByTestId('calendar-day-2026-08-27')).toBeNull()
  })

  it('요일 머리를 넘기면 그것을 쓴다. 목요일부터다', async () => {
    const view = await 그리기({ weeks: [팔월넷째주], weekdayLabels: WEEKDAY_LABELS_RESET })

    // 머리 일곱 칸이 목~수 순서로 선다. 같은 글자가 칸 안에는 없으므로 화면 전체로 집어도 된다.
    const labels = view.getAllByText(/^[일월화수목금토]$/).map((node) => node.props.children)
    expect(labels).toEqual(['목', '금', '토', '일', '월', '화', '수'])
  })

  it('안 넘기면 월간의 일~토가 기본이다. 월간 호출부는 안 바뀐다', async () => {
    const view = await 그리기()

    const labels = view.getAllByText(/^[일월화수목금토]$/).map((node) => node.props.children)
    expect(labels).toEqual(['일', '월', '화', '수', '목', '금', '토'])
  })

  // 이 테스트가 의 전부다. 이레만 받아도 진하기는 **그 달** 기준이다.
  // 기준이 주 안으로 좁아지면 8/20 이 최대가 되어 새까맣게 칠해진다.
  it('열지도 기준을 받은 주에서 다시 내지 않는다', async () => {
    const amounts = {
      '2026-08-13': { incomeMeso: 100_000_000_000, expenseMeso: 0 },
      '2026-08-20': { incomeMeso: 10_000_000_000, expenseMeso: 0 },
    }

    const view = await 그리기({
      weeks: [팔월넷째주],
      amounts,
      // 그 달 전체가 기준이다(8/13 의 1000억). 8/20 은 그 10% 라 가장 옅은 단계여야 한다.
      incomeMax: monthIncomeMax(buildCalendarMonth('2026-08'), amounts),
    })

    const heat = flattenStyle(view.getByTestId('calendar-heat-2026-08-20').props.style)
    expect(heat.opacity).toBeLessThan(0.2)
  })

  it('같은 값이라도 기준이 주로 좁아지면 가장 진해진다. 그래서 밖에서 넣는다', async () => {
    const amounts = { '2026-08-20': { incomeMeso: 10_000_000_000, expenseMeso: 0 } }

    const view = await 그리기({
      weeks: [팔월넷째주],
      amounts,
      incomeMax: monthIncomeMax([팔월넷째주], amounts),
    })

    const heat = flattenStyle(view.getByTestId('calendar-heat-2026-08-20').props.style)
    expect(heat.opacity).toBeGreaterThan(0.4)
  })
})
