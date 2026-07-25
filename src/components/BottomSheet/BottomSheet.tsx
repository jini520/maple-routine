import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '../../lib/use-body-scroll-lock'

interface BottomSheetProps {
  onClose: () => void
  children: ReactNode
  testId?: string
}

// 아래로 이 값(px)을 넘게 끌면 닫는다.
const DRAG_DISMISS_PX = 90

// 화면 하단에서 올라오는 시트(ADR-038). Modal과 동일하게 document.body로 포털하고 body 스크롤을
// 잠근다. 오버레이 관례상 z-[60](Modal/피커 z-50보다 위, 토스트와 동일 계층).
export function BottomSheet(props: BottomSheetProps): React.JSX.Element {
  useBodyScrollLock()
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)

  function handleTouchStart(event: React.TouchEvent): void {
    startY.current = event.touches[0].clientY
  }
  function handleTouchMove(event: React.TouchEvent): void {
    if (startY.current === null) return
    setDragY(Math.max(0, event.touches[0].clientY - startY.current)) // 아래로만
  }
  function handleTouchEnd(): void {
    if (dragY > DRAG_DISMISS_PX) {
      props.onClose()
    }
    setDragY(0)
    startY.current = null
  }

  return createPortal(
    <div
      data-testid={props.testId}
      onClick={props.onClose}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-bg/70"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
        className="flex max-h-[82vh] w-full max-w-md flex-col rounded-t-[20px] border-t border-border bg-bg shadow-[0_-8px_30px_rgba(0,0,0,0.3)]"
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex flex-none touch-none cursor-grab justify-center pb-1 pt-2"
        >
          <div className="h-1 w-9 rounded-full bg-border-strong" />
        </div>
        <div className="overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {props.children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
