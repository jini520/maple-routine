import { create } from 'zustand'
import bossCrystalPricesData from '../../data/boss-crystal-prices.json'
import { matchBossContent, type MatchedBoss } from '../../lib/boss-matching'
import { getCurrentBossProfitPeriod } from '../../lib/boss-profit-period'
import {
  getBossProfitRecords,
  getLatestPartySize,
  upsertBossProfitRecord,
} from '../../storage/boss-profit'
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
  periodLabel: string // "이번 주" | "이번 달"
  priceMeso: number | null // 시세표에 없으면 null ("가격 미확정")
  maxPartySize: number
  partySize: number | null // 사용자가 아직 입력 안 했으면 null
  payoutMeso: number | null // partySize가 null이거나 priceMeso가 null이면 null
}

export type BossProfitStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface BossProfitState {
  status: BossProfitStatus
  rows: BossProfitRow[]
  error: ScheduleSyncError | null
  staleCharacterNames: string[]
  trackedOcids: string[] | null
}

type BossProfitRowKey = Pick<BossProfitRow, 'ocid' | 'boss' | 'difficulty' | 'cycle' | 'periodKey'>

export interface BossProfitStore extends BossProfitState {
  loadTrackedOcids(): Promise<void>
  refresh(ocids: string[]): Promise<void>
  setPartySize(row: BossProfitRowKey, partySize: number): Promise<void>
}

interface CrystalPriceEntry {
  boss: string
  difficulty: string
  priceMeso: number | null
  maxPartySize?: number
}

const CRYSTAL_PRICES = bossCrystalPricesData.prices as CrystalPriceEntry[]
const DEFAULT_MAX_PARTY_SIZE = bossCrystalPricesData.partySizeScaling.defaultMaxPartySize

function findPriceEntry(boss: string, difficulty: BossDifficulty): CrystalPriceEntry | undefined {
  return CRYSTAL_PRICES.find((entry) => entry.boss === boss && entry.difficulty === difficulty)
}

function buildBossProfitRow(
  ocid: string,
  characterName: string,
  boss: MatchedBoss,
  now: Date,
): BossProfitRow {
  const bossName = boss.matchedBossName ?? boss.apiName
  const period = getCurrentBossProfitPeriod(boss.cycle, now)
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
    periodLabel: period.label,
    priceMeso,
    maxPartySize,
    partySize: null,
    payoutMeso: null,
  }
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

const initialState: BossProfitState = {
  status: 'idle',
  rows: [],
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
    if (ocids.length === 0) {
      set({ status: 'loaded', rows: [], error: null, staleCharacterNames: [] })
      return
    }

    const now = new Date()

    // ADR-017 결정 1: 캐시 우선 표시 — 재검증(syncSchedules) 전에 마지막으로 성공한
    // 스케줄 캐시가 있으면 완료된 보스만 걸러 화면을 먼저 채운다. 이 단계는 화면을
    // 비워두지 않는 용도일 뿐이라 boss_profit_records 조회/기록은 하지 않는다.
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

    set({ status: 'loading', rows: cachedRows, error: null, staleCharacterNames: [] })

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

    for (const result of results) {
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

    const mergedRows = rows.map((row) => {
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
      return { ...row, partySize: record.partySize, payoutMeso: record.payoutMeso }
    })

    // ADR-014: 기록이 없는 완료 보스는 화면 진입 전에도 즉시 기본 파티원 수로 자동 기록한다.
    // upsertBossProfitRecord는 단일 공유 SQLite 커넥션에 자체 트랜잭션을 열므로,
    // Promise.all로 동시 실행하면 트랜잭션이 겹쳐 에러가 난다 — 순차 실행으로 처리한다.
    const autoRecordedRows: BossProfitRow[] = []
    for (const row of mergedRows) {
      if (row.partySize !== null || row.priceMeso === null) {
        autoRecordedRows.push(row)
        continue
      }

      const latestPartySize = await getLatestPartySize(row.ocid, row.boss, row.difficulty)
      const partySize = latestPartySize ?? 1
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

    set({ status: 'loaded', rows: autoRecordedRows, error: null, staleCharacterNames })
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
