/**
 * 다른 사람으로 로그인할 때 앞 사람의 올리지 못한 기록을 버릴지 묻는 스토어. 로그인 흐름이 묻고 기다리며, 셸의 모달이 답한다.
 */
import { create } from 'zustand'

interface UnsyncedPromptState {
  /** 묻는 앞 사람의 대기 줄 수. 묻지 않으면 `null` */
  count: number | null
  /** 묻고 답을 기다린다. 버리면 `true` */
  ask(count: number): Promise<boolean>
  /** 모달의 답. 묻는 중이 아니면 아무 일도 없다 */
  answer(discard: boolean): void
}

let pending: ((discard: boolean) => void) | null = null

export const useUnsyncedPromptStore = create<UnsyncedPromptState>((set) => ({
  count: null,
  ask(count) {
    // 앞 물음이 남았으면 버리지 않는 쪽으로 닫는다. 로그인 창은 한 번에 하나라 겹치지 않는다.
    pending?.(false)
    set({ count })
    return new Promise<boolean>((resolve) => {
      pending = resolve
    })
  },
  answer(discard) {
    const resolve = pending
    pending = null
    set({ count: null })
    resolve?.(discard)
  },
}))
