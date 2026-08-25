// 가계부 캘린더 — [[ADR-169]]. **아직 기록이 없다**(결정 6), 그래서 여기서 보는 것은 격자·달 이동·
// 날짜 선택 셋이다. 그 셋은 데이터 없이도 진짜로 동작해야 한다(앞선 껍데기 둘과 갈리는 지점).
import type { ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

// 화면은 `storage/` 를 직접 안 부른다(CLAUDE.md CRITICAL) — 그 층을 목으로 갈아 끼운다.
jest.mock('../../../features/cashbook/records', () => {
  const actual = jest.requireActual('../../../features/cashbook/records')
  return {
    // **순수 함수는 진짜를 쓴다** — 줄에 무엇이 적히나는 그 함수들이 정하고, 목으로 덮으면
    // 화면 테스트가 «화면이 무엇을 그리나» 를 못 본다.
    recordTitleOf: actual.recordTitleOf,
    recordMesoOf: actual.recordMesoOf,
    recordCashOf: actual.recordCashOf,
    loadCalendarAmounts: jest.fn(),
    loadDayRecords: jest.fn(),
    loadLastPointRate: jest.fn(),
    recordIncome: jest.fn(),
    recordSpend: jest.fn(),
    editIncome: jest.fn(),
    editSpend: jest.fn(),
    removeRecord: jest.fn(),
  }
})

// 시트 껍데기는 `BossDropSheet.test.tsx` 와 같은 방식으로 세운다.
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, { testID: 'sheet-backdrop', ...props }),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { useToastStore } from '../../../features/toast/store'
import { renderOverlay } from '../../../components/__tests__/render-atom'
import { CashbookScreen } from '../CashbookScreen'

const records = jest.requireMock('../../../features/cashbook/records') as Record<string, jest.Mock>

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

// KST 2026-08-23(일) 14:00. UTC 로는 05:00 이라 날짜가 안 넘어간다.
const 지금 = Date.parse('2026-08-23T05:00:00Z')

beforeEach(() => {
  jest.useFakeTimers({ now: 지금 })
  records.loadCalendarAmounts.mockReset().mockResolvedValue({})
  records.loadLastPointRate.mockReset().mockResolvedValue(null)
  records.recordIncome.mockReset().mockResolvedValue(undefined)
  records.recordSpend.mockReset().mockResolvedValue(undefined)
  records.loadDayRecords.mockReset().mockResolvedValue([])
  records.editIncome.mockReset().mockResolvedValue(undefined)
  records.editSpend.mockReset().mockResolvedValue(undefined)
  records.removeRecord.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  jest.useRealTimers()
})

async function 그리기(): Promise<Rendered> {
  const view = await renderOverlay(<CashbookScreen />)
  // 마운트 직후의 읽기 둘(칸 금액 · 기억된 시세)이 끝난 뒤에 본다.
  await act(async () => {})
  return view
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

// ══ 기록이 붙었다 ([[ADR-170]] 결정 2·5·6) ═══════════════════════════════════════

describe('칸에 숫자가 든다', () => {
  it('보이는 칸과 열지도 기준을 **함께 덮는** 범위를 읽는다', async () => {
    await 그리기()

    // 2026-08 격자는 7/26(일) ~ 9/5(토)다.
    expect(records.loadCalendarAmounts).toHaveBeenCalledWith('2026-07-26', '2026-09-05')
  })

  it('기간을 옮기면 그 범위로 다시 읽는다 — 옛 숫자가 안 남는다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '다음 달')
    await act(async () => {})

    expect(records.loadCalendarAmounts).toHaveBeenLastCalledWith('2026-08-30', '2026-10-03')
  })

  // 주간이 달을 걸치면 그 이레가 기준 달의 격자 밖으로 나갈 수 있다 — 합집합을 쓰는 이유다.
  it('주간에서도 그 달 전체를 함께 읽는다 — 열지도 기준이 그 달이다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '주간')
    await act(async () => {})

    expect(records.loadCalendarAmounts).toHaveBeenLastCalledWith('2026-07-26', '2026-09-05')
  })

  it('읽은 금액이 칸에 선다', async () => {
    records.loadCalendarAmounts.mockResolvedValue({
      '2026-08-23': { incomeMeso: 1_743_000_000, expenseMeso: 2_542_372_881 },
    })

    const view = await 그리기()

    expect(view.getByTestId('calendar-income-2026-08-23')).toHaveTextContent('+17.43억')
    expect(view.getByTestId('calendar-expense-2026-08-23')).toHaveTextContent('−25.42억')
  })

  it('고른 날에 기록이 있으면 합계가 서고 빈 상태가 사라진다', async () => {
    records.loadCalendarAmounts.mockResolvedValue({
      '2026-08-23': { incomeMeso: 1_743_000_000, expenseMeso: 2_542_372_881 },
    })

    const view = await 그리기()

    expect(view.getByTestId('cashbook-day-total')).toBeTruthy()
    expect(view.queryByTestId('cashbook-empty')).toBeNull()
  })

  it('기록이 없는 날은 빈 상태다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-empty')).toBeTruthy()
    expect(view.queryByTestId('cashbook-day-total')).toBeNull()
  })
})

describe('펼침판이 시트를 연다', () => {
  async function 고르기(view: Rendered, label: string): Promise<void> {
    await 이름으로누르기(view, '기록 추가')
    await 이름으로누르기(view, label)
  }

  it('지출을 고르면 지출 시트가 뜬다', async () => {
    const view = await 그리기()

    await 고르기(view, '지출 추가')

    expect(view.getByText('지출 추가')).toBeTruthy()
  })

  it('수입을 고르면 수입 시트가 뜬다', async () => {
    const view = await 그리기()

    await 고르기(view, '수입 추가')

    expect(view.getByText('수입 추가')).toBeTruthy()
  })

  // 시트는 **고른 날**에 적는다 — FAB 는 날짜를 안 들고 오므로 화면이 그것을 넘긴다.
  it('시트가 고른 날을 받는다', async () => {
    const view = await 그리기()
    await 누르기(view, 'calendar-day-2026-08-11')

    await 고르기(view, '수입 추가')

    expect(view.getByTestId('income-sheet-date')).toHaveTextContent('8월 11일 (화)')
  })

  it('기억된 시세가 지출 시트로 간다', async () => {
    records.loadLastPointRate.mockResolvedValue(1_180)
    const view = await 그리기()

    await 고르기(view, '지출 추가')
    // 에픽던전 리워드는 두 단계다 — 대표 → 형태 → 단계.
    await 이름으로누르기(view, '하이마운틴')
    await 이름으로누르기(view, '경험치')
    await 이름으로누르기(view, '2단계')

    expect(view.getByTestId('spend-sheet-rate').props.value).toBe('1180')
  })

  it('저장하면 적고 다시 읽는다', async () => {
    const view = await 그리기()
    await 고르기(view, '수입 추가')

    await 이름으로누르기(view, '1')
    await 이름으로누르기(view, '저장')
    await act(async () => {})

    expect(records.recordIncome).toHaveBeenCalledTimes(1)
    expect(records.recordIncome.mock.calls[0][0]).toMatchObject({
      earnedOn: '2026-08-23',
      mesoAmount: 1,
    })
    // 처음 읽기 + 저장 뒤 다시 읽기.
    expect(records.loadCalendarAmounts).toHaveBeenCalledTimes(2)
  })

  it('저장하면 시트가 닫힌다', async () => {
    const view = await 그리기()
    await 고르기(view, '수입 추가')

    await 이름으로누르기(view, '1')
    await 이름으로누르기(view, '저장')
    await act(async () => {})

    expect(view.queryByTestId('income-sheet-amount')).toBeNull()
  })
})

// 저장이 던지면 **닫히면 안 된다.** 닫고 나면 친 것이 사라지고, 화면에는 «적혔다» 와 구분되지
// 않는 그림만 남는다 — 실기에서 지출이 하나도 안 적히는데 시트는 매번 닫혔다(2026-08-25,
// `spend_records.form` 마이그레이션 누락). 실패는 **말하고 자리를 지킨다**.
describe('저장이 실패하면', () => {
  async function 고르기(view: Rendered, label: string): Promise<void> {
    await 이름으로누르기(view, '기록 추가')
    await 이름으로누르기(view, label)
  }

  beforeEach(() => {
    useToastStore.setState({ toasts: [], queue: [] })
  })

  it('수입 — 시트가 열려 있고 토스트가 뜬다', async () => {
    records.recordIncome.mockRejectedValue(new Error('no such column'))
    const view = await 그리기()
    await 고르기(view, '수입 추가')

    await 이름으로누르기(view, '1')
    await 이름으로누르기(view, '저장')
    await act(async () => {})

    expect(view.getByTestId('income-sheet-amount')).toBeTruthy()
    expect(useToastStore.getState().toasts[0]?.message).toBe('수입을 적지 못했습니다')
  })

  it('지출 — 시트가 열려 있고 토스트가 뜬다', async () => {
    // 메포 항목은 시세가 있어야 저장이 열린다([[ADR-166]] 정정 2 ③).
    records.loadLastPointRate.mockResolvedValue(1_180)
    records.recordSpend.mockRejectedValue(new Error('no such column'))
    const view = await 그리기()
    await 고르기(view, '지출 추가')

    await 이름으로누르기(view, '몬스터 파크')
    await 이름으로누르기(view, '저장')
    await act(async () => {})

    expect(view.getByTestId('spend-sheet-total')).toBeTruthy()
    expect(useToastStore.getState().toasts[0]?.message).toBe('지출을 적지 못했습니다')
  })

  // 다시 읽으면 «없는 것» 으로 칸이 덮인다 — 실패했으니 읽을 것도 안 바뀌었다.
  it('다시 읽지 않는다', async () => {
    records.loadLastPointRate.mockResolvedValue(1_180)
    records.recordSpend.mockRejectedValue(new Error('no such column'))
    const view = await 그리기()
    await 고르기(view, '지출 추가')

    await 이름으로누르기(view, '몬스터 파크')
    await 이름으로누르기(view, '저장')
    await act(async () => {})

    expect(records.loadCalendarAmounts).toHaveBeenCalledTimes(1)
  })
})


// ── [[ADR-171]] — 무엇을 적었는지 보이고, 고치고, 지운다 ──────────────────────
const 그날수입 = {
  id: 'inc-1',
  ocid: null,
  earnedOn: '2026-08-23',
  category: '아이템 판매',
  item: '앱솔랩스 케이프',
  mesoAmount: 1_200_000_000,
  memo: null,
  recordedAt: '2026-08-23T01:00:00.000Z',
}

const 그날지출 = {
  id: 'spd-1',
  ocid: null,
  spentOn: '2026-08-23',
  category: '컨텐츠',
  item: '몬스터 파크',
  form: null,
  quantity: 2,
  mesoAmount: null,
  tariffMeso: null,
  pointAmount: 1_200,
  pointPer100mMeso: 1_180,
  cashAmount: null,
  memo: null,
  recordedAt: '2026-08-23T02:00:00.000Z',
}

describe('그날 목록', () => {
  beforeEach(() => {
    records.loadCalendarAmounts.mockResolvedValue({
      '2026-08-23': { incomeMeso: 1_200_000_000, expenseMeso: 101_694_915 },
    })
    records.loadDayRecords.mockResolvedValue([
      { kind: 'income', record: 그날수입 },
      { kind: 'spend', record: 그날지출 },
    ])
  })

  it('합계 아래에 적은 것이 한 줄씩 선다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-day-total')).toBeTruthy()
    expect(view.getByText('앱솔랩스 케이프')).toBeTruthy()
    expect(view.getByText('몬스터 파크')).toBeTruthy()
  })

  // 수량은 «몇 번» 이라 이름만으로는 금액이 왜 그런지 모른다. `×` 를 붙여야 «2번» 이지
  // «2번째» 가 아니라는 것이 읽힌다.
  it('수량이 있으면 함께 적는다', async () => {
    const view = await 그리기()

    // `toHaveTextContent` 는 이 판에서 **완전 일치**다 — 줄 전체를 적는다.
    expect(view.getByTestId('cashbook-row-spd-1')).toHaveTextContent('몬스터 파크×2−1.017억')
  })

  // **누를 수 있어 보여야 한다**(사용자 지적 2026-08-25) — 글자 둘만 놓인 줄은 목록이 아니라
  // 요약으로 읽힌다. 이 저장소가 「눌러서 들어가는 줄」에 쓰는 표식이 오른쪽 화살촉이다
  // (`SettingsFeatureGuideListScreen`).
  it('줄마다 갈래 표식과 들어가는 화살촉이 선다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-row-icon-spd-1')).toBeTruthy()
    expect(view.getByTestId('cashbook-row-chevron-spd-1')).toBeTruthy()
  })

  it('날을 바꾸면 그 날 것을 읽는다', async () => {
    const view = await 그리기()

    await 누르기(view, 'calendar-day-2026-08-11')

    expect(records.loadDayRecords).toHaveBeenLastCalledWith('2026-08-11')
  })
})

describe('줄을 누르면 고칠 수 있다', () => {
  beforeEach(() => {
    records.loadCalendarAmounts.mockResolvedValue({
      '2026-08-23': { incomeMeso: 1_200_000_000, expenseMeso: 101_694_915 },
    })
    records.loadDayRecords.mockResolvedValue([
      { kind: 'income', record: 그날수입 },
      { kind: 'spend', record: 그날지출 },
    ])
  })

  it('지출 줄은 채워진 지출 시트를 연다', async () => {
    const view = await 그리기()

    await 누르기(view, 'cashbook-row-spd-1')

    // **곧바로 ②로 열린다** — 고르던 자리가 이미 정해져 있으므로 머리는 「‹ 고른 것」 이다
    // ([[ADR-171]] 결정 2). 「지출 수정」 은 ①로 되돌아갔을 때 선다.
    expect(view.getByTestId('spend-sheet-choice')).toHaveTextContent('몬스터 파크')
    // 그 행이 쓴 시세가 채워진다 — 「마지막으로 쓴 값」 이 아니다.
    expect(view.getByTestId('spend-sheet-rate').props.value).toBe('1180')
    expect(view.getByTestId('spend-sheet-delete')).toBeTruthy()
  })

  it('①로 되돌아가면 머리가 「지출 수정」 이다', async () => {
    const view = await 그리기()
    await 누르기(view, 'cashbook-row-spd-1')

    await 이름으로누르기(view, '다시 고르기')

    expect(view.getByText('지출 수정')).toBeTruthy()
  })

  it('수입 줄은 채워진 수입 시트를 연다', async () => {
    const view = await 그리기()

    await 누르기(view, 'cashbook-row-inc-1')

    expect(view.getByText('수입 수정')).toBeTruthy()
    expect(view.getByTestId('income-sheet-amount')).toHaveTextContent('1,200,000,000')
  })

  it('수정하면 갈아 끼우고 다시 읽는다', async () => {
    const view = await 그리기()
    await 누르기(view, 'cashbook-row-inc-1')

    await 이름으로누르기(view, '수정')
    await act(async () => {})

    expect(records.editIncome).toHaveBeenCalledTimes(1)
    expect(records.editIncome.mock.calls[0][0]).toMatchObject({
      id: 'inc-1',
      // **적은 시각을 안 덮는다**([[ADR-171]] 결정 4).
      recordedAt: '2026-08-23T01:00:00.000Z',
    })
    expect(records.recordIncome).not.toHaveBeenCalled()
  })

  it('삭제하면 지우고 다시 읽는다', async () => {
    const view = await 그리기()
    await 누르기(view, 'cashbook-row-spd-1')

    await 이름으로누르기(view, '삭제')
    await act(async () => {})

    expect(records.removeRecord).toHaveBeenCalledWith({ kind: 'spend', record: 그날지출 })
    expect(view.queryByText('지출 수정')).toBeNull()
  })

  // 새로 적는 시트에는 지울 것이 없다.
  it('새로 적는 시트에는 삭제가 없다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '기록 추가')
    await 이름으로누르기(view, '지출 추가')

    expect(view.queryByTestId('spend-sheet-delete')).toBeNull()
  })
})
