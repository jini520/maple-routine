import { MAPLE_LEAF_PATH } from '../../mapleLeafPath'
import { MapleSpinner } from '../../atoms/MapleSpinner/MapleSpinner'
import {
  resolveContentOffsetPx,
  resolvePullProgress,
  type PullPhase,
} from '@core/lib/pull-to-refresh'

// 당겨서 새로고침 인디케이터(형태는 [[ADR-073]], 마크는 [[ADR-074]]). 표시만 담당한다 —
// 제스처 감지는 usePullToRefresh 훅이, "지금 제스처를 켤 것인가"는 화면이 판단하고,
// 목록을 실제로 내리는 것은 각 화면의 translateY 다.
//
// sticky 헤더 블록의 마지막 자식으로 `absolute inset-x-0 top-full` 에 놓는다. 흐름 자식으로 두고
// 높이를 키우면 터치 프레임마다 목록 전체가 리플로우되고, 보스 수익 화면은 sticky 헤더 높이를
// ResizeObserver 로 실측해 중첩 sticky 오프셋에 쓰므로([[ADR-047]] 결정 3) 펼친 카드 헤더가 손가락을
// 따라 움직인다. 절대 배치는 부모의 실측 높이를 바꾸지 않아 그 연쇄가 아예 생기지 않는다.
//
// 배경·테두리는 두지 않는다([[ADR-073]] 결정 7) — 목록이 내려가 생긴 틈이 곧 페이지 배경이라
// 덮을 것이 없고, 그 위에 또 불투명 면을 깔면 경계선이 두 겹으로 보인다.
//
// 문구는 없다([[ADR-074]] 결정 1). 이 자리에는 두 구간에서 형태·크기가 같은 마크 하나만 있다 —
// 당김 구간은 링이 진행률만큼 그려지고, 손을 떼면 그 링이 그대로 돌기 시작한다(결정 3·4).

export interface PullToRefreshIndicatorProps {
  distance: number
  phase: PullPhase
}

// 두 구간이 같은 값을 쓴다([[ADR-074]] 결정 6) — 손을 떼는 순간 크기가 튀면 한 동작이 두 개로 보인다.
// 벌어진 틈(PULL_THRESHOLD_PX = 56)의 절반이라 위아래로 여백이 남는다.
const MARK_SIZE_PX = 28

// MapleSpinner 와 같은 정규화 값이다 — 같은 경로에 같은 눈금을 써야 두 구간의 링이
// 같은 굵기·같은 궤적으로 보인다([[ADR-074]] 결정 3).
const RING_PATH_LENGTH = 300

export function PullToRefreshIndicator(
  props: PullToRefreshIndicatorProps,
): React.JSX.Element | null {
  if (props.phase === 'idle') return null

  return (
    <div
      data-testid="pull-to-refresh-indicator"
      // 문구가 없으면 role="status" + aria-live 는 읽을 텍스트가 없는 빈 라이브 리전이라
      // 스크린리더에 아무것도 전달하지 못한다([[ADR-074]] 결정 7). 재조회 상태는 헤더의
      // `조회 중...` 이 이미 알리므로([[ADR-061]] 결정 8) 이 자리는 순수 시각 표시다.
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-full z-[1] overflow-hidden"
      // 목록의 translateY 오프셋과 같은 함수·같은 인자다([[ADR-073]] 결정 6) — 두 벌로 계산하면
      // 값이 어긋나는 순간 인디케이터가 카드 위에 겹치거나 반대로 빈 띠가 남는다.
      style={{ height: resolveContentOffsetPx(props.distance, props.phase) }}
    >
      {/* 고정 높이가 아니라 h-full 이다 — 마크가 "현재 벌어진 틈"의 세로 중앙에 있어야 틈이 커질수록
          함께 내려온다. 그 내려옴이 곧 "당김"의 시각적 확인이다. 틈이 작을 때 내용이 넘치는 것은
          루트의 overflow-hidden 이 잘라준다. */}
      <div className="flex h-full items-center justify-center">
        {props.phase === 'refreshing' ? (
          // 같은 외곽선 링이 그대로 돈다([[ADR-074]] 결정 4). 28px이지만 스윕이 아니라 트레일 링인 것은
          // [[ADR-061]] 결정 1에 대한 PTR 한 자리 예외다(결정 5) — 여기서는 크기보다 연속성이 앞선다.
          <MapleSpinner size={MARK_SIZE_PX} className="text-primary-ink" />
        ) : (
          // 스피너가 아니라 제스처 진행률 표시다([[ADR-074]] 결정 3) — 스스로 움직이지 않고 링이
          // 손가락 위치의 함수로 그려지므로 애니메이션 클래스를 붙이지 않는다. 남은 호가 곧 남은 거리다.
          <svg
            data-testid="pull-to-refresh-leaf"
            width={MARK_SIZE_PX}
            height={MARK_SIZE_PX * (130 / 127)}
            viewBox="0 0 127 130"
            className="text-primary-ink"
          >
            <path
              d={MAPLE_LEAF_PATH}
              pathLength={RING_PATH_LENGTH}
              fill="none"
              stroke="currentColor"
              strokeWidth={9}
              strokeLinecap="round"
              strokeDasharray={`${RING_PATH_LENGTH} ${RING_PATH_LENGTH}`}
              strokeDashoffset={RING_PATH_LENGTH * (1 - resolvePullProgress(props.distance))}
            />
          </svg>
        )}
      </div>
    </div>
  )
}
