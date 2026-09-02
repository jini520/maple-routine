// 대표 캐릭터 표식 — 「선택됨」 층 행의 오른쪽([[ADR-144]] 결정 4).
//
// 별의 **뜻이 바뀌었다**: [[ADR-015]] 에서 별은 «고름» 이었는데, 카드가 자리를 옮기는 것이 곧 고름이
// 되면서(결정 3) 그 자리가 비었고 «대표» 가 들어왔다.
//
// ── 이 컴포넌트가 지키는 것 셋 ─────────────────────────────────────────────────────
//
// ① **배경도 테두리도 없다.** 채워진 별은 그 자체로 이미 «찬 것 vs 빈 것» 이라 뒤에 색판을 깔면 같은
//    말을 두 번 한다(그 배지 문법은 [[ADR-118]] 의 «값 배지» 것이다).
// ② **흐림은 톤만 낮춘다 — 비활성이 아니다.** 대표가 정해지면 나머지가 흐려지는 것은 «여럿 고를 수
//    없다» 는 말이고, 못 누르게 하면 **대표를 바꿀 방법이 사라진다**.
// ③ **`fill` 은 클래스가 아니라 프롭이다**(`CharacterTrackingGrid` 파일 머리 ⑦) — `fill-primary-ink`
//    는 CSS 속성이라 NativeWind 가 RN 스타일로 내지 못하고 조용히 사라진다(별이 테두리만 남는다).
import { Pressable } from 'react-native'

import { StarIcon } from '../../atoms'
import { useThemeAppearance } from '../../../theme/context'

/** 시각 크기(20px)와 권장 타깃(44px)의 차이를 사방으로 나눠 채운다(`PartySizeStepper` 와 같은 처방). */
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 }

export interface RepresentativeStarProps {
  /** 접근성 이름 접두 — 목록에서 어느 행의 별인지 구분한다(캐릭터 이름). */
  label: string
  filled: boolean
  /** 대표가 **다른 행에** 정해졌다 — 톤만 낮춘다(위 ②). */
  dimmed?: boolean
  onPress: () => void
}

export function RepresentativeStar(props: RepresentativeStarProps): React.JSX.Element {
  const { definition } = useThemeAppearance()

  return (
    <Pressable
      role="button"
      aria-selected={props.filled}
      aria-label={`${props.label} 대표 캐릭터`}
      onPress={props.onPress}
      hitSlop={HIT_SLOP}
      className={`shrink-0 items-center justify-center${props.dimmed === true ? ' opacity-40' : ''}`}
    >
      <StarIcon
        className={props.filled ? 'h-5 w-5 text-primary-ink' : 'h-5 w-5 text-text-muted'}
        fill={props.filled ? definition.primaryInk : 'none'}
        strokeWidth={1.5}
      />
    </Pressable>
  )
}
