/**
 * today 배너에서 **닫은 공지의 id**. 공지 자체는 쿼리(`notice-query.ts`)가 들고, 닫았는지는 기기 값이라 여기 든다.
 */
import { create } from 'zustand'

import { dismissNotice, forgetDismissedNotice, getDismissedNoticeIds } from '../../storage/notice-banner'

interface NoticeDismissalState {
  dismissedIds: readonly string[]
  /** 저장된 값을 올린다. 읽은 뒤에는 다시 안 읽는다. */
  restore: () => Promise<void>
  dismiss: (noticeId: string) => Promise<void>
  /** 서버에서 사라진 공지의 닫은 기록을 뺀다. */
  forget: (noticeId: string) => Promise<void>
}

let restored: Promise<void> | null = null

export const useNoticeDismissal = create<NoticeDismissalState>()((set, get) => ({
  dismissedIds: [],
  restore() {
    restored ??= getDismissedNoticeIds()
      .then((dismissedIds) => set({ dismissedIds }))
      .catch(() => undefined)
    return restored
  },
  async dismiss(noticeId) {
    await dismissNotice(noticeId)
    set({ dismissedIds: [...get().dismissedIds.filter((id) => id !== noticeId), noticeId] })
  },
  async forget(noticeId) {
    await forgetDismissedNotice(noticeId).catch(() => undefined)
    set({ dismissedIds: get().dismissedIds.filter((id) => id !== noticeId) })
  },
}))

/** 테스트 전용. 복원 약속이 모듈 수준이라 테스트끼리 오염된다. */
export function resetNoticeDismissalForTests(): void {
  restored = null
  useNoticeDismissal.setState({ dismissedIds: [] })
}
