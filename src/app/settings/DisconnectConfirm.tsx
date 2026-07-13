import { useBodyScrollLock } from '../../lib/use-body-scroll-lock'

export interface DisconnectConfirmProps {
  isOpen: boolean
  isDisconnecting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DisconnectConfirm(props: DisconnectConfirmProps): React.JSX.Element | null {
  useBodyScrollLock(props.isOpen)
  if (!props.isOpen) return null

  return (
    <div
      data-testid="disconnect-confirm-overlay"
      onClick={props.onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-[14px] border border-border bg-surface p-6 space-y-4"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-text">연결을 해제할까요?</h2>
          <p className="text-sm text-text-muted">
            API 키와 계정 연결이 해제되고 온보딩 화면으로 돌아갑니다. 보스 수익·드랍 기록은 삭제되지 않습니다.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={props.isDisconnecting}
            onClick={props.onCancel}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={props.isDisconnecting}
            onClick={props.onConfirm}
            className="rounded-full border border-error px-5 py-2.5 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-50"
          >
            {props.isDisconnecting ? '해제하는 중...' : '연결 해제'}
          </button>
        </div>
      </div>
    </div>
  )
}
