// [[ADR-101]] 결정 2·3: 부팅 선하이드레이션은 세 탭 스토어를 **순차로** 돌린다.
// 순서가 계약인 이유 — [[ADR-097]] 게이트의 신선도 조건은 앞 회차가 캐시를 다 쓴 뒤에야 참이
// 되므로, 병렬로 띄우면 셋 다 게이트를 통과해 같은 응답을 3번 받는다.
import { prehydrateTabStores } from '../prehydrate'

// jest 의 목 팩토리는 **`mock` 으로 시작하는 이름만** 밖에서 끌어올 수 있고, 팩토리가 여러 번
// 불릴 수 있다. 그래서 «같은 목을 돌려주는» 멱등 팩토리로 둔다 — 테스트가 그 인스턴스에 직접
// 단언하기 때문이다([[ADR-157]] — vitest 의 `vi.hoisted` 가 하던 일).
var mockCalls: string[] | undefined
var mockLoads: Record<string, jest.Mock> | undefined

function mockTrack(name: string): jest.Mock {
  const calls = (mockCalls = mockCalls ?? [])
  mockLoads = mockLoads ?? {}
  // 시작·종료를 둘 다 기록해야 "순차"가 검증된다 — 시작만 세면 병렬도 순서대로 찍힌다.
  mockLoads[name] =
    mockLoads[name] ??
    jest.fn(async (): Promise<void> => {
      calls.push(`${name}:start`)
      await Promise.resolve()
      calls.push(`${name}:end`)
    })
  return mockLoads[name]
}

jest.mock('../content-scheduler/store', () => ({
  useContentSchedulerStore: { getState: () => ({ loadTrackedOcids: mockTrack('content') }) },
}))
jest.mock('../boss-scheduler/store', () => ({
  useBossSchedulerStore: { getState: () => ({ loadTrackedOcids: mockTrack('boss') }) },
}))
jest.mock('../boss-profit/store', () => ({
  useBossProfitStore: { getState: () => ({ loadTrackedOcids: mockTrack('profit') }) },
}))

const loadContent = mockTrack('content')
const loadBoss = mockTrack('boss')
const loadProfit = mockTrack('profit')
const calls = (mockCalls = mockCalls ?? [])

describe('prehydrateTabStores', () => {
  beforeEach(() => {
    calls.length = 0
    jest.clearAllMocks()
  })

  it('세 탭 스토어를 순차로 하이드레이션한다', async () => {
    await prehydrateTabStores()

    expect(calls).toEqual([
      'content:start',
      'content:end',
      'boss:start',
      'boss:end',
      'profit:start',
      'profit:end',
    ])
  })

  it('한 스토어가 실패해도 나머지를 계속 예열하고 던지지 않는다', async () => {
    loadBoss.mockRejectedValueOnce(new Error('저장소 읽기 실패'))

    await expect(prehydrateTabStores()).resolves.toBeUndefined()

    expect(loadContent).toHaveBeenCalledTimes(1)
    expect(loadBoss).toHaveBeenCalledTimes(1)
    expect(loadProfit).toHaveBeenCalledTimes(1)
  })
})
