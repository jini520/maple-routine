import { Modal } from '../../components/Modal/Modal'

// 공용 Modal을 쓴다 — 직접 오버레이를 그리면 호출부의 space-y-* margin에 fixed inset-0 높이가
// 깎여 하단 제스처 영역만 딤이 빠진다(38c6ed7과 동일 기전, 실기기 확인). Modal은 body로 포털 렌더링.
export interface CacheClearConfirmProps {
  isOpen: boolean
  isClearing: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function CacheClearConfirm(props: CacheClearConfirmProps): React.JSX.Element | null {
  if (!props.isOpen) return null

  return (
    <Modal onClose={props.onCancel} testId="cache-clear-confirm-overlay" align="center">
      <div className="space-y-4">
        <h2 className="text-base font-bold text-text">캐시 데이터 삭제</h2>

        <div className="border-t border-border">
          <div className="flex items-start justify-between gap-4 border-b border-border py-2.5">
            <span className="shrink-0 pt-0.5 text-xs font-semibold text-text-muted">삭제됨</span>
            <span className="text-right text-sm font-semibold text-error">
              스케줄 캐시 · 추적 캐릭터 · 보스 수익 기록
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 border-b border-border py-2.5">
            <span className="shrink-0 pt-0.5 text-xs font-semibold text-text-muted">유지됨</span>
            <span className="text-right text-sm text-text">API 키</span>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-text-muted">
          보스 수익 기록은 NEXON Open API에서 최근 2주 데이터만 제공돼 삭제 후 복구할 수 없습니다.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={props.isClearing}
            onClick={props.onCancel}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={props.isClearing}
            onClick={props.onConfirm}
            className="rounded-full border border-error px-5 py-2.5 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-50"
          >
            {props.isClearing ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
