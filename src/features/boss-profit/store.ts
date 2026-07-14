import { create } from 'zustand'
import { DEFAULT_MAX_PARTY_SIZE, findPriceEntry } from '../../lib/boss-crystal-prices'
import { matchBossContent, type MatchedBoss } from '../../lib/boss-matching'
import {
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  getBackfillQueryDate,
  getCurrentBossProfitPeriod,
  getWeeklyPeriodKeysInMonth,
  isLatestPeriod,
  MIN_SCHEDULER_DATE,
} from '../../lib/boss-profit-period'
import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import { getAuthConfig } from '../../storage/api-key'
import { getBossPartySize } from '../../storage/boss-party-settings'
import { getBossProfitRecords, upsertBossProfitRecord, type BossProfitRecord } from '../../storage/boss-profit'
import { isPeriodChecked, markPeriodChecked } from '../../storage/boss-profit-period-checks'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getCachedSchedulerState } from '../../storage/scheduler-cache'
import type { BossCycle, BossDifficulty } from '../../types'
import { syncSchedules, type ScheduleSyncError } from '../schedule-sync/schedule-sync'

export interface BossProfitRow {
  ocid: string
  characterName: string
  boss: string // matchedBossName ?? apiName (매핑 안 되면 원문 그대로, ADR-008)
  difficulty: BossDifficulty
  cycle: BossCycle
  periodKey: string
  periodLabel: string // formatBossProfitPeriodLabel(cycle, periodKey, now).primary — "이번 주"/"지난 주"/"이번 달"/"지난 달"/절대 표기
  priceMeso: number | null // 시세표에 없으면 null ("가격 미확정"). 기록이 있으면 기록값으로 복원(라이브 재계산 방지, ADR-023)
  maxPartySize: number
  partySize: number | null // 사용자가 아직 입력 안 했으면 null
  payoutMeso: number | null // partySize가 null이거나 priceMeso가 null이면 null
}

export type WeeklySubtotalState = 'confirmed' | 'inProgress' | 'upcoming'

export interface BossProfitWeeklySubtotal {
  ocid: string
  characterName: string
  periodKey: string
  totalMeso: number
  state: WeeklySubtotalState
}

export type BossProfitStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface BossProfitState {
  status: BossProfitStatus
  tab: BossCycle
  periodKey: string // 현재 tab 기준으로 선택된 기간
  rows: BossProfitRow[] // 선택된 (tab, periodKey)의 보스 row. monthly 탭이면 그 달의 monthly-cycle 보스만
  weeklySubtotals: BossProfitWeeklySubtotal[] // monthly 탭에서만 채워짐(주차별 합계). weekly 탭에서는 항상 []
  isPeriodLoading: boolean // periodKey 이동 후 백필(과거 기간 재조회) 진행 중
  periodUnavailable: boolean // 직전 백필 시도가 실패해 이 기간 일부를 지금 볼 수 없음(재시도 가능하도록 checked로 기록하지 않았다는 뜻)
  error: ScheduleSyncError | null
  staleCharacterNames: string[]
  trackedOcids: string[] | null
}

type BossProfitRowKey = Pick<BossProfitRow, 'ocid' | 'boss' | 'difficulty' | 'cycle' | 'periodKey'>

export interface BossProfitStore extends BossProfitState {
  loadTrackedOcids(): Promise<void>
  refresh(ocids: string[]): Promise<void>
  setTab(tab: BossCycle): Promise<void>
  goToPreviousPeriod(): Promise<void>
  goToNextPeriod(): Promise<void>
  setPartySize(row: BossProfitRowKey, partySize: number): Promise<void>
}

// refresh()가 가장 최근에 계산한 "현재 기간" 전체(모든 cycle) row와 그 시점의 캐릭터명을 담아둔다.
// setTab/goToPreviousPeriod/goToNextPeriod가 "현재 기간"으로 되돌아올 때 네트워크 호출 없이
// 이 스냅샷에서 슬라이스하기 위한 용도다(ADR-023 "로컬 우선 캐싱").
interface LatestSyncSnapshot {
  ocids: string[]
  rows: BossProfitRow[]
  characterNames: Map<string, string>
}

let latestSyncSnapshot: LatestSyncSnapshot | null = null

function buildBossProfitRow(
  ocid: string,
  characterName: string,
  boss: MatchedBoss,
  now: Date,
): BossProfitRow {
  const bossName = boss.matchedBossName ?? boss.apiName
  const period = getCurrentBossProfitPeriod(boss.cycle, now)
  const periodLabel = formatBossProfitPeriodLabel(boss.cycle, period.periodKey, now).primary
  const priceEntry = findPriceEntry(bossName, boss.difficulty)
  const priceMeso = priceEntry?.priceMeso ?? null
  const maxPartySize = priceEntry?.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE

  return {
    ocid,
    characterName,
    boss: bossName,
    difficulty: boss.difficulty,
    cycle: boss.cycle,
    periodKey: period.periodKey,
    periodLabel,
    priceMeso,
    maxPartySize,
    partySize: null,
    payoutMeso: null,
  }
}

function buildRowFromRecord(record: BossProfitRecord, characterName: string, now: Date): BossProfitRow {
  const difficulty = record.difficulty as BossDifficulty
  const priceEntry = findPriceEntry(record.boss, difficulty)
  const maxPartySize = priceEntry?.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE

  return {
    ocid: record.ocid,
    characterName,
    boss: record.boss,
    difficulty,
    cycle: record.cycle,
    periodKey: record.periodKey,
    periodLabel: formatBossProfitPeriodLabel(record.cycle, record.periodKey, now).primary,
    priceMeso: record.priceMeso,
    maxPartySize,
    partySize: record.partySize,
    payoutMeso: record.payoutMeso,
  }
}

function mergeRecordsIntoRows(
  rows: BossProfitRow[],
  records: Awaited<ReturnType<typeof getBossProfitRecords>>,
): BossProfitRow[] {
  return rows.map((row) => {
    const record = records.find(
      (candidate) =>
        candidate.ocid === row.ocid &&
        candidate.boss === row.boss &&
        candidate.difficulty === row.difficulty &&
        candidate.periodKey === row.periodKey,
    )
    if (record === undefined) {
      return row
    }
    // ADR-023: priceMeso도 기록값으로 덮어쓴다 — 그렇지 않으면 과거 기록을 다시 보여줄 때
    // 라이브 시세로 조용히 재계산되는 데이터 무결성 버그가 생긴다.
    return { ...row, priceMeso: record.priceMeso, partySize: record.partySize, payoutMeso: record.payoutMeso }
  })
}

function matchesRowKey(row: BossProfitRow, key: BossProfitRowKey): boolean {
  return (
    row.ocid === key.ocid &&
    row.boss === key.boss &&
    row.difficulty === key.difficulty &&
    row.cycle === key.cycle &&
    row.periodKey === key.periodKey
  )
}

function filterRowsForTab(rows: BossProfitRow[], tab: BossCycle, periodKey: string): BossProfitRow[] {
  return rows.filter((row) => row.cycle === tab && row.periodKey === periodKey)
}

function sumRowsPayout(rows: BossProfitRow[]): number {
  return rows.reduce((sum, row) => sum + (row.payoutMeso ?? 0), 0)
}

// tab이 'monthly'일 때 그 달에 포함된 weekly periodKey들을 주차별로 합산한다. 현재 주는
// liveRows(방금 refresh/캐시가 계산해둔 값)에서 바로 합산하고, 지난 주는 로컬 기록을 조회하며,
// 아직 시작하지 않은 미래 주는 0/'upcoming'으로 채운다.
async function buildWeeklySubtotalsForMonth(
  ocids: string[],
  monthPeriodKey: string,
  liveRows: BossProfitRow[],
  knownNames: Map<string, string>,
  now: Date,
): Promise<BossProfitWeeklySubtotal[]> {
  if (ocids.length === 0) {
    return []
  }

  const weekKeys = getWeeklyPeriodKeysInMonth(monthPeriodKey)
  const currentWeeklyPeriodKey = getCurrentBossProfitPeriod('weekly', now).periodKey
  const pastWeekKeys = weekKeys.filter((key) => key < currentWeeklyPeriodKey)
  const pastRecords = pastWeekKeys.length > 0 ? await getBossProfitRecords(ocids, pastWeekKeys) : []

  const subtotals: BossProfitWeeklySubtotal[] = []

  for (const ocid of ocids) {
    const characterName =
      knownNames.get(ocid) ?? (await getCachedCharacterBasic(ocid))?.profile.name ?? null
    if (characterName === null) {
      continue
    }

    for (const weekKey of weekKeys) {
      if (weekKey === currentWeeklyPeriodKey) {
        const totalMeso = sumRowsPayout(
          liveRows.filter((row) => row.ocid === ocid && row.cycle === 'weekly' && row.periodKey === weekKey),
        )
        subtotals.push({ ocid, characterName, periodKey: weekKey, totalMeso, state: 'inProgress' })
      } else if (weekKey > currentWeeklyPeriodKey) {
        subtotals.push({ ocid, characterName, periodKey: weekKey, totalMeso: 0, state: 'upcoming' })
      } else {
        const totalMeso = pastRecords
          .filter((record) => record.ocid === ocid && record.cycle === 'weekly' && record.periodKey === weekKey)
          .reduce((sum, record) => sum + record.payoutMeso, 0)
        subtotals.push({ ocid, characterName, periodKey: weekKey, totalMeso, state: 'confirmed' })
      }
    }
  }

  return subtotals
}

// 과거 기간의 rows를 로컬 기록만으로 구성한다(캐릭터명은 character-basic-cache에서 조회, 캐시가
// 없는 ocid는 결과에서 제외).
async function buildRowsFromRecords(
  ocids: string[],
  cycle: BossCycle,
  periodKey: string,
  now: Date,
): Promise<BossProfitRow[]> {
  if (ocids.length === 0) {
    return []
  }

  const records = (await getBossProfitRecords(ocids, [periodKey])).filter((record) => record.cycle === cycle)
  if (records.length === 0) {
    return []
  }

  const nameCache = new Map<string, string | null>()
  const rows: BossProfitRow[] = []

  for (const record of records) {
    if (!nameCache.has(record.ocid)) {
      const cached = await getCachedCharacterBasic(record.ocid)
      nameCache.set(record.ocid, cached?.profile.name ?? null)
    }
    const characterName = nameCache.get(record.ocid) ?? null
    if (characterName === null) {
      continue
    }
    rows.push(buildRowFromRecord(record, characterName, now))
  }

  return rows
}

interface BackfillTarget {
  ocid: string
  cycle: BossCycle
  periodKey: string
}

function buildBackfillTargets(tab: BossCycle, periodKey: string, ocids: string[], now: Date): BackfillTarget[] {
  const targets: BackfillTarget[] = []

  if (tab === 'weekly') {
    for (const ocid of ocids) {
      targets.push({ ocid, cycle: 'weekly', periodKey })
    }
    return targets
  }

  const currentWeeklyPeriodKey = getCurrentBossProfitPeriod('weekly', now).periodKey
  const weekKeysInMonth = getWeeklyPeriodKeysInMonth(periodKey).filter((key) => key <= currentWeeklyPeriodKey)

  for (const ocid of ocids) {
    targets.push({ ocid, cycle: 'monthly', periodKey })
    for (const weekKey of weekKeysInMonth) {
      targets.push({ ocid, cycle: 'weekly', periodKey: weekKey })
    }
  }

  return targets
}

// 과거 기간 백필: 성공하면 markPeriodChecked를 호출해 다음 방문부터 재조회하지 않게 하고,
// 실패(네트워크/인증 등 어떤 이유든)하면 markPeriodChecked를 호출하지 않아 다음 방문 때 재시도된다.
// 이미 기록된 보스(setPartySize로 override된 값 포함)는 건드리지 않는다 — 기존 refresh() 자동
// 기록 로직과 동일하게 "기록이 없는 조합만" 기본값(파티 관리 설정, 없으면 1)으로 채운다.
// 반환값은 이 target을 이번에 확인할 수 없었는지(periodUnavailable에 반영) 여부다.
async function backfillTarget(target: BackfillTarget, now: Date): Promise<boolean> {
  const date = getBackfillQueryDate(target.cycle, target.periodKey)

  // 스케줄러 API가 존재하기 이전 기간(ADR-023 "추가 확인") — 재시도해도 영구히 실패하므로
  // API를 호출하지 않고 곧바로 "확인 완료, 기록 없음"으로 처리한다. periodUnavailable(재시도
  // 유도)이 아니라 일반적인 "기록 없음"과 동일하게 다룬다 — 이 기간은 애초에 데이터가 없다.
  if (date < MIN_SCHEDULER_DATE) {
    await markPeriodChecked(target.ocid, target.cycle, target.periodKey, now.toISOString())
    return false
  }

  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    return true
  }

  try {
    const state = await fetchSchedulerCharacterState(authConfig.apiKey, target.ocid, date)
    const completedBosses = state.bossContents
      .map(matchBossContent)
      .filter((boss) => boss.cycle === target.cycle && boss.isComplete)

    const existingRecords = await getBossProfitRecords([target.ocid], [target.periodKey])

    for (const boss of completedBosses) {
      const bossName = boss.matchedBossName ?? boss.apiName
      const alreadyRecorded = existingRecords.some(
        (record) =>
          record.ocid === target.ocid &&
          record.boss === bossName &&
          record.difficulty === boss.difficulty &&
          record.periodKey === target.periodKey,
      )
      if (alreadyRecorded) {
        continue
      }

      const priceEntry = findPriceEntry(bossName, boss.difficulty)
      if (priceEntry === undefined || priceEntry.priceMeso === null) {
        continue
      }

      const configuredPartySize = await getBossPartySize(target.ocid, bossName, boss.difficulty)
      const partySize = configuredPartySize ?? 1
      const payoutMeso = Math.floor(priceEntry.priceMeso / partySize)

      await upsertBossProfitRecord({
        ocid: target.ocid,
        boss: bossName,
        difficulty: boss.difficulty,
        cycle: target.cycle,
        periodKey: target.periodKey,
        partySize,
        priceMeso: priceEntry.priceMeso,
        payoutMeso,
        recordedAt: now.toISOString(),
      })
    }

    await markPeriodChecked(target.ocid, target.cycle, target.periodKey, now.toISOString())
    return false
  } catch {
    return true
  }
}

type BossProfitSetter = (partial: Partial<BossProfitState>) => void

// "기간 로드" 규칙(ADR-023): 이동한 periodKey가 그 tab의 현재 기간이면 네트워크 호출 없이
// 최근 refresh가 채워둔 스냅샷에서 슬라이스하고, 과거 기간이면 로컬 우선(이미 체크된 조합은
// API 호출 없이 로컬 기록만 읽고, 체크 안 된 조합만 순차적으로 백필한다).
async function loadPeriod(
  set: BossProfitSetter,
  tab: BossCycle,
  periodKey: string,
  ocids: string[],
  now: Date,
): Promise<void> {
  const currentPeriodKey = getCurrentBossProfitPeriod(tab, now).periodKey

  if (periodKey === currentPeriodKey) {
    const rows =
      latestSyncSnapshot === null ? [] : filterRowsForTab(latestSyncSnapshot.rows, tab, periodKey)
    const weeklySubtotals =
      tab === 'monthly'
        ? await buildWeeklySubtotalsForMonth(
            ocids,
            periodKey,
            latestSyncSnapshot?.rows ?? [],
            latestSyncSnapshot?.characterNames ?? new Map(),
            now,
          )
        : []
    set({ rows, weeklySubtotals, isPeriodLoading: false, periodUnavailable: false })
    return
  }

  const targets = buildBackfillTargets(tab, periodKey, ocids, now)
  const uncheckedTargets: BackfillTarget[] = []
  for (const target of targets) {
    const checked = await isPeriodChecked(target.ocid, target.cycle, target.periodKey)
    if (!checked) {
      uncheckedTargets.push(target)
    }
  }

  let periodUnavailable = false

  if (uncheckedTargets.length > 0) {
    set({ isPeriodLoading: true, periodUnavailable: false })
    for (const target of uncheckedTargets) {
      const failed = await backfillTarget(target, now)
      if (failed) {
        periodUnavailable = true
      }
    }
  }

  const rows = await buildRowsFromRecords(ocids, tab, periodKey, now)
  const weeklySubtotals =
    tab === 'monthly' ? await buildWeeklySubtotalsForMonth(ocids, periodKey, [], new Map(), now) : []

  set({ rows, weeklySubtotals, isPeriodLoading: false, periodUnavailable })
}

const initialState: BossProfitState = {
  status: 'idle',
  tab: 'weekly',
  periodKey: getCurrentBossProfitPeriod('weekly', new Date()).periodKey,
  rows: [],
  weeklySubtotals: [],
  isPeriodLoading: false,
  periodUnavailable: false,
  error: null,
  staleCharacterNames: [],
  trackedOcids: null,
}

export const useBossProfitStore = create<BossProfitStore>()((set, get) => ({
  ...initialState,

  async loadTrackedOcids() {
    const ocids = await getTrackedCharacterOcids('boss')
    set({ trackedOcids: ocids })
    if (ocids !== null) {
      await get().refresh(ocids)
    }
  },

  async refresh(ocids) {
    const tab = get().tab
    const now = new Date()
    const currentPeriodKey = getCurrentBossProfitPeriod(tab, now).periodKey

    if (ocids.length === 0) {
      latestSyncSnapshot = { ocids: [], rows: [], characterNames: new Map() }
      set({
        status: 'loaded',
        periodKey: currentPeriodKey,
        rows: [],
        weeklySubtotals: [],
        isPeriodLoading: false,
        periodUnavailable: false,
        error: null,
        staleCharacterNames: [],
      })
      return
    }

    // ADR-017 결정 1: 캐시 우선 표시 — 재검증(syncSchedules) 전에 마지막으로 성공한
    // 스케줄 캐시가 있으면 완료된 보스만 걸러 화면을 먼저 채운다. 이미 저장된 기록이
    // 있으면 함께 조회해 partySize/payoutMeso도 바로 보여준다(단순 읽기이므로 안전) —
    // 다만 기록이 없는 조합에 대한 자동 기록(upsert)은 이 단계에서 하지 않는다. 낡은
    // 캐시를 기준으로 잘못된 파티원 수를 기록해버리는 걸 막기 위해, 자동 기록은 지금처럼
    // 실제 재검증(syncSchedules) 이후에만 수행한다.
    const cachedRows = (
      await Promise.all(
        ocids.map(async (ocid): Promise<BossProfitRow[]> => {
          const cached = await getCachedSchedulerState(ocid)
          if (cached === null) {
            return []
          }
          const bosses = cached.state.bossContents.map(matchBossContent)
          const completedBosses = bosses.filter((boss) => boss.isComplete)
          return completedBosses.map((boss) =>
            buildBossProfitRow(ocid, cached.state.characterName, boss, now),
          )
        }),
      )
    ).flat()

    const cachedPeriodKeys = Array.from(new Set(cachedRows.map((row) => row.periodKey)))
    const cachedRecords =
      cachedRows.length > 0 ? await getBossProfitRecords(ocids, cachedPeriodKeys) : []
    const cachedMergedRows = mergeRecordsIntoRows(cachedRows, cachedRecords)

    // latestSyncSnapshot을 캐시 데이터로 즉시 채워둔다 — 이후 syncSchedules가 실패해도(네트워크
    // 등) 이 스냅샷이 null로 남지 않아야, 그 상태에서 tab 전환/기간 이동(loadPeriod)을 해도
    // 캐시 우선 표시(ADR-016/017)가 계속 유지된다. 실시간 동기화가 성공하면 아래에서 다시
    // 최신 데이터로 덮어쓴다.
    const cachedCharacterNames = new Map(cachedRows.map((row) => [row.ocid, row.characterName]))
    latestSyncSnapshot = { ocids: [...ocids], rows: cachedMergedRows, characterNames: cachedCharacterNames }

    set({
      status: 'loading',
      periodKey: currentPeriodKey,
      rows: filterRowsForTab(cachedMergedRows, tab, currentPeriodKey),
      weeklySubtotals: [],
      isPeriodLoading: false,
      periodUnavailable: false,
      error: null,
      staleCharacterNames: [],
    })

    let results: Awaited<ReturnType<typeof syncSchedules>>
    try {
      results = await syncSchedules(ocids)
    } catch {
      // syncSchedules 자체가 던지는 에러(온보딩 미완료 등)는
      // 캐릭터별 에러가 아니라 전체 조회 자체의 실패이므로 network로 취급한다.
      set({ status: 'error', error: { kind: 'network' } })
      return
    }

    const rows: BossProfitRow[] = []
    const staleCharacterNames: string[] = []
    const characterNames = new Map<string, string>()

    for (const result of results) {
      characterNames.set(result.ocid, result.characterName)

      if (result.isStale) {
        staleCharacterNames.push(result.characterName)
      }

      const bosses = result.state?.bossContents.map(matchBossContent) ?? []
      const completedBosses = bosses.filter((boss) => boss.isComplete)

      for (const boss of completedBosses) {
        rows.push(buildBossProfitRow(result.ocid, result.characterName, boss, now))
      }
    }

    const periodKeys = Array.from(new Set(rows.map((row) => row.periodKey)))
    const records = await getBossProfitRecords(ocids, periodKeys)
    const mergedRows = mergeRecordsIntoRows(rows, records)

    // ADR-014/ADR-019: 기록이 없는 완료 보스는 화면 진입 전에도 즉시 기본 파티원 수로 자동 기록한다.
    // 기본값은 boss_party_settings(파티 관리) 조회 결과, 없으면 1(솔로)이다.
    // upsertBossProfitRecord는 단일 공유 SQLite 커넥션에 자체 트랜잭션을 열므로,
    // Promise.all로 동시 실행하면 트랜잭션이 겹쳐 에러가 난다 — 순차 실행으로 처리한다.
    const autoRecordedRows: BossProfitRow[] = []
    for (const row of mergedRows) {
      if (row.partySize !== null || row.priceMeso === null) {
        autoRecordedRows.push(row)
        continue
      }

      const configuredPartySize = await getBossPartySize(row.ocid, row.boss, row.difficulty)
      const partySize = configuredPartySize ?? 1
      const payoutMeso = Math.floor(row.priceMeso / partySize)

      await upsertBossProfitRecord({
        ocid: row.ocid,
        boss: row.boss,
        difficulty: row.difficulty,
        cycle: row.cycle,
        periodKey: row.periodKey,
        partySize,
        priceMeso: row.priceMeso,
        payoutMeso,
        recordedAt: now.toISOString(),
      })

      autoRecordedRows.push({ ...row, partySize, payoutMeso })
    }

    latestSyncSnapshot = { ocids: [...ocids], rows: autoRecordedRows, characterNames }

    const weeklySubtotals =
      tab === 'monthly'
        ? await buildWeeklySubtotalsForMonth(ocids, currentPeriodKey, autoRecordedRows, characterNames, now)
        : []

    set({
      status: 'loaded',
      periodKey: currentPeriodKey,
      rows: filterRowsForTab(autoRecordedRows, tab, currentPeriodKey),
      weeklySubtotals,
      isPeriodLoading: false,
      periodUnavailable: false,
      error: null,
      staleCharacterNames,
    })
  },

  async setTab(tab) {
    const now = new Date()
    const periodKey = getCurrentBossProfitPeriod(tab, now).periodKey
    const ocids = latestSyncSnapshot?.ocids ?? get().trackedOcids ?? []
    set({ tab, periodKey })
    await loadPeriod(set, tab, periodKey, ocids, now)
  },

  async goToPreviousPeriod() {
    const { tab, periodKey } = get()
    const now = new Date()
    const newPeriodKey = getAdjacentPeriodKey(tab, periodKey, 'prev')
    const ocids = latestSyncSnapshot?.ocids ?? get().trackedOcids ?? []
    set({ periodKey: newPeriodKey })
    await loadPeriod(set, tab, newPeriodKey, ocids, now)
  },

  async goToNextPeriod() {
    const { tab, periodKey } = get()
    const now = new Date()
    if (isLatestPeriod(tab, periodKey, now)) {
      return
    }
    const newPeriodKey = getAdjacentPeriodKey(tab, periodKey, 'next')
    const ocids = latestSyncSnapshot?.ocids ?? get().trackedOcids ?? []
    set({ periodKey: newPeriodKey })
    await loadPeriod(set, tab, newPeriodKey, ocids, now)
  },

  async setPartySize(rowKey, partySize) {
    const row = get().rows.find((candidate) => matchesRowKey(candidate, rowKey))
    if (row === undefined) {
      throw new Error('setPartySize: 존재하지 않는 보스 행입니다')
    }

    if (!Number.isInteger(partySize) || partySize < 1 || partySize > row.maxPartySize) {
      throw new Error(`setPartySize: 파티원 수는 1 이상 ${row.maxPartySize} 이하의 정수여야 합니다`)
    }

    const payoutMeso = row.priceMeso === null ? null : Math.floor(row.priceMeso / partySize)

    if (row.priceMeso !== null) {
      await upsertBossProfitRecord({
        ocid: row.ocid,
        boss: row.boss,
        difficulty: row.difficulty,
        cycle: row.cycle,
        periodKey: row.periodKey,
        partySize,
        priceMeso: row.priceMeso,
        payoutMeso: payoutMeso as number,
        recordedAt: new Date().toISOString(),
      })
    }

    set({
      rows: get().rows.map((candidate) =>
        matchesRowKey(candidate, rowKey) ? { ...candidate, partySize, payoutMeso } : candidate,
      ),
    })
  },
}))
