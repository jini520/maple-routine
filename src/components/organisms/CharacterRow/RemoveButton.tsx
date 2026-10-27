/**
 * `선택됨` 층 행의 `✕`. 그 캐릭터를 목록에서 뺀다.
 *
 * 위험 색을 쓰지 않는다. 여기서 빼는 것은 저장 전 편집이라 되돌리는 값이 싸다. 그 계정을 열어
 * 다시 누르면 그만이다. 위험 색은 실행 행 문법이라 여기 것이 아니다.
 *
 * 별과 나란히 서므로 누름 상자(40×44)를 `RepresentativeStar` 와 맞추고, 둘 다 `hitSlop` 을 쓰지 않는다. 늘린 영역이
 * 겹치면 겹친 곳을 나중에 그려진 이 버튼이 가져가 별을 누르려다 빼게 된다.
 */
import { Pressable } from 'react-native'

import { XIcon } from '../../atoms'

export interface RemoveButtonProps {
  /** 접근성 이름 접두. 목록에서 어느 행의 `✕` 인지 구분한다(캐릭터 이름). */
  label: string
  onPress: () => void
}

export function RemoveButton(props: RemoveButtonProps): React.JSX.Element {
  return (
    <Pressable
      role="button"
      aria-label={`${props.label} 선택 해제`}
      onPress={props.onPress}
      className="h-11 w-10 shrink-0 items-center justify-center"
    >
      <XIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
    </Pressable>
  )
}
