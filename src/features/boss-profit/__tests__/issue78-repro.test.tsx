// @vitest-environment jsdom
/**
 * 이슈 #78 사전 조사용 **재현 하네스** (임시 파일 — 제품 코드가 아니다, 커밋 전 판단 필요).
 *
 * 실물을 최대한 그대로 쓴다: features/boss-profit/store, features/schedule-sync/schedule-sync,
 * lib/boss-profit-period, app/boss-profit/BossProfitScreen 전부 실제 구현이고, 기기 경계
 * (storage/*)와 네트워크 경계(nexon/character, nexon/schedule)만 인메모리 더미로 바꿨다.
 * 즉 "더미 데이터를 넣은 실제 앱"이며, 출력되는 문구는 화면이 실제로 렌더한 텍스트다.
 *
 * 실행: npx vitest run src/features/boss-profit/__tests__/issue78-repro.test.tsx --reporter=verbose
 *      (--reporter=verbose 없이는 console 리포트가 표시되지 않는다)
 *
 * 재현 대상
 *  - 시나리오 A/B (질문 1·2): 7월 1·2주차엔 기록이 있고 3·4주차엔 없고 5주차에 다시 있는 캐릭터를
 *    (A) 3·4주차가 아직 롤링 윈도우 안일 때 / (B) 2주 지나 윈도우를 벗어났을 때 각각 조회한다.
 *  - 시나리오 C (월간 탭): 같은 상태를 월간 탭 주차별 합계로 본다.
 *  - 시나리오 D: 2주간 미접속으로 API 조회가 안 되는 캐릭터(access_flag=false 추정).
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const world = vi.hoisted(() => ({
  tracked: [] as string[],
  characters: [] as { ocid: string; name: string; world: string; jobClass: string; level: number }[],
  records: [] as {
    ocid: string
    boss: string
    difficulty: string
    cycle: 'weekly' | 'monthly'
    periodKey: string
    partySize: number
    priceMeso: number
    payoutMeso: number
    recordedAt: string
    world?: string | null
  }[],
  checks: new Set<string>(),
  schedulerCache: new Map<string, { state: unknown; syncedAt: string }>(),
  basicCache: new Map<string, { profile: unknown; cachedAt: string }>(),
  // ocid → (date | undefined) => SchedulerCharacterState (throw 가능)
  apiByOcid: new Map<string, (date?: string) => unknown>(),
  apiCalls: [] as { ocid: string; date: string | null }[],
  writes: [] as string[],
  toasts: [] as string[],
}))

vi.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: async () => world.tracked,
}))

vi.mock('../../../storage/boss-profit', () => ({
  getBossProfitRecords: async (ocids: string[], periodKeys: string[]) =>
    world.records.filter((r) => ocids.includes(r.ocid) && periodKeys.includes(r.periodKey)),
  // SQL의 부등호 비교를 그대로 옮긴다(ADR-068 결정 5) — 월간 탭은 그 달의 weekly 기록도 함께 본다.
  // ADR-069 결정 3: refresh가 NULL 월드를 지금 아는 값으로 채운다(멱등 — world IS NULL 조건).
  fillMissingRecordWorlds: async (worldByOcid: Map<string, string>) => {
    for (const record of world.records) {
      const known = worldByOcid.get(record.ocid)
      if (known !== undefined && record.world == null) record.world = known
    }
  },
  hasBossProfitRecordsAtOrBefore: async (ocids: string[], tab: string, periodKey: string) =>
    world.records.some((r) => {
      if (!ocids.includes(r.ocid)) return false
      if (tab === 'monthly') {
        return r.cycle === 'monthly' ? r.periodKey <= periodKey : r.periodKey.slice(0, 7) <= periodKey
      }
      return r.cycle === 'weekly' && r.periodKey <= periodKey
    }),
  upsertBossProfitRecord: async (record: (typeof world.records)[number]) => {
    const index = world.records.findIndex(
      (r) =>
        r.ocid === record.ocid &&
        r.boss === record.boss &&
        r.difficulty === record.difficulty &&
        r.periodKey === record.periodKey,
    )
    if (index >= 0) world.records[index] = record
    else world.records.push(record)
    world.writes.push(
      `upsert 기록: ${record.ocid} ${record.boss}(${record.difficulty}) ${record.periodKey} = ${record.payoutMeso.toLocaleString()}메소`,
    )
  },
}))

vi.mock('../../../storage/boss-profit-period-checks', () => ({
  isPeriodChecked: async (ocid: string, cycle: string, periodKey: string) =>
    world.checks.has(`${ocid}|${cycle}|${periodKey}`),
  markPeriodChecked: async (ocid: string, cycle: string, periodKey: string) => {
    world.checks.add(`${ocid}|${cycle}|${periodKey}`)
    world.writes.push(`checked 표시: ${ocid} ${cycle} ${periodKey}`)
  },
}))

vi.mock('../../../storage/boss-party-settings', () => ({ getBossPartySize: async () => null }))

vi.mock('../../../storage/boss-drops', () => ({
  getBossDropRecords: async () => [],
  replaceBossDropRecords: async () => undefined,
}))

vi.mock('../../../storage/scheduler-cache', () => ({
  getCachedSchedulerState: async (ocid: string) => world.schedulerCache.get(ocid) ?? null,
  setCachedSchedulerState: async (ocid: string, entry: { state: unknown; syncedAt: string }) => {
    world.schedulerCache.set(ocid, entry)
  },
}))

vi.mock('../../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: async (ocid: string) => world.basicCache.get(ocid) ?? null,
  setCachedCharacterBasic: async (ocid: string, entry: { profile: unknown; cachedAt: string }) => {
    world.basicCache.set(ocid, entry)
  },
  getAllCachedCharacterBasicOcids: async () => [...world.basicCache.keys()],
}))

vi.mock('../../../storage/shared-progress-cache', () => ({
  getWorldSharedProgress: async () => ({}),
  getAccountSharedProgress: async () => ({}),
  setWorldSharedProgressEntry: async () => undefined,
  setAccountSharedProgressEntry: async () => undefined,
}))

vi.mock('../../../storage/api-key', () => ({
  getAuthConfig: async () => ({ apiKey: 'dummy-key', selectedAccountId: 'account-1' }),
}))

vi.mock('../../../storage/tracking-mode', () => ({ getTrackingMode: async () => 'auto' }))

vi.mock('../../../storage/manual-tracked-content', () => ({ getManualTrackedContent: async () => [] }))

vi.mock('../../../nexon/character', () => ({
  fetchCharacterList: async () => [{ accountId: 'account-1', characters: world.characters }],
  fetchCharacterBasic: async (_apiKey: string, ocid: string) => {
    const cached = world.basicCache.get(ocid)
    if (cached === undefined) throw new Error(`더미 character/basic 없음: ${ocid}`)
    return cached.profile
  },
}))

vi.mock('../../../nexon/schedule', () => ({
  fetchSchedulerCharacterState: async (_apiKey: string, ocid: string, date?: string) => {
    world.apiCalls.push({ ocid, date: date ?? null })
    const handler = world.apiByOcid.get(ocid)
    if (handler === undefined) throw new Error(`더미 scheduler 핸들러 없음: ${ocid}`)
    return handler(date)
  },
}))

vi.mock('../../../features/toast/store', () => ({
  useToastStore: {
    getState: () => ({
      showError: (message: string) => {
        world.toasts.push(message)
      },
      showSuccess: () => undefined,
      showInfo: () => undefined,
    }),
  },
}))

import { BossProfitScreen } from '../../../app/boss-profit/BossProfitScreen'
import { findPriceEntry } from '../../../lib/boss-crystal-prices'
import {
  getCurrentBossProfitPeriod,
  getMinQueryableDate,
  isPeriodQueryable,
} from '../../../lib/boss-profit-period'
import { NexonBadRequestError } from '../../../nexon/errors'
import type { BossContent, BossCycle, SchedulerCharacterState } from '../../../types'
import { useBossProfitStore } from '../store'

// ── 더미 세계 ────────────────────────────────────────────────────────────────
const W1 = '2026-07-02'
const W2 = '2026-07-09'
const W3 = '2026-07-16'
const W4 = '2026-07-23'
const W5 = '2026-07-30'

const GAP = { ocid: 'ocid-dummy-gap', name: '틈샘', world: '엘리시움', jobClass: '아크메이지', level: 285 }
const DORMANT = { ocid: 'ocid-dummy-dormant', name: '잠수깨비', world: '엘리시움', jobClass: '나이트로드', level: 270 }

const T_JULY31 = new Date('2026-07-31T05:00:00.000Z') // KST 2026-07-31 14:00 (금) — 5주차 진행 중
const T_AUG14 = new Date('2026-08-14T05:00:00.000Z') // KST 2026-08-14 14:00 (금) — 2주 뒤

function boss(
  name: string,
  difficulty: string,
  cycle: BossCycle,
  complete: boolean,
  registered = true,
): BossContent {
  return {
    name,
    difficulty: difficulty as BossContent['difficulty'],
    cycle,
    isRegistered: registered,
    isComplete: complete,
    ownComplete: complete,
  }
}

function state(character: typeof GAP, bossContents: BossContent[], asOf: string): SchedulerCharacterState {
  return {
    asOf,
    characterName: character.name,
    world: character.world,
    level: character.level,
    jobClass: character.jobClass,
    dailyContents: [
      { name: '더미 일일 퀘스트', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 1, questState: 1 },
    ],
    weeklyContents: [
      { name: '더미 주간 퀘스트', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 1, questState: 1 },
    ],
    bossContents,
    isDailyStale: false,
    isWeeklyStale: false,
    isWeeklyBossStale: false,
    isMonthlyBossStale: false,
  }
}

/** 아무 컨텐츠도 진행하지 않은 주의 응답(ADR-030 — 섹션이 통째로 빈 채로 온다). */
function idleState(character: typeof GAP, asOf: string): SchedulerCharacterState {
  return {
    ...state(character, [], asOf),
    dailyContents: [],
    weeklyContents: [],
    isDailyStale: true,
    isWeeklyStale: true,
    isWeeklyBossStale: true,
    isMonthlyBossStale: true,
  }
}

function record(ocid: string, bossName: string, difficulty: string, cycle: BossCycle, periodKey: string) {
  const price = findPriceEntry(bossName, difficulty as BossContent['difficulty'])?.priceMeso ?? 0
  return {
    ocid,
    boss: bossName,
    difficulty,
    cycle,
    periodKey,
    partySize: 1,
    priceMeso: price,
    payoutMeso: price,
    recordedAt: `${periodKey}T12:00:00.000Z`,
    world: null,
  }
}

function basicEntry(character: typeof GAP, accessFlag: boolean) {
  return {
    profile: {
      name: character.name,
      level: character.level,
      imageUrl: `https://example.invalid/${character.ocid}.png`,
      accessFlag,
      world: character.world,
      guildName: null,
    },
    cachedAt: '2026-07-16T12:00:00.000Z',
  }
}

function resetWorld(): void {
  world.tracked = []
  world.characters = []
  world.records = []
  world.checks = new Set()
  world.schedulerCache = new Map()
  world.basicCache = new Map()
  world.apiByOcid = new Map()
  world.apiCalls = []
  world.writes = []
  world.toasts = []
}

/** 시나리오 A/B/C 공통: 1·2주차 기록 있음 / 3·4주차 비어 있음 / 5주차 기록 있음. */
function seedGapCharacter(options: { markGapWeeksChecked: boolean }): void {
  world.tracked = [GAP.ocid]
  world.characters = [GAP]
  world.basicCache.set(GAP.ocid, basicEntry(GAP, true))

  world.records.push(
    record(GAP.ocid, '자쿰', '카오스', 'weekly', W1),
    record(GAP.ocid, '매그너스', '하드', 'weekly', W1),
    record(GAP.ocid, '자쿰', '카오스', 'weekly', W2),
    record(GAP.ocid, '자쿰', '카오스', 'weekly', W5),
  )
  for (const key of [W1, W2, W5]) world.checks.add(`${GAP.ocid}|weekly|${key}`)
  if (options.markGapWeeksChecked) {
    for (const key of [W3, W4]) world.checks.add(`${GAP.ocid}|weekly|${key}`)
  }

  // 이번 주(=조회 시점의 현재 주) 응답과 과거 date 응답을 날짜로 분기한다.
  world.apiByOcid.set(GAP.ocid, (date) => {
    if (date === undefined) {
      return state(GAP, [boss('자쿰', '카오스', 'weekly', true)], '2026-08-14')
    }
    if (date >= W5) {
      return state(GAP, [boss('자쿰', '카오스', 'weekly', true)], date)
    }
    if (date >= W3) {
      // 3·4주차: 접속하지 않아 아무 것도 없다.
      return idleState(GAP, date)
    }
    // 1·2주차: 롤링 윈도우 밖 — 실제 API라면 조회 자체가 안 된다.
    throw new NexonBadRequestError('더미: 롤링 윈도우를 벗어난 date', 'OPENAPI00004')
  })
  world.schedulerCache.set(GAP.ocid, {
    state: state(GAP, [boss('자쿰', '카오스', 'weekly', true)], '2026-08-14'),
    syncedAt: '2026-08-14T04:00:00.000Z',
  })
}

// ── 하네스 유틸 ──────────────────────────────────────────────────────────────
const report: string[] = []
function line(text = ''): void {
  report.push(text)
}
function flush(title: string): void {
  console.log(`\n${'═'.repeat(78)}\n${title}\n${'═'.repeat(78)}\n${report.join('\n')}\n`)
  report.length = 0
}

function visibleText(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

const NOTICES = [
  '이 기간은 조회할 수 없습니다',
  '아직 처치한 보스가 없습니다',
  '이 기간을 불러오지 못했습니다',
  '불러오고 있어요',
  '기록을 불러오고 있어요',
]

function notices(): string {
  const text = visibleText()
  const found = NOTICES.filter((notice) => text.includes(notice))
  return found.length === 0 ? '(없음)' : found.join(' / ')
}

function prevDisabled(): boolean {
  return (screen.getByLabelText('이전 기간') as HTMLButtonElement).disabled
}

async function renderScreen(): Promise<void> {
  render(
    <MemoryRouter>
      <BossProfitScreen />
    </MemoryRouter>,
  )
  await waitFor(() => {
    expect(useBossProfitStore.getState().status).toBe('loaded')
  })
}

function resetStore(): void {
  useBossProfitStore.setState({
    status: 'idle',
    tab: 'weekly',
    rows: [],
    dropsByRowKey: {},
    weeklySubtotals: [],
    isPeriodLoading: false,
    canGoPreviousPeriod: false,
    error: null,
    staleCharacterNames: [],
    trackedOcids: null,
    lastSyncedAt: null,
  })
}

function snapshot(label: string): void {
  const store = useBossProfitStore.getState()
  line(`── ${label}`)
  line(`   store   periodKey=${store.periodKey} rows=${store.rows.length}건 subtotals=${store.weeklySubtotals.length}건`)
  line(
    `           periodState=${store.periodState} canGoPrev=${store.canGoPreviousPeriod} error=${
      store.error === null ? 'null' : store.error.kind
    }`,
  )
  line(`   화면    이전버튼 ${prevDisabled() ? '비활성(막힘)' : '활성'} · 고지: ${notices()}`)
  line(`   전체텍스트: ${visibleText().slice(0, 260)}`)
}

function expandCharacterCard(name: string): void {
  const header = screen.getAllByRole('button').find((button) => (button.textContent ?? '').includes(name))
  if (header === undefined) throw new Error(`카드 헤더를 찾지 못했다: ${name}`)
  fireEvent.click(header)
}

beforeEach(() => {
  resetWorld()
  resetStore()
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('이슈 #78 재현 — 기록이 끊긴 캐릭터', () => {
  it('시나리오 A: 3·4주차가 아직 롤링 윈도우 안일 때 (KST 2026-07-31)', async () => {
    vi.setSystemTime(T_JULY31)
    seedGapCharacter({ markGapWeeksChecked: false })

    line(`now = KST 2026-07-31 14:00 · 현재 주 = ${getCurrentBossProfitPeriod('weekly', T_JULY31).periodKey}`)
    line(`롤링 조회 하한(오늘-13일) = ${getMinQueryableDate(T_JULY31)}`)
    line(
      `주차별 조회 가능 여부: ${[W1, W2, W3, W4, W5]
        .map((key) => `${key}=${isPeriodQueryable('weekly', key, T_JULY31) ? 'O' : 'X'}`)
        .join(' ')}`,
    )
    line(`DB 사전 상태: 기록 ${world.records.length}건(${W1}×2, ${W2}×1, ${W5}×1) · ${W3}/${W4} 기록 없음·미확인`)
    line()

    await renderScreen()
    snapshot(`5주차(현재 주) ${W5}`)

    for (const label of [`4주차 ${W4}`, `3주차 ${W3}`, `2주차 ${W2}`, `1주차 ${W1}`]) {
      const before = world.apiCalls.length
      await act(async () => {
        await useBossProfitStore.getState().goToPreviousPeriod()
      })
      line()
      snapshot(label)
      const calls = world.apiCalls.slice(before)
      line(`   API     ${calls.length === 0 ? '호출 없음' : calls.map((c) => `date=${c.date}`).join(', ')}`)
    }

    line()
    line(`이 구간에서 쓴 것: ${world.writes.filter((w) => w.startsWith('checked')).join(' | ')}`)
    flush('시나리오 A — 빈 주가 아직 조회 가능한 동안 (질문 1·2)')

    // 3·4주차는 조회해서 "0건"을 확인했고, 1·2주차는 캐시 기록으로 도달할 수 있었다.
    expect(world.checks.has(`${GAP.ocid}|weekly|${W4}`)).toBe(true)
    expect(world.checks.has(`${GAP.ocid}|weekly|${W3}`)).toBe(true)
    expect(useBossProfitStore.getState().periodKey).toBe(W1)
    expect(useBossProfitStore.getState().rows.length).toBe(2)
  })

  it('시나리오 B: 같은 DB, 2주 뒤 — 빈 주를 지나 1·2주차 기록에 도달할 수 있다 (수정 후)', async () => {
    vi.setSystemTime(T_AUG14)
    seedGapCharacter({ markGapWeeksChecked: true }) // 시나리오 A가 남긴 상태

    line(`now = KST 2026-08-14 14:00 · 현재 주 = ${getCurrentBossProfitPeriod('weekly', T_AUG14).periodKey}`)
    line(`롤링 조회 하한(오늘-13일) = ${getMinQueryableDate(T_AUG14)}`)
    line(
      `주차별 조회 가능 여부: ${[W1, W2, W3, W4, W5]
        .map((key) => `${key}=${isPeriodQueryable('weekly', key, T_AUG14) ? 'O' : 'X'}`)
        .join(' ')}`,
    )
    line(`DB: ${W1}·${W2}·${W5} 기록 있음 · ${W3}·${W4} "확인 완료, 기록 0건"(checked)`)
    line()

    await renderScreen()
    snapshot('현재 주 2026-08-13')

    for (const label of ['2026-08-06', `5주차 ${W5}`]) {
      await act(async () => {
        await useBossProfitStore.getState().goToPreviousPeriod()
      })
      line()
      snapshot(label)
    }

    line()
    line('↓ 빈 주(4주차·3주차)를 한 칸씩 지나 기록이 있는 2주차까지 간다')
    for (const label of [`4주차 ${W4}`, `3주차 ${W3}`, `2주차 ${W2}`]) {
      await act(async () => {
        await useBossProfitStore.getState().goToPreviousPeriod()
      })
      line()
      snapshot(label)
    }
    line()
    line('→ 수정 전에는 5주차에서 이전 버튼이 막혀 1·2주차 기록에 영구히 도달할 수 없었다.')
    flush('시나리오 B — 빈 주를 지나 그 이전 기록에 도달한다')

    // 빈 주에서도 게이트가 열려 있다(더 과거에 기록이 있으므로)
    expect(useBossProfitStore.getState().periodKey).toBe(W2)
    expect(useBossProfitStore.getState().rows).toHaveLength(1)
    // 1주차까지 한 칸 더 갈 수 있다
    expect(useBossProfitStore.getState().canGoPreviousPeriod).toBe(true)
    await act(async () => {
      await useBossProfitStore.getState().goToPreviousPeriod()
    })
    expect(useBossProfitStore.getState().periodKey).toBe(W1)
    expect(useBossProfitStore.getState().rows).toHaveLength(2)
  })

  it('시나리오 C: 월간 탭 2026-07 — 빈 주가 0메소로 위장되지 않는다 (수정 후)', async () => {
    vi.setSystemTime(T_AUG14)
    seedGapCharacter({ markGapWeeksChecked: true })

    await renderScreen()
    await act(async () => {
      await useBossProfitStore.getState().setTab('monthly')
    })
    await act(async () => {
      await useBossProfitStore.getState().goToPreviousPeriod() // 2026-08 → 2026-07
    })

    line(`periodKey = ${useBossProfitStore.getState().periodKey} (월간)`)
    line()
    line('주차별 합계(store.weeklySubtotals):')
    for (const subtotal of useBossProfitStore.getState().weeklySubtotals) {
      line(
        `   ${subtotal.periodKey}  state=${subtotal.state.padEnd(11)} ${subtotal.totalMeso.toLocaleString().padStart(12)} 메소`,
      )
    }
    line()
    expandCharacterCard(GAP.name)
    line(`카드를 펼친 화면 텍스트:`)
    line(`   ${visibleText()}`)
    flush('시나리오 C — 월간 탭에서 본 같은 상태 (질문 2)')

    const states = new Map(
      useBossProfitStore.getState().weeklySubtotals.map((subtotal) => [subtotal.periodKey, subtotal.state]),
    )
    expect(states.get(W1)).toBe('recorded')
    expect(states.get(W2)).toBe('recorded')
    // 수정 후: 확인 기록(checked)이 있으므로 "0건 확정"으로 남는다 — 시간이 지나도 조회 불가로
    // 격하되지 않는다(ADR-067 결정 3). 수정 전에는 둘 다 'unavailable'이었다.
    expect(states.get(W3)).toBe('confirmedEmpty')
    expect(states.get(W4)).toBe('confirmedEmpty')
    expect(states.get(W5)).toBe('recorded')
  })
})

describe('이슈 #78 재현 — 2주간 미접속으로 조회할 수 없는 캐릭터', () => {
  function seedDormant(handler: (date?: string) => unknown): void {
    world.tracked = [DORMANT.ocid]
    world.characters = [DORMANT]
    // 마지막으로 성공했던 동기화(3주차) 캐시 — 자쿰·매그너스를 처치한 상태로 굳어 있다.
    world.basicCache.set(DORMANT.ocid, basicEntry(DORMANT, true))
    world.schedulerCache.set(DORMANT.ocid, {
      state: state(
        DORMANT,
        [boss('자쿰', '카오스', 'weekly', true), boss('매그너스', '하드', 'weekly', true)],
        W3,
      ),
      syncedAt: '2026-07-19T12:00:00.000Z',
    })
    world.records.push(
      record(DORMANT.ocid, '자쿰', '카오스', 'weekly', W3),
      record(DORMANT.ocid, '매그너스', '하드', 'weekly', W3),
    )
    world.checks.add(`${DORMANT.ocid}|weekly|${W3}`)
    world.apiByOcid.set(DORMANT.ocid, handler)
  }

  it('D-1: 동기화가 실패한 캐릭터는 자동 기록하지 않는다 (수정 후)', async () => {
    vi.setSystemTime(T_AUG14)
    seedDormant(() => {
      // 이슈 #78 A의 원래 관찰(비-2xx). 실측으로는 비활성 캐릭터도 200이지만, 조회 불가 ocid
      // (OPENAPI00003)에서는 이 형태가 실제로 나온다.
      throw new NexonBadRequestError('조회할 수 없는 ocid', 'OPENAPI00003')
    })

    line(`now = KST 2026-08-14 · 현재 주 = ${getCurrentBossProfitPeriod('weekly', T_AUG14).periodKey}`)
    line(`마지막 성공 동기화: 2026-07-19 (3주차 ${W3}) — 그 주엔 자쿰·매그너스 처치`)
    line()

    await renderScreen()
    const store = useBossProfitStore.getState()

    line(`store.status=${store.status} error=${store.error === null ? 'null' : store.error.kind}`)
    line(`store.staleCharacterNames=${JSON.stringify(store.staleCharacterNames)}`)
    line(`토스트: ${world.toasts.length === 0 ? '(없음)' : world.toasts.join(' | ')}`)
    line(`API 호출: ${world.apiCalls.length}회 ${JSON.stringify(world.apiCalls.map((c) => c.date))}`)
    line()
    line('현재 주(2026-08-13)에 잡힌 행:')
    for (const row of store.rows) {
      line(
        `   ${row.characterName} ${row.boss}(${row.difficulty}) periodKey=${row.periodKey} isComplete=${row.isComplete} payout=${(row.payoutMeso ?? 0).toLocaleString()}메소`,
      )
    }
    line()
    line('이 새로고침이 DB에 쓴 것:')
    line(world.writes.length === 0 ? '   (없음)' : world.writes.map((w) => `   ${w}`).join('\n'))
    line()
    line(`현재 주(${getCurrentBossProfitPeriod('weekly', T_AUG14).periodKey}) 기록: ${world.records.filter((r) => r.periodKey === getCurrentBossProfitPeriod('weekly', T_AUG14).periodKey).length}건`)
    line(`화면: ${visibleText().slice(0, 300)}`)
    line()
    line('→ 수정 전에는 4주 전 처치가 이번 주 수익 16,640,000메소로 영구 기록됐다(ADR-067 결정 7).')
    flush('시나리오 D-1 — 2주 미접속 캐릭터를 새로고침했을 때')

    expect(store.staleCharacterNames).toEqual([DORMANT.name])
    expect(world.toasts.some((message) => message.includes('일부 캐릭터를 불러오지 못했습니다'))).toBe(true)
    // 수정 후: 낡은 캐시로 현재 기간에 기록을 쓰지 않는다 — DB에 이번 주 기록이 생기지 않는다
    const currentWeek = getCurrentBossProfitPeriod('weekly', T_AUG14).periodKey
    expect(world.records.filter((record) => record.periodKey === currentWeek)).toHaveLength(0)
    expect(world.writes.filter((write) => write.startsWith('upsert'))).toHaveLength(0)
  })

  it('D-2: 200이지만 모든 섹션이 빈 경우', async () => {
    vi.setSystemTime(T_AUG14)
    seedDormant((date) => idleState(DORMANT, date ?? '2026-08-14'))

    await renderScreen()
    const store = useBossProfitStore.getState()

    line(`store.status=${store.status} staleCharacterNames=${JSON.stringify(store.staleCharacterNames)}`)
    line(`토스트: ${world.toasts.length === 0 ? '(없음)' : world.toasts.join(' | ')}`)
    line(`API 호출 ${world.apiCalls.length}회: ${JSON.stringify(world.apiCalls.map((c) => c.date))}`)
    line(`현재 주 행 ${store.rows.length}건`)
    for (const row of store.rows) {
      line(`   ${row.boss}(${row.difficulty}) isComplete=${row.isComplete} payout=${row.payoutMeso}`)
    }
    line(`DB 쓰기: ${world.writes.length === 0 ? '(없음)' : world.writes.join(' | ')}`)
    line(`화면: ${visibleText().slice(0, 300)}`)
    flush('시나리오 D-2 — 같은 캐릭터, API가 200 + 빈 섹션을 주는 경우')

    expect(store.error).toBeNull()
  })
})

// ── 실측(2026-07-31, 실제 Nexon API) 응답 형태를 그대로 옮긴 더미 ─────────────
// 비활성(access_flag=false) 캐릭터의 당일 응답: daily는 몬스터파크(world 공유) 1건,
// weekly는 6건(그중 2건이 character 범위!), boss는 bossMonthly 2건만 남는다.
const MEASURED_DORMANT_DAILY = [
  { name: '몬스터파크', kind: 'contents' as const, isRegistered: true, nowCount: 0, maxCount: 14, questState: null },
]
const MEASURED_DORMANT_WEEKLY = [
  { name: '에픽 던전 : 하이마운틴', kind: 'contents' as const, isRegistered: false, nowCount: 0, maxCount: 0, questState: null },
  { name: '에픽 던전 : 앵글러 컴퍼니', kind: 'contents' as const, isRegistered: false, nowCount: 0, maxCount: 0, questState: null },
  { name: '에픽 던전 : 악몽선경', kind: 'contents' as const, isRegistered: true, nowCount: 0, maxCount: 0, questState: null },
  { name: '[메이플 유니온] 주간 드래곤 퇴치', kind: 'quest' as const, isRegistered: false, nowCount: 0, maxCount: 0, questState: 2 as const },
  // ↓ 이 두 건이 character 범위라 "주간 섹션이 신선하다"고 오판된다
  { name: '[메이플 유니온] PC방 주간 드래곤 퇴치', kind: 'quest' as const, isRegistered: false, nowCount: 0, maxCount: 0, questState: 0 as const },
  { name: '[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?', kind: 'quest' as const, isRegistered: true, nowCount: 0, maxCount: 0, questState: 0 as const },
]

describe('이슈 #78 재현 — 실측 응답 형태에서 나오는 문제', () => {
  const IDLE = { ocid: 'ocid-dummy-idle', name: '묻힌달', world: '엘리시움', jobClass: '팔라딘', level: 262 }

  it('H: 축약 응답이어도 이미 기록된 이번 달 월간 수익은 화면에 남는다 (수정 후)', async () => {
    vi.setSystemTime(T_AUG14)
    world.tracked = [IDLE.ocid]
    world.characters = [IDLE]
    world.basicCache.set(IDLE.ocid, basicEntry(IDLE, false))

    // 8월 1일에 검은마법사(하드)를 처치했고 그 기록이 DB에 있다.
    const blackMage = record(IDLE.ocid, '검은마법사', '하드', 'monthly', '2026-08')
    world.records.push(blackMage)
    world.schedulerCache.set(IDLE.ocid, {
      state: state(IDLE, [boss('검은 마법사', '하드', 'monthly', true)], '2026-08-01'),
      syncedAt: '2026-08-01T12:00:00.000Z',
    })

    // 그 뒤 미접속 → 당일 응답이 실측 형태(축약)로 온다.
    world.apiByOcid.set(IDLE.ocid, (date) => {
      if (date === undefined) {
        // 실측: reg=false, comp=false (등록 흔적조차 남지 않는다)
        return {
          ...state(
            IDLE,
            [
              boss('검은 마법사', '하드', 'monthly', false, false),
              boss('검은 마법사', '익스트림', 'monthly', false, false),
            ],
            '2026-08-14',
          ),
          dailyContents: MEASURED_DORMANT_DAILY,
          weeklyContents: MEASURED_DORMANT_WEEKLY,
          isWeeklyBossStale: true, // bossWeekly 0건 → 잡힌다
          isMonthlyBossStale: false, // bossMonthly 2건 → 안 잡힌다 ← 구멍
        }
      }
      // 과거 date 응답에는 그 달의 실제 완료가 그대로 있다(실측: 비활성도 200)
      return state(IDLE, [boss('검은 마법사', '하드', 'monthly', true)], date)
    })

    line(`검은마법사(하드) 기록: ${blackMage.payoutMeso.toLocaleString()}메소 (periodKey=2026-08, DB에 존재)`)
    line('당일 응답: bossMonthly 2건(reg=false, comp=false) · bossWeekly 0건 — 실측 축약 형태')
    line()

    await renderScreen()
    await act(async () => {
      await useBossProfitStore.getState().setTab('monthly')
    })
    const store = useBossProfitStore.getState()
    line(`월간 탭 periodKey=${store.periodKey} rows=${store.rows.length}건`)
    for (const row of store.rows) line(`   ${row.boss}(${row.difficulty}) isComplete=${row.isComplete} payout=${row.payoutMeso}`)
    line(`DB의 2026-08 기록: ${world.records.filter((r) => r.periodKey === '2026-08').length}건`)
    line(`화면: ${visibleText().slice(0, 240)}`)
    line()
    line('→ 수정 전에는 rows=0건이라 "이번 달 총 수익 0 메소"로 보였다(ADR-067 결정 4 표시).')
    flush('시나리오 H — 축약 응답이어도 기록된 월간 수익은 남는다')

    expect(world.records.filter((r) => r.periodKey === '2026-08')).toHaveLength(1)
    // 수정 후: 기록만 있는 조합도 행으로 되살린다(합집합) — 금액이 화면에서 사라지지 않는다
    const blackMageRows = store.rows.filter((row) => row.boss === '검은마법사')
    expect(blackMageRows).toHaveLength(1)
    expect(blackMageRows[0].payoutMeso).toBe(blackMage.payoutMeso)
    expect(visibleText()).toContain(blackMage.payoutMeso.toLocaleString())
  })

  it('I: 보스가 0건인 캐릭터(특수 월드·저레벨)는 매 동기화마다 14회 호출한다', async () => {
    vi.setSystemTime(T_AUG14)
    world.tracked = [IDLE.ocid]
    world.characters = [IDLE]
    world.basicCache.set(IDLE.ocid, basicEntry(IDLE, false))
    // 실측: 스페셜 월드 캐릭터는 당일·과거 모두 boss_contents 0건, daily 1건, weekly 6건
    world.apiByOcid.set(IDLE.ocid, () => ({
      ...state(IDLE, [], '2026-08-14'),
      dailyContents: MEASURED_DORMANT_DAILY,
      weeklyContents: MEASURED_DORMANT_WEEKLY,
      isDailyStale: false,
      isWeeklyStale: false,
      isWeeklyBossStale: true,
      isMonthlyBossStale: true,
    }))

    await renderScreen()
    const first = world.apiCalls.length
    line(`1차 동기화: ${first}회 — ${JSON.stringify(world.apiCalls.map((c) => c.date))}`)
    await act(async () => {
      await useBossProfitStore.getState().refresh([IDLE.ocid])
    })
    line(`2차 동기화(새로고침): 추가 ${world.apiCalls.length - first}회 — 영구히 해결되지 않는다`)
    flush('시나리오 I — 영구 미해결 섹션 백필 루프 (캐릭터 1명당 14회)')

    expect(first).toBe(14)
    expect(world.apiCalls.length - first).toBe(14)
  })
})

describe('이슈 #78 재현 — 백필의 "확인 완료" 판정이 굳는 자리', () => {
  const LEAF = { ocid: 'ocid-dummy-leaf', name: '리프탄', world: '엘리시움', jobClass: '히어로', level: 280 }
  // KST 수요일 23:30 — 주간 리셋(목 00:00) 직전, 사용자 관찰상 API가 불안정해지는 시각
  const T_WED_2330 = new Date('2026-07-29T14:30:00.000Z')

  it('E: 불안정 시각의 빈 응답이 그 주를 영구히 "0메소 확정"으로 굳힌다', async () => {
    vi.setSystemTime(T_WED_2330)
    world.tracked = [LEAF.ocid]
    world.characters = [LEAF]
    world.basicCache.set(LEAF.ocid, basicEntry(LEAF, true))
    world.schedulerCache.set(LEAF.ocid, {
      state: state(LEAF, [boss('자쿰', '카오스', 'weekly', false)], W4),
      syncedAt: '2026-07-29T14:00:00.000Z',
    })
    // 불안정 시각: date 파라미터 조회가 빈 응답을 준다(에러가 아니라 200 + 빈 섹션)
    world.apiByOcid.set(LEAF.ocid, (date) => idleState(LEAF, date ?? '2026-07-29'))

    line(`now = KST 2026-07-29 23:30 (수) · 현재 주 = ${getCurrentBossProfitPeriod('weekly', T_WED_2330).periodKey}`)
    line(`3주차 ${W3} 조회 가능 = ${isPeriodQueryable('weekly', W3, T_WED_2330)}`)
    line('실제로는 그 주에 자쿰·매그너스를 처치했지만, 지금 응답은 비어 있다')
    line()

    await renderScreen()
    await act(async () => {
      await useBossProfitStore.getState().goToPreviousPeriod() // 현재 주(W4) → W3
    })
    line(`1차 방문 ${useBossProfitStore.getState().periodKey}: rows=${useBossProfitStore.getState().rows.length}건 periodState=${useBossProfitStore.getState().periodState}`)
    line(`   API 호출: ${JSON.stringify(world.apiCalls.map((c) => c.date))}`)
    line(`   DB 쓰기: ${world.writes.join(' | ')}`)
    line(`   화면 고지: ${notices()}`)
    line()

    // 다음 날, API가 정상으로 돌아와 그 주의 실제 처치를 반환한다
    world.apiByOcid.set(LEAF.ocid, (date) =>
      state(LEAF, [boss('자쿰', '카오스', 'weekly', true), boss('매그너스', '하드', 'weekly', true)], date ?? W3),
    )
    vi.setSystemTime(new Date('2026-07-30T05:00:00.000Z')) // KST 목 14:00
    const w3QueryDate = '2026-07-22' // getBackfillQueryDate('weekly', W3)
    const w3CallsBefore = world.apiCalls.filter((call) => call.date === w3QueryDate).length
    await act(async () => {
      await useBossProfitStore.getState().goToNextPeriod()
    })
    await act(async () => {
      await useBossProfitStore.getState().goToPreviousPeriod()
    })
    const w3CallsAfter = world.apiCalls.filter((call) => call.date === w3QueryDate).length
    line(`2차 방문(다음 날, API 정상) ${useBossProfitStore.getState().periodKey}: rows=${useBossProfitStore.getState().rows.length}건`)
    line(`   3주차 재조회(date=${w3QueryDate}) 추가 호출: ${w3CallsAfter - w3CallsBefore}회 — checked라 다시 묻지 않는다`)
    line(`   화면 고지: ${notices()}`)
    flush('시나리오 E — 불안정 시각(수 23:30)에 백필한 주가 영구히 0메소로 굳는다')

    expect(world.checks.has(`${LEAF.ocid}|weekly|${W3}`)).toBe(true)
    expect(w3CallsAfter - w3CallsBefore).toBe(0)
    expect(useBossProfitStore.getState().rows).toHaveLength(0)
  })

  it('G: 목요일 00:05 — 쌓아둔 기록이 있으면 백필이 막혀도 실패 문구를 띄우지 않는다(수정 후)', async () => {
    // KST 2026-07-30(목) 00:05 — 주간 리셋 직후. 지난 주(07-23) 조회일 = 07-29 = 오늘−1일.
    vi.setSystemTime(new Date('2026-07-29T15:05:00.000Z'))
    world.tracked = [LEAF.ocid]
    world.characters = [LEAF]
    world.basicCache.set(LEAF.ocid, basicEntry(LEAF, true))

    // 지난 주(07-23) 동안 실시간 동기화로 쌓아둔 기록 — refresh()의 자동 기록이 만든 것.
    world.records.push(
      record(LEAF.ocid, '자쿰', '카오스', 'weekly', W4),
      record(LEAF.ocid, '매그너스', '하드', 'weekly', W4),
    )
    // 그런데 그 주는 checked로 표시된 적이 없다 — markPeriodChecked는 backfillTarget 안에서만
    // 호출되고, 그 주가 "현재 기간"이던 동안에는 백필이 돌지 않았다.
    world.schedulerCache.set(LEAF.ocid, {
      state: state(LEAF, [boss('자쿰', '카오스', 'weekly', false)], '2026-07-30'),
      syncedAt: '2026-07-29T15:00:00.000Z',
    })
    // 실측: date=오늘−1일 → 400 OPENAPI00009 "Please wait until the data is ready"
    world.apiByOcid.set(LEAF.ocid, (date) => {
      if (date === '2026-07-29') throw new NexonBadRequestError('아직 집계 전', 'OPENAPI00009')
      return state(LEAF, [boss('자쿰', '카오스', 'weekly', true)], date ?? '2026-07-30')
    })

    const now = new Date('2026-07-29T15:05:00.000Z')
    line(`now = KST 2026-07-30(목) 00:05 · 현재 주 = ${getCurrentBossProfitPeriod('weekly', now).periodKey}`)
    line(`지난 주 ${W4} 기록: DB에 ${world.records.length}건 (주중 실시간 동기화로 쌓임)`)
    line(`지난 주 checked 표시: ${world.checks.has(`${LEAF.ocid}|weekly|${W4}`)} ← 현재 기간이던 동안엔 아무도 표시하지 않는다`)
    line(`지난 주 조회일 = 2026-07-29 = 오늘−1일 → 실측 400 OPENAPI00009`)
    line()

    await renderScreen()
    const before = world.apiCalls.length
    await act(async () => {
      await useBossProfitStore.getState().goToPreviousPeriod()
    })
    const store = useBossProfitStore.getState()
    line(`지난 주 ${store.periodKey}: rows=${store.rows.length}건 periodState=${useBossProfitStore.getState().periodState}`)
    line(`   이 이동이 쏜 API: ${JSON.stringify(world.apiCalls.slice(before).map((c) => c.date))}`)
    line(`   화면 고지: ${notices()}`)
    line(`   화면: ${visibleText().slice(0, 220)}`)
    line(`   periodState = ${store.periodState}`)
    line()
    line('→ 수정 후: 기록이 화면의 주인이므로 실패 문단을 띄우지 않는다(ADR-068 결정 7).')
    line('   수정 전에는 "이 기간을 불러오지 못했습니다 — 다시 시도해주세요"가 함께 떴다.')
    flush('시나리오 G — 목요일 리셋 직후, 쌓아둔 기록은 그대로 보인다')

    // 기록은 보인다
    expect(store.rows).toHaveLength(2)
    // 기록이 있으므로 화면 상태는 recorded — 실패 문단이 뜨지 않는다
    expect(store.periodState).toBe('recorded')
    expect(store.periodState).toBe('recorded')
    expect(visibleText()).not.toContain('이 기간을 불러오지 못했습니다')
    // 재시도 여지는 남는다(checked로 굳히지 않았다) — 집계가 끝나면 다음 방문에 delta가 채워진다
    expect(world.checks.has(`${LEAF.ocid}|weekly|${W4}`)).toBe(false)
  })

  it('G-2: 백필은 실시간 기록을 파기하지 않고 빠진 것만 채운다', async () => {
    // KST 2026-07-31(금) 14:00 — 지난 주(07-23) 조회일 07-29는 오늘−2일이라 조회 가능하다.
    vi.setSystemTime(T_JULY31)
    world.tracked = [LEAF.ocid]
    world.characters = [LEAF]
    world.basicCache.set(LEAF.ocid, basicEntry(LEAF, true))

    // 주중에 실시간으로 쌓인 기록 — 자쿰만 있고, 사용자가 파티원 수를 3으로 고쳐뒀다.
    const zakumPrice = findPriceEntry('자쿰', '카오스')?.priceMeso ?? 0
    world.records.push({
      ...record(LEAF.ocid, '자쿰', '카오스', 'weekly', W4),
      partySize: 3,
      payoutMeso: Math.floor(zakumPrice / 3),
      recordedAt: '2026-07-25T20:00:00.000Z',
    })
    world.schedulerCache.set(LEAF.ocid, {
      state: state(LEAF, [boss('자쿰', '카오스', 'weekly', false)], '2026-07-31'),
      syncedAt: '2026-07-31T04:00:00.000Z',
    })
    // 그 주 마감 응답에는 자쿰 + 매그너스(리셋 직전에 잡아 기록에 없던 것)가 둘 다 완료로 들어온다.
    world.apiByOcid.set(LEAF.ocid, (date) =>
      state(
        LEAF,
        [boss('자쿰', '카오스', 'weekly', true), boss('매그너스', '하드', 'weekly', true)],
        date ?? '2026-07-31',
      ),
    )

    line('백필 전 DB:')
    for (const r of world.records) {
      line(`   ${r.boss}(${r.difficulty}) partySize=${r.partySize} payout=${r.payoutMeso.toLocaleString()} recordedAt=${r.recordedAt}`)
    }
    line()

    await renderScreen()
    await act(async () => {
      await useBossProfitStore.getState().goToPreviousPeriod()
    })

    line(`백필 후 DB(${W4}):`)
    for (const r of world.records.filter((r) => r.periodKey === W4)) {
      line(`   ${r.boss}(${r.difficulty}) partySize=${r.partySize} payout=${r.payoutMeso.toLocaleString()} recordedAt=${r.recordedAt}`)
    }
    line()
    line(`${W4}에 쓴 것: ${world.writes.filter((w) => w.includes(W4)).join(' | ')}`)
    line(`(현재 주 ${W5}의 upsert는 refresh()의 자동 기록이라 이 시나리오와 무관하다)`)
    line(`화면: ${visibleText().slice(0, 200)}`)
    flush('시나리오 G-2 — 백필은 파기가 아니라 보강(delta fill)이다')

    const w4 = world.records.filter((r) => r.periodKey === W4)
    const zakum = w4.find((r) => r.boss === '자쿰')
    const magnus = w4.find((r) => r.boss === '매그너스')
    // 실시간 기록이 base — 사용자가 고친 파티원 수·기록 시각이 그대로 남는다
    expect(zakum?.partySize).toBe(3)
    expect(zakum?.recordedAt).toBe('2026-07-25T20:00:00.000Z')
    // 빠져 있던 조합만 추가된다
    expect(magnus?.partySize).toBe(1)
    // upsert는 딱 1건(매그너스)만 일어난다
    expect(world.writes.filter((w) => w.startsWith('upsert') && w.includes(W4))).toHaveLength(1)
    expect(w4).toHaveLength(2)
    expect(world.checks.has(`${LEAF.ocid}|weekly|${W4}`)).toBe(true)
  })

  it('F: 월드 리프 이전 기간은 "조회 불가"로 말한다 — 재시도 유도가 아니다(수정 후)', async () => {
    vi.setSystemTime(T_JULY31)
    world.tracked = [LEAF.ocid]
    world.characters = [LEAF]
    world.basicCache.set(LEAF.ocid, basicEntry(LEAF, true))
    world.schedulerCache.set(LEAF.ocid, {
      state: state(LEAF, [boss('자쿰', '카오스', 'weekly', true)], '2026-07-31'),
      syncedAt: '2026-07-31T04:00:00.000Z',
    })
    // 월드 리프: 2026-07-23에 챌린저스2 → 엘리시움. 그 이전 date는 조회되지 않는다(사용자 관찰).
    world.apiByOcid.set(LEAF.ocid, (date) => {
      if (date !== undefined && date < '2026-07-23') {
        // 실측: 리프 이전 날짜는 400 OPENAPI00004 — 윈도우 밖과 코드가 같다
        throw new NexonBadRequestError('더미: 월드 리프 이전 기록', 'OPENAPI00004')
      }
      return state(LEAF, [boss('자쿰', '카오스', 'weekly', true)], date ?? '2026-07-31')
    })

    line(`now = KST 2026-07-31 · 월드 리프: 2026-07-23 챌린저스2 → 엘리시움`)
    line(`4주차 ${W4} 조회일 = 2026-07-29(리프 이후) · 3주차 ${W3} 조회일 = 2026-07-22(리프 이전)`)
    line()

    await renderScreen()
    await act(async () => {
      await useBossProfitStore.getState().goToPreviousPeriod() // W5 → W4
    })
    line(`4주차 ${useBossProfitStore.getState().periodKey}: rows=${useBossProfitStore.getState().rows.length}건 periodState=${useBossProfitStore.getState().periodState} 고지=${notices()}`)

    await act(async () => {
      await useBossProfitStore.getState().goToPreviousPeriod() // W4 → W3 (리프 이전)
    })
    const firstVisitCalls = world.apiCalls.length
    line(`3주차 ${useBossProfitStore.getState().periodKey}: rows=${useBossProfitStore.getState().rows.length}건 periodState=${useBossProfitStore.getState().periodState}`)
    line(`   화면 고지: ${notices()}`)
    line(`   checked 표시: ${world.checks.has(`${LEAF.ocid}|weekly|${W3}`)} (안 함 → 재시도 유도)`)
    line(`   누적 API 호출 ${firstVisitCalls}회: ${JSON.stringify(world.apiCalls.map((c) => c.date))}`)
    line()

    await act(async () => {
      await useBossProfitStore.getState().goToNextPeriod()
    })
    await act(async () => {
      await useBossProfitStore.getState().goToPreviousPeriod()
    })
    line(`재방문: 추가 API 호출 ${world.apiCalls.length - firstVisitCalls}회 — 아직 영속하지 않아 한 번 더 묻는다(후속 과제)`)
    line(`   화면 고지: ${notices()}`)
    flush('시나리오 F — 월드 리프 이전 기간(사용자 실제 ocid의 상황)')

    // 수정 후: API가 알려준 400 OPENAPI00004를 그대로 "조회 불가"로 옮긴다 — 전에는 이 자리가
    // "이 기간을 불러오지 못했습니다 — 다시 시도해주세요"였다(영구 실패에 재시도 유도).
    expect(useBossProfitStore.getState().periodState).toBe('outOfRange')
    expect(useBossProfitStore.getState().periodState).toBe('outOfRange')
    // 아직 영속하지 않으므로 재방문 시 한 번 더 호출한다 — 낭비가 남아 있다(ADR-067 후속).
    expect(world.checks.has(`${LEAF.ocid}|weekly|${W3}`)).toBe(false)
    expect(world.apiCalls.length).toBeGreaterThan(firstVisitCalls)
  })
})
