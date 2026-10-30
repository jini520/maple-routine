import { act, fireEvent } from '@testing-library/react-native'

jest.mock('../../../features/stats/load', () => ({
  loadStatsImages: jest.fn().mockResolvedValue(new Map()),
  loadCumulativeStart: jest.fn().mockResolvedValue(null),
  saveCumulativeStart: jest.fn().mockResolvedValue(undefined),
}))
// 날짜별 줄은 쿼리가 든다. 화면은 그 결과만 받으므로 쿼리 쪽을 통째로 갈아 끼운다.
jest.mock('../../../features/cashbook/ledger-query', () => ({ useLedgerDays: jest.fn() }))
// 머리 아래 `hh:mm:ss 기준` 은 회차 쿼리를 읽는다. 이 화면의 일이 아니라 비워 둔다.
jest.mock('../../../features/refresh/freshness', () => ({ useRealtimeFetchedAt: jest.fn(() => null) }))

const mockReload = jest.fn()
const mockRequestDateRange = jest.fn()
let mockCollecting = false
let mockStatus: 'idle' | 'filling' | 'ready' = 'ready'
jest.mock('../../../features/ledger/useLedgerData', () => ({
  useLedgerData: () => ({
    status: mockStatus,
    collecting: mockCollecting,
    reload: mockReload,
    requestDateRange: mockRequestDateRange,
  }),
}))

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useSettlementStore } from '../../../features/settlement/store'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { apiWindowRange, historyFloorDateKey } from '../../../features/cashbook/range'
import { StatsScreen } from '../StatsScreen'

const { useLedgerDays } = jest.requireMock('../../../features/cashbook/ledger-query') as { useLedgerDays: jest.Mock }

const 지금 = Date.parse('2026-09-29T05:00:00Z')

function 수입(dateKey: string, meso: number): unknown {
  return {
    kind: 'income',
    characterName: '',
    record: {
      id: `i-${dateKey}-${meso}`, ocid: null, earnedOn: dateKey, category: 'etc', item: null, itemKey: null,
      mesoAmount: meso, pointAmount: null, pointPer100mMeso: null, cashAmount: null, quantity: null,
      itemKind: null, saleFeePercent: null, saleFeeMeso: null, saleFeeAuto: false, hunt: null,
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
      tariffMeso: null, pointAmount: null, pointPer100mMeso: null, cashAmount: null,
      recordedAt: dateKey,
    },
  }
}

const 기록 = {
  '2026-09-18': [수입('2026-09-18', 100_000_000)],
  '2026-09-25': [수입('2026-09-25', 500_000_000), 지출('2026-09-25', 200_000_000)],
}

beforeEach(() => {
  installNoopNativePorts()
  jest.useFakeTimers({ now: 지금 })
  mockReload.mockReset().mockResolvedValue(undefined)
  mockRequestDateRange.mockReset()
  mockCollecting = false
  mockStatus = 'ready'
  useLedgerDays.mockReset().mockReturnValue({ days: 기록, isFetching: false })
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

  // 누적 카드가 처음부터 더하므로 그 범위가 나머지 카드의 범위를 다 덮는다. 기간을 옮겨도 범위가 같아 쿼리가 하나다.
  it('날짜별 줄은 가장 이른 조회일부터 오늘까지 한 범위로 묻고, 기간을 옮겨도 그 범위다', async () => {
    const view = await 그리기()
    const 전기간 = { from: historyFloorDateKey('2026-09-29'), to: '2026-09-29' }
    expect(useLedgerDays).toHaveBeenLastCalledWith(전기간)

    await act(async () => {
      fireEvent.press(view.getByLabelText('이전 주'))
    })
    await act(async () => {
      fireEvent.press(view.getByLabelText('월간'))
    })

    const 물은범위 = new Set(useLedgerDays.mock.calls.map(([range]: [{ from: string; to: string }]) => `${range.from}~${range.to}`))
    expect([...물은범위]).toEqual([`${전기간.from}~${전기간.to}`])
  })

  // 읽기 전에 `0 메소` 를 그리면 기록이 없다는 말로 읽힌다. 기간 줄과 카드 제목은 그대로 선다.
  describe('불러오는 중', () => {
    const 제목들 = ['순 수익', '추이', '캐릭터별', '수입 내역', '지출 내역', '보스별 수입', '누적 순 수익']

    it('첫 읽기가 끝나기 전에는 카드 본문 자리에 스켈레톤이 선다', async () => {
      useLedgerDays.mockReturnValue({ days: null, isFetching: true })
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

// 처치 날짜가 있는 기록만 읽는 화면이라 결산 중에는 오늘 잡은 보스가 빠진다. 그 말을 머리글 바로 아래 줄이 한다.
describe('결산 안내 줄', () => {
  // 실물 스토어라 값이 케이스 사이로 샌다.
  beforeEach(() => {
    useSettlementStore.setState({ settling: false, startedAt: null, dismissedAt: null, visible: false })
  })

  it('결산 중이면 머리글 아래에 서고 둘째 줄이 보스 수입이 늦는다고 말한다', async () => {
    useSettlementStore.setState({
      settling: true,
      startedAt: '2026-10-18T15:00:00.000Z',
      dismissedAt: null,
      visible: true,
    })

    const view = await 그리기()

    expect(view.getByTestId('stats-settlement-banner')).toBeTruthy()
    expect(view.getByText('오늘 잡은 보스 수입은 결산이 끝난 뒤 반영됩니다.')).toBeTruthy()
  })
})
