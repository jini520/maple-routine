import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, RefreshCw, X } from 'lucide-react'
import type { ToastItem, ToastVariant } from '../../../features/toast/store'
import { shouldDismissFromSwipe } from '../../../lib/swipe-dismiss'

export interface ToastProps {
  toast: ToastItem
  onDismiss: () => void
}

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

// 톤 배경은 *-tint 토큰이다(ADR-064 결정 2). Tailwind 투명도 접미사(bg-secondary/10)를 쓰면
// 투명과 섞여 배경이 거의 안 보인다 — 그 문제를 이 파일이 color-mix로 우회하고 있었는데,
// 이제 틴트가 값으로 확정돼 있어 토큰만 쓰면 된다.
const TONE_CLASSES: Record<ToastVariant, string> = {
  success: 'bg-secondary-tint',
  error: 'bg-error-tint',
  info: 'bg-info-tint',
}

const ICON_CLASSES: Record<ToastVariant, string> = {
  success: 'text-secondary-ink',
  error: 'text-error-ink',
  info: 'text-info-ink',
}

export function Toast(props: ToastProps): React.JSX.Element {
  const { toast, onDismiss } = props
  const [isEntered, setIsEntered] = useState(false)
  const [dragX, setDragX] = useState<number | null>(null)
  const dragStartX = useRef(0)

  // 마운트 직후 바로 최종 상태 클래스를 주면 트랜지션이 재생되지 않는다 — 한 프레임 뒤로 미뤄 진입 애니메이션을 재생한다.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if ((event.target as HTMLElement).closest('button')) return
    dragStartX.current = event.clientX
    setDragX(0)
    // 구형 WebView 등 setPointerCapture 미지원 환경 대비.
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (dragX === null) return
    setDragX(event.clientX - dragStartX.current)
  }

  function handlePointerUp(): void {
    if (dragX === null) return
    if (shouldDismissFromSwipe(dragX)) {
      onDismiss()
    } else {
      setDragX(null)
    }
  }

  const Icon = ICONS[toast.variant]
  const isDragging = dragX !== null
  const dragOpacity = isDragging ? Math.max(0.15, 1 - Math.abs(dragX) / 140) : undefined

  const enterClasses = isEntered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative flex touch-pan-y items-center gap-2 overflow-hidden rounded-[14px] border border-border px-2.5 py-2 shadow-lg transition-opacity duration-200 ease-out motion-reduce:translate-y-0 motion-reduce:transition-opacity ${TONE_CLASSES[toast.variant]} ${enterClasses}`}
      style={
        isDragging
          ? { transform: `translateX(${dragX}px)`, opacity: dragOpacity, transition: 'none' }
          : undefined
      }
    >
      <Icon className={`h-4 w-4 shrink-0 ${ICON_CLASSES[toast.variant]}`} strokeWidth={2} aria-hidden="true" />
      <p className={`min-w-0 flex-1 truncate text-sm font-medium ${toast.variant === 'error' ? 'text-error-ink' : 'text-text'}`}>
        {toast.message}
      </p>
      {toast.action && (
        <button
          type="button"
          aria-label={toast.action.label}
          onClick={() => {
            toast.action?.onClick()
            onDismiss()
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center text-primary-ink"
        >
          {/* 기본은 '다시 시도'를 전제한 RefreshCw. 뜻이 다른 액션은 자기 아이콘을 넘긴다([[ADR-063]]). */}
          {(() => {
            const ActionIcon = toast.action.icon ?? RefreshCw
            return <ActionIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          })()}
        </button>
      )}
      <button
        type="button"
        aria-label="닫기"
        onClick={onDismiss}
        className="flex h-6 w-6 shrink-0 items-center justify-center text-text-muted"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </button>
      {toast.duration !== null && (
        <div data-testid="toast-timer" className="absolute inset-x-0 bottom-0 h-[2.5px]">
          <div
            className={`h-full origin-left bg-current motion-reduce:hidden ${ICON_CLASSES[toast.variant]}`}
            style={{ animation: `toast-shrink ${toast.duration}ms linear forwards` }}
          />
        </div>
      )}
    </div>
  )
}
