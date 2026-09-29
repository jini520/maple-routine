import { act, fireEvent } from '@testing-library/react-native'

jest.mock('../../../features/stats/load', () => ({
  loadStatsDays: jest.fn(),
  loadStatsImages: jest.fn().mockResolvedValue(new Map()),
  statsDataRevision: jest.fn().mockReturnValue(0),
}))

const mockReload = jest.fn()
const mockRequestDateRange = jest.fn()
let mockSetLayerRevision: ((value: number) => void) | null = null
jest.mock('../../../features/ledger/useLedgerData', () => ({
  useLedgerData: () => {
    const react = require('react') as typeof import('react')
    const [revision, setRevision] = react.useState(1)
    mockSetLayerRevision = setRevision
    return { status: 'ready', collecting: false, revision, reload: mockReload, requestDateRange: mockRequestDateRange }
  },
}))

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (callback: () => void) => {
    const react = require('react') as typeof import('react')
    react.useEffect(() => {
      callback()
    }, [callback])
  },
}))

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { clearCountUpMemory } from '../../../hooks/useCountUp'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { apiWindowRange } from '../../../features/cashbook/range'
import { StatsScreen } from '../StatsScreen'

const { loadStatsDays, statsDataRevision } = jest.requireMock('../../../features/stats/load') as {
  loadStatsDays: jest.Mock
  statsDataRevision: jest.Mock
}

const 지금 = Date.parse('2026-09-29T05:00:00Z')

function 수입(dateKey: string, meso: number): unknown {
  return {
    kind: 'income',
    characterName: '',
    record: {
      id: `i-${dateKey}-${meso}`, ocid: null, earnedOn: dateKey, category: 'etc', item: null, itemKey: null,
      mesoAmount: meso, pointAmount: null, pointPer100mMeso: null, cashAmount: null, quantity: null,
      itemKind: null, saleFeePercent: null, saleFeeMeso: null, saleFeeAuto: false, hunt: null, memo: null,
      recordedAt: dateKey,
    },
  }
}

function 지출(dateKey: string, meso: number): unknown {
  return {
    kind: 'spend',
    characterName: '',
    record: {
      id: `s-${dateKey}-${meso}`, ocid: null, spentOn: dateKey, category: 'etc', item: null, itemKey: null,
      formItemKeys: null, itemKind: null, levelFrom: null, levelTo: null, quantity: null, mesoAmount: meso,
      tariffMeso: null, pointAmount: null, pointPer100mMeso: null, cashAmount: null, memo: null,
      recordedAt: dateKey,
    },
  }
}

beforeEach(() => {
  clearCountUpMemory()
  installNoopNativePorts()
  jest.useFakeTimers({ now: 지금 })
  mockReload.mockReset().mockResolvedValue(undefined)
  mockRequestDateRange.mockReset()
  statsDataRevision.mockReset().mockReturnValue(0)
  loadStatsDays.mockReset().mockResolvedValue({
    '2026-09-18': [수입('2026-09-18', 100_000_000)],
    '2026-09-25': [수입('2026-09-25', 500_000_000), 지출('2026-09-25', 200_000_000)],
  })
})

afterEach(() => {
  jest.useRealTimers()
})

async function 그리기(): Promise<Awaited<ReturnType<typeof renderOverlay>>> {
  const view = await renderOverlay(<StatsScreen />)
  await act(async () => {
    await Promise.resolve()
  })
  // 처음 읽은 값도 0 에서 굴러 올라간다. 굴리기가 끝난 뒤를 본다.
  await act(async () => {
    jest.advanceTimersByTime(1000)
  })
  return view
}

describe('StatsScreen', () => {
  it('머리에 통계와 주간 · 월간이 서고 기간 줄은 이번 주다', async () => {
    const view = await 그리기()

    expect(view.getByText('통계')).toBeTruthy()
    expect(view.getByText('주간')).toBeTruthy()
    expect(view.getByText('월간')).toBeTruthy()
    expect(view.getByTestId('stats-period-label').props.children).toBe('이번 주')
  })

  it('순 수익 카드는 그 기간의 수입 − 지출이다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('stats-summary-net').props.children.join('')).toContain('+3억')
  })

  it('이전 기간으로 옮기면 지난 주의 합계가 선다', async () => {
    const view = await 그리기()

    await act(async () => {
      fireEvent.press(view.getByLabelText('이전 주'))
    })

    expect(view.getByTestId('stats-period-label').props.children).toBe('지난 주')
    // 숫자는 이전 값에서 굴러간다. 굴리기가 끝나면 새 기간의 값이다.
    expect(view.getByTestId('stats-summary-net').props.children.join('')).not.toContain('+1억')
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(view.getByTestId('stats-summary-net').props.children.join('')).toContain('+1억')
  })

  it('월간으로 바꾸면 이번 달이다', async () => {
    const view = await 그리기()

    await act(async () => {
      fireEvent.press(view.getByLabelText('월간'))
    })

    expect(view.getByTestId('stats-period-label').props.children).toBe('이번 달')
  })

  // 가계부와 같은 창이다. 고른 기간의 달을 가운데 두고 앞뒤 두 달(오늘을 안 넘는다).
  it('층에는 가계부와 같은 달 창을 요청한다', async () => {
    const view = await 그리기()
    expect(mockRequestDateRange).toHaveBeenLastCalledWith(apiWindowRange('2026-09', '2026-09-29'))

    // 같은 달 안의 주로 옮기면 창이 그대로다.
    await act(async () => {
      fireEvent.press(view.getByLabelText('이전 주'))
    })
    expect(mockRequestDateRange).toHaveBeenLastCalledWith(apiWindowRange('2026-09', '2026-09-29'))

    // 월간에서 석 달 전으로 가면 창이 그 달을 가운데 둔다.
    await act(async () => {
      fireEvent.press(view.getByLabelText('월간'))
    })
    for (let step = 0; step < 3; step += 1) {
      await act(async () => {
        fireEvent.press(view.getByLabelText('이전 달'))
      })
    }
    expect(mockRequestDateRange).toHaveBeenLastCalledWith(apiWindowRange('2026-06', '2026-09-29'))
  })

  // 주를 옮겨도 18개월치는 이미 들고 있다. 층의 회차가 끝나도 읽는 표가 안 바뀌었으면 다시 읽지 않는다.
  it('기간을 옮기거나 층의 판만 오르면 다시 읽지 않는다', async () => {
    const view = await 그리기()
    expect(loadStatsDays).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.press(view.getByLabelText('이전 주'))
    })
    await act(async () => {
      mockSetLayerRevision?.(2)
    })

    expect(loadStatsDays).toHaveBeenCalledTimes(1)
  })

  it('읽는 표의 판이 오른 뒤 층의 회차가 끝나면 다시 읽는다', async () => {
    await 그리기()

    statsDataRevision.mockReturnValue(5)
    await act(async () => {
      mockSetLayerRevision?.(2)
    })

    expect(loadStatsDays).toHaveBeenCalledTimes(2)
  })
})
