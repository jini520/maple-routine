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

    expect(view.getByTestId('cashbook-month-label')).toHaveTextContent('2026년 8월')
  })
})

describe('CashbookScreen — 달 이동', () => {
  it('이전 달·다음 달로 옮긴다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '이전 달')
    expect(view.getByTestId('cashbook-month-label')).toHaveTextContent('2026년 7월')

    await 이름으로누르기(view, '다음 달')
    await 이름으로누르기(view, '다음 달')
    expect(view.getByTestId('cashbook-month-label')).toHaveTextContent('2026년 9월')
  })

  it('해를 넘긴다', async () => {
    const view = await 그리기()

    for (let count = 0; count < 5; count += 1) await 이름으로누르기(view, '다음 달')

    expect(view.getByTestId('cashbook-month-label')).toHaveTextContent('2027년 1월')
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
    expect(view.getByTestId('cashbook-month-label')).toHaveTextContent('2026년 9월')
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
