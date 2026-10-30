/**
 * 보스 수익 화면의 **화면 상태와 쓰기**. 보던 탭 · 기간, 미완료 행의 파티 계획, 그리고 기록을 쓰는 액션이다.
 *
 * 기간의 데이터는 여기 없다. `bossProfitPeriod(tab, periodKey)` 쿼리가 들고(`period-query.ts`) 화면이 `useBossProfitPeriod`
 * 로 본다. 쓰기는 기록만 쓴다. 쓴 기록이 표의 판을 올리면 그 표를 읽는 쿼리가 무효화되어 화면이 맞는다. 전에는 스토어가
 * 동기화 · 자동 기록 · 기간 표까지 들어, 그 사본들이 캐시와 어긋나는 자리가 결함이 됐다.
 */
import { create } from 'zustand'

import {
  getCurrentBossProfitPeriod,
  isLatestPeriod,
} from '../../lib/boss/boss-profit-period'
import { crystalPayoutMeso, type PartyShares } from '../../lib/boss/party-shares'
import { resetWeekStartOf } from '../../lib/calendar'
import { getBossPartySettings } from '../../storage/boss-party-settings'
import {
  getBossPartyPeriodOverrides,
  setBossPartyPeriodOverride,
} from '../../storage/boss-party-period-overrides'
import { replaceBossDropRecords } from '../../storage/boss-drops'
import { upsertBossProfitRecord } from '../../storage/boss-profit'
import type { RecordedDrop } from '../../types/drops'
import type { BossCycle, BossDifficulty } from '../../types'
import { countCoreSave } from '../app-review/request'
import {
  cancelManualCompletion,
  saveManualCompletion,
} from '../manual-completion/record'
import { reportDropPrice, reportDropRemoved } from '../server-sync/drop-price-sync'
import { readTrackedOcidsSync } from '../schedule-sync/read-schedule'
import { buildPartyPlans, partyPlanKey, type BossPartyPlan } from './party-plans'
import { readPeriodSnapshot, refetchPeriod } from './period-query'
import { resolveDisplayOcids } from './period-snapshot'
import { resolveNextPeriodKey, resolvePreviousPeriodKey } from './period-navigation'
import { dropRowKey, matchesRowKey, type BossProfitRow, type BossProfitRowKey } from './rows'
import { withSqliteFallback } from './sqlite-guards'

// 행과 소계 타입의 정의 위치는 `rows.ts` · `period-snapshot.ts` 지만 공개 경로는 그대로 둔다. 화면이 여기서 가져온다.
export type { BossProfitRow } from './rows'
export { dropRowKey } from './rows'
export type { BossProfitWeeklySubtotal, WeeklySubtotalState } from './period-snapshot'

export interface BossProfitState {
  tab: BossCycle
  /** 보고 있는 기간. 지금 탭 기준이다. */
  periodKey: string
  /**
   * `partyPlanKey(ocid, bossKey, difficulty, periodKey)` → **미완료 행이 그릴** 파티 인원과 비율.
   *
   * 파티 관리 설정을 깔고 그 기간에 갈라진 값이 있으면 그것이 이긴다. 못 찾은 행은 `SOLO_PARTY_PLAN` 으로 선다.
   * 파티 설정 표에는 판이 없어 쿼리로 두지 않는다. 설정을 바꾸는 쓰기가 이 스토어 안에 있어 그 자리에서 맞춘다.
   */
  partyPlans: Record<string, BossPartyPlan>
}

export interface BossProfitStore extends BossProfitState {
  setTab(tab: BossCycle): void
  /** 지금 탭의 현재 기간으로 돌아온다. 이미 거기면 아무 일도 없다 */
  goToCurrentPeriod(): void
  /**
   * 주간 탭의 현재 기간으로 돌린다. 보스 수익 화면이 언마운트될 때, 곧 수익·지출을 떠날 때 부른다. 옆 탭인 가계부가
   * 떠나면 주간 · 이번 주로 돌아오는 것과 맞춘다.
   */
  resetToCurrentWeek(): void
  goToPreviousPeriod(): Promise<void>
  goToNextPeriod(): Promise<void>
  /** 지금 보고 있는 기간을 신선해도 다시 읽는다. 재시도(`failed`)와 조회(`notChecked`)가 부른다. */
  retryPeriod(): Promise<void>
  /** 미완료 행이 그릴 파티 인원과 비율을 읽어 둔다. 설정 + 그 기간에 갈라진 값. */
  loadPartyPlans(ocids: string[], now: Date): Promise<void>
  /**
   * 그 행의 파티 인원과 분배 비율. **파티 관리 설정은 안 건드린다.**
   *
   * 완료 행이면 그 기록 한 건을 다시 세고, 미완료 행이면 그 기간만의 값이 된다. 비율을 함께 받는 것은 둘이 따로 가면
   * 금액과 표기가 갈리기 때문이다. 균등으로 되돌리는 것도 `shares` 를 전부 `null` 로 넘기는 이 길 하나다.
   */
  setRowParty(row: BossProfitRowKey, input: { partySize: number; shares: PartyShares }): Promise<void>
  /**
   * 직접 적은 완료를 쓰거나 고친다. 쓰고 나서 적은 날짜의 주로 데려간다(사용자 지정).
   *
   * 난이도를 바꾸면 기록 키가 바뀌므로 옛 줄을 지우고 드롭을 새 키로 옮긴다. 그 일은 `features/manual-completion/record` 가 한다.
   */
  saveManualCompletion(
    row: BossProfitRowKey,
    input: { difficulty: BossDifficulty; dateKey: string; partySize: number; shares: PartyShares },
  ): Promise<void>
  /** 직접 적은 완료를 취소한다. **그 기록의 드롭도 함께 지운다.** */
  cancelManualCompletion(row: BossProfitRowKey): Promise<void>
  setBossDrops(row: BossProfitRowKey, drops: RecordedDrop[]): Promise<void>
}

/** 미완료 행이 설 수 있는 기간 둘. 지금 주차와 지금 달이다. 과거 기간의 행은 기록에서 나와 전부 완료다. */
function currentPartyPlanPeriodKeys(now: Date): string[] {
  return [
    getCurrentBossProfitPeriod('weekly', now).periodKey,
    getCurrentBossProfitPeriod('monthly', now).periodKey,
  ]
}

/** 보고 있는 기간의 행 하나. 쿼리 캐시에서 찾는다. 없으면 그 행이 화면에 없다는 뜻이라 던진다. */
function findRow(tab: BossCycle, periodKey: string, key: BossProfitRowKey, action: string): BossProfitRow {
  const row = readPeriodSnapshot(tab, periodKey)?.rows.find((candidate) => matchesRowKey(candidate, key))
  if (row === undefined) {
    throw new Error(`${action}: 존재하지 않는 보스 행입니다`)
  }
  return row
}

export const useBossProfitStore = create<BossProfitStore>()((set, get) => ({
  tab: 'weekly',
  periodKey: getCurrentBossProfitPeriod('weekly', new Date()).periodKey,
  partyPlans: {},

  setTab(tab) {
    set({ tab, periodKey: getCurrentBossProfitPeriod(tab, new Date()).periodKey })
  },

  goToCurrentPeriod() {
    const { tab, periodKey } = get()
    const currentPeriodKey = getCurrentBossProfitPeriod(tab, new Date()).periodKey
    if (periodKey === currentPeriodKey) return
    set({ periodKey: currentPeriodKey })
  },

  resetToCurrentWeek() {
    if (get().tab !== 'weekly') {
      get().setTab('weekly')
      return
    }
    get().goToCurrentPeriod()
  },

  async goToPreviousPeriod() {
    const { tab, periodKey } = get()
    // 화면 이전 버튼과 같은 판정이다. 더 과거에 기록이 없으면 이동하지 않는다.
    if (readPeriodSnapshot(tab, periodKey)?.canGoPreviousPeriod !== true) return
    // **갈 곳은 그리는 목록으로 고른다.** 화살표가 사는지도 이 목록으로 판정하므로 추적 목록으로 고르면 둘이 갈려,
    // 관리 목록에서 뺀 캐릭터의 기록만 있는 기간을 건너뛰고 그 앞으로 넘어간다(사용자 보고).
    const navigationOcids = await resolveDisplayOcids(readTrackedOcidsSync() ?? [])
    // **한 칸이 아니라 기록이 있는 가장 가까운 기간이다.** 오래 쉬었다 돌아오면 그 사이가 전부 조회 불가라, 한 칸씩
    // 걸으면 예전 기록에 닿는 데 수십 번이 든다.
    const newPeriodKey = await resolvePreviousPeriodKey(tab, periodKey, navigationOcids)
    if (newPeriodKey === null) return
    // 찾는 사이에 다른 이동이 들어왔으면 이 답은 다른 기간의 것이다.
    if (get().tab !== tab || get().periodKey !== periodKey) return
    set({ periodKey: newPeriodKey })
  },

  async goToNextPeriod() {
    const { tab, periodKey } = get()
    const now = new Date()
    if (isLatestPeriod(tab, periodKey, now)) return
    const navigationOcids = await resolveDisplayOcids(readTrackedOcidsSync() ?? [])
    const newPeriodKey = await resolveNextPeriodKey(tab, periodKey, navigationOcids, now)
    if (newPeriodKey === null) return
    if (get().tab !== tab || get().periodKey !== periodKey) return
    set({ periodKey: newPeriodKey })
  },

  async retryPeriod() {
    const { tab, periodKey } = get()
    await refetchPeriod(tab, periodKey)
  },

  async loadPartyPlans(ocids, now) {
    if (ocids.length === 0) {
      set({ partyPlans: {} })
      return
    }
    const periodKeys = currentPartyPlanPeriodKeys(now)
    const [settings, overrides] = await Promise.all([
      withSqliteFallback(getBossPartySettings(ocids), []),
      withSqliteFallback(getBossPartyPeriodOverrides(ocids, periodKeys), []),
    ])
    set({ partyPlans: buildPartyPlans(settings, overrides, periodKeys) })
  },

  async setRowParty(rowKey, { partySize, shares }) {
    const row = findRow(get().tab, get().periodKey, rowKey, 'setRowParty')

    if (!Number.isInteger(partySize) || partySize < 1 || partySize > row.maxPartySize) {
      throw new Error(`setRowParty: 파티원 수는 1 이상 ${row.maxPartySize} 이하의 정수여야 합니다`)
    }

    // 아직 안 잡은 보스는 기록이 아니라 **그 기간만의 값**으로 간다. 기록 표에 쓰면 그 조합이 완료로 읽혀
    // (`mergeRecordsIntoRows`) 잡지도 않은 보스가 완료로 선다.
    if (!row.isComplete) {
      const plan: BossPartyPlan = {
        partySize,
        crystalMyShare: shares.myShare,
        crystalSharesTotal: shares.sharesTotal,
        splitFeePercent: shares.splitFeePercent,
        splitFeeAuto: shares.splitFeeAuto === true,
      }
      await setBossPartyPeriodOverride({
        ocid: row.ocid,
        bossKey: row.bossKey,
        difficulty: row.difficulty,
        periodKey: row.periodKey,
        ...plan,
        updatedAt: new Date().toISOString(),
      })
      set({
        partyPlans: {
          ...get().partyPlans,
          [partyPlanKey(row.ocid, row.bossKey, row.difficulty, row.periodKey)]: plan,
        },
      })
      return
    }

    if (row.priceMeso === null) return
    // 기록이 바뀌면 판이 올라 기간 쿼리가 다시 읽는다. 화면은 여기서 안 건드린다.
    await upsertBossProfitRecord({
      ocid: row.ocid,
      bossKey: row.bossKey,
      boss: row.bossName,
      difficulty: row.difficulty,
      cycle: row.cycle,
      periodKey: row.periodKey,
      partySize,
      priceMeso: row.priceMeso,
      payoutMeso: crystalPayoutMeso(row.priceMeso, partySize, shares),
      crystalMyShare: shares.myShare,
      crystalSharesTotal: shares.sharesTotal,
      splitFeePercent: shares.splitFeePercent,
      splitFeeAuto: shares.splitFeeAuto === true,
      recordedAt: new Date().toISOString(),
      world: row.world,
      worldKey: row.worldKey,
      // 파티원 수만 고치는 upsert 가 **출처를 지우면 안 된다.** 안 넘기면 기본값이 `auto` 라 직접 적은 완료의 표식이
      // 편집 한 번에 사라진다.
      source: row.source,
    })
  },

  async saveManualCompletion(rowKey, input) {
    const row = findRow(get().tab, get().periodKey, rowKey, 'saveManualCompletion')

    await saveManualCompletion(
      {
        ocid: row.ocid,
        bossKey: row.bossKey,
        bossName: row.bossName,
        cycle: row.cycle,
        periodKey: row.periodKey,
        difficulty: input.difficulty,
        partySize: input.partySize,
        shares: input.shares,
        defeatedOn: input.dateKey,
        world: row.world,
        worldKey: row.worldKey,
        // 난이도를 바꿨으면 옛 줄을 지워야 한다. 안 지우면 같은 처치가 두 줄이 된다.
        previousDifficulty: row.source === 'manual' ? row.difficulty : undefined,
      },
      new Date(),
    )

    // **적은 날짜의 주로 데려간다**(사용자 지정). 월간 보스는 잡은 주에 서므로 날짜를 옮기면 그 행이 다른 주로 가고,
    // 보던 주에 그대로 두면 방금 적은 것이 화면에서 사라진다. 주간 보스는 고를 수 있는 날이 그 주 안이라 언제나 같은 주다.
    const targetWeek = resetWeekStartOf(input.dateKey)
    if (get().tab === 'weekly' && targetWeek !== get().periodKey) {
      set({ periodKey: targetWeek })
    }
  },

  async cancelManualCompletion(rowKey) {
    const row = findRow(get().tab, get().periodKey, rowKey, 'cancelManualCompletion')
    await cancelManualCompletion(
      { ocid: row.ocid, bossKey: row.bossKey, difficulty: row.difficulty, periodKey: row.periodKey },
      new Date(),
    )
  },

  async setBossDrops(rowKey, drops) {
    const { tab, periodKey } = get()
    const row = findRow(tab, periodKey, rowKey, 'setBossDrops')
    // 저장에서 빠진 드롭을 알려면 쓰기 전의 드롭이 필요하다. 쓰기가 끝나면 쿼리가 다시 읽어 옛 값이 사라진다.
    const key = dropRowKey(row.ocid, row.bossKey, row.difficulty, row.periodKey)
    const before = readPeriodSnapshot(tab, periodKey)?.dropsByRowKey[key] ?? []

    // 한 보스/기간의 드롭 집합을 통째로 교체한다(replace-all).
    const now = new Date()
    const ids = await replaceBossDropRecords(
      row.ocid,
      row.bossKey,
      row.difficulty,
      row.periodKey,
      drops,
      now.toISOString(),
      { name: row.world, key: row.worldKey },
    )

    // 저장한 드롭 전부를 서버로 한 건씩 보낸다(시세 표본). 가격이 없는 드롭도 보낸다(서버가 pending · skipped 로 든다).
    // **기기 저장이 끝난 뒤이고 결과를 안 기다린다.** 식별자는 메모리의 드롭에 없을 수 있어 저장소가 돌려준 값을 쓴다.
    const saved = drops.map((drop, index) => ({ ...drop, dropRecordId: ids[index] ?? drop.dropRecordId }))
    for (const drop of saved) {
      if (drop.dropRecordId === null) continue
      void reportDropPrice(drop.dropRecordId, now)
    }

    // 저장에서 빠진 드롭은 기기에서 기록이 사라진 것이다. 서버의 그 줄을 deleted 로 표시하는 요청이다.
    const savedIds = new Set(saved.map((drop) => drop.dropRecordId))
    for (const drop of before) {
      if (drop.dropRecordId === null || savedIds.has(drop.dropRecordId)) continue
      void reportDropRemoved(drop.dropRecordId, now)
    }

    // 드롭을 전부 뺀 저장은 지우기라 리뷰 요청의 셈에 넣지 않는다.
    if (saved.length > 0) countCoreSave()
  },
}))
