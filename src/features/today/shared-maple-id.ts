/**
 * today 공유 컨텐츠 위젯에서 고른 메이플 ID. 고르면 바로 바꾸고 기기에 적는다.
 *
 * 마지막에 고른 것을 기억한다. today 를 열 때마다 처음 것으로 돌아가면 보던 메이플 ID 를 매번 다시 골라야 한다.
 */
import { create } from 'zustand'

import { getTodaySharedMapleId, setTodaySharedMapleId } from '../../storage/today-shared-maple-id'

export interface TodaySharedMapleIdStore {
  /** 고른 메이플 ID. 고른 적이 없으면 `null` */
  mapleId: string | null
  restoreFromStorage(): Promise<void>
  select(mapleId: string): void
}

export const useTodaySharedMapleIdStore = create<TodaySharedMapleIdStore>()((set) => ({
  mapleId: null,

  async restoreFromStorage() {
    const saved = await getTodaySharedMapleId().catch(() => null)
    // 복원을 기다리는 동안 사용자가 이미 골랐으면 그것이 이긴다.
    set((state) => (state.mapleId === null ? { mapleId: saved } : state))
  },

  // 화면은 고른 즉시 바뀐다. 적기가 실패하면 다음에 켰을 때 처음 것으로 돌아갈 뿐이다.
  select(mapleId: string) {
    set({ mapleId })
    void setTodaySharedMapleId(mapleId).catch(() => undefined)
  },
}))
