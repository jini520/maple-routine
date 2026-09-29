import { act, fireEvent } from '@testing-library/react-native'

jest.mock('../../../features/stats/load', () => ({
  loadStatsDays: jest.fn(),
  loadStatsImages: jest.fn().mockResolvedValue(new Map()),
  statsDataRevision: jest.fn().mockReturnValue(0),
  loadCumulativeStart: jest.fn().mockResolvedValue(null),
  saveCumulativeStart: jest.fn().mockResolvedValue(undefined),
}))

const mockReload = jest.fn()
const mockRequestDateRange = jest.fn()
let mockSetLayerRevision: ((value: number) => void) | null = null
let mockCollecting = false
let mockStatus: 'idle' | 'filling' | 'ready' = 'ready'
jest.mock('../../../features/ledger/useLedgerData', () => ({
  useLedgerData: () => {
    const react = require('react') as typeof import('react')
    const [revision, setRevision] = react.useState(1)
    mockSetLayerRevision = setRevision
    return { status: mockStatus, collecting: mockCollecting, revision, reload: mockReload, requestDateRange: mockRequestDateRange }
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
  installNoopNativePorts()
  jest.useFakeTimers({ now: 지금 })
  mockReload.mockReset().mockResolvedValue(undefined)
  mockRequestDateRange.mockReset()
  mockCollecting = false
  mockStatus = 'ready'
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
    expect(view.getByTestId('stats-summary-net').props.children.join('')).toContain('+1억')
  })

  it('월간으로 바꾸면 이번 달이다', async () => {
    const view = await 그리기()

    await act(async () => {
      fireEvent.press(view.getByLabelText('월간'))
    })

    expect(view.getByTestId('stats-period-label').props.children).toBe('이번 달')
  })

  // 가계부와 같은 함수다. 범위가 같아야 두 화면을 오가도 층이 회차를 다시 안 연다.
  it('층에는 가계부와 같은 범위를 요청한다', async () => {
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

  // 읽기 전에 `0 메소` 를 그리면 기록이 없다는 말로 읽힌다. 기간 줄과 카드 제목은 그대로 선다.
  describe('불러오는 중', () => {
    const 제목들 = ['순 수익', '추이', '캐릭터별', '수입 내역', '지출 내역', '보스별 수익', '누적 순수익']

    it('첫 읽기가 끝나기 전에는 카드 본문 자리에 스켈레톤이 선다', async () => {
      loadStatsDays.mockReset().mockReturnValue(new Promise(() => undefined))
      const view = await 그리기()

      expect(view.getByTestId('stats-skeleton')).toBeTruthy()
      expect(view.queryByTestId('stats-summary-net')).toBeNull()
      expect(view.getByTestId('stats-period-label').props.children).toBe('이번 주')
      for (const 제목 of 제목들) expect(view.getByText(제목)).toBeTruthy()
    })

    it('읽기가 끝나면 스켈레톤이 걷히고 값이 선다', async () => {
      const view = await 그리기()

      expect(view.queryByTestId('stats-skeleton')).toBeNull()
      expect(view.getByTestId('stats-summary-net')).toBeTruthy()
    })

    it('아직 안 받은 지난 날을 받는 동안(filling)에는 스켈레톤이다', async () => {
      mockStatus = 'filling'
      mockCollecting = true
      const view = await 그리기()

      expect(view.getByTestId('stats-skeleton')).toBeTruthy()
      expect(view.queryByTestId('stats-summary-net')).toBeNull()
    })

    // 이미 받아 둔 달로 옮겨도 층은 회차를 돌려 `collecting` 을 켠다. 값은 18개월치를 이미 들고 있어
    // 그대로 맞다. 여기서 스켈레톤을 세우면 값이 먼저 섰다가 스켈레톤이 뒤늦게 덮는다.
    it('받아 둔 범위를 다시 도는 회차(collecting 만 참)에는 값을 그대로 둔다', async () => {
      mockCollecting = true
      const view = await 그리기()

      expect(view.queryByTestId('stats-skeleton')).toBeNull()
      expect(view.getByTestId('stats-summary-net')).toBeTruthy()
    })
  })
})
