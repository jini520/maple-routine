export interface ModalProps {
  onClose: () => void
  children: React.ReactNode
  testId?: string
  /** false면 카드(테두리·배경·패딩) 없이 위치 고정용 래퍼만 제공한다 — children이 이미
   * 자체 카드 스타일을 갖고 있을 때(예: 재사용하는 ApiKeyForm/AccountSelectionList) 쓴다.
   * 기본값 true. */
  card?: boolean
}

// CharacterTrackingPicker/DisconnectConfirm에서 반복되던 오버레이 마크업을 공용화한 것 —
// 새 컴포넌트(ApiKeyModal/AccountModal/ThemeModal)들이 공유한다.
export function Modal(props: ModalProps): React.JSX.Element {
  const showCard = props.card ?? true

  return (
    <div
      data-testid={props.testId}
      onClick={props.onClose}
      className="fixed inset-0 flex items-center justify-center bg-bg/70"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={
          showCard ? 'w-full max-w-sm rounded-[14px] border border-border bg-surface p-6' : 'w-full max-w-sm'
        }
      >
        {props.children}
      </div>
    </div>
  )
}
