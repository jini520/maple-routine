import type { TrackingMode } from '../../storage/tracking-mode'
import { TRACKING_MODE_OPTIONS } from '../../features/tracking-mode/copy'

export interface TrackingModeSelectorProps {
  mode: TrackingMode
  /** 결정 14(a) 시드가 진행 중이면 옵션을 비활성화한다(ADR-035 결정 15). */
  isApplying: boolean
  onSelect: (mode: TrackingMode) => void
}

// TrackingModeModal 안에 들어가는 선택 목록 — 모달 자체가 카드 역할을 하므로 여기서는 카드
// 테두리를 다시 두르지 않는다. 문구는 온보딩 TrackingModeStep과 동일한 공용 카피를 재사용한다.
export function TrackingModeSelector(props: TrackingModeSelectorProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      {TRACKING_MODE_OPTIONS.map((option) => {
        const isSelected = props.mode === option.mode
        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={isSelected}
            disabled={props.isApplying}
            onClick={() => props.onSelect(option.mode)}
            className={
              isSelected
                ? 'w-full text-left rounded-[10px] border border-primary bg-primary/15 px-4 py-3 disabled:opacity-50'
                : 'w-full text-left rounded-[10px] border border-border px-4 py-3 hover:bg-primary/15 disabled:opacity-50'
            }
          >
            <span className="block text-sm font-semibold text-text">{option.title}</span>
            <span className="mt-1 block text-sm text-text-muted">{option.description}</span>
          </button>
        )
      })}
    </div>
  )
}
