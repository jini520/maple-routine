/**
 * 설정의 MVP 등급 목록과 ID 이력 상세가 함께 읽는 상태. 두 페이지가 같은 이력을 보여야 해서 스토어에 둔다.
 *
 * @see docs/features/mvp-grade.md 묻는 자리
 */
import { create } from 'zustand'

import type { MvpGradeEntry } from '../../lib/mvp/history'
import { getCharacterAccountSightings } from '../../storage/character-accounts'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getMvpWeeklyCheckOff, setMvpWeeklyCheckOff } from '../../storage/mvp-grade-prefs'
import { getMvpGradeHistories, replaceMvpGradeHistory } from '../../storage/mvp-grades'
import { useToastStore } from '../toast/store'
import { loadAccountIdentities, trackedAccountIdsOf, type AccountIdentity } from './accounts'
import { afterGradeChange } from './after-change'

export interface MvpGradeAccountView extends AccountIdentity {
  accountId: string
  /** 시작 날짜 오름차순 */
  history: MvpGradeEntry[]
}

interface MvpGradeSettingsState {
  /** 실패를 빈 목록으로 위장하지 않는다. 읽지 못했으면 ID 가 있는지조차 모른다 */
  status: 'idle' | 'loading' | 'ready' | 'failed'
  accounts: MvpGradeAccountView[]
  weeklyOff: boolean
  /** 추적 캐릭터의 ID 와 이력이 있는 ID 를 읽는다. 추적 ID 가 앞이다. */
  load: () => Promise<void>
  /** 한 ID 의 이력을 통째로 바꿔 적고, 자동 수수료를 다시 계산한다. 못 적으면 토스트로 알린다. */
  saveHistory: (accountId: string, history: MvpGradeEntry[], now: Date) => Promise<void>
  /** `매주 등급 확인` 스위치. 저장값(`mvpWeeklyCheckOff`)의 반대다. */
  setWeeklyCheck: (on: boolean) => Promise<void>
}

export const useMvpGradeSettingsStore = create<MvpGradeSettingsState>()((set, get) => ({
  status: 'idle',
  accounts: [],
  weeklyOff: false,

  async load() {
    set({ status: 'loading' })
    try {
      const [tracked, sightings, histories, weeklyOff] = await Promise.all([
        getTrackedCharacterOcids(),
        getCharacterAccountSightings(),
        getMvpGradeHistories(),
        getMvpWeeklyCheckOff(),
      ])
      const withHistory = [...histories].filter(([, entries]) => entries.length > 0).map(([accountId]) => accountId)
      const accountIds = [...new Set([...trackedAccountIdsOf(tracked, sightings), ...withHistory])]
      const identities = await loadAccountIdentities(accountIds)
      set({
        status: 'ready',
        weeklyOff,
        accounts: accountIds.map((accountId) => ({
          accountId,
          summary: identities.get(accountId)?.summary ?? null,
          portraitUrl: identities.get(accountId)?.portraitUrl ?? null,
          history: histories.get(accountId) ?? [],
        })),
      })
    } catch {
      set({ status: 'failed', accounts: [] })
    }
  },

  async saveHistory(accountId, history, now) {
    try {
      await replaceMvpGradeHistory(accountId, history, now.toISOString())
    } catch {
      useToastStore.getState().showError('등급 기록을 저장하지 못했습니다')
      return
    }
    set({
      accounts: get().accounts.map((account) => (account.accountId === accountId ? { ...account, history } : account)),
    })
    await afterGradeChange()
  },

  async setWeeklyCheck(on) {
    await setMvpWeeklyCheckOff(!on)
    set({ weeklyOff: !on })
  },
}))
