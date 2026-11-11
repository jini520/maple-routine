import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

jest.mock('../../../server/settlement', () => ({ fetchSettlement: jest.fn() }))
jest.mock('../../../storage/settlement-banner', () => ({
  getDismissedSettlementAt: jest.fn(async () => null),
  dismissSettlement: jest.fn(async () => undefined),
}))

import { queryClient } from '../../query/client'
import { isSettlementVisible, refreshSettlement, settlementOptions, settlingYesterdayOf, useSettlementBanner } from '../query'
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
