import { Modal } from '../Modal/Modal'
import { ProgressBar } from '../ProgressBar/ProgressBar'

export interface ProgressModalProps {
  message: string
  completed: number
  total: number
}

// 진행률(N/M) 바를 담은 모달. 저장·동기화처럼 완료 시점에만 프로그램적으로 닫는 용도라
// 오버레이 클릭으로 닫히지 않게 onClose를 no-op으로 둔다. 진행률 바 스타일은 온보딩 예열
// 진행률 바([[ADR-016]])와 동일하게 재사용한다.
export function ProgressModal(props: ProgressModalProps): React.JSX.Element {
  const percent = props.total > 0 ? Math.round((props.completed / props.total) * 100) : 0

  return (
    <Modal onClose={() => {}} align="center">
      <div className="space-y-2">
        <p className="text-sm text-text-muted">
          {props.message} ({props.completed}/{props.total})
        </p>
        <ProgressBar percent={percent} aria={{ now: percent, max: 100 }} />
      </div>
    </Modal>
  )
}
