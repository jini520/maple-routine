import { focusManager, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

jest.mock('../../../server/settlement', () => ({ fetchSettlement: jest.fn() }))
jest.mock('../../../storage/settlement-banner', () => ({
  getDismissedSettlementAt: jest.fn(async () => null),
  dismissSettlement: jest.fn(async () => undefined),
}))

import { queryClient } from '../../query/client'
import {
  isSettlementVisible,
  readSettlementBeforeRound,
  refreshSettlement,
  settlementOptions,
  settlingYesterdayOf,
  startSettlementRecheck,
  useSettlementBanner,
} from '../query'
import type { Settlement } from '../../../types/settlement'
import { resetSettlementDismissalForTests } from '../store'

const { fetchSettlement: fetchMock } = jest.requireMock('../../../server/settlement') as Record<string, jest.Mock>
const { getDismissedSettlementAt: dismissedMock, dismissSettlement: dismissMock } = jest.requireMock(
  '../../../storage/settlement-banner',
) as Record<string, jest.Mock>

const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
  queryClient.clear()
  resetSettlementDismissalForTests()
  jest.clearAllMocks()
  dismissedMock.mockResolvedValue(null)
  fetchMock.mockResolvedValue({ settling: true, startedAt: '2026-10-31T17:00:00.000Z' })
})

describe('settlingYesterdayOf', () => {
  const kst = (text: string) => new Date(`${text}+09:00`)

  // 넥슨 AI 에이전트 가이드는 00009 를 되풀이해 부르지 말라고 한다. 결산 중이면 어제 날짜를 묻지 않는다.
  it('0시 ~ 2시에 서버가 결산 중이라고 하면 묻지 않을 어제 날짜를 준다', async () => {
    await expect(settlingYesterdayOf(kst('2026-11-11T00:00:30'))).resolves.toBe('2026-11-10')
    await expect(settlingYesterdayOf(kst('2026-11-11T01:59:59'))).resolves.toBe('2026-11-10')
  })

  it('2시부터는 서버에 묻지 않고 null 이다', async () => {
    await expect(settlingYesterdayOf(kst('2026-11-11T02:00:00'))).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // 서버가 죽었을 때 어제 날짜를 아예 못 받게 되면 안 된다.
  it.each([
    ['결산 중이 아님', () => fetchMock.mockResolvedValue({ settling: false, startedAt: null })],
    ['서버가 모름', () => fetchMock.mockResolvedValue(null)],
    ['답을 못 받음', () => fetchMock.mockRejectedValue(new Error('down'))],
  ])('%s 이면 null 이다', async (_name, arrange) => {
    arrange()
    await expect(settlingYesterdayOf(kst('2026-11-11T01:00:00'))).resolves.toBeNull()
  })

  // 캐릭터마다 부른다. 매번 물으면 회차 하나가 우리 서버의 속도 제한에 닿는다.
  it('1분 안에 다시 부르면 서버에 다시 묻지 않는다', async () => {
    await settlingYesterdayOf(kst('2026-11-11T01:00:00'))
    await settlingYesterdayOf(kst('2026-11-11T01:00:00'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

it('서버 쿼리라 복귀마다 받는다', () => {
  expect(settlementOptions.refetchOnWindowFocus).toBe('always')
  expect(settlementOptions.meta).toEqual({ source: 'server' })
})

it('결산 중이고 이번 결산을 안 닫았을 때만 줄을 세운다. 못 받은 것도 안 세운다', () => {
  expect(isSettlementVisible({ settling: true, startedAt: 'a' }, null)).toBe(true)
  expect(isSettlementVisible({ settling: true, startedAt: 'a' }, 'a')).toBe(false)
  expect(isSettlementVisible({ settling: false, startedAt: null }, null)).toBe(false)
  expect(isSettlementVisible(null, null)).toBe(false)
  expect(isSettlementVisible(undefined, null)).toBe(false)
})

it('닫으면 그 결산의 시작 시각을 기기에 적고, 다음 결산은 시각이 달라 다시 선다', async () => {
  const { result } = await renderHook(() => useSettlementBanner(), { wrapper })
  await waitFor(() => expect(result.current.visible).toBe(true))

  await act(() => result.current.dismiss())
  expect(dismissMock).toHaveBeenCalledWith('2026-10-31T17:00:00.000Z')
  expect(result.current.visible).toBe(false)

  fetchMock.mockResolvedValue({ settling: true, startedAt: '2026-11-01T17:00:00.000Z' })
  await act(() => refreshSettlement())
  await waitFor(() => expect(result.current.visible).toBe(true))
})

// 앱을 다시 켠 뒤 첫 회차가 닫은 기록을 모르면 이미 닫은 줄이 한 번 선다.
it('기기에 닫은 기록이 있으면 처음부터 안 세운다', async () => {
  dismissedMock.mockResolvedValue('2026-10-31T17:00:00.000Z')

  const { result } = await renderHook(() => useSettlementBanner(), { wrapper })
  await waitFor(() => expect(queryClient.getQueryData(settlementOptions.queryKey)).toBeDefined())

  expect(result.current.visible).toBe(false)
})

it('회차가 겹쳐 물어도 서버는 한 번만 부른다', async () => {
  let resolve: (value: unknown) => void = () => undefined
  fetchMock.mockReturnValue(new Promise((done) => (resolve = done)))

  const first = refreshSettlement()
  const second = refreshSettlement()
  resolve({ settling: false, startedAt: null })
  await Promise.all([first, second])

  expect(fetchMock).toHaveBeenCalledTimes(1)
})

describe('0시 ~ 2시 다시 묻기', () => {
  const kst = (text: string) => new Date(`${text}+09:00`)
  const MINUTE = 60_000
  let stop: () => void = () => undefined

  beforeEach(() => {
    jest.useFakeTimers()
    focusManager.setFocused(true)
  })

  afterEach(() => {
    stop()
    focusManager.setFocused(undefined)
    jest.useRealTimers()
  })

  const seed = (value: unknown) => queryClient.setQueryData(settlementOptions.queryKey, value as never)

  // 서버는 첫 확인에 성공해야 결산 중이라고 한다. 0시 직후에 받은 결산 아님을 들고 있으면 다음 복귀까지 줄이 안 선다.
  it.each([
    ['결산 아님', { settling: false, startedAt: null }],
    ['모름', null],
  ])('포그라운드에서 답이 %s 이면 1분마다 다시 묻는다', async (_name, answer) => {
    jest.setSystemTime(kst('2026-11-26T00:00:30'))
    seed(answer)
    fetchMock.mockResolvedValue({ settling: false, startedAt: null })
    stop = startSettlementRecheck()

    await jest.advanceTimersByTimeAsync(MINUTE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(MINUTE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('결산 중이라는 답을 받으면 더 묻지 않는다', async () => {
    jest.setSystemTime(kst('2026-11-26T00:00:30'))
    seed({ settling: false, startedAt: null })
    stop = startSettlementRecheck()

    await jest.advanceTimersByTimeAsync(MINUTE)
    await jest.advanceTimersByTimeAsync(MINUTE * 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // 결산 답을 쓰는 것은 0시 ~ 2시 회차뿐이다. 낮에 묻는 것은 호출만 늘린다.
  it('2시가 지나면 묻지 않는다', async () => {
    jest.setSystemTime(kst('2026-11-26T01:59:30'))
    seed({ settling: false, startedAt: null })
    fetchMock.mockResolvedValue({ settling: false, startedAt: null })
    stop = startSettlementRecheck()

    await jest.advanceTimersByTimeAsync(MINUTE * 3)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // 돌아올 때는 복귀 재조회가 한 번 묻는다.
  it('배경에서는 묻지 않는다', async () => {
    jest.setSystemTime(kst('2026-11-26T00:00:30'))
    seed({ settling: false, startedAt: null })
    focusManager.setFocused(false)
    stop = startSettlementRecheck()

    await jest.advanceTimersByTimeAsync(MINUTE * 3)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('멈추면 더 묻지 않는다', async () => {
    jest.setSystemTime(kst('2026-11-26T00:00:30'))
    seed({ settling: false, startedAt: null })
    startSettlementRecheck()()

    await jest.advanceTimersByTimeAsync(MINUTE * 3)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('readSettlementBeforeRound', () => {
  const kst = (text: string) => new Date(`${text}+09:00`)

  // 회차의 단계마다 진행 중인 조회를 기다리지 않고, 처음부터 어제를 뺄 수 있게 답을 먼저 받아 둔다.
  it('0시 ~ 2시에는 들고 있는 답이 있어도 서버에 다시 묻고, 뒤의 회차는 그 답을 다시 쓴다', async () => {
    const notSettling: Settlement = { settling: false, startedAt: null }
    queryClient.setQueryData(settlementOptions.queryKey, notSettling)
    const now = kst('2026-11-26T00:05:00')

    await readSettlementBeforeRound(now)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await expect(settlingYesterdayOf(now)).resolves.toBe('2026-11-25')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // 2시 밖에서는 결산 답을 쓰지 않는다. 당김을 늦출 이유가 없다.
  it('2시 밖에서는 묻지 않는다', async () => {
    await readSettlementBeforeRound(kst('2026-11-26T02:00:00'))
    await readSettlementBeforeRound(kst('2026-11-26T15:00:00'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('답을 못 받아도 던지지 않는다', async () => {
    fetchMock.mockRejectedValue(new Error('down'))
    await expect(readSettlementBeforeRound(kst('2026-11-26T00:05:00'))).resolves.toBeUndefined()
  })
})
