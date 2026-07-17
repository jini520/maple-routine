import { Modal } from '../../components/Modal/Modal'

// 임시 디버그 — 데이터 초기화 확인 모달. 배포 전 이 파일과 SettingsScreen의 디버그 행을 삭제할 것.
// 공용 Modal을 쓴다 — 직접 오버레이를 그리면 호출부의 space-y-* margin에 fixed inset-0 높이가
// 깎여 하단 제스처 영역만 딤이 빠진다(38c6ed7과 동일 기전, 실기기 확인). Modal은 body로 포털 렌더링.
export interface DebugResetConfirmProps {
  isOpen: boolean
  isResetting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DebugResetConfirm(props: DebugResetConfirmProps): React.JSX.Element | null {
  if (!props.isOpen) return null

  return (
    <Modal onClose={props.onCancel} testId="debug-reset-overlay" align="center">
      <div className="space-y-4">
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
    </Modal>
  )
}
