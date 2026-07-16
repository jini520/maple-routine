import { useBodyScrollLock } from '../../lib/use-body-scroll-lock'

// 임시 디버그 — 데이터 초기화 확인 모달. 배포 전 이 파일과 SettingsScreen의 디버그 행을 삭제할 것.
export interface DebugResetConfirmProps {
  isOpen: boolean
  isResetting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DebugResetConfirm(props: DebugResetConfirmProps): React.JSX.Element | null {
  useBodyScrollLock(props.isOpen)
  if (!props.isOpen) return null

  return (
    <div
      data-testid="debug-reset-overlay"
      onClick={props.onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-[14px] border border-border bg-surface p-6 space-y-4"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-text">데이터를 초기화할까요? (디버그)</h2>
          <p className="text-sm text-text-muted">
            API 키·선택한 계정·테마만 남기고 캐시·추적 목록·보스 수익 기록 등 나머지 데이터를 모두 삭제한 뒤
            앱을 다시 불러옵니다.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={props.isResetting}
            onClick={props.onCancel}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={props.isResetting}
            onClick={props.onConfirm}
            className="rounded-full border border-error px-5 py-2.5 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-50"
          >
            {props.isResetting ? '초기화 중...' : '초기화'}
          </button>
        </div>
      </div>
    </div>
  )
}
