import { createPortal } from 'react-dom'
import { Toast } from './Toast'
import { useToastStore } from '../../features/toast/store'

// 하단 탭바(h-16=4rem) 위, 안전영역만큼 더 띄운다 — AppShell의 pb-[calc(4rem+var(--sa-bottom))]과 동일한 계산.
// 탭바가 없는 화면(온보딩 등)에 붙이는 경우는 이 컴포넌트를 실제로 마운트할 때 따로 검토한다.
export function ToastStack(): React.JSX.Element | null {
  const { toasts, dismiss } = useToastStore()

  if (toasts.length === 0) return null

  return createPortal(
    <div
      data-testid="toast-stack"
      className="fixed inset-x-0 bottom-[calc(4rem+var(--sa-bottom)+0.75rem)] z-40 flex flex-col gap-2 px-4"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>,
    document.body,
  )
}
