import { createPortal } from 'react-dom'
import { Toast } from './Toast'
import { useToastStore } from '../../features/toast/store'

export interface ToastStackProps {
  /** 하단 탭바(h-16=4rem)가 떠 있는 화면인지 — AppShell의 pb-[calc(4rem+var(--sa-bottom))]과 같은 기준. 기본 true. */
  hasTabBar?: boolean
}

export function ToastStack(props: ToastStackProps): React.JSX.Element | null {
  const hasTabBar = props.hasTabBar ?? true
  const { toasts, dismiss } = useToastStore()

  if (toasts.length === 0) return null

  const bottomClass = hasTabBar
    ? 'bottom-[calc(4rem+var(--sa-bottom)+0.75rem)]'
    : 'bottom-[calc(var(--sa-bottom)+0.75rem)]'

  // Modal/CharacterTrackingPicker/DisconnectConfirm 등 오버레이가 전부 z-50이라, 토스트가 그보다
  // 낮으면 모달이 열려있는 동안 배경(bg-bg/70)에 가려 안 보인다 — 토스트는 항상 최상단이어야 한다.
  return createPortal(
    <div data-testid="toast-stack" className={`fixed inset-x-0 ${bottomClass} z-[60] flex flex-col gap-2 px-4`}>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>,
    document.body,
  )
}
