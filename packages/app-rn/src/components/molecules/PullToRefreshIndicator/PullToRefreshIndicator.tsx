import { resolveContentOffsetPx, resolvePullProgress, type PullPhase } from '@core/lib/pull-to-refresh'
import { View } from 'react-native'
import { Path } from 'react-native-svg'

import { Svg } from '../../../lib/nativewind-interop'
import { MapleSpinner } from '../../atoms/MapleSpinner/MapleSpinner'
import { MAPLE_LEAF_PATH, MAPLE_LEAF_PATH_LENGTH } from '../../mapleLeafPath'

// 당겨서 새로고침 인디케이터(형태는 [[ADR-073]], 마크는 [[ADR-074]]). 표시만 담당한다 —
// 제스처 감지는 훅이, "지금 제스처를 켤 것인가"는 화면이 판단하고, 목록을 실제로 내리는 것은
// 각 화면의 오프셋이다.
//
// ── ⚠️ RN 의 `RefreshControl` 과 이 컴포넌트는 **겹치는 물건이다** ─────────────────
//
// 화면 배선(step 6 `ScreenScroll`)에서 **둘 중 하나를 골라야 하고, 그것은 제품 결정이다.** 지금
// 판단에 필요한 것만 갈라 적어 둔다.
//
// **`RefreshControl` 이 공짜로 주는 것** — [[ADR-072]]·[[ADR-073]] 이 손으로 만든 것 대부분이다.
//   · 최상단 판정·감쇠·임계값·손 뗀 뒤 정착·재조회 중 유지([[ADR-073]] 결정 4·5) 전부 네이티브
//   · 목록 이동이 **UI 스레드**에서 일어난다 → [[ADR-073]] 「남은 검증」의 *"60fps 로 손가락을 따라
//     오는가"* 와 [[ADR-072]] 결정 8(iOS 러버밴드 억제)이 **질문째 사라진다**
//   · 스크롤 컨테이너가 소유하므로 [[ADR-072]] 결정 14(스크롤 조상 안에서 시작한 터치 제외)도 구조로 해결
//
// **`RefreshControl` 이 줄 수 없는 것** — 정확히 [[ADR-074]] 가 정한 마크다.
//   · 커스텀 그림을 넣을 자리가 없다. iOS 는 시스템 스피너(`tintColor` 만), 안드로이드는 시스템
//     원형 화살표(`colors`·`progressBackgroundColor` 만)다 → **단풍잎 외곽선 링이 사라진다**
//     ([[ADR-074]] 결정 2·4·6)
//   · 당김 진행률을 알려주지 않는다 → **진행률 드로잉**([[ADR-074]] 결정 3, "남은 호가 남은 거리")이
//     원리적으로 불가능하다. 그 결정이 회전을 버리고 드로잉을 고른 이유가 통째로 걸린다
//   · 두 구간이 같은 마크로 이어지는 연속성([[ADR-074]] 결정 4·5 — [[ADR-061]] 결정 1에 PTR 예외를
//     신설하면서까지 지킨 것)도 같은 이유로 표현할 수 없다
//
// 그래서 **이 컴포넌트를 그대로 옮겨 둔다** — 커스텀 쪽을 고르면 이 마크가 그대로 쓰이고,
// `RefreshControl` 을 고르면 [[ADR-074]] 의 결정 넷을 폐기하는 **새 결정**이 필요하다(사용자 지정
// 사항이라 코드가 조용히 정할 일이 아니다).
//
// ── RN 으로 옮기며 바뀐 것 셋 ─────────────────────────────────────────────────────
//
// ① `pathLength={300}` 정규화가 없다 — `react-native-svg` 가 그 속성을 안 받는다. 실측 둘레
//    (`MAPLE_LEAF_PATH_LENGTH`)에 같은 비율을 곱해 **같은 그림**을 만든다(`MapleSpinner` 와 같은 처방).
//    `strokeDashoffset` 도 그래서 `300 × (1−진행률)` 이 아니라 `둘레 × (1−진행률)` 이다.
// ② 높이는 `style={{ height }}` 그대로다 — [[ADR-073]] 결정 6(인디케이터 높이와 목록 오프셋이 한
//    함수에서 나온다)이 유지된다. 계산도 `@core/lib/pull-to-refresh` 의 같은 함수다.
// ③ `aria-hidden` 은 남고 `role`/`aria-live` 는 없다([[ADR-074]] 결정 7) — 문구가 없어 빈 라이브
//    리전이 되는 것은 RN 에서도 같다.
//
// **두 구간이 이제 둘 다 산다**(step 7). 재조회 구간의 링은 `MapleSpinner` 가 `maple-trail` 을
// Reanimated 로 되살리면서 함께 돌기 시작했고 — 이 파일은 한 줄도 안 바뀌었다 — 당김 구간의 드로잉은
// 애니메이션이 아니라 **손가락 위치의 함수**라 원래부터 살아 있었다. 그래서 [[ADR-074]] 결정 4·5 의
// "같은 마크가 그대로 이어진다"가 코드 위에서는 성립한다. **눈으로는 아직 못 봤다** — 두 구간의
// 연속성은 4단계에서 실기기로 볼 대상이다.

export interface PullToRefreshIndicatorProps {
  distance: number
  phase: PullPhase
}

// 두 구간이 같은 값을 쓴다([[ADR-074]] 결정 6) — 손을 떼는 순간 크기가 튀면 한 동작이 두 개로 보인다.
// 벌어진 틈(PULL_THRESHOLD_PX = 56)의 절반이라 위아래로 여백이 남는다.
const MARK_SIZE_PX = 28

export function PullToRefreshIndicator(props: PullToRefreshIndicatorProps): React.JSX.Element | null {
  if (props.phase === 'idle') return null

  return (
    <View
      testID="pull-to-refresh-indicator"
      // 문구가 없으면 role="status" + aria-live 는 읽을 텍스트가 없는 빈 라이브 리전이라
      // 스크린리더에 아무것도 전달하지 못한다([[ADR-074]] 결정 7). 재조회 상태는 헤더의
      // `조회 중...` 이 이미 알리므로([[ADR-061]] 결정 8) 이 자리는 순수 시각 표시다.
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-full z-[1] overflow-hidden"
      // 목록의 오프셋과 같은 함수·같은 인자다([[ADR-073]] 결정 6) — 두 벌로 계산하면
      // 값이 어긋나는 순간 인디케이터가 카드 위에 겹치거나 반대로 빈 띠가 남는다.
      style={{ height: resolveContentOffsetPx(props.distance, props.phase) }}
    >
      {/* 고정 높이가 아니라 h-full 이다 — 마크가 "현재 벌어진 틈"의 세로 중앙에 있어야 틈이 커질수록
          함께 내려온다. 그 내려옴이 곧 "당김"의 시각적 확인이다. 틈이 작을 때 내용이 넘치는 것은
          루트의 overflow-hidden 이 잘라준다. */}
      <View className="h-full items-center justify-center">
        {props.phase === 'refreshing' ? (
          // 같은 외곽선 링이 그대로 돈다([[ADR-074]] 결정 4). 28px이지만 스윕이 아니라 트레일 링인 것은
          // [[ADR-061]] 결정 1에 대한 PTR 한 자리 예외다(결정 5) — 여기서는 크기보다 연속성이 앞선다.
          <MapleSpinner size={MARK_SIZE_PX} className="text-primary-ink" />
        ) : (
          // 스피너가 아니라 제스처 진행률 표시다([[ADR-074]] 결정 3) — 스스로 움직이지 않고 링이
          // 손가락 위치의 함수로 그려진다. 남은 호가 곧 남은 거리다.
          <Svg
            testID="pull-to-refresh-leaf"
            width={MARK_SIZE_PX}
            height={MARK_SIZE_PX * (130 / 127)}
            viewBox="0 0 127 130"
            className="text-primary-ink"
          >
            <Path
              d={MAPLE_LEAF_PATH}
              fill="none"
              stroke="currentColor"
              strokeWidth={9}
              strokeLinecap="round"
              strokeDasharray={[MAPLE_LEAF_PATH_LENGTH, MAPLE_LEAF_PATH_LENGTH]}
              strokeDashoffset={MAPLE_LEAF_PATH_LENGTH * (1 - resolvePullProgress(props.distance))}
            />
          </Svg>
        )}
      </View>
    </View>
  )
}
