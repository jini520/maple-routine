// 「선택됨」 층 행의 `✕` — 그 캐릭터를 목록에서 뺀다([[ADR-144]] 결정 3).
//
// **위험 색을 쓰지 않는다.** 여기서 빼는 것은 저장 전 편집이라 되돌리는 값이 싸다 — 그 계정을
// 열어 다시 누르면 그만이다(다른 계정 소속이면 그 계정을 열어야 한다는 것이 결정 3 의 대가다).
// 위험 색은 [[ADR-118]] 결정 4 의 «실행 행» 문법이라 여기 것이 아니다.
//
// 별과 나란히 서므로 크기·히트 슬롭을 `RepresentativeStar` 와 맞춘다.
import { Pressable } from 'react-native'

import { XIcon } from '../../../lib/icons'

/** 시각 크기(20px)와 권장 타깃(44px)의 차이를 사방으로 나눠 채운다(`RepresentativeStar` 와 같다). */
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 }

export interface RemoveButtonProps {
  /** 접근성 이름 접두 — 목록에서 어느 행의 `✕` 인지 구분한다(캐릭터 이름). */
  label: string
  onPress: () => void
}

export function RemoveButton(props: RemoveButtonProps): React.JSX.Element {
  return (
    <Pressable
      role="button"
      aria-label={`${props.label} 선택 해제`}
      onPress={props.onPress}
      hitSlop={HIT_SLOP}
      className="shrink-0 items-center justify-center"
    >
      <XIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
    </Pressable>
  )
}
