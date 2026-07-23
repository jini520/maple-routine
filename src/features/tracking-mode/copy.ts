import type { TrackingMode } from '../../storage/tracking-mode'

export interface TrackingModeOptionCopy {
  mode: TrackingMode
  title: string
  description: string
  /** '추천' 배지를 붙일지 — 기본 모드(auto)에만 붙는다. */
  recommended?: boolean
}

// 온보딩(TrackingModeStep)과 설정(TrackingModeSelector) 두 곳이 같은 문구를 쓴다 — 한쪽만
// 고치면 어긋나므로 카피를 여기 한 곳에 모아 둔다(ADR-035 결정 1).
export const TRACKING_MODE_OPTIONS: TrackingModeOptionCopy[] = [
  {
    mode: 'auto',
    title: '자동 · 게임 등록을 그대로 따라가기',
    description:
      '게임 내 스케줄러에 등록한 콘텐츠와 완료 여부가 그대로 반영돼요. 등록하지 않은 콘텐츠는 표시되지 않아요.',
    recommended: true,
  },
  {
    mode: 'manual',
    title: '수동 · 내가 직접 관리하기',
    description:
      '게임 등록 여부와 상관없이 원하는 콘텐츠만 골라 체크리스트로 관리해요. 지금 등록된 항목으로 목록을 시작하고, 이후엔 자유롭게 추가·삭제할 수 있어요.',
  },
]

export const TRACKING_MODE_RECOMMENDED_BADGE = '추천'

// 설정 리스트 행 배지처럼 짧은 라벨이 필요한 곳에서 쓴다.
export const TRACKING_MODE_LABELS: Record<TrackingMode, string> = {
  auto: '자동',
  manual: '수동',
}
