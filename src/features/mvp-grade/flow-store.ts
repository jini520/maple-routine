/**
 * MVP 등급을 묻는 흐름의 상태. 무엇을 물을지 정하고(`evaluate`), 모달의 답을 받아 적는다(`complete`).
 *
 * @see docs/features/mvp-grade.md 묻는 자리
 */
import { create } from 'zustand'

import { summarizeAccount, type AccountSummaryView } from '../character-manage/derivations'
import { resetWeekStartOf } from '../../lib/calendar'
import type { MvpGradeKey } from '../../lib/mvp/grades'
import { setGradeFrom, type MvpGradeEntry } from '../../lib/mvp/history'
import { accountOfOcid } from '../../lib/mvp/membership'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { getAuthConfig } from '../../storage/api-key'
import { getBulkFeeDropRecords } from '../../storage/boss-drops'
import { getCharacterAccountSightings } from '../../storage/character-accounts'
import { getCharacterProfiles } from '../../storage/character-profiles'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getBulkFeeIncomeRecords } from '../../storage/income'
import {
  getMvpBulkApplyAsked,
  getMvpLastCheckedWeek,
  getMvpWeeklyCheckOff,
  setMvpBulkApplyAsked,
  setMvpLastCheckedWeek,
  setMvpWeeklyCheckOff,
} from '../../storage/mvp-grade-prefs'
import { getMvpGradeHistories, replaceMvpGradeHistory } from '../../storage/mvp-grades'
import type { MapleAccount } from '../../types'
import { useToastStore } from '../toast/store'
import { decideMvpAsk, type MvpAsk } from './ask'
import { applyFeesToPastRecords } from './bulk-apply'
import { fetchAndRecordCharacterList } from './character-list'
import { recalculateAutoFees } from './recalculate-fees'
import { useMvpGradeStore } from './store'

/** 모달의 ID 카드 하나. */
export interface MvpAskAccount {
  accountId: string
  /** ID 표시. 목록을 못 받았으면 `null` 이라 ID 만 적는다 */
  summary: AccountSummaryView | null
  portraitUrl: string | null
  /** 지금 등급. 이력이 없으면 `null` */
  currentGrade: MvpGradeKey | null
}

/** 모달이 돌려주는 ID 하나의 답. */
export interface MvpAskChoice {
  accountId: string
  grade: MvpGradeKey
  /** 그 등급이 시작된 주의 목요일 */
  startWeek: string
  /** 주간 확인에서 등급을 바꿨나. 안 바꾼 ID 는 이력을 안 건드린다 */
  changed: boolean
}

export interface MvpAskResult {
  choices: MvpAskChoice[]
  /** `앞으로 등급은 직접 바꿀게요` */
  weeklyOff: boolean
  /** `지난 기록에도 수수료 적용하기` */
  bulkApply: boolean
}

interface MvpAskState {
  ask: MvpAsk | null
  accounts: MvpAskAccount[]
  /** 추적 캐릭터와 이력 · preferences 를 읽어 물을 것을 정한다. 물을 것이 있을 때만 ID 표시를 받는다. */
  evaluate: (now: Date) => Promise<void>
  /** 모달의 답을 적고 모달을 닫는다. */
  complete: (result: MvpAskResult, now: Date) => Promise<void>
}

/** 목록을 받아 그 ID 들의 표시를 만든다. 못 받으면 표시 없이 ID 만 선다. */
async function loadAccounts(accountIds: readonly string[], histories: Map<string, MvpGradeEntry[]>): Promise<MvpAskAccount[]> {
  let lists: MapleAccount[] = []
  const auth = await getAuthConfig().catch(() => null)
  if (auth !== null) lists = await fetchAndRecordCharacterList(auth.apiKey).catch(() => [])
  const summaries = new Map<string, AccountSummaryView>()
  for (const account of lists) {
    if (!accountIds.includes(account.accountId)) continue
    const summary = summarizeAccount(account)
    if (summary !== null) summaries.set(account.accountId, summary)
  }
  const profiles = await getCharacterProfiles([...summaries.values()].map((summary) => summary.representative.ocid)).catch(
    () => new Map(),
  )
  return accountIds.map((accountId) => {
    const summary = summaries.get(accountId) ?? null
    const history = histories.get(accountId) ?? []
    return {
      accountId,
      summary,
      portraitUrl: summary === null ? null : (profiles.get(summary.representative.ocid)?.imageUrl ?? null),
      currentGrade: history[history.length - 1]?.grade ?? null,
    }
  })
}

export const useMvpAskStore = create<MvpAskState>()((set, get) => ({
  ask: null,
  accounts: [],

  async evaluate(now) {
    const [tracked, sightings, histories, weeklyOff, lastCheckedWeek, bulkAsked] = await Promise.all([
      getTrackedCharacterOcids(),
      getCharacterAccountSightings(),
      getMvpGradeHistories(),
      getMvpWeeklyCheckOff(),
      getMvpLastCheckedWeek(),
      getMvpBulkApplyAsked(),
    ])
    const trackedAccountIds = (tracked ?? [])
      .map((ocid) => accountOfOcid(sightings, ocid))
      .filter((accountId): accountId is string => accountId !== null)
    // 일괄 적용 대상은 물을 때만 센다. 한 번 물었으면 다시 안 세운다.
    const hasPastRecords = bulkAsked
      ? false
      : (await getBulkFeeIncomeRecords()).length + (await getBulkFeeDropRecords()).length > 0
    const ask = decideMvpAsk({
      trackedAccountIds,
      historyAccountIds: new Set([...histories].filter(([, entries]) => entries.length > 0).map(([id]) => id)),
      weeklyOff,
      lastCheckedWeek,
      thisWeek: resetWeekStartOf(getCurrentKstDateKey(now)),
      bulkAsked,
      hasPastRecords,
    })
    if (ask === null) {
      set({ ask: null, accounts: [] })
      return
    }
    set({ ask, accounts: await loadAccounts(ask.accountIds, histories) })
  },

  async complete(result, now) {
    const ask = get().ask
    if (ask === null) return
    const histories = await getMvpGradeHistories()
    for (const choice of result.choices) {
      if (ask.kind === 'weekly' && !choice.changed) continue
      const next = setGradeFrom(histories.get(choice.accountId) ?? [], choice.startWeek, choice.grade)
      await replaceMvpGradeHistory(choice.accountId, next, now.toISOString())
    }
    await setMvpLastCheckedWeek(resetWeekStartOf(getCurrentKstDateKey(now)))
    await setMvpWeeklyCheckOff(result.weeklyOff)
    // 첫 흐름을 마치면 일괄 적용을 다시 안 묻는다. 체크박스가 안 섰던 사용자(지난 기록이 없던 온보딩)도 같다.
    if (ask.kind !== 'weekly') {
      await setMvpBulkApplyAsked()
      if (ask.bulk && result.bulkApply) await applyFeesToPastRecords()
    }
    const recalculated = await recalculateAutoFees()
    if (recalculated > 0) useToastStore.getState().showSuccess(`자동 수수료 기록 ${recalculated}건을 다시 계산했어요`)
    await useMvpGradeStore.getState().reload()
    set({ ask: null, accounts: [] })
  },
}))
