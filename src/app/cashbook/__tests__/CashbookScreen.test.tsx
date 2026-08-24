// 가계부 캘린더 — [[ADR-169]]. **아직 기록이 없다**(결정 6), 그래서 여기서 보는 것은 격자·달 이동·
// 날짜 선택 셋이다. 그 셋은 데이터 없이도 진짜로 동작해야 한다(앞선 껍데기 둘과 갈리는 지점).
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { CashbookScreen } from '../CashbookScreen'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

// KST 2026-08-23(일) 14:00. UTC 로는 05:00 이라 날짜가 안 넘어간다.
const 지금 = Date.parse('2026-08-23T05:00:00Z')

beforeEach(() => {
  jest.useFakeTimers({ now: 지금 })
})

afterEach(() => {
  jest.useRealTimers()
})

async function 그리기(): Promise<Rendered> {
  return renderOverlay(<CashbookScreen />)
}

async function 누르기(view: Rendered, testID: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByTestId(testID))
  })
}

async function 이름으로누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

describe('CashbookScreen — 자리와 머리', () => {
  it('화면과 제목이 «가계부» 다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('screen-Cashbook')).toBeTruthy()
    expect(view.getByText('가계부')).toBeTruthy()
  })

  it('이번 달로 시작한다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('2026년 8월')
  })
})

describe('CashbookScreen — 달 이동', () => {
  it('이전 달·다음 달로 옮긴다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '이전 달')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('2026년 7월')

    await 이름으로누르기(view, '다음 달')
    await 이름으로누르기(view, '다음 달')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('2026년 9월')
  })

  it('해를 넘긴다', async () => {
    const view = await 그리기()

    for (let count = 0; count < 5; count += 1) await 이름으로누르기(view, '다음 달')

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('2027년 1월')
  })

  // 달을 옮겨도 고른 날은 그대로다 — 옮긴 것은 «보는 달» 이지 «고른 날» 이 아니다.
  it('달을 옮겨도 고른 날은 안 바뀐다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '이전 달')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 23일 (일)')
  })
})

describe('CashbookScreen — 날짜 선택', () => {
  it('오늘로 시작한다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 23일 (일)')
    expect(view.getByLabelText('8월 23일 (일) 오늘')).toBeTruthy()
  })

  it('칸을 고르면 상세 머리글이 따라온다', async () => {
    const view = await 그리기()

    await 누르기(view, 'calendar-day-2026-08-11')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 11일 (화)')
  })

  // 앞뒤 달 칸을 누르면 **보는 달도 함께 옮겨진다** — 아니면 고른 날이 격자 밖에 있게 된다.
  it('다음 달 칸을 고르면 달도 함께 옮겨진다', async () => {
    const view = await 그리기()

    await 누르기(view, 'calendar-day-2026-09-05')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('9월 5일 (토)')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('2026년 9월')
    // 옮긴 달의 격자에 그 칸이 여전히 있다(이번엔 이번 달 칸으로).
    expect(view.getByTestId('calendar-day-2026-09-05')).toBeTruthy()
  })
})

describe('CashbookScreen — 아직 기록이 없다 ([[ADR-169]] 결정 6)', () => {
  it('고른 날에 기록이 없다고 말한다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-empty')).toBeTruthy()
  })

  // [[ADR-169]] 정정 1 — 칸은 금액 두 줄이고, 공급원이 없는 지금은 모든 날이 «0» 이다.
  it('모든 칸의 수익이 0 이고 칠해진 칸이 없다', async () => {
    const view = await 그리기()

    const 수익줄 = view.queryAllByTestId(/^calendar-income-/)
    expect(수익줄.length).toBeGreaterThan(0)
    for (const line of 수익줄) expect(line).toHaveTextContent('0')

    for (const heat of view.queryAllByTestId(/^calendar-heat-/)) {
      expect(heat.props.style.opacity).toBe(0)
    }
  })

  // 값이 없어도 두 줄이 서 있어야 기록이 붙을 때 격자가 안 흔들린다.
  it('지출 줄도 칸마다 자리를 지킨다', async () => {
    const view = await 그리기()

    expect(view.queryAllByTestId(/^calendar-expense-/)).toHaveLength(
      view.queryAllByTestId(/^calendar-income-/).length,
    )
  })
})

// ══ 주간/월간 전환 ([[ADR-170]] 결정 10·11·12) ═══════════════════════════════════
//
// **이 앱에는 「주」가 둘이다.** 월간 격자의 줄은 일요일에 시작하고 주간 보기는 **목요일**에
// 시작한다 — 후자가 게임의 주이고 보스 수익 탭이 이미 그 축을 쓴다. 화면이 그 둘을 오간다.

describe('주간/월간 전환', () => {
  it('두 알약이 서고 월간으로 시작한다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('주간').props.accessibilityState?.selected).toBe(false)
    expect(view.getByLabelText('월간').props.accessibilityState?.selected).toBe(true)
  })

  it('주간을 누르면 고른 날이 든 **목요일 주**가 뜬다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '주간')

    // 오늘은 2026-08-23(일)이고 그 주의 목요일은 8/20 이다.
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('8월 20일 – 26일')
  })

  it('주간에서는 이레만 그린다 — 딱 7칸', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '주간')

    for (const day of ['20', '21', '22', '23', '24', '25', '26']) {
      expect(view.getByTestId(`calendar-day-2026-08-${day}`)).toBeTruthy()
    }
    // 주의 앞뒤는 없다 — 월간처럼 앞뒤로 채우지 않는다.
    expect(view.queryByTestId('calendar-day-2026-08-19')).toBeNull()
    expect(view.queryByTestId('calendar-day-2026-08-27')).toBeNull()
  })

  it('주간의 요일 머리는 목요일부터다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '주간')

    const labels = view.getAllByText(/^[일월화수목금토]$/).map((node) => node.props.children)
    expect(labels).toEqual(['목', '금', '토', '일', '월', '화', '수'])
  })

  it('화살표가 주를 옮긴다 — 이레씩이다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '주간')

    await 이름으로누르기(view, '이전 주')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('8월 13일 – 19일')

    await 이름으로누르기(view, '다음 주')
    await 이름으로누르기(view, '다음 주')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('8월 27일 – 9월 2일')
  })

  // 달을 걸치는 주는 **달을 둘 다 적는다** — 「8월 27일 – 2일」 이면 어느 달의 2일인지 모른다.
  it('달을 걸치는 주는 양쪽 달을 다 적는다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '주간')
    await 이름으로누르기(view, '다음 주')

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('8월 27일 – 9월 2일')
  })

  it('월간으로 돌아가면 **그 주의 목요일이 든 달**이다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '주간')
    // 8/27 – 9/2 로 옮긴다. 목요일(8/27)이 든 달은 **8월**이다.
    await 이름으로누르기(view, '다음 주')

    await 이름으로누르기(view, '월간')

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('2026년 8월')
  })

  it('월간에서 고른 날을 바꾸고 주간으로 가면 그 날이 든 주다', async () => {
    const view = await 그리기()
    await 누르기(view, 'calendar-day-2026-08-11')

    await 이름으로누르기(view, '주간')

    // 8/11(화)이 든 목요일 주는 8/6 – 8/12 다.
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('8월 6일 – 12일')
  })

  it('주간에서 칸을 고르면 상세가 따라오고 주는 그대로다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '주간')

    await 누르기(view, 'calendar-day-2026-08-25')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 25일 (화)')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('8월 20일 – 26일')
  })
})

// 두 축이 공존하는 대가 — **월간 격자의 한 줄 ≠ 주간의 한 주**다. 아무 표시가 없으면 사용자에게는
// 그냥 어긋남이라, 주 경계를 격자 위에 드러낸다([[ADR-170]] 결정 10 의 대가).
describe('목요일 경계선', () => {
  it('월간 격자에는 있다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('calendar-reset-divider')).toBeTruthy()
  })

  it('주간에는 없다 — 격자 자체가 한 주라 자를 것이 없다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '주간')

    expect(view.queryByTestId('calendar-reset-divider')).toBeNull()
  })
})
