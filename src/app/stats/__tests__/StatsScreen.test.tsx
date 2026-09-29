import { act, fireEvent } from '@testing-library/react-native'

jest.mock('../../../features/stats/load', () => ({ loadStatsDays: jest.fn() }))

const mockReload = jest.fn()
const mockRequestDateRange = jest.fn()
jest.mock('../../../features/ledger/useLedgerData', () => ({
  useLedgerData: () => ({
    status: 'ready',
    collecting: false,
    revision: 1,
    reload: mockReload,
    requestDateRange: mockRequestDateRange,
  }),
}))

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { StatsScreen } from '../StatsScreen'

const { loadStatsDays } = jest.requireMock('../../../features/stats/load') as { loadStatsDays: jest.Mock }

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

  // 강화 내역은 날마다 API 를 부르므로 층에는 고른 기간만 요청한다.
  it('층에는 고른 기간의 날짜 범위만 요청한다', async () => {
    await 그리기()

    expect(mockRequestDateRange).toHaveBeenLastCalledWith({ from: '2026-09-24', to: '2026-09-30' })
  })
})
