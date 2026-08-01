import { MAPLE_LEAF_PATH } from '../mapleLeafPath'
import { MapleSweepSpinner } from '../MapleSweepSpinner/MapleSweepSpinner'
import { resolveBandHeightPx, resolvePullProgress, type PullPhase } from '../../lib/pull-to-refresh'

// 당겨서 새로고침 인디케이터([[ADR-072]] 결정 4~7). 표시만 담당한다 —
// 제스처 감지는 usePullToRefresh 훅이, "지금 제스처를 켤 것인가"는 화면이 판단한다.
//
// sticky 헤더 블록의 마지막 자식으로 `absolute inset-x-0 top-full` 에 놓는다. 흐름 자식으로 두고
// 높이를 키우면 터치 프레임마다 목록 전체가 리플로우되고, 보스 수익 화면은 sticky 헤더 높이를
// ResizeObserver 로 실측해 중첩 sticky 오프셋에 쓰므로([[ADR-047]] 결정 3) 펼친 카드 헤더가 손가락을
// 따라 움직인다. 절대 배치는 부모의 실측 높이를 바꾸지 않아 그 연쇄가 아예 생기지 않는다.

export interface PullToRefreshBannerProps {
  distance: number
  phase: PullPhase
}

const MESSAGE: Record<Exclude<PullPhase, 'idle'>, string> = {
  // 앞의 둘은 대기 표시가 아니라 제스처 안내라 어미 규칙의 대상이 아니고,
  // 재조회 문구는 `~중...` 을 쓰지 않는다([[ADR-061]] 결정 9).
  pulling: '당겨서 새로고침',
  ready: '놓으면 새로고침',
  refreshing: '새로고침하고 있어요',
}

export function PullToRefreshBanner(props: PullToRefreshBannerProps): React.JSX.Element | null {
  if (props.phase === 'idle') return null

  const progress = resolvePullProgress(props.distance)

  return (
    <div
      data-testid="pull-to-refresh-banner"
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-full z-[1] overflow-hidden border-b border-border bg-bg"
      style={{ height: resolveBandHeightPx(props.distance, props.phase) }}
    >
      {/* h-14(56px)는 PULL_THRESHOLD_PX 와 같은 값이다 — 내용 높이가 고정이라 루트의 overflow-hidden 이
          위에서부터 드러내는 효과를 내고, 배너가 꽉 차는 순간이 곧 임계값 도달이 된다. */}
      <div className="flex h-14 items-center justify-center gap-2">
        {props.phase === 'refreshing' ? (
          <MapleSweepSpinner size={24} className="text-primary-ink" />
        ) : (
          // 스피너가 아니라 제스처 진행률 표시다([[ADR-072]] 결정 7) — 스스로 움직이지 않고
          // 손가락 위치의 함수로 회전각·불투명도가 정해지므로 애니메이션 클래스를 붙이지 않는다.
          <svg
            data-testid="pull-to-refresh-leaf"
            aria-hidden="true"
            viewBox="0 0 127 130"
            className="h-5 w-5 text-primary-ink"
            style={{ transform: `rotate(${progress * 180}deg)`, opacity: 0.3 + 0.7 * progress }}
          >
            <path d={MAPLE_LEAF_PATH} fill="currentColor" />
          </svg>
        )}
        <span className="text-sm text-text-muted">{MESSAGE[props.phase]}</span>
      </div>
    </div>
  )
}
