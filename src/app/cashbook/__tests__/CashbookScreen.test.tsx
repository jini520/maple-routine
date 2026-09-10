// 가계부 캘린더. **아직 기록이 없다**, 그래서 여기서 보는 것은 격자·달 이동·
// 날짜 선택 셋이다. 그 셋은 데이터 없이도 진짜로 동작해야 한다(앞선 껍데기 둘과 갈리는 지점).
import type { ReactNode } from 'react'
import { act, fireEvent, within } from '@testing-library/react-native'

// 화면은 `storage/` 를 직접 안 부른다(CLAUDE.md CRITICAL). 그 층을 목으로 갈아 끼운다.
jest.mock('../../../features/cashbook/records', () => {
  const actual = jest.requireActual('../../../features/cashbook/records')
  return {
    // **순수 함수는 진짜를 쓴다**. 줄에 무엇이 적히나는 그 함수들이 정하고, 목으로 덮으면
    // 화면 테스트가 **화면이 무엇을 그리나** 를 못 본다.
    recordTitleOf: actual.recordTitleOf,
    recordMesoOf: actual.recordMesoOf,
    recordCashOf: actual.recordCashOf,
    recordCountLabelOf: actual.recordCountLabelOf,
    dayTotalsOf: actual.dayTotalsOf,
    isManualRecord: actual.isManualRecord,
    rowKeyOf: actual.rowKeyOf,
    resolveTrackedDefeatDates: jest.fn(),
    cashbookDataRevision: jest.fn(),
    amountsOfDays: actual.amountsOfDays,
    loadMonthDays: jest.fn(),
    loadDayRecords: jest.fn(),
    loadLastPointRate: jest.fn(),
    loadLastHuntSelection: jest.fn(),
    loadTrackedCharacters: jest.fn(),
    recordIncome: jest.fn(),
    recordSpend: jest.fn(),
    editIncome: jest.fn(),
    editSpend: jest.fn(),
    removeRecord: jest.fn(),
  }
})

// 창의 소유자는 부모 층이다. 이 화면은 상태를 구독하고 다시 채워 달라고 부탁만 한다.
//
// 회차 수를 **진짜 state 로** 들고 있어야 테스트가 그것을 올려 실제 리렌더를 낼 수 있다.
// 객체만 바꾸고 `rerender` 를 부르면 하네스의 프로바이더가 벗겨진다.
const mockWindow = {
  status: 'ready' as 'idle' | 'filling' | 'ready',
  collecting: false,
  revision: 1,
  reload: jest.fn(),
}
let mockSetWindowRevision: ((value: number) => void) | null = null
const mockRequestDateRange = jest.fn()

jest.mock('../../../features/ledger/useLedgerData', () => ({
  useLedgerData: () => {
    const react = require('react') as typeof import('react')
    const [revision, setRevision] = react.useState(mockWindow.revision)
    mockSetWindowRevision = setRevision
    return {
      status: mockWindow.status,
      collecting: mockWindow.collecting,
      revision,
      reload: mockWindow.reload,
      requestDateRange: mockRequestDateRange,
    }
  },
}))

// 자동 줄은 **보스 수익 탭으로 간다**. 그 이동을 목으로 받아 **어디로 갔나** 를 본다.
// 이름이 `mock` 으로 시작해야 팩토리 안에서 참조할 수 있다(jest 의 호이스팅 가드).
const mockOpenTab = jest.fn()
jest.mock('../../../hooks/useOpenTab', () => ({ useOpenTab: () => mockOpenTab }))

/**
 * `useFocusEffect` 가 요구하는 내비게이션 컨텍스트의 대역. 이 하네스는 화면 하나만 띄우므로
 * **포커스를 손으로 튼다**. 마운트가 첫 포커스이고, 그 뒤는 `다시들어오기` 가
 * 등록된 콜백을 다시 부른다(탭을 떠났다 돌아오는 그 순서다).
 */
const mockFocusCallbacks = new Set<() => void>()
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (callback: () => void) => {
    const react = require('react') as typeof import('react')
    react.useEffect(() => {
      callback()
      mockFocusCallbacks.add(callback)
      return () => {
        mockFocusCallbacks.delete(callback)
      }
    }, [callback])
  },
}))

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
    // 시트 밖과 같게 둔다. 아톰이 이 값으로 **시트 안인가** 를 묻는다.
    // 목이 시트를 평범한 `View` 로 바꾸므로 여기서도 문맥이 없는 것이 사실이고, 그래서
    // 아래 입력은 안 그려진다. 그래도 **있어야 한다**: `lib/nativewind-interop` 이 모듈을
    // 읽는 순간 이것을 등록하므로, 없으면 스위트가 뜨기도 전에 죽는다.
    useBottomSheetInternal: () => null,
    // 넘긴 것을 그대로 돌려준다. 시트가 무엇을 넘겼는지는 프롭에서 본다.
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.TextInput, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { useToastStore } from '../../../features/toast/store'
import { flattenStyle, renderOverlay } from '../../../components/__tests__/render-atom'
import { FAB_SPACE_PX } from '../../../lib/fab-metrics'
import { clearCountUpMemory } from '../../../hooks/useCountUp'
import { BOSS_SLOT_MAX_PX, CashbookScreen } from '../CashbookScreen'

const records = jest.requireMock('../../../features/cashbook/records') as Record<string, jest.Mock>

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

// KST 2026-08-23(일) 14:00. UTC 로는 05:00 이라 날짜가 안 넘어간다.
const 지금 = Date.parse('2026-08-23T05:00:00Z')
/** 들어오면 오늘이 고른 날이다. 그날 줄을 넣는 자리가 이 날짜를 쓴다. */
const 고른날 = '2026-08-23'

beforeEach(() => {
  // 시트의 큰 숫자는 카운트업을 타고, 그 기억은 **모듈 수준**이라 케이스 사이로 샌다.
  clearCountUpMemory()
  jest.useFakeTimers({ now: 지금 })
  records.loadMonthDays.mockReset().mockResolvedValue({})
  records.loadLastPointRate.mockReset().mockResolvedValue(null)
  records.loadLastHuntSelection.mockReset().mockResolvedValue(null)
  records.loadTrackedCharacters.mockReset().mockResolvedValue([])
  records.recordIncome.mockReset().mockResolvedValue(undefined)
  records.recordSpend.mockReset().mockResolvedValue(undefined)
  records.loadDayRecords.mockReset().mockResolvedValue([])
  records.resolveTrackedDefeatDates.mockReset().mockResolvedValue(0)
  records.cashbookDataRevision.mockReset().mockReturnValue(0)
  mockWindow.status = 'ready'
  mockWindow.collecting = false
  mockWindow.revision = 1
  mockWindow.reload.mockReset().mockResolvedValue(undefined)
  mockOpenTab.mockReset()
  records.editIncome.mockReset().mockResolvedValue(undefined)
  records.editSpend.mockReset().mockResolvedValue(undefined)
  records.removeRecord.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  jest.useRealTimers()
})

/**
 * 칸 금액 모양을 **그날 줄로 바꿔** 목에 넣는다.
 *
 * 달 읽기 하나가 격자와 그날 목록을 함께 내므로 목이 돌려주는 것도 그날 줄이다. 칸 금액은
 * 진짜 `amountsOfDays` 가 그것을 접어 낸다. 케이스는 여전히 **이 날 얼마** 로만 말한다.
 */
function 칸금액을(amounts: Record<string, { incomeMeso: number; expenseMeso: number }>): void {
  const byDate: Record<string, unknown[]> = {}
  for (const [dateKey, amount] of Object.entries(amounts)) {
    byDate[dateKey] = [
      {
        kind: 'income',
        characterName: '',
        record: { ...그날수입, id: `i-${dateKey}`, earnedOn: dateKey, mesoAmount: amount.incomeMeso },
      },
      {
        kind: 'spend',
        characterName: '',
        record: {
          id: `s-${dateKey}`, spentOn: dateKey, category: '기타', item: null, form: null,
          itemKind: null, quantity: null, mesoAmount: amount.expenseMeso, tariffMeso: null,
          pointAmount: null, pointPer100mMeso: null, cashAmount: null, memo: null,
          recordedAt: dateKey,
        },
      },
    ]
  }
  records.loadMonthDays.mockResolvedValue(byDate)
}

/**
 * 그날 줄을 목에 넣는다. **달 읽기가 그것을 든다.**
 *
 * 화면은 창 안의 날을 달 읽기가 든 표에서 꺼낸다. 하루 조회(`loadDayRecords`)는 창 밖의 날에만
 * 쓰이므로, 여기 넣지 않으면 케이스가 그 길을 안 지난다.
 */
function 그날줄을(dateKey: string, rows: unknown[]): void {
  records.loadMonthDays.mockResolvedValue({ [dateKey]: rows })
}

/** `loadMonthDays` 가 어느 달을 읽었나. 부른 순서 그대로. */
function 읽은달(): string[] {
  return records.loadMonthDays.mock.calls.map((call: string[]) => call[0].slice(0, 7))
}

async function 그리기(): Promise<Rendered> {
  const view = await renderOverlay(<CashbookScreen />)
  // 마운트 직후의 읽기 둘(칸 금액· 기억된 시세)이 끝난 뒤에 본다.
  await act(async () => {})
  return view
}

/** 탭을 떠났다 돌아오는 도우미. 실제로는 `useFocusEffect` 가 다시 도는 그 순간이다. */
async function 다시들어오기(): Promise<void> {
  await act(async () => {
    for (const callback of [...mockFocusCallbacks]) callback()
  })
}

async function 누르기(view: Rendered, testID: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByTestId(testID))
  })
}

/**
 * **기본이 주간이다**. 월간의 거동을 보는 테스트는 들어와서 한 번 옮긴다.
 * 그 한 줄이 이 테스트가 어느 보기를 말하는가 를 본문에 드러내 준다.
 */
async function 월간으로(view: Rendered): Promise<void> {
  await 이름으로누르기(view, '월간')
}

async function 이름으로누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

/**
 * 수입 시트의 치는 칸에 **친다**. OS 숫자 키보드다.
 *
 * 아이템 판매의 치는 자리는 **판매 대금 칸**이다. 큰 숫자는 수수료를 뗀 합계라
 * 못 친다. 시트는 **사냥으로 열리므로** 부르는 쪽이 갈래를 먼저 옮긴다.
 */
async function 금액치기(view: Rendered, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('income-sheet-gross'), text)
  })
}

describe('CashbookScreen: 자리와 머리', () => {
  it('화면과 제목이 **가계부** 다', async () => {
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

// 기간 이동은 **보스 수익 탭의 그것과 같은 모양**이다. 화살촉 둘 사이에
// 두 줄(**이번 주** + 그 이레의 날짜)이 선다. 라벨은 `formatBossProfitPeriodLabel` 이 만든다.
/**
 * **올해가 아니면 기간 위에 작게 연도가 선다**(사용자 지시). 주간 라벨은 두 줄이 다 연도를
 * 안 들어(`8월 1주차` · `8월 6일 ~ 8월 12일`) 해를 넘기면 어느 해인지가 화면에서 사라진다.
 */
describe('CashbookScreen: 연도 표시', () => {
  it('올해면 안 뜬다', async () => {
    const view = await 그리기()

    expect(view.queryByTestId('cashbook-period-year')).toBeNull()
  })

  it('해를 넘겨 거슬러 가면 뜬다', async () => {
    const view = await 그리기()
    // 2026-08-20 에서 뒤로 서른넷이면 2025-12-25 다.
    for (let count = 0; count < 34; count += 1) await 이름으로누르기(view, '이전 주')

    expect(view.getByTestId('cashbook-period-year')).toHaveTextContent('2025')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('12월 25일 ~ 12월 31일')
  })

  // 월간은 두 줄이 이미 `2025년 12월` 이라 여기서 또 적으면 같은 말이 두 번 선다.
  it('월간에는 안 뜬다. 라벨이 이미 연도를 든다', async () => {
    const view = await 그리기()
    await 월간으로(view)
    for (let count = 0; count < 8; count += 1) await 이름으로누르기(view, '이전 달')

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('2025년 12월')
    expect(view.queryByTestId('cashbook-period-year')).toBeNull()
  })

  /**
   * **자리를 안 밀어낸다**(사용자 지정). 줄로 끼우면 이 덩이가 한 줄만큼 커져 격자와 그 아래가
   * 통째로 내려간다. 흐름 밖(`position: absolute`)에 둔다.
   */
  it('흐름 밖에 서서 아래를 안 민다', async () => {
    const view = await 그리기()
    for (let count = 0; count < 34; count += 1) await 이름으로누르기(view, '이전 주')

    const style = flattenStyle(view.getByTestId('cashbook-period-year').props.style)

    expect(style.position).toBe('absolute')
    // 위 여백(`gap-4` = 16px) 안에 든다. 그보다 크면 위 알약 줄을 침범한다.
    expect(style.top).toBeLessThan(0)
    expect(style.top).toBeGreaterThanOrEqual(-16)
  })
})

describe('CashbookScreen: 기간 라벨', () => {
  it('가까운 기간은 상대 표현이고, 아랫줄이 그 날짜를 든다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('이번 주')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 20일 ~ 8월 26일')
  })

  it('먼 기간은 절대 표현으로 바뀐다. `지난 주` 뒤부터는 주차다', async () => {
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

describe('CashbookScreen: 달 이동', () => {
  it('이전 달·다음 달로 옮긴다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    await 이름으로누르기(view, '이전 달')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('지난 달')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 7월')

    // 앞으로는 **이번 달까지만** 간다. 왕복은 과거 안에서 잰다.
    await 이름으로누르기(view, '이전 달')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 6월')

    await 이름으로누르기(view, '다음 달')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('지난 달')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 7월')
  })

  it('해를 넘긴다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    // **뒤로** 넘는다. 앞은 이번 달에서 막힌다. 해 경계를 지나는 것은 같다.
    for (let count = 0; count < 8; count += 1) await 이름으로누르기(view, '이전 달')

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('2025년 12월')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2025년 12월')
  })

  // 달을 옮기면 **고른 날도 그 달 1일로 간다**. 전에는 격자만 옮겨 격자는 7월인데 상세는
  // 8월 23일이 서 있었다.
  it('달을 옮기면 고른 날이 그 달 1일이 된다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    await 이름으로누르기(view, '이전 달')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('7월 1일 (수)')
  })
})

/**
 * **앞으로는 못 간다**. 다음 주·다음 달은 **지금 기간에서 죽는다.**
 *
 * 판정은 보스 수익 탭이 쓰는 `isLatestPeriod` **그 함수**다(두 하위 탭이 같은 경계를 갖는다).
 * 죽었는지는 `disabled` 와 `aria-disabled` 둘 다로 본다. 앞은 손가락을, 뒤는 스크린리더를 막는다.
 */
describe('앞으로는 못 간다', () => {
  it('이번 주에서 다음 주가 죽는다', async () => {
    const view = await 그리기()

    const 다음 = view.getByLabelText('다음 주')
    expect(다음.props.accessibilityState?.disabled).toBe(true)

    // 눌러도 안 움직인다.
    await 이름으로누르기(view, '다음 주')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('이번 주')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 20일 ~ 8월 26일')
  })

  it('이번 달에서 `다음 달`이 죽는다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    expect(view.getByLabelText('다음 달').props.accessibilityState?.disabled).toBe(true)

    await 이름으로누르기(view, '다음 달')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 8월')
  })

  // 과거로 물러나면 되돌아올 길이 있어야 한다. 안 그러면 뒤로 간 사람이 갇힌다.
  it('지난 기간에서는 살아난다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '이전 주')
    expect(view.getByLabelText('다음 주').props.accessibilityState?.disabled).toBe(false)
    await 이름으로누르기(view, '다음 주')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('이번 주')

    await 월간으로(view)
    await 이름으로누르기(view, '이전 달')
    expect(view.getByLabelText('다음 달').props.accessibilityState?.disabled).toBe(false)
  })

  // **뒤로는 안 막는다**. 손입력은 언제로든 적으므로 과거에 경계가 없다(의
  // 살아남은 절반).
  /**
   * **화살표만 막으면 구멍이 남는다**. 월간 격자의 꼬리 칸은 **다음 달 날짜**라
   * (8월 격자는 9/5 까지 그린다) 그것을 누르면 달 동기화가 화면을 다음 달로 옮겼다. 한 번의 탭으로
   * 화살표가 막은 곳에 도착한다.
   */
  it('격자의 다음 달 칸을 눌러도 달이 안 넘어간다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    await 누르기(view, 'calendar-day-2026-09-01')

    // 고른 날은 **바뀐다**. 막는 것은 **보는 기간** 이지 **고른 날** 이 아니다(미래에도 적을 수 있다).
    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('9월 1일 (화)')
    // 격자는 8월에 남는다.
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 8월')
  })

  // 지난 달에서 **이번 달** 칸을 누르는 것은 미래가 아니다. 화살표로도 갈 수 있는 곳이다.
  it('지난 달 격자에서 이번 달 칸을 누르면 이번 달로 온다', async () => {
    const view = await 그리기()
    await 월간으로(view)
    await 이름으로누르기(view, '이전 달')

    // 7월 격자는 8/1(토)까지 그린다.
    await 누르기(view, 'calendar-day-2026-08-01')

    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 8월')
  })

  it('`이전` 은 한도에 닿기 전까지 안 죽는다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('이전 주').props.accessibilityState?.disabled).toBeFalsy()
    await 월간으로(view)
    expect(view.getByLabelText('이전 달').props.accessibilityState?.disabled).toBeFalsy()
  })
})

/**
 * **뒤로도 못 가는 곳이 있다**(사용자 지정 2026-09-10). 조회 한도(1년 6개월)가 바닥이다.
 * 그 아래에 기기 DB 의 기록이 남아 있어도 안 간다 - 새로 받을 길이 없어 반쪽만 채워진 달이
 * 되고, 화면이 그것을 그 달의 전부처럼 말하게 된다.
 *
 * 오늘이 2026-08-23 이라 월간의 바닥은 **2025년 2월**, 주간의 바닥은 그 달 1일(토)이 든
 * 리셋 주의 목요일 **2025-01-30** 이다.
 */
describe('뒤로는 조회 한도까지만', () => {
  /** 월간으로 바닥 달까지 간다. 2026-08 에서 2025-02 까지 열여덟이다. */
  async function 바닥달로(view: Rendered): Promise<Rendered> {
    await 월간으로(view)
    for (let count = 0; count < 18; count += 1) await 이름으로누르기(view, '이전 달')
    return view
  }

  it('월간은 한도인 달에서 `이전 달` 이 죽는다', async () => {
    const view = await 바닥달로(await 그리기())

    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2025년 2월')
    expect(view.getByLabelText('이전 달').props.accessibilityState?.disabled).toBe(true)

    await 이름으로누르기(view, '이전 달')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2025년 2월')
  }, 20_000)

  /**
   * **주간이 며칠 더 간다.** 월간의 바닥이 2월이어도 주간은 1월 30일에 시작하는 그 한 주까지
   * 간다. 그 주가 2월 1일을 들고 있어서다.
   *
   * 주를 여든세 번 누르는 대신 월간으로 바닥까지 간 뒤 주간을 누른다. 그러면 고른 날(2월 1일)이
   * 든 주가 열리고 그것이 곧 바닥 주다.
   */
  it('주간은 그 달 1일이 든 주까지 간다. 앞 달에서 시작해도', async () => {
    const view = await 바닥달로(await 그리기())

    await 이름으로누르기(view, '주간')

    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('1월 30일 ~ 2월 5일')
    expect(view.getByLabelText('이전 주').props.accessibilityState?.disabled).toBe(true)
  }, 20_000)

  /**
   * **화살표만 막으면 구멍이 남는다.** 격자는 앞뒤 달 날짜로 빈칸을 채우므로 2025년 2월 격자의
   * 앞 칸은 1월 날짜다. 그것을 누르면 한 번의 탭이 화살표가 막은 곳에 도착한다.
   */
  it('격자의 앞 달 칸을 눌러도 한도 아래로 안 간다', async () => {
    const view = await 바닥달로(await 그리기())

    // 2025년 2월 격자는 1/26(일)에 시작한다.
    await 누르기(view, 'calendar-day-2025-01-26')

    // 고른 날은 바뀐다. 막는 것은 **보는 기간** 이다.
    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('1월 26일 (일)')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2025년 2월')
  }, 20_000)
})

describe('CashbookScreen: 날짜 선택', () => {
  it('오늘로 시작한다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 23일 (일)')
    expect(view.getByLabelText('8월 23일 (일) 오늘')).toBeTruthy()
  })

  // 보는 범위와 무관한 거동이라 **이 주 안의 날**을 고른다. 월간으로 옮길 이유가 없다.
  it('칸을 고르면 상세 머리글이 따라온다', async () => {
    const view = await 그리기()

    await 누르기(view, 'calendar-day-2026-08-25')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 25일 (화)')
  })

  /**
   * **지난 달** 칸을 누르면 보는 달도 함께 옮겨진다. 아니면 고른 날이 격자 밖에 있게 된다.
   *
 * 다음 달 칸도 그쪽만 뒤집었다(한 번의 탭이 화살표가 막은
   * 곳에 도착하고 있었다). 뒤로는 경계가 없으므로 이 절반은 그대로다.
   */
  it('지난 달 칸을 고르면 달도 함께 옮겨진다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    // 8월 격자는 7/26(일)에 시작한다.
    await 누르기(view, 'calendar-day-2026-07-28')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('7월 28일 (화)')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('지난 달')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 7월')
    // 옮긴 달의 격자에 그 칸이 여전히 있다(이번엔 이번 달 칸으로).
    expect(view.getByTestId('calendar-day-2026-07-28')).toBeTruthy()
  })
})

describe('CashbookScreen: 아직 기록이 없다', () => {
  it('고른 날에 기록이 없다고 말한다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-empty')).toBeTruthy()
  })

  // 적은 것이 없는 날은 **두 줄 다 빈다**(전에는 수익 줄에 **0** 을 적었다).
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

// ══ 주간/월간 전환 ═══════════════════════════════════
//
// **이 앱에는 주가 둘이다.** 월간 격자의 줄은 일요일에 시작하고 주간 보기는 **목요일**에
// 시작한다. 후자가 게임의 주이고 보스 수익 탭이 이미 그 축을 쓴다. 화면이 그 둘을 오간다.

describe('주간/월간 전환', () => {
  //  정정. **들어오면 주간이다.**
  it('두 알약이 서고 주간으로 시작한다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('주간').props.accessibilityState?.selected).toBe(true)
    expect(view.getByLabelText('월간').props.accessibilityState?.selected).toBe(false)
  })

  it('들어오자마자 오늘이 든 목요일 주를 그린다. 누르지 않아도', async () => {
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

  it('주간에서는 이레만 그린다. 딱 7칸', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '주간')

    for (const day of ['20', '21', '22', '23', '24', '25', '26']) {
      expect(view.getByTestId(`calendar-day-2026-08-${day}`)).toBeTruthy()
    }
    // 주의 앞뒤는 없다. 월간처럼 앞뒤로 채우지 않는다.
    expect(view.queryByTestId('calendar-day-2026-08-19')).toBeNull()
    expect(view.queryByTestId('calendar-day-2026-08-27')).toBeNull()
  })

  it('주간의 요일 머리는 목요일부터다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '주간')

    const labels = view.getAllByText(/^[일월화수목금토]$/).map((node) => node.props.children)
    expect(labels).toEqual(['목', '금', '토', '일', '월', '화', '수'])
  })

  it('화살표가 주를 옮긴다. 이레씩이다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '주간')

    await 이름으로누르기(view, '이전 주')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('지난 주')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 13일 ~ 8월 19일')

    await 이름으로누르기(view, '이전 주')
    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('8월 1주차')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 6일 ~ 8월 12일')

    // 앞으로는 **이번 주까지만** 간다.
    await 이름으로누르기(view, '다음 주')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('8월 13일 ~ 8월 19일')
  })

  // 달을 걸치는 주는 **달을 둘 다 적는다**. `8월 27일 – 2일` 이면 어느 달의 2일인지 모른다.
  it('달을 걸치는 주는 양쪽 달을 다 적는다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '주간')
    // 7/30(목) ~ 8/5(수). **과거의** 걸치는 주다. 앞으로는 못 가므로 뒤로 셋 물러난다.
    for (let count = 0; count < 3; count += 1) await 이름으로누르기(view, '이전 주')

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('7월 5주차')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('7월 30일 ~ 8월 5일')
  })

  it('월간으로 돌아가면 **그 주의 목요일이 든 달**이다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '주간')
    // 7/30 – 8/5 로 옮긴다(뒤로 셋). 목요일(7/30)이 든 달은 **7월**이다.
    for (let count = 0; count < 3; count += 1) await 이름으로누르기(view, '이전 주')

    await 이름으로누르기(view, '월간')

    expect(view.getByTestId('cashbook-period-label')).toHaveTextContent('지난 달')
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('2026년 7월')
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

// 두 축이 공존하는 것은 그대로다(월간 격자의 한 줄 != 주간의 한 주). 그것을 격자에 **그리지
// 않기로** 했다. 어긋남을 만나는 자리는 주간 보기이고,
// 그 화면이 자기 기간을 날짜로 직접 말한다. `대가` 절에 옛 문장이 취소선으로 남아 있어,
// 그것만 읽고 되살리는 것을 이 테스트가 막는다.
describe('목요일 경계선', () => {
  it('월간 격자에도 안 그린다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    expect(view.queryByTestId('calendar-reset-divider')).toBeNull()
  })
})

/**
 * **기간을 옮기면 고른 날도 따라간다**. 주간은 그 주의 목요일(리셋 주의 시작일이라 `weekStartKey`
 * 그대로), 월간은 그 달 1일이다. 전에는 격자만 옮겨 두 구역이 서로 다른 때를 말했다.
 */
describe('기간 이동이 고른 날을 옮긴다', () => {
  it('주를 옮기면 그 주의 목요일이 고른 날이 된다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '이전 주')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 13일 (목)')
  })

  it('달을 옮기면 그 달 1일이 고른 날이 된다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    await 이름으로누르기(view, '이전 달')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('7월 1일 (수)')
  })

  /**
   * 덤으로 **월간에서 주간으로 돌아올 때 보던 달을 지킨다**. `showWeekly` 는 고른 날이 든 주를
   * 여는데, 고른 날이 안 따라오던 때는 6월을 보다 주간을 눌러도 이번 주로 튀었다.
   */
  it('달을 옮긴 뒤 주간으로 가면 그 달의 주다', async () => {
    const view = await 그리기()
    await 월간으로(view)
    await 이름으로누르기(view, '이전 달')

    await 이름으로누르기(view, '주간')

    // 7/1(수)이 든 목요일 주는 6/25 – 7/1 이다.
    expect(view.getByTestId('cashbook-period-range')).toHaveTextContent('6월 25일 ~ 7월 1일')
  })

  // 알약은 기간을 옮기는 장치가 아니라 **같은 때를 다른 단위로 보는** 장치다.
  it('주간·월간 알약은 고른 날을 안 건드린다', async () => {
    const view = await 그리기()

    await 월간으로(view)
    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 23일 (일)')

    await 이름으로누르기(view, '주간')
    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 23일 (일)')
  })
})


// ══ 기록이 붙었다 ═══════════════════════════════════════

describe('칸에 숫자가 든다', () => {
  /**
   * 읽는 단위가 **달력 월**이다. 격자 범위가 아니다. 격자는 앞뒤 달 날짜로 빈칸을 채우지만
   * 그 칸은 금액을 안 그리므로 읽어 봐야 버린다.
   */
  it('보는 달을 먼저 읽는다. 달 단위다', async () => {
    await 그리기()

    expect(records.loadMonthDays).toHaveBeenNthCalledWith(1, '2026-08-01', '2026-08-31')
  })

  /**
   * **보는 달 앞뒤 둘까지 미리 읽는다.** 옮기자마자 그려지도록.
   *
   * 앞으로는 이번 달까지만이다. 그 뒤로는 화살표가 죽어 있어 갈 수 없고 읽어 봐야 빈 표다.
   * 오늘이 2026-08-23 이라 창은 8월·7월·6월 셋이다.
   */
  it('앞뒤 둘까지 미리 읽는다. 앞으로는 이번 달까지만', async () => {
    await 그리기()

    expect(읽은달()).toEqual(['2026-08', '2026-07', '2026-06'])
  })

  it('달을 옮기면 새로 창에 든 달만 더 읽는다', async () => {
    const view = await 그리기()
    await 월간으로(view)
    records.loadMonthDays.mockClear()

    // 7월로 가면 창이 7·6·8·5 다. 앞의 셋은 이미 들고 있으므로 5월만 새로 읽는다.
    await 이름으로누르기(view, '이전 달')
    await act(async () => {})

    expect(읽은달()).toEqual(['2026-05'])
  })

  /**
   * **층에는 창 전체를 알린다**(사용자 지시). 보이는 격자만 알리면 이웃 달이 기기 DB 에 없는
   * 채로 남아, 옮겼을 때 그릴 것이 없다. 창 안은 언제나 받아 둔 상태여야 한다.
   */
  it('층에는 창 전체 범위를 알린다. 격자 범위가 아니라', async () => {
    await 그리기()

    // 오늘이 2026-08-23 이라 창은 6·7·8 월이다. 8월 격자(7/26 ~ 9/5)가 아니다.
    expect(mockRequestDateRange).toHaveBeenLastCalledWith({
      from: '2026-06-01',
      to: '2026-08-31',
    })
  })

  it('달을 옮기면 창도 함께 옮겨 알린다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    await 이름으로누르기(view, '이전 달')

    // 7월이 한가운데면 5월 ~ 8월이다(앞으로는 이번 달까지).
    expect(mockRequestDateRange).toHaveBeenLastCalledWith({
      from: '2026-05-01',
      to: '2026-08-31',
    })
  })

  // 범위가 달 단위라 같은 달 안의 주 이동은 층에 **같은 값**을 알린다. 층이 그것을 걸러 낸다.
  it('같은 달 안의 주 이동은 범위를 안 바꾼다', async () => {
    const view = await 그리기()
    mockRequestDateRange.mockClear()

    // 8/20 → 8/13. 둘 다 8월이다.
    await 이름으로누르기(view, '이전 주')

    expect(mockRequestDateRange.mock.calls).toEqual([])
  })

  it('주간도 같은 달을 본다. 열지도 기준이 그 달이다', async () => {
    const view = await 그리기()
    records.loadMonthDays.mockClear()

    await 이름으로누르기(view, '주간')
    await act(async () => {})

    // 이미 셋을 들고 있어 더 읽을 것이 없다.
    expect(읽은달()).toEqual([])
  })

  it('읽은 금액이 칸에 선다', async () => {
    칸금액을({
      '2026-08-23': { incomeMeso: 1_743_000_000, expenseMeso: 2_542_372_881 },
    })

    const view = await 그리기()

    expect(view.getByTestId('calendar-income-2026-08-23')).toHaveTextContent('+17.43억')
    expect(view.getByTestId('calendar-expense-2026-08-23')).toHaveTextContent('−25.42억')
  })

  // **상세는 그날 읽기에서 나온다**. 칸 금액 표가 아니다. 그래서 그 표를
  // 아무리 채워도 그날 기록이 없으면 빈 상태이고, 반대도 같다.
  it('고른 날에 기록이 있으면 합계가 서고 빈 상태가 사라진다', async () => {
    그날줄을(고른날, [{ kind: 'income', record: 그날수입, characterName: '' }])

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
   * **달 읽기 하나가 격자와 상세를 함께 낸다.** 옮긴 달의 1일에 든 줄이 조회 없이 곧장 선다.
   *
   * 전에는 상세가 조회를 따로 가졌고, 그 답이 오기 전까지 이 자리가 비었다.
   */
  it('옮긴 달의 상세가 달 읽기에서 곧장 나온다', async () => {
    그날줄을('2026-07-01', [
      { kind: 'income', record: { ...그날수입, earnedOn: '2026-07-01' }, characterName: '' },
    ])

    const view = await 그리기()
    await 월간으로(view)
    await 이름으로누르기(view, '이전 달')

    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('7월 1일 (수)')
    expect(view.getByTestId('cashbook-day-total')).toBeTruthy()
    expect(view.getByText('앱솔랩스 케이프')).toBeTruthy()
    // 하루 조회는 안 돈다. 창 안의 날이다.
    expect(records.loadDayRecords).not.toHaveBeenCalled()
  })

  /**
   * **아직 안 읽었다** 와 **읽었더니 없더라** 는 다른 사실이다. 답이 오기 전의
   * `loadedDay.dateKey` 는 빈 문자열이라 목록이 빈 배열인데, 그것을 0건으로 읽어 탭에
   * 들어오자마자 빈 상태가 번쩍였다(사용자 지적).
   */
  it('읽는 동안은 빈 상태도 합계도 안 그린다', async () => {
    // 영영 안 끝나는 읽기. 그 사이의 화면을 본다.
    records.loadMonthDays.mockReturnValue(new Promise(() => {}))

    const view = await 그리기()

    expect(view.queryByTestId('cashbook-empty')).toBeNull()
    expect(view.queryByTestId('cashbook-day-total')).toBeNull()
    // 머리글은 고른 날에서 곧장 나오므로 읽기를 안 기다린다.
    expect(view.getByTestId('cashbook-selected-day')).toHaveTextContent('8월 23일 (일)')
  })

  /**
   * **창 밖의 날**은 아직 하루 조회로 간다. 그 답이 오기 전에도 빈 상태를 안 그린다.
   *
   * 창 밖은 이번 달 격자의 다음 달 칸이 그 자리다. 오늘이 2026-08-23 이라 창의 천장이 8월이고
   * 9/1 은 밖이다.
   */
  it('창 밖의 날을 고르면 읽는 동안 빈 상태가 안 뜬다', async () => {
    const view = await 그리기()
    await 월간으로(view)
    expect(view.getByTestId('cashbook-empty')).toBeTruthy()

    records.loadDayRecords.mockReturnValue(new Promise(() => {}))
    await 누르기(view, 'calendar-day-2026-09-01')

    expect(view.queryByTestId('cashbook-empty')).toBeNull()
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

  // 시트는 **고른 날**에 적는다. FAB 는 날짜를 안 들고 오므로 화면이 그것을 넘긴다.
  it('시트가 고른 날을 받는다', async () => {
    const view = await 그리기()
    await 누르기(view, 'calendar-day-2026-08-25')

    await 고르기(view, '수입 추가')
    // 날짜는 2차 시트의 머리에 산다. 1차는 갈래만 묻는다.
    await 누르기(view, 'income-sheet-category-사냥')

    expect(view.getByTestId('income-sheet-date')).toHaveTextContent('8월 25일 (화)')
  })

  it('기억된 시세가 지출 시트로 간다', async () => {
    records.loadLastPointRate.mockResolvedValue(1_180)
    const view = await 그리기()

    await 고르기(view, '지출 추가')
    // 갈래는 1차 시트에서 고른다. 그 다음이 에픽던전 리워드의 두 단계다(대표 → 형태별 단계).
    await 누르기(view, 'spend-sheet-category-컨텐츠')
    await 이름으로누르기(view, '하이마운틴')

    expect(view.getByTestId('spend-sheet-rate').props.value).toBe('1180')
  })

  it('저장하면 적고 다시 읽는다', async () => {
    const view = await 그리기()
    await 고르기(view, '수입 추가')
    await 이름으로누르기(view, '아이템 판매')

    await 금액치기(view, '1')
    await 이름으로누르기(view, '저장')
    await act(async () => {})

    expect(records.recordIncome).toHaveBeenCalledTimes(1)
    expect(records.recordIncome.mock.calls[0][0]).toMatchObject({
      earnedOn: '2026-08-23',
      mesoAmount: 1,
    })
    // 저장이 판을 바꿨으므로 보는 달을 다시 읽는다.
    expect(records.loadMonthDays).toHaveBeenCalledWith('2026-08-01', '2026-08-31')
    expect(읽은달().filter((month) => month === '2026-08')).toHaveLength(2)
  })

  it('저장하면 시트가 닫힌다', async () => {
    const view = await 그리기()
    await 고르기(view, '수입 추가')
    await 이름으로누르기(view, '아이템 판매')

    await 금액치기(view, '1')
    await 이름으로누르기(view, '저장')
    await act(async () => {})

    expect(view.queryByTestId('income-sheet-amount')).toBeNull()
  })
})

// 저장이 던지면 닫히면 안 된다. 닫고 나면 친 것이 사라지고, 화면에는 적혔다 와 구분되지 않는
// 그림만 남는다. 실패는 말하고 자리를 지킨다.
describe('저장이 실패하면', () => {
  async function 고르기(view: Rendered, label: string): Promise<void> {
    await 이름으로누르기(view, '기록 추가')
    await 이름으로누르기(view, label)
  }

  beforeEach(() => {
    useToastStore.setState({ toasts: [], queue: [] })
  })

  it('수입. 시트가 열려 있고 토스트가 뜬다', async () => {
    records.recordIncome.mockRejectedValue(new Error('no such column'))
    const view = await 그리기()
    await 고르기(view, '수입 추가')
    await 이름으로누르기(view, '아이템 판매')

    await 금액치기(view, '1')
    await 이름으로누르기(view, '저장')
    await act(async () => {})

    expect(view.getByTestId('income-sheet-amount')).toBeTruthy()
    expect(useToastStore.getState().toasts[0]?.message).toBe('수입을 적지 못했습니다')
  })

  it('지출. 시트가 열려 있고 토스트가 뜬다', async () => {
    // 메포 항목은 시세가 있어야 저장이 열린다.
    records.loadLastPointRate.mockResolvedValue(1_180)
    records.recordSpend.mockRejectedValue(new Error('no such column'))
    const view = await 그리기()
    await 고르기(view, '지출 추가')

    await 누르기(view, 'spend-sheet-category-컨텐츠')
    await 이름으로누르기(view, '몬스터 파크')
    await 이름으로누르기(view, '저장')
    await act(async () => {})

    expect(view.getByTestId('spend-sheet-amount')).toBeTruthy()
    expect(useToastStore.getState().toasts[0]?.message).toBe('지출을 적지 못했습니다')
  })

  // 다시 읽으면 **없는 것** 으로 칸이 덮인다. 실패했으니 읽을 것도 안 바뀌었다.
  it('다시 읽지 않는다', async () => {
    records.loadLastPointRate.mockResolvedValue(1_180)
    records.recordSpend.mockRejectedValue(new Error('no such column'))
    const view = await 그리기()
    await 고르기(view, '지출 추가')

    await 누르기(view, 'spend-sheet-category-컨텐츠')
    await 이름으로누르기(view, '몬스터 파크')
    records.loadMonthDays.mockClear()
    await 이름으로누르기(view, '저장')
    await act(async () => {})

    expect(읽은달()).toEqual([])
  })
})


// 무엇을 적었는지 보이고, 고치고, 지운다
const 그날수입 = {
  id: 'inc-1',
  ocid: null,
  earnedOn: '2026-08-23',
  category: '아이템 판매',
  item: '앱솔랩스 케이프',
  mesoAmount: 1_200_000_000,
  saleFeePercent: null,
  saleFeeMeso: null,
  // 수입도 통화 칸 셋을 든다. 안 쓴 통화는 `null` 이다.
  pointAmount: null,
  pointPer100mMeso: null,
  cashAmount: null,
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
    칸금액을({
      '2026-08-23': { incomeMeso: 1_200_000_000, expenseMeso: 101_694_915 },
    })
    그날줄을(고른날, [
      { kind: 'income', record: 그날수입, characterName: '' },
      { kind: 'spend', record: 그날지출, characterName: '' },
    ])
  })

  it('합계 아래에 적은 것이 한 줄씩 선다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-day-total')).toBeTruthy()
    expect(view.getByText('앱솔랩스 케이프')).toBeTruthy()
    expect(view.getByText('몬스터 파크')).toBeTruthy()
  })

  // 수량은 **몇 번** 이라 이름만으로는 금액이 왜 그런지 모른다. `×` 를 붙여야 **2번** 이지
  // **2번째** 가 아니라는 것이 읽힌다.
  /**
   * **캐릭터가 붙은 줄은 이름을 앞에 적는다**.
   * 보스 줄이 이미 쓰던 어법이라 한 목록 안에서 어법이 하나로 유지된다.
   */
  it('캐릭터가 붙어 있으면 이름이 앞에 선다', async () => {
    그날줄을(고른날, [
      { kind: 'spend', record: 그날지출, characterName: '루디' },
    ])
    const view = await 그리기()

    expect(view.getByTestId('cashbook-row-spd-1')).toHaveTextContent('루디 · 몬스터 파크×2−1.02억')
  })

  it('수량이 있으면 함께 적는다', async () => {
    const view = await 그리기()

    // `toHaveTextContent` 는 이 판에서 **완전 일치**다. 줄 전체를 적는다.
    expect(view.getByTestId('cashbook-row-spd-1')).toHaveTextContent('몬스터 파크×2−1.02억')
  })

  // **누를 수 있어 보여야 한다**(사용자 지적). 글자 둘만 놓인 줄은 목록이 아니라
  // 요약으로 읽힌다. 이 저장소가 `눌러서 들어가는 줄`에 쓰는 표식이 오른쪽 화살촉이다
  // (`SettingsFeatureGuideListScreen`).
  it('줄마다 갈래 표식과 들어가는 화살촉이 선다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-row-icon-spd-1')).toBeTruthy()
    expect(view.getByTestId('cashbook-row-chevron-spd-1')).toBeTruthy()
  })

  // 그림이 붙는 갈래는 배지 안이 아이콘이 아니라 그림이다. 조회표는 `item-icons.spec.ts` 가
  // 따로 검사하므로 여기서 물을 것은 **배선** 하나다. 표에 없는 갈래는 아이콘 그대로여야 한다.
  // 표에 없는 갈래는 아이콘 그대로여야 한다. 폴백 그림을 두면 틀린 것을 그린다.
  it('그림을 안 붙인 갈래는 배지 안이 아이콘 그대로다', async () => {
    const view = await 그리기()

    // 지출은 `컨텐츠`, 수입은 `아이템 판매` 다. 둘 다 표에 없다.
    expect(view.queryByTestId('cashbook-row-image-spd-1', { includeHiddenElements: true })).toBeNull()
    expect(view.queryByTestId('cashbook-row-image-inc-1', { includeHiddenElements: true })).toBeNull()
  })

  // **창 안의 날은 조회 없이** 달 읽기가 든 표에서 꺼낸다.
  it('날을 바꿔도 새 조회가 안 돈다', async () => {
    그날줄을('2026-08-25', [{ kind: 'income', record: 그날수입, characterName: '' }])
    const view = await 그리기()

    await 누르기(view, 'calendar-day-2026-08-25')

    expect(view.getByTestId('cashbook-day-total')).toBeTruthy()
    expect(records.loadDayRecords).not.toHaveBeenCalled()
  })

  // 창 밖의 날만 하루 조회로 간다.
  it('창 밖의 날은 따로 읽는다', async () => {
    const view = await 그리기()
    await 월간으로(view)

    await 누르기(view, 'calendar-day-2026-09-01')

    expect(records.loadDayRecords).toHaveBeenLastCalledWith('2026-09-01')
  })
})

describe('줄을 누르면 고칠 수 있다', () => {
  beforeEach(() => {
    칸금액을({
      '2026-08-23': { incomeMeso: 1_200_000_000, expenseMeso: 101_694_915 },
    })
    그날줄을(고른날, [
      { kind: 'income', record: 그날수입, characterName: '' },
      { kind: 'spend', record: 그날지출, characterName: '' },
    ])
  })

  it('지출 줄은 채워진 지출 시트를 연다', async () => {
    const view = await 그리기()

    await 누르기(view, 'cashbook-row-spd-1')

    // **곧바로 세부로 열린다**. 고른 것이 이미 정해져 있다. 그리고 그것을
    // **못 바꾼다**: 항목이 글자로 서고 되돌아가기가 없다.
    expect(view.getByTestId('spend-sheet-title')).toHaveTextContent('몬스터 파크')
    // 그 행이 쓴 시세가 채워진다. `마지막으로 쓴 값` 이 아니다.
    expect(view.getByTestId('spend-sheet-rate').props.value).toBe('1180')
    expect(view.getByTestId('spend-sheet-delete')).toBeTruthy()
  })

  it('되돌아갈 곳이 없다. 고른 것을 못 바꾼다', async () => {
    const view = await 그리기()

    await 누르기(view, 'cashbook-row-spd-1')

    expect(view.queryByLabelText('다시 고르기')).toBeNull()
    expect(view.queryByLabelText('컨텐츠')).toBeNull()
  })

  it('수입 줄은 채워진 수입 시트를 연다', async () => {
    const view = await 그리기()

    await 누르기(view, 'cashbook-row-inc-1')

    expect(view.getByTestId('income-sheet-title')).toHaveTextContent('아이템 판매')
    expect(view.getByTestId('income-sheet-gross').props.value).toBe('1200000000')
  })

  it('수정하면 갈아 끼우고 다시 읽는다', async () => {
    const view = await 그리기()
    await 누르기(view, 'cashbook-row-inc-1')

    await 이름으로누르기(view, '수정')
    await act(async () => {})

    expect(records.editIncome).toHaveBeenCalledTimes(1)
    expect(records.editIncome.mock.calls[0][0]).toMatchObject({
      id: 'inc-1',
      // **적은 시각을 안 덮는다**.
      recordedAt: '2026-08-23T01:00:00.000Z',
    })
    expect(records.recordIncome).not.toHaveBeenCalled()
  })

  it('삭제하면 지우고 다시 읽는다', async () => {
    const view = await 그리기()
    await 누르기(view, 'cashbook-row-spd-1')

    await 이름으로누르기(view, '삭제')
    await act(async () => {})

    expect(records.removeRecord).toHaveBeenCalledWith({ kind: 'spend', record: 그날지출, characterName: '' })
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

// FAB 는 화면 위에 떠 있어 콘텐츠를 밀어내지 않는다. 그 몫을 콘텐츠 끝에서 갚지 않으면 스크롤을
// 끝까지 내렸을 때 마지막 줄이 버튼 뒤로 들어간다. 값의 출처가 다이얼과 같은 상수여야 갈리지
// 않는다.
describe('떠 있는 ＋ 가 먹는 자리', () => {
  it('콘텐츠 끝에 다이얼 몫만큼 여백을 남긴다', async () => {
    const view = await 그리기()

    const 여백 = flattenStyle(view.getByTestId('cashbook-content').props.style).paddingBottom

    expect(여백).toBe(FAB_SPACE_PX)
  })
})

// 보스 수익이 흘러든 줄. **여기서 못 고친다**. 눌러도 시트가 안 열린다.
// 가는 곳은 줄마다 다르다. 결정석은 **그 자리에서
// 펼쳐지고**, 판매는 보스 수익 탭으로 간다.
describe('자동으로 흘러든 줄', () => {
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
  // 여섯을 넘겨야 **끊기는가** 를 볼 수 있다. 두 마리로는 한 줄에 다 들어가 아무것도 안 드러난다.
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
    칸금액을({
      '2026-08-23': { incomeMeso: 7_600_000_000, expenseMeso: 0 },
    })
    그날줄을(고른날, [결정석줄, 판매줄])
  })

  // 결정석 줄만 그림을 갖는다. 조회표는 `item-icons.spec.ts` 가 따로 검사하므로 여기서 물을
  // 것은 **배선** 하나다.
  //
  // `includeHiddenElements` 를 켜는 것은 표식이 `aria-hidden` 이기 때문이다. 줄 이름이 이미
  // 무엇인지 말하므로 그림은 스크린리더에서 숨는 것이 맞고, 그러면 기본 쿼리에 안 잡힌다.
  const 숨은것까지 = { includeHiddenElements: true }

  it('결정석 줄은 배지 안이 그림이고 판매 줄은 아이콘 그대로다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-row-image-bossCrystal:ocid-1', 숨은것까지)).toBeTruthy()
    expect(view.queryByTestId('cashbook-row-image-dropSale:ocid-1', 숨은것까지)).toBeNull()
  })

  // 그림 뒤에는 바탕을 안 깐다(사용자 지정). 자리는 그대로 24 다.
  it('그림이 선 배지는 바탕색이 없다', async () => {
    const view = await 그리기()

    const 그림줄 = view.getByTestId('cashbook-row-icon-bossCrystal:ocid-1')
    const 아이콘줄 = view.getByTestId('cashbook-row-icon-dropSale:ocid-1')
    const 바탕 = (node: { props: { style?: unknown } }): unknown =>
      (Object.assign({}, ...[node.props.style].flat(2)) as { backgroundColor?: unknown })
        .backgroundColor

    expect(바탕(그림줄)).toBeUndefined()
    expect(바탕(아이콘줄)).toEqual(expect.any(String))
  })

  it('캐릭터당 두 줄이 선다. 결정석과 판매를 가른다', async () => {
    const view = await 그리기()

    // `toHaveTextContent` 는 이 판에서 **완전 일치**다. 줄 전체를 적는다.
    expect(view.getByTestId('cashbook-row-bossCrystal:ocid-1')).toHaveTextContent(
      '루디 · 보스 결정석2마리+36억',
    )
    expect(view.getByTestId('cashbook-row-dropSale:ocid-1')).toHaveTextContent(
      '루디 · 아이템 판매3건 · 미입력 2+40억',
    )
  })

  it('누르면 시트가 안 열린다. 여기서 못 고친다 (결정 8)', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    expect(view.queryByTestId('spend-sheet-date')).toBeNull()
    expect(view.queryByTestId('income-sheet-date')).toBeNull()
  })

  it('판매 줄은 보스 수익 탭으로 간다. `미입력` 이 저쪽 할 일을 가리킨다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '루디 · 아이템 판매 보스 수익에서 보기')

    expect(mockOpenTab).toHaveBeenCalledWith('Profit')
  })

  // 결정석 줄은 그 자리에서 펼친다.
  it('결정석 줄을 누르면 탭을 안 옮기고 그날 잡은 보스를 편다', async () => {
    const view = await 그리기()

    expect(view.queryByTestId('cashbook-row-bosses-bossCrystal:ocid-1')).toBeNull()

    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    expect(mockOpenTab).not.toHaveBeenCalled()
    expect(view.getByTestId('cashbook-boss-tile-스우|하드')).toBeTruthy()
    expect(view.getByTestId('cashbook-boss-tile-데미안|노멀')).toBeTruthy()
  })

  // 사용자가 지정한 것이 **초상화** 다. 이름만 뜨면 그 지정을 안 지킨 것이다.
  it('타일마다 초상이 든다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    expect(view.getAllByTestId('boss-portrait')).toHaveLength(2)
  })

  // 56px 타일 위에 `익스트림` 넉 자가 앉으면 초상을 거의 다 덮는다.
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

  // 한 줄에 여섯 · 이름 없음.
  //
  // 폭으로 재지 않는다. 고정 px 면 기기마다 다섯도 일곱도 되고, 퍼센트(`w-1/6` = `16.67%`)면
  // 여섯이 100.02% 라 하나가 다음 줄로 밀린다. 그래서 여섯이 레이아웃의 결과가 아니라
  // 구조여야 하고, 그 구조를 여기서 본다.
  it('여덟 마리는 여섯 + 둘로 끊긴다', async () => {
    그날줄을(고른날, [{ ...결정석줄, count: 8, bosses: 보스여덟 }])
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    const 줄들 = view.getAllByTestId(/^cashbook-boss-row-/)
    expect(줄들).toHaveLength(2)
    expect(within(줄들[0]).getAllByTestId(/^cashbook-boss-tile-/)).toHaveLength(6)
    expect(within(줄들[1]).getAllByTestId(/^cashbook-boss-tile-/)).toHaveLength(2)
  })

  // 안 채우면 둘이 반반씩 벌어져 앞줄과 격자가 안 맞는다.
  it('덜 찬 마지막 줄은 빈 칸으로 채운다', async () => {
    그날줄을(고른날, [{ ...결정석줄, count: 8, bosses: 보스여덟 }])
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    const 마지막줄 = view.getAllByTestId(/^cashbook-boss-row-/)[1]
    expect(within(마지막줄).getAllByTestId(/^cashbook-boss-slot-/)).toHaveLength(6)
  })

  // 칸은 `flex-1` 여섯이라 남는 픽셀까지 Yoga 가 나눠 준다. 반올림으로 넘칠 자리가 없다.
  // **상한이 붙는다**. 안 붙이면 넓은 기기에서 칸이 넓어진 만큼 타일 사이가 벌어진다.
  it('칸은 폭을 안 들되 상한이 있다. 줄을 여섯이 나누고 그 이상은 안 벌어진다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    const 칸 = flattenStyle(view.getByTestId('cashbook-boss-slot-스우|하드').props.style)
    expect(칸.width).toBeUndefined()
    expect(칸.flexGrow).toBe(1)
    expect(칸.maxWidth).toBe(BOSS_SLOT_MAX_PX)

    // 상한에 걸려 줄이 덜 차면 **가운데로** 모인다. 왼쪽으로 붙으면 오른쪽만 비어 기운다.
    const 줄 = flattenStyle(view.getAllByTestId(/^cashbook-boss-row-/)[0].props.style)
    expect(줄.justifyContent).toBe('center')
  })

  it('보스 이름을 안 적는다. 초상이 대신한다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    expect(view.queryByText('스우')).toBeNull()
    expect(view.queryByText('데미안')).toBeNull()
  })

  // 눈으로 읽던 것이 사라졌으므로 그 자리를 접근성 이름이 받아야 한다.
  it('읽어 주는 이름은 `난이도 + 보스`다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    expect(view.getByLabelText('하드 스우')).toBeTruthy()
    expect(view.getByLabelText('노멀 데미안')).toBeTruthy()
  })

  // 펼친 판은 줄과 **한 카드**여야 한다. 따로 선 상자로 보이면 **이 줄이 편 것** 이 끊긴다.
  // NativeWind 가 이 클래스를 못 만들면 조용히 테두리가 남으므로 값으로 본다.
  it('펼치면 줄과 판 사이의 선이 사라진다', async () => {
    const view = await 그리기()
    const 줄 = view.getByTestId('cashbook-row-bossCrystal:ocid-1')

    // 접혀 있으면 네 귀가 둥근 카드 하나다.
    expect(flattenStyle(줄.props.style)).toMatchObject({ borderRadius: 12, borderWidth: 1 })

    await 이름으로누르기(view, '루디 · 보스 결정석 펼치기')

    // 펼치면 아래쪽 선이 0 이 되고 아래 두 귀가 각진다. 판이 그 자리를 잇는다.
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

  // 줄의 신원이 `bossCrystal:{ocid}` 라 날짜를 안 든다. 안 접으면 다른 날의 줄이
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
    // 판이 바뀌어 **보는 달을 다시 읽는다**. 그 뒤 창의 나머지가 이어진다.
    expect(읽은달().filter((month) => month === '2026-08')).toHaveLength(2)
    expect(view.getByTestId('cashbook-row-bossCrystal:ocid-1')).toBeTruthy()
  })

  it('캔 것이 없으면 다시 안 읽는다. 바뀔 것이 없다', async () => {
    const view = await 그리기()
    await act(async () => {})

    // 창의 셋을 한 번씩. 다시 읽은 달이 없다.
    expect(읽은달()).toEqual(['2026-08', '2026-07', '2026-06'])
    expect(view.getByTestId('cashbook-row-dropSale:ocid-1')).toBeTruthy()
  })
})

/**
 * **당겨서 새로고침**(사용자 지적).
 *
 * 다른 네 화면이 이미 하는 그것이 여기만 빠져 있었다. 당겨도 아무 일이 없었다.
 * 무엇을 다시 부를지는 **부모 층**이 정하고, 화면은 그 회차가 끝난 뒤 **다시 읽는다.**
 */
describe('당겨서 새로고침', () => {
  function 당김(view: Rendered): { refreshing: boolean; onRefresh: () => void } {
    return view.getByTestId('screen-scroll').props.refreshControl.props
  }

  it('컨트롤이 붙어 있다', async () => {
    const view = await 그리기()

    expect(당김(view).refreshing).toBe(false)
  })

  // 당김은 **부모에게 부탁만** 한다. 무엇을 다시 부를지(오늘·과거)는 그쪽이 정하고, 끝나면
  // 회차 수가 올라 화면이 다시 읽는다. 전에는 이 화면이 자기만의 조합을 들고 있었다.
  it('당기면 부모의 다시 불러오기를 부른다', async () => {
    const view = await 그리기()

    await act(async () => {
      당김(view).onRefresh()
    })

    expect(mockWindow.reload).toHaveBeenCalledTimes(1)
  })
})

/**
 * 기간 합계 세 칸. 기간 이동과 격자 **사이**에 선다.
 *
 * 값은 **격자가 그린 칸을 그대로 접은 것**이라 여기서 보는 것은 화면이 어느 격자를
 * 넣었나 다: 주간이면 이레, 월간이면 그 달 칸만. 새 조회는 안 튼다. `loadCalendarAmounts` 는
 * 격자용으로 이미 부른 그 한 번이다.
 */
describe('기간 합계 세 칸', () => {
  // 8/20(목)~8/26(수)이 이번 주다. 7/31·9/1 은 **월간 격자의 앞뒤 달 칸**이라 어느 보기에서도
  // 안 들어야 한다(8월 격자는 7/26 에 시작해 9/5 에 끝난다).
  const 금액 = {
    '2026-07-31': { incomeMeso: 900_000_000, expenseMeso: 900_000_000 },
    '2026-08-15': { incomeMeso: 300_000_000, expenseMeso: 100_000_000 },
    '2026-08-21': { incomeMeso: 50_000_000, expenseMeso: 20_000_000 },
    '2026-08-23': { incomeMeso: 10_000_000, expenseMeso: 5_000_000 },
    '2026-09-01': { incomeMeso: 700_000_000, expenseMeso: 700_000_000 },
  }

  // 그린 순서를 그대로 훑는다. 자리를 **몇 번째 자식** 으로 재면 상자가 하나 끼는 순간 깨진다.
  function 그린순서(view: Rendered): string[] {
    const 순서: string[] = []
    const 훑기 = (node: unknown): void => {
      if (node === null || typeof node !== 'object') return
      const element = node as { props?: { testID?: string }; children?: unknown[] }
      if (element.props?.testID !== undefined) 순서.push(element.props.testID)
      for (const child of element.children ?? []) 훑기(child)
    }
    훑기(view.toJSON())
    return 순서
  }

  /**
   * 위에서부터 **범위 이동 → 합계 → 격자**. 어느 기간인가 를
   * 말한 줄 바로 다음이 그 기간이 얼마인가 이고, 그 둘이 격자를 받친다.
   */
  it('범위 이동 · 합계 · 격자 순으로 선다', async () => {
    const view = await 그리기()
    const 순서 = 그린순서(view)

    expect(순서.indexOf('cashbook-period-range')).toBeLessThan(
      순서.indexOf('cashbook-summary-net'),
    )
    expect(순서.indexOf('cashbook-summary-net')).toBeLessThan(
      순서.indexOf('calendar-day-2026-08-20'),
    )
  })

  it('주간은 **이레만** 접는다', async () => {
    칸금액을(금액)
    const view = await 그리기()

    // 8/21 + 8/23 = 6000만 수익· 2500만 지출. 8/15 는 이 주가 아니다.
    expect(view.getByTestId('cashbook-summary-income')).toHaveTextContent('+6,000만')
    expect(view.getByTestId('cashbook-summary-expense')).toHaveTextContent('−2,500만')
    expect(view.getByTestId('cashbook-summary-net')).toHaveTextContent('+3,500만 메소')
  })

  it('월간은 그 달 칸만 접는다. 앞뒤 달로 채운 칸은 안 든다', async () => {
    칸금액을(금액)
    const view = await 그리기()
    await 월간으로(view)

    // 8/15 + 8/21 + 8/23 = 3.6억 수익· 1.25억 지출. 7/31·9/1 이 들면 자릿수가 통째로 달라진다.
    expect(view.getByTestId('cashbook-summary-income')).toHaveTextContent('+3.6억')
    expect(view.getByTestId('cashbook-summary-expense')).toHaveTextContent('−1.25억')
    expect(view.getByTestId('cashbook-summary-net')).toHaveTextContent('+2.35억 메소')
  })

  it('기간을 옮기면 따라간다', async () => {
    칸금액을(금액)
    const view = await 그리기()
    await 이름으로누르기(view, '이전 주')

    // 8/13(목)~8/19(수). 이 이레에 든 것은 8/15 하나다(3억 수익· 1억 지출).
    expect(view.getByTestId('cashbook-summary-income')).toHaveTextContent('+3억')
    expect(view.getByTestId('cashbook-summary-expense')).toHaveTextContent('−1억')
    expect(view.getByTestId('cashbook-summary-net')).toHaveTextContent('+2억 메소')
  })

  /**
   * 적자인 기간. **부호가 색을 정한다**. 색을 값으로 안 박고 **수익·지출 칸과 견준다**:
   * 테마가 바뀌어도 순 수익이 지출과 같은 색이다 는 그대로여야 하는 계약이기 때문이다.
   */
  it('순 수익이 음수면 지출과 같은 색이고 `−` 절댓값이다', async () => {
    칸금액을({
      '2026-08-21': { incomeMeso: 10_000_000, expenseMeso: 30_000_000 },
    })
    const view = await 그리기()

    const 순수익 = view.getByTestId('cashbook-summary-net')
    // 통째로 못 박는다. `formatMesoCompact(-20000000)` 이 내는 ASCII `-` 가 새어 나오면
    // 문자열이 갈려 이 줄이 깨진다. 부호는 U+2212 다.
    expect(순수익).toHaveTextContent('−2,000만 메소')
    expect(flattenStyle(순수익.props.style).color).toBe(
      flattenStyle(view.getByTestId('cashbook-summary-expense').props.style).color,
    )
  })

  /**
   * **셋은 같은 무게가 아니다**. 수익·지출은 순 수익을 **내기 위한
   * 값**이라 약하게 서고, 답인 순 수익만 크게 선다. 값을 박지 않고 **셋을 서로 견준다**: 지켜야 할
   * 것은 16px이 아니라 답이 재료보다 크다 는 관계다.
   */
  it('순 수익이 수익·지출보다 크고 굵다', async () => {
    const view = await 그리기()

    const 수익 = flattenStyle(view.getByTestId('cashbook-summary-income').props.style)
    const 지출 = flattenStyle(view.getByTestId('cashbook-summary-expense').props.style)
    const 순수익 = flattenStyle(view.getByTestId('cashbook-summary-net').props.style)

    expect(Number(순수익.fontSize)).toBeGreaterThan(Number(수익.fontSize))
    expect(Number(순수익.fontSize)).toBeGreaterThan(Number(지출.fontSize))
    expect(Number(순수익.fontWeight)).toBeGreaterThan(Number(수익.fontWeight))
  })

  /**
   * **답이 왼쪽 헤드라인, 재료 둘이 오른쪽에 쌓인다**(저울, 사용자 채택).
   * 답은 카드에서 가장 큰 것이 되고 재료는 그 옆의 각주가 된다.
   */
  it('순 수익이 왼쪽 헤드라인이고 재료 둘은 오른쪽에 쌓인다', async () => {
    const view = await 그리기()

    const 블록 = flattenStyle(view.getByTestId('cashbook-period-summary').props.style)
    expect(블록).toMatchObject({ flexDirection: 'row', justifyContent: 'space-between' })
    expect(블록.backgroundColor).toBeTruthy()

    // 재료 둘은 **한 상자에 세로로** 쌓이고 답은 그 밖이다. 셋이 한 무리면 답이 재료로 읽힌다.
    const 재료 = view.getByTestId('cashbook-summary-sources')
    expect(flattenStyle(재료.props.style)).toMatchObject({ alignItems: 'flex-end' })
    expect(within(재료).getByTestId('cashbook-summary-income')).toBeTruthy()
    expect(within(재료).getByTestId('cashbook-summary-expense')).toBeTruthy()
    expect(within(재료).queryByTestId('cashbook-summary-net')).toBeNull()

    // 단위는 큰 숫자에만 붙는다. 셋이 같은 축이라 한 번이면 된다. 이 케이스는 기록이 없어
    // 셋 다 0 이고 0 에는 부호도 안 붙는다.
    expect(view.getByTestId('cashbook-summary-net')).toHaveTextContent('0 메소')
    expect(view.getByTestId('cashbook-summary-income')).toHaveTextContent('+0')
  })

  it('순 수익이 양수면 수익과 같은 색이다', async () => {
    칸금액을({
      '2026-08-21': { incomeMeso: 30_000_000, expenseMeso: 10_000_000 },
    })
    const view = await 그리기()

    expect(flattenStyle(view.getByTestId('cashbook-summary-net').props.style).color).toBe(
      flattenStyle(view.getByTestId('cashbook-summary-income').props.style).color,
    )
  })
})

/**
 * 다시 들어오면 다시 읽는다. 바뀌었을 때만.
 *
 * 이 화면은 탭이라 마운트가 앱 실행당 한 번인데 원천 넷 중 둘은 남의 화면이 쓴다. 보스
 * 수익에서 아이템 가격을 입력하고 가계부로 오면 새로고침 없이도 반영돼야 한다.
 */
describe('CashbookScreen: 낡은 숫자', () => {
  it('판이 그대로면 다시 안 읽는다. 탭을 오가는 것은 흔한 일이다', async () => {
    await 그리기()
    records.loadMonthDays.mockClear()
    records.loadDayRecords.mockClear()

    await 다시들어오기()

    expect(records.loadMonthDays).not.toHaveBeenCalled()
    expect(records.loadDayRecords).not.toHaveBeenCalled()
  })

  it('남의 화면이 원천을 바꿨으면 들어올 때 다시 읽는다. 당기지 않아도', async () => {
    await 그리기()
    records.loadMonthDays.mockClear()
    records.loadDayRecords.mockClear()
    // 가격 입력 화면이 `boss_drop_records` 를 적고 왔다.
    records.cashbookDataRevision.mockReturnValue(1)

    await 다시들어오기()
    await act(async () => {})

    // 판이 바뀌었으므로 창의 셋을 다시 읽는다. 그날 줄도 그 안에 들어 있다.
    expect(읽은달()).toEqual(['2026-08', '2026-07', '2026-06'])
    expect(records.loadDayRecords).not.toHaveBeenCalled()
  })

  it('다시 읽은 숫자가 그대로 합계에 선다. 증상이 사라지는 지점이다', async () => {
    칸금액을({})
    const view = await 그리기()
    expect(view.getByTestId('cashbook-summary-income')).toHaveTextContent('+0')

    // 보스 수익 탭에서 아이템 가격을 적고 돌아왔다.
    칸금액을({
      '2026-08-21': { incomeMeso: 60_000_000, expenseMeso: 0 },
    })
    records.cashbookDataRevision.mockReturnValue(1)
    await 다시들어오기()

    expect(view.getByTestId('cashbook-summary-income')).toHaveTextContent('+6,000만')
  })

  it('한 번 따라잡으면 같은 판으로 또 안 읽는다', async () => {
    await 그리기()
    records.cashbookDataRevision.mockReturnValue(1)
    await 다시들어오기()
    records.loadMonthDays.mockClear()
    records.loadDayRecords.mockClear()

    await 다시들어오기()

    expect(records.loadMonthDays).not.toHaveBeenCalled()
    expect(records.loadDayRecords).not.toHaveBeenCalled()
  })

  it('포커스는 다시 읽기만 한다. 부모의 다시 불러오기는 안 튼다', async () => {
    await 그리기()
    records.cashbookDataRevision.mockReturnValue(2)

    await 다시들어오기()

    expect(mockWindow.reload).not.toHaveBeenCalled()
  })
})

// ⚠️ 사용자 보고 · 실기기 계측으로 잡은 경합.
//
//   16:42:02  가계부가 읽는다        dated=41   (이번 주 것뿐)
//   16:42:05  창이 과거 기록을 만든다  +185건
//
// 가계부는 포커스 때 한 번 재는 것이 전부라, 그 뒤 3초에 들어온 것을 받을 길이 없었다.
// 이제 창의 회차가 끝날 때(`revision` 이 오를 때) 다시 잰다.
describe('창이 뒤늦게 채운 것을 받는다', () => {
  it('회차가 끝나면 다시 읽는다', async () => {
    await 그리기()
    const 읽은횟수 = records.loadMonthDays.mock.calls.length

    await act(async () => {
      mockSetWindowRevision?.(2)
    })

    expect(records.loadMonthDays.mock.calls.length).toBeGreaterThan(읽은횟수)
  })

  // 당김도 이 길로 온다. 바뀐 것이 없을 때 건너뛰면 사용자가 당겨도 아무 일도 안 일어난다.
  it('안 바뀌었어도 회차가 끝나면 다시 읽는다. 당김이 이 길로 온다', async () => {
    await 그리기()
    const 읽은횟수 = records.loadMonthDays.mock.calls.length

    await act(async () => {
      mockSetWindowRevision?.(2)
    })

    expect(records.loadMonthDays.mock.calls.length).toBeGreaterThan(읽은횟수)
  })
})


// 강화 줄은 앞의 둘과 둘이 갈린다. **나가는 돈**이고, 초상이 없다. 펼치는 것은 결정석과 같다.
describe('강화 줄', () => {
  const 스타포스줄 = {
    kind: 'enhancement' as const,
    category: '스타포스' as const,
    characterName: '낟낟',
    payoutMeso: 1_200_000_000,
    count: 47,
    unpricedCount: 0,
    items: [
      { targetItem: '아케인셰이드 클로', count: 32, costMeso: 980_000_000, unpricedCount: 0 },
      { targetItem: '데아 시두스 이어링', count: 15, costMeso: 220_000_000, unpricedCount: 0 },
    ],
  }
  const 에디셔널줄 = {
    kind: 'enhancement' as const,
    category: '에디셔널 잠재능력' as const,
    characterName: '낟낟',
    payoutMeso: 740_000_000,
    count: 10,
    unpricedCount: 0,
    items: [{ targetItem: '아케인셰이드 클로', count: 10, costMeso: 740_000_000, unpricedCount: 0 }],
  }

  beforeEach(() => {
    칸금액을({
      '2026-08-23': { incomeMeso: 0, expenseMeso: 1_940_000_000 },
    })
    그날줄을(고른날, [스타포스줄, 에디셔널줄])
  })

  it('나가는 돈으로 적힌다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-row-enhancement:스타포스:낟낟')).toHaveTextContent(
      '낟낟 · 스타포스47회−12억',
    )
  })

  // 넷을 안 묶는다. 비용이 서는 방식이 아예 달라 묶으면 무엇에 썼는지가 한 숫자에 가려진다.
  it('갈래마다 줄이 따로 선다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-row-enhancement:에디셔널 잠재능력:낟낟')).toHaveTextContent(
      '낟낟 · 에디셔널 잠재능력10회−7.4억',
    )
  })

  it('값모름이 있으면 건수 옆에 선다', async () => {
    그날줄을(고른날, [{ ...스타포스줄, unpricedCount: 3 }])
    const view = await 그리기()

    expect(view.getByTestId('cashbook-row-enhancement:스타포스:낟낟')).toHaveTextContent(
      '낟낟 · 스타포스47회 · 값모름 3−12억',
    )
  })

  it('처음에는 접혀 있다', async () => {
    const view = await 그리기()

    expect(view.queryByTestId('cashbook-row-items-enhancement:스타포스:낟낟')).toBeNull()
  })

  // 원천이 넥슨 API 라 갈 곳이 없다. 펼치는 것이 여기서 할 수 있는 전부다.
  it('누르면 그 자리에서 펼쳐진다. 탭을 안 옮긴다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '낟낟 · 스타포스 펼치기')

    expect(view.getByTestId('cashbook-row-items-enhancement:스타포스:낟낟')).toBeTruthy()
    expect(mockOpenTab).not.toHaveBeenCalled()
    expect(view.queryByTestId('cashbook-spend-sheet')).toBeNull()
  })

  it('무엇을 강화했는지 큰 금액부터 적는다', async () => {
    const view = await 그리기()
    await 이름으로누르기(view, '낟낟 · 스타포스 펼치기')

    expect(view.getByTestId('cashbook-item-row-아케인셰이드 클로')).toHaveTextContent(
      '아케인셰이드 클로32회−9.8억',
    )
    expect(view.getByTestId('cashbook-item-row-데아 시두스 이어링')).toHaveTextContent(
      '데아 시두스 이어링15회−2.2억',
    )
  })

  // 한 번에 하나만 펼친다. 둘이 같은 장비를 만졌으면 판이 둘 서서 신원이 겹친다.
  it('다른 갈래를 펼치면 앞의 것이 접힌다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '낟낟 · 스타포스 펼치기')
    await 이름으로누르기(view, '낟낟 · 에디셔널 잠재능력 펼치기')

    expect(view.queryByTestId('cashbook-row-items-enhancement:스타포스:낟낟')).toBeNull()
    expect(view.getByTestId('cashbook-row-items-enhancement:에디셔널 잠재능력:낟낟')).toBeTruthy()
  })

  // 0 을 적으면 공짜로 강화한 것이 된다.
  it('그 장비를 통째로 모르면 금액 자리가 값 모름 이다', async () => {
    그날줄을(고른날, [
      {
        ...스타포스줄,
        items: [{ targetItem: '왕푸', count: 8, costMeso: 0, unpricedCount: 8 }],
      },
    ])
    const view = await 그리기()
    await 이름으로누르기(view, '낟낟 · 스타포스 펼치기')

    expect(view.getByTestId('cashbook-item-row-왕푸')).toHaveTextContent('왕푸8회값 모름')
  })

  it('다시 누르면 접힌다', async () => {
    const view = await 그리기()

    await 이름으로누르기(view, '낟낟 · 스타포스 펼치기')
    await 이름으로누르기(view, '낟낟 · 스타포스 접기')

    expect(view.queryByTestId('cashbook-row-items-enhancement:스타포스:낟낟')).toBeNull()
  })
})

// 회차가 도는 동안 읽으면 그 시점의 DB 가 아직 자라는 중이라, 한 셀의 값이 종류가 도착할
// 때마다 커진다(큐브 → 스타포스 → 잠재). 다 합산될 때까지 안 그린다(사용자 지정).
describe('확정 전에는 안 그린다', () => {
  beforeEach(() => {
    칸금액을({
      '2026-08-23': { incomeMeso: 7_600_000_000, expenseMeso: 1_200_000_000 },
    })
  })

  it('받는 중에는 다시 읽지도 않는다', async () => {
    mockWindow.collecting = true
    records.loadMonthDays.mockClear()
    await 그리기()

    expect(records.loadMonthDays).not.toHaveBeenCalled()
  })

  // 자리는 남는다(칸 높이가 흔들리면 격자가 출렁인다). 비는 것은 숫자다.
  it('받는 중이면 달력 칸의 숫자가 빈다', async () => {
    const view = await 그리기()
    expect(view.getByTestId('calendar-income-2026-08-23')).toHaveTextContent('+76억')

    mockWindow.collecting = true
    const 받는중 = await 그리기()

    expect(받는중.getByTestId('calendar-income-2026-08-23')).not.toHaveTextContent('억')
    expect(받는중.getByTestId('calendar-expense-2026-08-23')).not.toHaveTextContent('억')
  })

  // 오른쪽 정렬만으로는 금액의 오른쪽 끝만 한 x 에 서고, 자릿수가 달라지면 줄의 왼쪽 끝이
  // 밀린다. 값이 들어올 때마다 두 줄이 흔들렸다(사용자 보고).
  it('금액 칸이 고정 폭이라 자릿수가 달라도 안 밀린다', async () => {
    const view = await 그리기()
    const 짧다 = flattenStyle(view.getByTestId('cashbook-summary-income').props.style).width

    칸금액을({
      '2026-08-23': { incomeMeso: 1_234_500_000_000, expenseMeso: 900_000 },
    })
    const 길다 = await 그리기()

    expect(짧다).toBe(64)
    expect(flattenStyle(길다.getByTestId('cashbook-summary-income').props.style).width).toBe(64)
    expect(flattenStyle(길다.getByTestId('cashbook-summary-expense').props.style).width).toBe(64)
  })

  // 회차가 끝난 순간부터 새 읽기가 도착하기까지 몇 밀리초가 있다. 그 사이에 이전 달의 값이
  // 그려졌다. 격자가 앞뒤 달의 날을 함께 그리므로 겹치는 날만 값이 있고 나머지는 비어, 있던
  // 것만 먼저 뜬 것처럼 보였다(사용자 보고).
  it('읽은 범위가 지금 범위와 다르면 안 그린다', async () => {
    const view = await 그리기()
    expect(view.getByTestId('cashbook-summary-income')).toHaveTextContent('+76억')

    let resolve: ((value: Record<string, unknown>) => void) | null = null
    records.loadMonthDays.mockImplementation(
      () => new Promise((done) => (resolve = done as never)),
    )
    await 이름으로누르기(view, '이전 주')

    expect(view.getByTestId('cashbook-summary-income')).toHaveTextContent('+0')

    await act(async () => {
      resolve?.({})
    })
  })

  it('다 받으면 숫자가 선다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('cashbook-summary-net')).toHaveTextContent('+64억 메소')
    expect(view.getByTestId('cashbook-summary-income')).toHaveTextContent('+76억')
    expect(view.getByTestId('cashbook-summary-expense')).toHaveTextContent('−12억')
  })
})
