/**
 * 직접 완료 안내 줄을 **닫은 주**. 서버가 연 보스는 쿼리(`query.ts`)가 들고, 닫았는지는 기기 값이라 여기 든다.
 */
import { create } from 'zustand'

import {
  dismissManualCompletion,
  getDismissedManualCompletionWeek,
} from '../../storage/manual-completion-banner'

interface ManualCompletionDismissalState {
  /** 닫을 때 기억한 주간 기간 키. 기기에 남는다. 아직 안 읽었으면 `null`. */
  dismissedWeek: string | null
  /** 저장된 값을 올린다. 읽은 뒤에는 다시 안 읽는다. */
  restore: () => Promise<void>
  /** 그 주 동안 줄을 닫는다. */
  dismiss: (weeklyPeriodKey: string) => Promise<void>
}

let restored: Promise<void> | null = null

export const useManualCompletionDismissal = create<ManualCompletionDismissalState>()((set) => ({
  dismissedWeek: null,
  restore() {
    restored ??= getDismissedManualCompletionWeek()
      .then((dismissedWeek) => set({ dismissedWeek }))
      .catch(() => undefined)
    return restored
  },
  async dismiss(weeklyPeriodKey) {
    // 저장 실패는 삼킨다. 이번 실행 동안은 줄이 내려가고, 다음에 켜면 한 번 더 서는데 그것은 거짓이 아니라 이미 읽은
    // 안내를 다시 보는 일이다.
    await dismissManualCompletion(weeklyPeriodKey).catch(() => undefined)
    set({ dismissedWeek: weeklyPeriodKey })
  },
}))

/** 테스트 전용. 복원 약속이 모듈 수준이라 테스트끼리 오염된다. */
export function resetManualCompletionDismissalForTests(): void {
  restored = null
  useManualCompletionDismissal.setState({ dismissedWeek: null })
}
