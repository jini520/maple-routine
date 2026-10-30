// 부팅 예열은 저장된 쿼리 캐시가 다 올라온 뒤에 **순차로** 돈다. 선택 복원 → 스케줄 회차 → 보스 수익.
// 순서가 계약인 이유. 보스 수익의 게이트는 앞 회차가 캐시를 다 쓴 뒤에야 신선하다고 보므로, 병렬로
// 띄우면 같은 응답을 두 번 받는다.
import { prehydrateTabStores } from '../prehydrate'

var mockCalls: string[] | undefined
var mockLoads: Record<string, jest.Mock> | undefined

function mockTrack(name: string): jest.Mock {
  const calls = (mockCalls = mockCalls ?? [])
  mockLoads = mockLoads ?? {}
  // 시작·종료를 둘 다 기록해야 "순차"가 검증된다. 시작만 세면 병렬도 순서대로 찍힌다.
  mockLoads[name] =
    mockLoads[name] ??
    jest.fn(async (): Promise<void> => {
      calls.push(`${name}:start`)
      await Promise.resolve()
      calls.push(`${name}:end`)
    })
  return mockLoads[name]
}

var mockRestoredState: { resolve: () => void; promise: Promise<void> } | undefined
function mockRestoredGate(): { resolve: () => void; promise: Promise<void> } {
  if (mockRestoredState === undefined) {
    let resolve: () => void = () => undefined
    const promise = new Promise<void>((done) => {
      resolve = done
    })
    mockRestoredState = { resolve, promise }
  }
  return mockRestoredState
}

jest.mock('../query/persist', () => ({ whenQueryCacheRestored: () => mockRestoredGate().promise }))
jest.mock('../character-selection/store', () => ({
  useCharacterSelectionStore: { getState: () => ({ hydrate: mockTrack('selection') }) },
}))
jest.mock('../schedule-sync/schedule-query', () => ({ prefetchSchedules: mockTrack('schedule') }))
jest.mock('../boss-profit/store', () => ({
  useBossProfitStore: { getState: () => ({ loadTrackedOcids: mockTrack('profit') }) },
}))

const loadSchedule = mockTrack('schedule')
const loadProfit = mockTrack('profit')
const calls = (mockCalls = mockCalls ?? [])

describe('prehydrateTabStores', () => {
  beforeEach(() => {
    calls.length = 0
    jest.clearAllMocks()
  })

  it('저장된 캐시가 올라온 뒤에 선택 · 스케줄 회차 · 보스 수익을 순차로 예열한다', async () => {
    const run = prehydrateTabStores()
    await Promise.resolve()
    expect(calls).toEqual([])

    mockRestoredGate().resolve()
    await run

    expect(calls).toEqual([
      'selection:start',
      'selection:end',
      'schedule:start',
      'schedule:end',
      'profit:start',
      'profit:end',
    ])
  })

  it('한 단계가 실패해도 나머지를 계속 예열하고 던지지 않는다', async () => {
    loadSchedule.mockRejectedValueOnce(new Error('회차 실패'))

    await expect(prehydrateTabStores()).resolves.toBeUndefined()

    expect(loadSchedule).toHaveBeenCalledTimes(1)
    expect(loadProfit).toHaveBeenCalledTimes(1)
  })
})
