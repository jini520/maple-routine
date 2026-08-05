// [[ADR-101]] 결정 2·3: 부팅 선하이드레이션은 세 탭 스토어를 **순차로** 돌린다.
// 순서가 계약인 이유 — [[ADR-097]] 게이트의 신선도 조건은 앞 회차가 캐시를 다 쓴 뒤에야 참이
// 되므로, 병렬로 띄우면 셋 다 게이트를 통과해 같은 응답을 3번 받는다.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prehydrateTabStores } from '../prehydrate'

const { calls, loadContent, loadBoss, loadProfit } = vi.hoisted(() => {
  const calls: string[] = []
  // 시작·종료를 둘 다 기록해야 "순차"가 검증된다 — 시작만 세면 병렬도 순서대로 찍힌다.
  const track =
    (name: string) =>
    async (): Promise<void> => {
      calls.push(`${name}:start`)
      await Promise.resolve()
      calls.push(`${name}:end`)
    }
  return {
    calls,
    loadContent: vi.fn(track('content')),
    loadBoss: vi.fn(track('boss')),
    loadProfit: vi.fn(track('profit')),
  }
})

vi.mock('../content-scheduler/store', () => ({
  useContentSchedulerStore: { getState: () => ({ loadTrackedOcids: loadContent }) },
}))
vi.mock('../boss-scheduler/store', () => ({
  useBossSchedulerStore: { getState: () => ({ loadTrackedOcids: loadBoss }) },
}))
vi.mock('../boss-profit/store', () => ({
  useBossProfitStore: { getState: () => ({ loadTrackedOcids: loadProfit }) },
}))

describe('prehydrateTabStores', () => {
  beforeEach(() => {
    calls.length = 0
    vi.clearAllMocks()
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
