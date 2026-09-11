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
export function BackButton(props: {
  onPress: () => void
  /**
   * 손가락이 닿는 칸과 화살표 색. 옮겨오기 전 열다섯 자리가 이 두 가지였고 그대로 남겼다.
   *
   * `compact` 는 28px 에 흐린 화살표(설정 하위 화면들과 컨텐츠 관리 · 아이템 분배).
   * `regular` 는 36px 에 진한 화살표(가격 입력 · 히스토리).
   */
  size?: 'compact' | 'regular'
}): React.JSX.Element {
  const isRegular = props.size === 'regular'

  return (
    <Pressable
      role="button"
      aria-label="뒤로"
      onPress={() => {
        tapFeedback()
        props.onPress()
      }}
      className={isRegular ? '-ml-2 h-9 w-9 items-center justify-center' : '-ml-1 p-1'}
    >
      <ArrowLeftIcon
        className={`h-5 w-5 ${isRegular ? 'text-text' : 'text-text-muted'}`}
        strokeWidth={2}
        aria-hidden
      />
    </Pressable>
  )
}
