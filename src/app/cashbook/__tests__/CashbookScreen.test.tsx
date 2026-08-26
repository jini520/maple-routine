// 가계부 캘린더 — [[ADR-169]]. **아직 기록이 없다**(결정 6), 그래서 여기서 보는 것은 격자·달 이동·
// 날짜 선택 셋이다. 그 셋은 데이터 없이도 진짜로 동작해야 한다(앞선 껍데기 둘과 갈리는 지점).
import type { ReactNode } from 'react'
import { act, fireEvent, within } from '@testing-library/react-native'

// 화면은 `storage/` 를 직접 안 부른다(CLAUDE.md CRITICAL) — 그 층을 목으로 갈아 끼운다.
jest.mock('../../../features/cashbook/records', () => {
  const actual = jest.requireActual('../../../features/cashbook/records')
  return {
    // **순수 함수는 진짜를 쓴다** — 줄에 무엇이 적히나는 그 함수들이 정하고, 목으로 덮으면
    // 화면 테스트가 «화면이 무엇을 그리나» 를 못 본다.
    recordTitleOf: actual.recordTitleOf,
    recordMesoOf: actual.recordMesoOf,
    recordCashOf: actual.recordCashOf,
    recordCountLabelOf: actual.recordCountLabelOf,
    dayTotalsOf: actual.dayTotalsOf,
    isManualRecord: actual.isManualRecord,
    rowKeyOf: actual.rowKeyOf,
    resolveTrackedDefeatDates: jest.fn(),
    loadCalendarAmounts: jest.fn(),
    loadDayRecords: jest.fn(),
    loadLastPointRate: jest.fn(),
    loadTrackedCharacters: jest.fn(),
    recordIncome: jest.fn(),
    recordSpend: jest.fn(),
    editIncome: jest.fn(),
    editSpend: jest.fn(),
    removeRecord: jest.fn(),
  }
})

// 자동 줄은 **보스 수익 탭으로 간다**([[ADR-172]] 결정 8) — 그 이동을 목으로 받아 «어디로 갔나» 를 본다.
// 이름이 `mock` 으로 시작해야 팩토리 안에서 참조할 수 있다(jest 의 호이스팅 가드).
const mockOpenTab = jest.fn()
jest.mock('../../use-open-tab', () => ({ useOpenTab: () => mockOpenTab }))

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
    // 시트 밖과 같게 둔다 — 아톰이 이 값으로 «시트 안인가» 를 묻는다([[ADR-170]] 정정 5).
    // 목이 시트를 평범한 `View` 로 바꾸므로 여기서도 문맥이 없는 것이 사실이고, 그래서
    // 아래 입력은 안 그려진다 — 그래도 **있어야 한다**: `lib/nativewind-interop` 이 모듈을
    // 읽는 순간 이것을 등록하므로, 없으면 스위트가 뜨기도 전에 죽는다.
    useBottomSheetInternal: () => null,
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.TextInput, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { useToastStore } from '../../../features/toast/store'
import { flattenStyle, renderOverlay } from '../../../components/__tests__/render-atom'
import { SPEED_DIAL_SPACE_PX } from '../../../components/organisms/SpeedDial/speed-dial-metrics'
import { clearCountUpMemory } from '../../../lib/use-count-up'
import { BOSS_SLOT_MAX_PX, CashbookScreen } from '../CashbookScreen'

const records = jest.requireMock('../../../features/cashbook/records') as Record<string, jest.Mock>

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

// KST 2026-08-23(일) 14:00. UTC 로는 05:00 이라 날짜가 안 넘어간다.
const 지금 = Date.parse('2026-08-23T05:00:00Z')

beforeEach(() => {
  // 시트의 큰 숫자는 카운트업을 타고, 그 기억은 **모듈 수준**이라 케이스 사이로 샌다.
  clearCountUpMemory()
  jest.useFakeTimers({ now: 지금 })
  records.loadCalendarAmounts.mockReset().mockResolvedValue({})
  records.loadLastPointRate.mockReset().mockResolvedValue(null)
  records.loadTrackedCharacters.mockReset().mockResolvedValue([])
  records.recordIncome.mockReset().mockResolvedValue(undefined)
  records.recordSpend.mockReset().mockResolvedValue(undefined)
  records.loadDayRecords.mockReset().mockResolvedValue([])
  records.resolveTrackedDefeatDates.mockReset().mockResolvedValue(0)
  mockOpenTab.mockReset()
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

/**
 * **기본이 주간이다**([[ADR-170]] 결정 10 정정). 월간의 거동을 보는 테스트는 들어와서 한 번 옮긴다 —
 * 그 한 줄이 «이 테스트가 어느 보기를 말하는가» 를 본문에 드러내 준다.
 */
async function 월간으로(view: Rendered): Promise<void> {
  await 이름으로누르기(view, '월간')
}

async function 이름으로누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

/** 수입 시트의 금액 칸에 **친다** — OS 숫자 키보드다([[ADR-170]] 정정 4). */
async function 금액치기(view: Rendered, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('income-sheet-amount'), text)
  })
}

describe('CashbookScreen — 자리와 머리', () => {
  it('화면과 제목이 «가계부» 다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('screen-Cashbook')).toBeTruthy()
    expect(view.getByText('가계부')).toBeTruthy()
  })

  it('월간으로 옮기면 이번 달이다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('이번 달')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 8월')
  })
})

// 기간 이동은 **보스 수익 탭의 그것과 같은 모양**이다([[ADR-170]] 정정 3) — 화살촉 둘 사이에
// 두 줄(«이번 주» + 그 이레의 날짜)이 선다. 라벨은 `formatBossProfitPeriodLabel` 이 만든다.
describe('CashbookScreen — 기간 라벨 ([[ADR-170]] 정정 3)', () => {
  it('가까운 기간은 상대 표현이고, 아랫줄이 그 날짜를 든다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('이번 주')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 20일 ~ 8월 26일')
  })

  it('먼 기간은 절대 표현으로 바뀐다 — 「지난 주」 뒤부터는 주차다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '이전 주')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('지난 주')

    await 이름으로누르기(view, '이전 주')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('8월 1주차')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 6일 ~ 8월 12일')
  })

  it('아랫줄은 상대 표현일 때도 **정확한 날짜**를 말한다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('이번 달')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 8월')
  })
})

describe('CashbookScreen — 달 이동', () => {
  it('이전 달·다음 달로 옮긴다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    await 이름으로누르기(view, '이전 달')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('지난 달')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 7월')

    await 이름으로누르기(view, '다음 달')
    await 이름으로누르기(view, '다음 달')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('2026년 9월')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 9월')
  })

  it('해를 넘긴다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    for (let count = 0; count < 5; count += 1) await 이름으로누르기(view, '다음 달')

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('2027년 1월')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2027년 1월')
  })

  // 달을 옮겨도 고른 날은 그대로다 — 옮긴 것은 «보는 달» 이지 «고른 날» 이 아니다.
  it('달을 옮겨도 고른 날은 안 바뀐다', async () => {
    const view = await 그리기()
    await 월간으로(view)

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

  // 보는 범위와 무관한 거동이라 **이 주 안의 날**을 고른다 — 월간으로 옮길 이유가 없다.
  it('칸을 고르면 상세 머리글이 따라온다', async () => {
    const view = await 그리기()

    await 누르기(view, 'calendar-day-2026-08-25')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 25일 (화)')
  })

  // 앞뒤 달 칸을 누르면 **보는 달도 함께 옮겨진다** — 아니면 고른 날이 격자 밖에 있게 된다.
  it('다음 달 칸을 고르면 달도 함께 옮겨진다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    await 누르기(view, 'calendar-day-2026-09-05')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('9월 5일 (토)')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('2026년 9월')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 9월')
    // 옮긴 달의 격자에 그 칸이 여전히 있다(이번엔 이번 달 칸으로).
    expect(view.getByTestId('calendar-day-2026-09-05')).toBeTruthy()
  })
})

describe('CashbookScreen — 아직 기록이 없다 ([[ADR-169]] 결정 6)', () => {
  it('고른 날에 기록이 없다고 말한다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-empty')).toBeTruthy()
  })

  // [[ADR-169]] 정정 3 — 적은 것이 없는 날은 **두 줄 다 빈다**(전에는 수익 줄에 «0» 을 적었다).
  it('적은 것이 없으면 칸이 비고 칠해지지도 않는다', async () => {
    const view = await 그리기()

    const 수익줄 = view.queryAllByTestId(/^calendar-income-/)
    expect(수익줄.length).toBeGreaterThan(0)
    for (const line of 수익줄) expect(line.props.children).toBe(' ')

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
  // [[ADR-170]] 결정 10 정정(사용자 지정 2026-08-26) — **들어오면 주간이다.**
  it('두 알약이 서고 주간으로 시작한다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('주간').props.accessibilityState?.selected).toBe(true)
    expect(view.getByLabelText('월간').props.accessibilityState?.selected).toBe(false)
  })

  it('들어오자마자 오늘이 든 목요일 주를 그린다 — 누르지 않아도', async () => {
    const view = await 그리기()

    // 오늘은 2026-08-23(일)이고 그 주의 목요일은 8/20 이다.
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('이번 주')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 20일 ~ 8월 26일')
    expect(view.getAllByTestId(/^calendar-day-/)).toHaveLength(7)
  })

  it('주간을 누르면 고른 날이 든 **목요일 주**가 뜬다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '주간')

    // 오늘은 2026-08-23(일)이고 그 주의 목요일은 8/20 이다.
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('이번 주')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 20일 ~ 8월 26일')
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
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('지난 주')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 13일 ~ 8월 19일')

    await 이름으로누르기(view, '다음 주')
    await 이름으로누르기(view, '다음 주')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('8월 4주차')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 27일 ~ 9월 2일')
  })

  // 달을 걸치는 주는 **달을 둘 다 적는다** — 「8월 27일 – 2일」 이면 어느 달의 2일인지 모른다.
  it('달을 걸치는 주는 양쪽 달을 다 적는다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '주간')
    await 이름으로누르기(view, '다음 주')

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('8월 4주차')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 27일 ~ 9월 2일')
  })

  it('월간으로 돌아가면 **그 주의 목요일이 든 달**이다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '주간')
    // 8/27 – 9/2 로 옮긴다. 목요일(8/27)이 든 달은 **8월**이다.
    await 이름으로누르기(view, '다음 주')

    await 이름으로누르기(view, '월간')

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('이번 달')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 8월')
  })

  it('월간에서 고른 날을 바꾸고 주간으로 가면 그 날이 든 주다', async () => {
    const view = await 그리기()
    await 월간으로(view)
    await 누르기(view, 'calendar-day-2026-08-11')

    await 이름으로누르기(view, '주간')

    // 8/11(화)이 든 목요일 주는 8/6 – 8/12 다.
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('8월 1주차')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 6일 ~ 8월 12일')
  })

  it('주간에서 칸을 고르면 상세가 따라오고 주는 그대로다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '주간')

    await 누르기(view, 'calendar-day-2026-08-25')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 25일 (화)')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('이번 주')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 20일 ~ 8월 26일')
  })
})

// 두 축이 공존하는 대가 — **월간 격자의 한 줄 ≠ 주간의 한 주**다. 아무 표시가 없으면 사용자에게는
// 그냥 어긋남이라, 주 경계를 격자 위에 드러낸다([[ADR-170]] 결정 10 의 대가).
describe('목요일 경계선', () => {
  it('월간 격자에는 있다', async () => {
    const view = await 그리기()
    await 월간으로(view)

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
    await 월간으로(view)

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

  // **상세는 그날 읽기에서 나온다**([[ADR-169]] 정정 5) — 칸 금액 표가 아니다. 그래서 그 표를
  // 아무리 채워도 그날 기록이 없으면 빈 상태이고, 반대도 같다.
  it('고른 날에 기록이 있으면 합계가 서고 빈 상태가 사라진다', async () => {
    records.loadDayRecords.mockResolvedValue([{ kind: 'income', record: 그날수입 }])

    const view = await 그리기()

    expect(view.getByTestId('cashbook-day-total')).toBeTruthy()
    expect(view.queryByTestId('cashbook-empty')).toBeNull()
  })

  it('기록이 없는 날은 빈 상태다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-empty')).toBeTruthy()
    expect(view.queryByTestId('cashbook-day-total')).toBeNull()
  })

  /**
   * 기간을 옮겨도 **고른 날은 안 바뀐다**([[ADR-169]] 이후의 계약). 그런데 상세가 «격자가 덮는
   * 범위로 읽어 온 칸 금액 표» 를 보고 서 있으면, 그 날이 범위 밖으로 나가는 순간 상세가 통째로
   * 사라졌다 — 머리글은 「8월 25일」인데 아래는 「기록이 없어요」(사용자 보고 2026-08-26).
   *
   * 목은 **범위를 실제로 지킨다** — 그러지 않으면(어느 범위로 불러도 같은 표를 돌려주면) 이
   * 회귀가 목 안에서 사라져 테스트가 통과해 버린다.
   */
  it('기간을 옮겨도 고른 날의 상세가 남는다', async () => {
    records.loadCalendarAmounts.mockImplementation(async (from: string, to: string) =>
      from <= '2026-08-25' && '2026-08-25' <= to
        ? { '2026-08-25': { incomeMeso: 1_200_000_000, expenseMeso: 0 } }
        : {},
    )
    records.loadDayRecords.mockResolvedValue([
      { kind: 'income', record: { ...그날수입, earnedOn: '2026-08-25' } },
    ])

    const view = await 그리기()
    await 월간으로(view)
    await 누르기(view, 'calendar-day-2026-08-25')
    await act(async () => {})
    expect(view.getByTestId('cashbook-day-total')).toBeTruthy()

    await 이름으로누르기(view, '이전 달')
    await act(async () => {})

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 25일 (화)')
    expect(view.getByTestId('cashbook-day-total')).toBeTruthy()
    expect(view.queryByTestId('cashbook-empty')).toBeNull()
    expect(view.getByText('앱솔랩스 케이프')).toBeTruthy()
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
    await 누르기(view, 'calendar-day-2026-08-25')

    await 고르기(view, '수입 추가')

    expect(view.getByTestId('income-sheet-date')).toHaveTextContent('8월 25일 (화)')
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

    await 금액치기(view, '1')
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

    await 금액치기(view, '1')
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

    await 금액치기(view, '1')
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

    expect(view.getByTestId('spend-sheet-amount')).toBeTruthy()
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

    await 누르기(view, 'calendar-day-2026-08-25')

    expect(records.loadDayRecords).toHaveBeenLastCalledWith('2026-08-25')
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

    // **곧바로 세부로 열린다** — 고른 것이 이미 정해져 있다([[ADR-171]] 결정 2). 그리고 그것을
    // **못 바꾼다**([[ADR-173]] 결정 15): 항목이 글자로 서고 되돌아가기가 없다.
    expect(view.getByTestId('spend-sheet-title')).toHaveTextContent('몬스터 파크')
    // 그 행이 쓴 시세가 채워진다 — 「마지막으로 쓴 값」 이 아니다.
    expect(view.getByTestId('spend-sheet-rate').props.value).toBe('1180')
    expect(view.getByTestId('spend-sheet-delete')).toBeTruthy()
  })

  it('되돌아갈 곳이 없다 — 고른 것을 못 바꾼다', async () => {
    const view = await 그리기()

    await 누르기(view, 'cashbook-row-spd-1')

    expect(view.queryByLabelText('다시 고르기')).toBeNull()
    expect(view.queryByLabelText('컨텐츠')).toBeNull()
  })

  it('수입 줄은 채워진 수입 시트를 연다', async () => {
    const view = await 그리기()

    await 누르기(view, 'cashbook-row-inc-1')

    expect(view.getByTestId('income-sheet-title')).toHaveTextContent('아이템 판매')
    expect(view.getByTestId('income-sheet-amount').props.value).toBe('1,200,000,000')
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

// FAB 는 화면 위에 떠 있어 **콘텐츠를 밀어내지 않는다** — 그 몫을 콘텐츠 끝에서 갚지 않으면
// 스크롤을 끝까지 내렸을 때 마지막 줄이 버튼 뒤로 들어간다([[ADR-170]] 결정 5 가 예고한 결함,
// 사용자 보고 2026-08-25). 값의 출처가 다이얼과 **같은 상수**여야 갈리지 않는다.
describe('떠 있는 ＋ 가 먹는 자리', () => {
  it('콘텐츠 끝에 다이얼 몫만큼 여백을 남긴다', async () => {
    const view = await 그리기()

    const 여백 = flattenStyle(view.getByTestId('cashbook-content').props.style).paddingBottom

    expect(여백).toBe(SPEED_DIAL_SPACE_PX)
  })
})

// 보스 수익이 흘러든 줄([[ADR-172]] 결정 7·8). **여기서 못 고친다** — 눌러도 시트가 안 열린다.
// 그것이 [[ADR-171]] 결정 5 의 발효다. 가는 곳은 줄마다 다르다(정정 1) — 결정석은 **그 자리에서
// 펼쳐지고**, 판매는 보스 수익 탭으로 간다.
describe('자동으로 흘러든 줄 ([[ADR-172]])', () => {
  const 결정석줄 = {
    kind: 'bossCrystal' as const,
    ocid: 'ocid-1',
    characterName: '루디',
    payoutMeso: 3_600_000_000,
    count: 2,
    bosses: [
      { boss: '스우', difficulty: '하드' },
      { boss: '데미안', difficulty: '노멀' },
    ],
  }
  // 여섯을 넘겨야 «끊기는가» 를 볼 수 있다 — 두 마리로는 한 줄에 다 들어가 아무것도 안 드러난다.
  const 보스여덟 = [
    { boss: '검은 마법사', difficulty: '하드' },
    { boss: '스우', difficulty: '하드' },
    { boss: '데미안', difficulty: '노멀' },
    { boss: '루시드', difficulty: '하드' },
    { boss: '윌', difficulty: '하드' },
    { boss: '더스크', difficulty: '카오스' },
    { boss: '진 힐라', difficulty: '하드' },
    { boss: '듄켈', difficulty: '하드' },
  ]
  const 판매줄 = {
    kind: 'dropSale' as const,
    ocid: 'ocid-1',
    characterName: '루디',
    payoutMeso: 4_000_000_000,
    count: 3,
    unpricedCount: 2,
  }

  beforeEach(() => {
    records.loadCalendarAmounts.mockResolvedValue({
      '2026-08-23': { incomeMeso: 7_600_000_000, expenseMeso: 0 },
    })
    records.loadDayRecords.mockResolvedValue([결정석줄, 판매줄])
  })

  it('캐릭터당 두 줄이 선다 — 결정석과 판매를 가른다', async () => {
    const view = await 그리기()

    // `toHaveTextContent` 는 이 판에서 **완전 일치**다 — 줄 전체를 적는다.
    expect(view.getByTestId('cashbook-row-bossCrystal:ocid-1')).toHaveTextContent(
      '루디 · 보스 결정석2마리+36억',
    )
    expect(view.getByTestId('cashbook-row-dropSale:ocid-1')).toHaveTextContent(
      '루디 · 아이템 판매3건 · 미입력 2+40억',
    )
  })

  it('누르면 시트가 안 열린다 — 여기서 못 고친다 (결정 8)', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    expect(view.queryByTestId('spend-sheet-date')).toBeNull()
    expect(view.queryByTestId('income-sheet-date')).toBeNull()
  })

  it('판매 줄은 보스 수익 탭으로 간다 — 「미입력」 이 저쪽 할 일을 가리킨다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '루디 · 아이템 판매 보스 수익에서 보기')

    expect(mockOpenTab).toHaveBeenCalledWith('Profit')
  })

  // ── 정정 1: 결정석 줄은 **그 자리에서 펼친다** ────────────────────────────────
  it('결정석 줄을 누르면 탭을 안 옮기고 그날 잡은 보스를 편다', async () => {
    const view = await 그리기()

    expect(view.queryByTestId('cashbook-row-bosses-bossCrystal:ocid-1')).toBeNull()

    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    expect(mockOpenTab).not.toHaveBeenCalled()
    expect(view.getByTestId('cashbook-boss-tile-스우|하드')).toBeTruthy()
    expect(view.getByTestId('cashbook-boss-tile-데미안|노멀')).toBeTruthy()
  })

  // 사용자가 지정한 것이 «초상화» 다 — 이름만 뜨면 그 지정을 안 지킨 것이다.
  it('타일마다 초상이 든다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    expect(view.getAllByTestId('boss-portrait')).toHaveLength(2)
  })

  // 정정 2 — 56px 타일 위에 「익스트림」 넉 자가 앉으면 초상을 거의 다 덮는다.
  it('난이도는 타일 안에 한 칸으로 든다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    expect(view.getByText('H')).toBeTruthy()
    expect(view.getByText('N')).toBeTruthy()
    expect(view.queryByText('하드')).toBeNull()
    expect(view.queryByText('노멀')).toBeNull()
  })

  it('타일은 네모다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    const [초상] = view.getAllByTestId('boss-portrait')
    expect(flattenStyle(초상.props.style).borderRadius).toBe(8)
  })

  // ── 정정 3: 한 줄에 여섯 · 이름 없음 ─────────────────────────────────────────
  //
  // **폭으로 재지 않는다.** 고정 px 면 기기마다 다섯도 일곱도 되고, 퍼센트(`w-1/6` = `16.67%`)면
  // 여섯이 100.02% 라 하나가 다음 줄로 밀린다(실측 — 처음에 그렇게 냈다가 다섯만 섰다).
  // 그래서 «여섯» 이 레이아웃의 결과가 아니라 **구조**여야 하고, 그 구조를 여기서 본다.
  it('여덟 마리는 여섯 + 둘로 끊긴다', async () => {
    records.loadDayRecords.mockResolvedValue([{ ...결정석줄, count: 8, bosses: 보스여덟 }])
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    const 줄들 = view.getAllByTestId(/^cashbook-boss-row-/)
    expect(줄들).toHaveLength(2)
    expect(within(줄들[0]).getAllByTestId(/^cashbook-boss-tile-/)).toHaveLength(6)
    expect(within(줄들[1]).getAllByTestId(/^cashbook-boss-tile-/)).toHaveLength(2)
  })

  // 안 채우면 둘이 반반씩 벌어져 앞줄과 격자가 안 맞는다.
  it('덜 찬 마지막 줄은 빈 칸으로 채운다', async () => {
    records.loadDayRecords.mockResolvedValue([{ ...결정석줄, count: 8, bosses: 보스여덟 }])
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    const 마지막줄 = view.getAllByTestId(/^cashbook-boss-row-/)[1]
    expect(within(마지막줄).getAllByTestId(/^cashbook-boss-slot-/)).toHaveLength(6)
  })

  // 칸은 `flex-1` 여섯이라 남는 픽셀까지 Yoga 가 나눠 준다 — 반올림으로 넘칠 자리가 없다.
  // **상한이 붙는다**(정정 4) — 안 붙이면 넓은 기기에서 칸이 넓어진 만큼 타일 사이가 벌어진다.
  it('칸은 폭을 안 들되 상한이 있다 — 줄을 여섯이 나누고 그 이상은 안 벌어진다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    const 칸 = flattenStyle(view.getByTestId('cashbook-boss-slot-스우|하드').props.style)
    expect(칸.width).toBeUndefined()
    expect(칸.flexGrow).toBe(1)
    expect(칸.maxWidth).toBe(BOSS_SLOT_MAX_PX)

    // 상한에 걸려 줄이 덜 차면 **가운데로** 모인다 — 왼쪽으로 붙으면 오른쪽만 비어 기운다.
    const 줄 = flattenStyle(view.getAllByTestId(/^cashbook-boss-row-/)[0].props.style)
    expect(줄.justifyContent).toBe('center')
  })

  it('보스 이름을 안 적는다 — 초상이 대신한다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    expect(view.queryByText('스우')).toBeNull()
    expect(view.queryByText('데미안')).toBeNull()
  })

  // 눈으로 읽던 것이 사라졌으므로 그 자리를 접근성 이름이 받아야 한다.
  it('읽어 주는 이름은 「난이도 + 보스」다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    expect(view.getByLabelText('하드 스우')).toBeTruthy()
    expect(view.getByLabelText('노멀 데미안')).toBeTruthy()
  })

  // 펼친 판은 줄과 **한 카드**여야 한다 — 따로 선 상자로 보이면 «이 줄이 편 것» 이 끊긴다.
  // NativeWind 가 이 클래스를 못 만들면 조용히 테두리가 남으므로 값으로 본다.
  it('펼치면 줄과 판 사이의 선이 사라진다', async () => {
    const view = await 그리기()
    const 줄 = view.getByTestId('cashbook-row-bossCrystal:ocid-1')

    // 접혀 있으면 네 귀가 둥근 카드 하나다.
    expect(flattenStyle(줄.props.style)).toMatchObject({ borderRadius: 12, borderWidth: 1 })

    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    // 펼치면 아래쪽 선이 0 이 되고 아래 두 귀가 각진다 — 판이 그 자리를 잇는다.
    const 펼친줄 = flattenStyle(줄.props.style)
    expect(펼친줄).toMatchObject({ borderTopLeftRadius: 12, borderBottomWidth: 0 })
    expect(펼친줄.borderRadius).toBeUndefined()
  })

  it('다시 누르면 접힌다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')
    await 이름으로누르기(view, '루디 · 보스 결정석 접기')

    expect(view.queryByTestId('cashbook-row-bosses-bossCrystal:ocid-1')).toBeNull()
  })

  // 줄의 신원이 `bossCrystal:{ocid}` 라 날짜를 안 든다(결정 7) — 안 접으면 다른 날의 줄이
  // 펼쳐진 채로 남는다.
  it('날을 바꾸면 접힌다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    await 누르기(view, 'calendar-day-2026-08-25')

    expect(view.queryByTestId('cashbook-row-bosses-bossCrystal:ocid-1')).toBeNull()
  })

  it('들어올 때 처치 날짜를 캐고, 캔 것이 있으면 다시 읽는다 (결정 9)', async () => {
    records.resolveTrackedDefeatDates.mockResolvedValue(3)
    const view = await 그리기()
    await act(async () => {})

    expect(records.resolveTrackedDefeatDates).toHaveBeenCalledTimes(1)
    expect(records.loadDayRecords).toHaveBeenCalledTimes(2)
    expect(view.getByTestId('cashbook-row-bossCrystal:ocid-1')).toBeTruthy()
  })

  it('캔 것이 없으면 다시 안 읽는다 — 바뀔 것이 없다', async () => {
    const view = await 그리기()
    await act(async () => {})

    expect(records.loadDayRecords).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('cashbook-row-dropSale:ocid-1')).toBeTruthy()
  })
})
