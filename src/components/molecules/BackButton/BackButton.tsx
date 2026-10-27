import { Pressable } from 'react-native'

import { ArrowLeftIcon } from '../../atoms'
import { tapFeedback } from '../../../native/haptics'

/**
 * 페이지 헤더의 `←`. 누르면 두드림을 내고 `onPress` 를 부른다.
 *
 * **새 페이지의 뒤로 버튼은 이것을 쓴다.** 호출부마다 `Pressable` 을 세우면 다음 페이지가
 * 두드림을 빠뜨리고, 그 페이지에서만 손끝이 조용한 것을 아무도 못 본다.
 *
 * 시트 안에서 단계를 되돌리는 `←` 는 이 부품이 아니다. 그쪽은 페이지를 안 떠난다.
 *
 * @example
 * <BackButton onPress={() => navigation.goBack()} />
 */
export function BackButton(props: { onPress: () => void }): React.JSX.Element {
  // 화면 머리의 뒤로가기는 어디서나 같은 역할이라 모양이 하나다(28px · 흐린 화살표).
  return (
    <Pressable
      role="button"
      aria-label="뒤로"
      onPress={() => {
        tapFeedback()
        props.onPress()
      }}
      className="-ml-1 p-1"
    >
      <ArrowLeftIcon
        className="h-5 w-5 text-text-muted"
        strokeWidth={2}
        aria-hidden
      />
    </Pressable>
  )
}
