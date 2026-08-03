import { Gamepad2, Info, ListChecks } from 'lucide-react'
import type { TrackingMode } from '../../storage/tracking-mode'
import { TRACKING_MODE_OPTIONS } from '../../features/tracking-mode/copy'

export interface TrackingModeSelectorProps {
  mode: TrackingMode
  /** 결정 14(a) 시드가 진행 중이면 옵션을 비활성화한다(ADR-035 결정 15). */
  isApplying: boolean
  onSelect: (mode: TrackingMode) => void
}

// 온보딩 TrackingModeStep과 같은 뜻의 아이콘을 쓴다 — 선택 이유는 그쪽 파일 주석(ADR-035 결정 22).
const OPTION_ICONS = { auto: Gamepad2, manual: ListChecks } as const

// TrackingModeModal 안에 들어가는 선택 목록 — 모달 자체가 카드 역할을 하므로 여기서는 카드
// 테두리를 다시 두르지 않는다. 문구와 **카드 안쪽 구조** 모두 온보딩 TrackingModeStep과 같아야
// 한다(ADR-035 결정 22) — 공용 카피를 함께 쓰므로 한쪽만 고치면 같은 선택지가 두 화면에서 다르게
// 생긴다. 규격은 docs/features/settings.md "트래킹 모드 옵션 카드".
export function TrackingModeSelector(props: TrackingModeSelectorProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      {TRACKING_MODE_OPTIONS.map((option) => {
        const isSelected = props.mode === option.mode
        const Icon = OPTION_ICONS[option.mode]
        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={isSelected}
            disabled={props.isApplying}
            onClick={() => props.onSelect(option.mode)}
            className={
              isSelected
                ? 'w-full text-left rounded-[10px] border border-primary bg-primary-tint px-4 py-3 disabled:opacity-50'
                : 'w-full text-left rounded-[10px] border border-border px-4 py-3 hover:bg-primary-tint disabled:opacity-50'
            }
          >
            <span className="flex items-start gap-3">
              <Icon className="h-5 w-5 flex-none text-primary-ink" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">{option.title}</span>
                <span className="mt-0.5 block text-sm text-text-muted">{option.description}</span>
              </span>
            </span>
            {/* 고칠 수 없는 알려진 제약이라 실패(error)가 아니라 고지다 — UnavailableNotice와
                같은 정보 톤을 카드 안 크기로 승계한다(ADR-060 결정 5, ADR-035 결정 22). */}
            <span className="mt-2 flex items-start gap-1.5 rounded-[8px] bg-info-tint px-2.5 py-1.5 text-xs text-info-ink">
              <Info className="mt-px h-3.5 w-3.5 flex-none" strokeWidth={1.75} aria-hidden="true" />
              {option.caution}
            </span>
          </button>
        )
      })}
    </div>
  )
}
