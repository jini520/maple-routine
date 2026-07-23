import { useState } from 'react'
import type { TrackingMode } from '../../storage/tracking-mode'
import {
  TRACKING_MODE_OPTIONS,
  TRACKING_MODE_RECOMMENDED_BADGE,
} from '../../features/tracking-mode/copy'

export interface TrackingModeStepProps {
  onSubmit: (mode: TrackingMode) => void
}

// ADR-035 결정 13/16: 온보딩의 자동/수동 트래킹 모드 선택 단계. 카드 박스 없이 배경 위에 바로
// 놓이는 페이지 레이아웃(ApiKeyForm/AccountSelectionList와 동일)을 따르고, 옵션·CTA 버튼 모두
// AccountSelectionList/ThemeSelector의 기존 선택 카드 클래스를 그대로 재사용한다(신규 스타일 금지).
// 옵션 문구는 설정(TrackingModeSelector)과 공유하는 공용 카피를 재사용한다.
export function TrackingModeStep(props: TrackingModeStepProps): React.JSX.Element {
  const [mode, setMode] = useState<TrackingMode>('auto')

  return (
    <div className="w-full space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text">진행 상황을 어떻게 관리할까요?</h2>
        <p className="text-sm text-text-muted">나중에 설정에서 언제든 바꿀 수 있어요.</p>
      </div>

      <div className="space-y-2">
        {TRACKING_MODE_OPTIONS.map((option) => {
          const isSelected = mode === option.mode
          return (
            <button
              key={option.mode}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setMode(option.mode)}
              className={
                isSelected
                  ? 'w-full text-left rounded-[10px] border border-primary bg-primary/15 px-4 py-3'
                  : 'w-full text-left rounded-[10px] border border-border px-4 py-3 hover:bg-primary/15'
              }
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text">{option.title}</span>
                {option.recommended && (
                  <span className="shrink-0 rounded-full bg-primary/15 text-primary text-xs font-semibold px-2.5 py-1">
                    {TRACKING_MODE_RECOMMENDED_BADGE}
                  </span>
                )}
              </span>
              <span className="mt-1 block text-sm text-text-muted">{option.description}</span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => props.onSubmit(mode)}
        className="w-full rounded-full bg-primary text-bg font-semibold hover:bg-primary-hover px-5 py-2.5 disabled:opacity-50"
      >
        계속하기
      </button>
    </div>
  )
}
