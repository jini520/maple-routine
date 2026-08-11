import { useState } from 'react'
import { Gamepad2, Info, ListChecks } from 'lucide-react'
import type { TrackingMode } from '@core/storage/tracking-mode'
import { TRACKING_MODE_OPTIONS } from '@core/features/tracking-mode/copy'
import { Button } from '../../components/atoms/Button/Button'

export interface TrackingModeStepProps {
  onSubmit: (mode: TrackingMode) => void
}

// 자동은 "게임에서 정한 것을 따른다"는 주어를 가리키고, 수동은 "앱에서 고른다"를 가리킨다
// (ADR-035 결정 22). RefreshCw(동기화)는 이 앱에서 새로고침 버튼의 기능 신호라 누를 수 없는
// 자리에 두면 뜻이 흐려져 기각했다.
const OPTION_ICONS = { auto: Gamepad2, manual: ListChecks } as const

// ADR-035 결정 13/16/17/22: 온보딩의 자동/수동 트래킹 모드 선택 단계. 카드 박스 없이 배경 위에 바로
// 놓이는 페이지 레이아웃(ApiKeyForm/AccountSelectionList와 동일)을 따르고, 바깥 선택 카드 클래스는
// AccountSelectionList/ThemeSelector와 계속 공유한다 — 결정 22가 푼 것은 카드 **안쪽**뿐이다.
// 카드 안쪽(아이콘·설명·주의 박스)은 설정 TrackingModeSelector와 같은 모양이어야 한다(공용 카피를
// 함께 쓰므로 한쪽만 고치면 같은 선택지가 두 화면에서 다르게 생긴다) — 규격은 docs/features/settings.md.
// 설명·주의는 접지 않고 항상 보여준다(고르기 **전에** 둘을 비교하는 화면이다). 기본 선택은 없으며,
// 사용자가 직접 고르기 전까지 "계속하기"를 비활성화한다(결정 17).
export function TrackingModeStep(props: TrackingModeStepProps): React.JSX.Element {
  const [mode, setMode] = useState<TrackingMode | null>(null)

  return (
    <div className="w-full space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text">스케줄러를 어떻게 관리할까요?</h2>
        <p className="text-sm text-text-muted">나중에 설정에서 언제든 바꿀 수 있어요.</p>
      </div>

      <div className="space-y-2">
        {TRACKING_MODE_OPTIONS.map((option) => {
          const isSelected = mode === option.mode
          const Icon = OPTION_ICONS[option.mode]
          return (
            <button
              key={option.mode}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setMode(option.mode)}
              className={
                isSelected
                  ? 'w-full text-left rounded-[10px] border border-primary bg-primary-tint px-4 py-3'
                  : 'w-full text-left rounded-[10px] border border-border px-4 py-3 hover:bg-primary-tint'
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

      <Button
        variant="primary"
        disabled={mode === null}
        onClick={() => {
        if (mode !== null) props.onSubmit(mode)
        }}
        className="w-full disabled:opacity-50"
      >
        계속하기
      </Button>
    </div>
  )
}
