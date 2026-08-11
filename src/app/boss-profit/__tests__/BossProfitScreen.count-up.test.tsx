// @vitest-environment jsdom
//
// [[ADR-087]] 정정 1 — **기간 이동은 총 수익만 굴린다**(사용자 결정).
//
// 이 파일이 지키는 것은 결과 자체보다 **결과가 커밋 모양에 흔들리지 않는다**는 것이다. store 는
// `set({ periodKey })` 를 데이터보다 먼저 하고(라벨·네비게이션 반응성), 그 사이에 React 가 커밋을
// 끼울지는 SQLite 조회가 캐시에 맞는지·백필이 걸리는지에 따라 달라진다. 정정 1 이전에는 그
// 비결정성이 그대로 화면에 새어 나와, 같은 왕복인데 회차마다 굴러가기도 안 굴러가기도 했다.
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCountUpMemory } from '@core/lib/use-count-up'
import { BossProfitScreen } from '../BossProfitScreen'
import { useBossProfitStore, type BossProfitRow } from '../../../features/boss-profit/store'

vi.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }) },
}))
vi.mock('../../../features/boss-profit/store', () => ({
  useBossProfitStore: vi.fn(),
  dropRowKey: (ocid: string, boss: string, difficulty: string, periodKey: string) =>
    `${ocid}|${boss}|${difficulty}|${periodKey}`,
}))

const mockedUseBossProfitStore = vi.mocked(useBossProfitStore)

const THIS_WEEK = '2026-07-09'
const LAST_WEEK = '2026-07-02'
const TOTAL: Record<string, number> = { [THIS_WEEK]: 9_000_000, [LAST_WEEK]: 5_000_000 }

function row(periodKey: string, payoutMeso: number): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    imageUrl: null,
    world: null,
    boss: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    periodKey,
    periodLabel: '주',
    priceMeso: payoutMeso,
    maxPartySize: 6,
    partySize: 1,
    payoutMeso,
    isComplete: true,
  }
}

/** store 스냅샷. `loaded*` 는 rows 와 함께만 움직인다(정정 1의 원자성 요구). */
function mockStore(view: {
  periodKey: string
  dataPeriodKey: string
  isPeriodLoading?: boolean
}): void {
  mockedUseBossProfitStore.mockReturnValue({
    status: 'loaded',
    tab: 'weekly',
    periodKey: view.periodKey,
    loadedTab: 'weekly',
    loadedPeriodKey: view.dataPeriodKey,
    rows: [row(view.dataPeriodKey, TOTAL[view.dataPeriodKey])],
    dropsByRowKey: {},
    weeklySubtotals: [],
    isPeriodLoading: view.isPeriodLoading ?? false,
    periodState: 'recorded' as const,
    previousPeriodTotalMeso: 0,
    canGoPreviousPeriod: true,
    error: null,
    staleCharacterNames: [],
    characterIssues: {},
    trackedOcids: ['ocid-1'],
    lastSyncedAt: null,
    loadTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    setTab: vi.fn(),
    goToPreviousPeriod: vi.fn(),
    goToNextPeriod: vi.fn(),
    retryPeriod: vi.fn(),
    setPartySize: vi.fn(),
    setBossDrops: vi.fn(),
  })
}

// 취소가 실제로 동작하는 rAF 목 — no-op 이면 버려진 tween 이 계속 돌아 다음 회차를 오염시킨다.
const frames = new Map<number, (time: number) => void>()
let nextFrameId = 0
let now = 0

function settle(): void {
  for (let guard = 0; guard < 200 && frames.size > 0; guard += 1) {
    now += 60
    const batch = [...frames.values()]
    frames.clear()
    act(() => {
      for (const frame of batch) frame(now)
    })
  }
}

beforeEach(() => {
  frames.clear()
  nextFrameId = 0
  now = 0
  clearCountUpMemory()
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
    nextFrameId += 1
    frames.set(nextFrameId, callback)
    return nextFrameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id)
  })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  clearCountUpMemory()
})

function tree(): React.JSX.Element {
  return (
    <MemoryRouter initialEntries={['/profit']}>
      <BossProfitScreen />
    </MemoryRouter>
  )
}

function headlineTotal(): string {
  const amount = screen.getByText(/총 수익/).parentElement?.parentElement?.querySelector('.text-xl')
  return amount?.textContent?.replace(/[^0-9]/g, '') ?? '없음'
}

function cardTotal(): string {
  return screen.getByRole('button', { name: /낟낟/ }).textContent?.replace(/[^0-9]/g, '') ?? ''
}

/** 기간 이동을 커밋 모양별로 재현한다 — 어느 모양이든 결과가 같아야 한다. */
const COMMIT_SHAPES: Record<string, (rerender: () => void, from: string, to: string) => void> = {
  // periodKey 렌더가 먼저 커밋되고 데이터가 뒤따른다.
  분리: (rerender, from, to) => {
    mockStore({ periodKey: to, dataPeriodKey: from })
    rerender()
    mockStore({ periodKey: to, dataPeriodKey: to })
    rerender()
  },
  // periodKey 와 데이터가 한 커밋에 도착한다(전부 캐시 히트).
  합침: (rerender, _from, to) => {
    mockStore({ periodKey: to, dataPeriodKey: to })
    rerender()
  },
  // 백필이 걸려 로딩 커밋이 사이에 낀다.
  백필: (rerender, from, to) => {
    mockStore({ periodKey: to, dataPeriodKey: from })
    rerender()
    mockStore({ periodKey: to, dataPeriodKey: from, isPeriodLoading: true })
    rerender()
    mockStore({ periodKey: to, dataPeriodKey: to })
    rerender()
  },
  // 로딩 커밋이 중간 렌더를 삼킨다.
  삼킴: (rerender, from, to) => {
    mockStore({ periodKey: to, dataPeriodKey: from, isPeriodLoading: true })
    rerender()
    mockStore({ periodKey: to, dataPeriodKey: to })
    rerender()
  },
}

describe('보스 수익 카운트업 — 기간 이동 (ADR-087 정정 1)', () => {
  describe.each(Object.entries(COMMIT_SHAPES))('커밋 모양: %s', (_shape, move) => {
    it('총 수익은 옛 기간 금액에서 굴러가고, 캐릭터 카드는 굴리지 않는다', () => {
      mockStore({ periodKey: THIS_WEEK, dataPeriodKey: THIS_WEEK })
      const view = render(tree())
      settle()

      move(() => view.rerender(tree()), THIS_WEEK, LAST_WEEK)

      // 총 수익: 아직 옛 기간 금액 — 여기서 목표까지 굴러간다.
      expect(headlineTotal()).toBe(String(TOTAL[THIS_WEEK]))
      // 캐릭터 카드: 굴리지 않고 곧바로 새 기간 금액.
      expect(cardTotal()).toBe(String(TOTAL[LAST_WEEK]))

      settle()
      expect(headlineTotal()).toBe(String(TOTAL[LAST_WEEK]))
      expect(cardTotal()).toBe(String(TOTAL[LAST_WEEK]))
    })

    it('왕복을 반복해도 회차마다 결과가 같다', () => {
      mockStore({ periodKey: THIS_WEEK, dataPeriodKey: THIS_WEEK })
      const view = render(tree())
      settle()

      let at = THIS_WEEK
      for (let round = 1; round <= 6; round += 1) {
        const to = at === THIS_WEEK ? LAST_WEEK : THIS_WEEK

        move(() => view.rerender(tree()), at, to)

        expect(headlineTotal(), `${round}회차 총 수익 출발점`).toBe(String(TOTAL[at]))
        expect(cardTotal(), `${round}회차 카드`).toBe(String(TOTAL[to]))

        settle()
        expect(headlineTotal(), `${round}회차 총 수익 도착점`).toBe(String(TOTAL[to]))
        at = to
      }
    })
  })

  it('같은 기간 안에서 금액이 바뀌면 카드도 굴러간다 (결정 6 유지)', () => {
    mockStore({ periodKey: THIS_WEEK, dataPeriodKey: THIS_WEEK })
    const view = render(tree())
    settle()

    // 파티원 수 편집 등 — loadedPeriodKey 는 그대로고 금액만 바뀐다.
    mockedUseBossProfitStore.mockReturnValue({
      ...mockedUseBossProfitStore.mock.results[0].value,
      rows: [row(THIS_WEEK, 1_000_000)],
    })
    view.rerender(tree())

    expect(cardTotal()).toBe(String(TOTAL[THIS_WEEK]))
    expect(headlineTotal()).toBe(String(TOTAL[THIS_WEEK]))

    settle()
    expect(cardTotal()).toBe('1000000')
    expect(headlineTotal()).toBe('1000000')
  })
})
