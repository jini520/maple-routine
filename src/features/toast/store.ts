import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
  duration: number | null
  action?: ToastAction
}

interface ToastStore {
  toasts: ToastItem[]
  queue: ToastItem[]
  showSuccess: (message: string) => void
  showInfo: (message: string) => void
  showError: (message: string, action?: ToastAction) => void
  dismiss: (id: string) => void
}

// 자동 소멸까지 걸리는 시간 — 변형별 고정값(호출부에서 개별 지정 불가, [[ADR-032와 무관, Toast 설계]] 확정 스펙).
const DURATIONS: Record<ToastVariant, number | null> = {
  success: 2000,
  info: 2500,
  error: null,
}

const MAX_VISIBLE = 3

let seq = 0
function nextId(): string {
  seq += 1
  return `toast-${seq}`
}

// zustand 상태는 직렬화 가능한 값만 담는 게 관례라, setTimeout 핸들은 스토어 밖 모듈 스코프에서 id로 추적한다.
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastStore>()((set, get) => {
  function scheduleAutoDismiss(item: ToastItem) {
    if (item.duration === null) return
    const timer = setTimeout(() => get().dismiss(item.id), item.duration)
    timers.set(item.id, timer)
  }

  function push(variant: ToastVariant, message: string, action?: ToastAction) {
    const item: ToastItem = { id: nextId(), variant, message, duration: DURATIONS[variant], action }
    const { toasts, queue } = get()
    if (toasts.length < MAX_VISIBLE) {
      set({ toasts: [...toasts, item] })
      scheduleAutoDismiss(item)
    } else {
      set({ queue: [...queue, item] })
    }
  }

  return {
    toasts: [],
    queue: [],
    showSuccess: (message) => push('success', message),
    showInfo: (message) => push('info', message),
    showError: (message, action) => push('error', message, action),
    dismiss: (id) => {
      const timer = timers.get(id)
      if (timer !== undefined) {
        clearTimeout(timer)
        timers.delete(id)
      }

      const { toasts, queue } = get()
      const remaining = toasts.filter((t) => t.id !== id)
      if (remaining.length === toasts.length) return // 보이는 목록에 없는 id — 할 일 없음

      if (queue.length > 0) {
        const [next, ...restQueue] = queue
        set({ toasts: [...remaining, next], queue: restQueue })
        scheduleAutoDismiss(next)
      } else {
        set({ toasts: remaining })
      }
    },
  }
})
