import { Modal } from '../../components/Modal/Modal'
import type { SchedulerContentTemplateEntry } from '../../lib/manual-content-merge'
import schedulerContentTemplate from '../../data/scheduler-content-template.json'

const contentTemplate = schedulerContentTemplate as {
  daily: SchedulerContentTemplateEntry[]
  weekly: SchedulerContentTemplateEntry[]
}

export interface ManualContentPickerModalProps {
  tab: 'daily' | 'weekly'
  /** 이미 추적 중인 content_name 목록 — 후보에서 제외한다. */
  alreadyTracked: string[]
  onAdd: (contentName: string) => void
  onClose: () => void
}

// ADR-035 결정 11: 수동 추적 "추가"는 고정 템플릿(scheduler-content-template.json)에서만 고른다 —
// 자유 텍스트 입력도, 과거 이력 자동완성도 없다(템플릿에 없는 콘텐츠는 애초에 추가 대상이 아님).
export function ManualContentPickerModal(props: ManualContentPickerModalProps): React.JSX.Element {
  const candidates = contentTemplate[props.tab].filter(
    (entry) => !props.alreadyTracked.includes(entry.content_name),
  )

  return (
    <Modal onClose={props.onClose} testId="manual-content-picker-overlay">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-text">항목 추가</h2>
        <p className="text-sm text-text-muted">추적할 항목을 선택해주세요.</p>
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-text-muted">추가할 수 있는 항목이 없습니다.</p>
      ) : (
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
          {candidates.map((entry) => (
            <li key={entry.content_name}>
              <button
                type="button"
                onClick={() => {
                  props.onAdd(entry.content_name)
                  props.onClose()
                }}
                className="w-full rounded-[10px] border border-border px-4 py-3 text-left text-sm text-text hover:bg-primary/15"
              >
                {entry.content_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
