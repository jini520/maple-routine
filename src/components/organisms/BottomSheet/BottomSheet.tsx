import { useState, type ReactNode } from 'react'
import { Drawer } from 'vaul'

interface BottomSheetProps {
  onClose: () => void
  children: ReactNode
  testId?: string
}

// 화면 하단에서 올라오는 시트(ADR-038 → ADR-039에서 vaul 채택). 스킨/공개 API는 종전 자체구현과
// 동일하게 유지하고 동작(진입·닫힘 애니메이션, 속도 기반 fling, 스냅 복귀, 포커스 트랩·Esc, body
// 스크롤 잠금)만 vaul에 위임한다. 오버레이 관례상 z-[60](Modal/피커 z-50보다 위, 토스트와 동일).
//
// 부모(BossProfitScreen)가 시트를 조건부 마운트하고 onClose로 언마운트하는 패턴을 유지하되,
// vaul의 닫힘 애니메이션을 살리려고 open을 내부 상태로 두고 이탈 애니메이션이 끝난 뒤
// (onAnimationEnd) onClose로 부모에 언마운트를 알린다.
export function BottomSheet(props: BottomSheetProps): React.JSX.Element {
  const [open, setOpen] = useState(true)

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setOpen(false)
      }}
      onAnimationEnd={(isOpen) => {
        if (!isOpen) props.onClose()
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-scrim" />
        <Drawer.Content
          data-testid={props.testId}
          aria-describedby={undefined}
          onPointerDownOutside={(event) => {
            // 시트 콘텐츠 바깥 pointerdown이면 vaul/Radix가 시트를 닫는다. 단 [data-sheet-keep-open]로
            // 표시된 오버레이(고가 드롭 연출 등)에서 시작된 탭은 닫지 않는다(ADR-039). 연출은 시트의
            // 형제로 렌더돼 Radix가 '바깥'으로 판정하므로, 그 위 탭이 시트까지 닫아버리는 걸 막는다.
            const target = event.detail.originalEvent.target as Element | null
            if (target?.closest('[data-sheet-keep-open]')) event.preventDefault()
          }}
          className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[82vh] w-full max-w-md flex-col rounded-t-[20px] border-t border-border bg-bg shadow-[0_-8px_30px_var(--color-shadow-color)] outline-none"
        >
          <Drawer.Title className="sr-only">드롭 아이템 기록</Drawer.Title>
          <div className="flex flex-none justify-center pb-2 pt-3">
            <div className="h-1 w-9 rounded-full bg-border-strong" />
          </div>
          <div className="overflow-y-auto pt-2">
            {props.children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
