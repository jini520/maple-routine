/**
 * 직접 완료를 열어 둔 보스. today 의 안내 줄과 보스 수익의 단추가 이것을 구독한다.
 *
 * **스토어가 하나라 두 화면이 같은 답을 본다.** 진입하는 자리가 둘(today · 보스 수익)이고 둘 다
 * `refresh()` 를 부른다. 스케줄러 갱신 회차마다 부르지 않는 것은 이 값이 늦게 와서 늘어나는 것이
 * 없기 때문이다 - 이 값은 배너와 단추만 쓴다.
 *
 * **겹쳐 불러도 서버는 한 번만 부른다.** 두 화면을 빠르게 오가면 같은 값을 두 번 묻게 된다.
 */
import { create } from 'zustand'

import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import { fetchManualCompletionBosses } from '../../server/manual-completion'
import {
  dismissManualCompletion,
  getDismissedManualCompletionWeek,
} from '../../storage/manual-completion-banner'
import type { ManualCompletionBoss } from '../../types/manual-completion'

interface ManualCompletionState {
  /** 서버가 연 보스. **`null` 은 못 받았다**는 뜻이고 빈 배열은 아무것도 안 열렸다는 사실이다. */
  bosses: ManualCompletionBoss[] | null
  /** 닫을 때 기억한 주간 기간 키. 기기에 남는다. */
  dismissedWeek: string | null
  /** 지금 안내 줄을 세우나. 열린 보스가 있고 이번 주에 안 닫았을 때만 참이다. */
  visible: boolean
  refresh: () => Promise<void>
  /** 이번 주 동안 줄을 닫는다. 다음 주에는 다시 선다. */
  dismiss: () => Promise<void>
}

/** 지금 나가 있는 조회. 겹쳐 부르면 이것을 함께 기다린다. */
let inFlight: Promise<void> | null = null

function visibilityOf(bosses: ManualCompletionBoss[] | null, dismissedWeek: string | null): boolean {
  if (bosses === null || bosses.length === 0) return false
  return getCurrentBossProfitPeriod('weekly', new Date()).periodKey !== dismissedWeek
}

export const useManualCompletionStore = create<ManualCompletionState>()((set, get) => ({
  bosses: null,
  dismissedWeek: null,
  visible: false,

  async refresh() {
    if (inFlight !== null) {
      await inFlight
      return
    }

    inFlight = (async () => {
      // 기기의 닫은 기록을 함께 읽는다. 앱을 다시 켠 뒤 첫 회차가 그것을 모르면 이미 닫은 줄이
      // 한 번 선다(결산 줄과 같은 사정).
      const [bosses, dismissedWeek] = await Promise.all([
        fetchManualCompletionBosses(),
        getDismissedManualCompletionWeek().catch(() => null),
      ])

      set({ bosses, dismissedWeek, visible: visibilityOf(bosses, dismissedWeek) })
    })()

    try {
      await inFlight
    } finally {
      inFlight = null
    }
  },

  async dismiss() {
    // 줄이 안 서 있으면 닫을 것도 없다. 빈 회차에 키를 적으면 다음 주 판정이 그 값에 걸린다.
    if (!get().visible) return

    const week = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
    // 저장 실패는 삼킨다. 이번 실행 동안은 줄이 내려가고, 다음에 켜면 한 번 더 서는데 그것은
    // 거짓이 아니라 이미 읽은 안내를 다시 보는 일이다.
    await dismissManualCompletion(week).catch(() => undefined)
    set({ dismissedWeek: week, visible: false })
  },
}))
