import { create } from 'zustand'
import type { ComponentType } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
  // 액션 슬롯은 아이콘만 보이고 label 은 aria-label 로만 쓰인다. 기본값(RefreshCw)이 다시 시도를
  // 전제하므로 뜻이 다른 액션은 자기 아이콘을 넘겨야 한다.
  //
  // 타입이 플랫폼 중립인 것은 두 아이콘 라이브러리가 다 들어가야 하기 때문이다. `lucide-react`
  // 의 `LucideIcon` 으로 좁히면 `lucide-react-native` 의 같은 아이콘이 타입상 안 들어간다
  // (SVG 프롭이 갈린다). core 가 특정 아이콘 라이브러리를 아는 것 자체가 이 층에 안 맞기도 하다.
  icon?: ComponentType<{ size?: number; color?: string }>
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

// 자동 소멸까지 걸리는 시간. 변형별 고정값이고 호출부에서 개별 지정할 수 없다.
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
      if (remaining.length === toasts.length) return // 보이는 목록에 없는 id. 할 일 없음

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

/**
 * 테스트 전용. 떠 있는 토스트와 예약된 자동 소멸 타이머를 전부 걷는다.
 *
 * 타이머가 모듈 스코프에 살기 때문에 필요하다. 토스트를 띄운 채 끝난 케이스는 실제
 * `setTimeout` 을 남기고, 그러면 jest 가 안 끝나 워커 정리와 겹쳐 SIGSEGV 로 죽기까지 한다.
 *
 * `jest.setup.js` 의 전역 `afterEach` 가 이것을 부르므로 개별 테스트는 아무것도 안 해도 된다.
 */
export function __resetToastsForTest(): void {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  useToastStore.setState({ toasts: [], queue: [] })
}
