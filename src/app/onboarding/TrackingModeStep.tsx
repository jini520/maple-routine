import { useState } from 'react'
import type { TrackingMode } from '../../storage/tracking-mode'

export interface TrackingModeStepProps {
  onSubmit: (mode: TrackingMode) => void
}

// ADR-035 결정 13/16: 온보딩의 자동/수동 트래킹 모드 선택 단계. 카드 박스 없이 배경 위에 바로
// 놓이는 페이지 레이아웃(ApiKeyForm/AccountSelectionList와 동일)을 따르고, 옵션·CTA 버튼 모두
// AccountSelectionList/ThemeSelector의 기존 선택 카드 클래스를 그대로 재사용한다(신규 스타일 금지).
export function TrackingModeStep(props: TrackingModeStepProps): React.JSX.Element {
  const [mode, setMode] = useState<TrackingMode>('auto')

  return (
    <div className="w-full space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text">진행 상황을 어떻게 관리할까요?</h2>
        <p className="text-sm text-text-muted">나중에 설정에서 언제든 바꿀 수 있어요.</p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          aria-pressed={mode === 'auto'}
          onClick={() => setMode('auto')}
          className={
            mode === 'auto'
              ? 'w-full text-left rounded-[10px] border border-primary bg-primary/15 px-4 py-3'
              : 'w-full text-left rounded-[10px] border border-border px-4 py-3 hover:bg-primary/15'
          }
        >
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">자동 · 게임 등록을 그대로 따라가기</span>
            <span className="shrink-0 rounded-full bg-primary/15 text-primary text-xs font-semibold px-2.5 py-1">
              추천
            </span>
          </span>
          <span className="mt-1 block text-sm text-text-muted">
            게임 내 스케줄러에 등록한 콘텐츠와 완료 여부가 그대로 반영돼요. 등록하지 않은 콘텐츠는 표시되지 않아요.
          </span>
        </button>

        <button
          type="button"
          aria-pressed={mode === 'manual'}
          onClick={() => setMode('manual')}
          className={
            mode === 'manual'
              ? 'w-full text-left rounded-[10px] border border-primary bg-primary/15 px-4 py-3'
              : 'w-full text-left rounded-[10px] border border-border px-4 py-3 hover:bg-primary/15'
          }
        >
          <span className="block text-sm font-semibold text-text">수동 · 내가 직접 관리하기</span>
          <span className="mt-1 block text-sm text-text-muted">
            게임 등록 여부와 상관없이 원하는 콘텐츠만 골라 체크리스트로 관리해요. 지금 등록된 항목으로 목록을 시작하고,
            이후엔 자유롭게 추가·삭제할 수 있어요.
          </span>
        </button>
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
