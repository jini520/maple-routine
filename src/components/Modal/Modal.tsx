import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '../../lib/use-body-scroll-lock'

export interface ModalProps {
  onClose: () => void
  children: React.ReactNode
  testId?: string
  /** false면 카드(테두리·배경·패딩) 없이 위치 고정용 래퍼만 제공한다 — children이 이미
   * 자체 카드 스타일을 갖고 있을 때(예: 재사용하는 ApiKeyForm/AccountSelectionList) 쓴다.
   * 기본값 true. */
  card?: boolean
  /** 카드 최대 너비 Tailwind 클래스 — 기본 max-w-sm. 더 좁게(예: max-w-xs) 쓰고 싶을 때 지정. */
  maxWidth?: string
  /** 세로 위치. 기본 'top' — 키보드가 뜨면 WebView가 줄어드는데 중앙 정렬이면 중앙이 키보드 높이의
   * 절반만큼 이동해 모달이 크게 튄다(iOS는 애니메이션 없이 스냅해 특히 어색하다). 상단 고정이면
   * 뷰포트가 줄어도 위치가 그대로라 튀지 않는다. 키보드를 띄우지 않는 모달만 'center'를 쓴다. */
  align?: 'top' | 'center'
}

// CharacterTrackingPicker/DisconnectConfirm에서 반복되던 오버레이 마크업을 공용화한 것 —
// 새 컴포넌트(ApiKeyModal/AccountModal/ThemeModal)들이 공유한다.
export function Modal(props: ModalProps): React.JSX.Element {
  useBodyScrollLock()
  const showCard = props.card ?? true
  const maxWidth = props.maxWidth ?? 'max-w-sm'
  // 상단 정렬은 안전영역(상태바·노치)만큼 내린 뒤 여백을 더 둬 화면 끝에 붙지 않게 한다.
  const alignClass =
    (props.align ?? 'top') === 'center'
      ? 'items-center'
      : 'items-start pt-[calc(var(--sa-top)+2rem)]'

  // body로 포털 렌더링한다 — 호출부 어디에 놓이든 부모의 레이아웃 유틸리티에 영향받지 않게 하려고.
  // 예로 space-y-*는 자식에 margin-block-end를 붙이는데, position:fixed에 top/bottom이 함께 걸린
  // 오버레이는 그 마진만큼 높이가 줄어(880→864) 화면 끝까지 못 덮는다. 그러면 상태바·제스처 영역만
  // 딤이 빠져 밝은 띠로 남는다(실기기 확인). 포털로 띄우면 항상 뷰포트 전체를 덮는다.
  return createPortal(
    <div
      data-testid={props.testId}
      onClick={props.onClose}
      className={`fixed inset-0 z-50 flex justify-center overflow-y-auto bg-bg/70 px-4 ${alignClass}`}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={
          showCard
            ? `w-full ${maxWidth} rounded-[14px] border border-border bg-surface p-6`
            : `w-full ${maxWidth}`
        }
      >
        {props.children}
      </div>
    </div>,
    document.body,
  )
}
