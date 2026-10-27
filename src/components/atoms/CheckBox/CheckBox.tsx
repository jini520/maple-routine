import { View } from 'react-native'

import { withAlpha } from '../../../lib/color'
import { useThemeAppearance } from '../../../theme/context'
import { CheckIcon } from '../Icon'

/**
 * 체크박스의 네모 하나. 라벨은 부르는 쪽이 붙인다.
 *
 * 테두리 없이 채움으로 가른다. 꺼진 상자는 글자색 14% 반투명이라 화면 바탕 · 카드 · 칸 · 시트 어디에 놓여도
 * 보인다. `card-inset` 으로 채우면 라이트의 화면 바탕 위에서 묻힌다.
 *
 * 모서리는 `rounded-md`(6px)다. 4px 는 각지고 완전한 원은 고르는 하나로 읽힌다. 획이 얇아야
 * 12px 안에서 안 뭉갠다. 3 은 체크가 삼각형처럼 보인다.
 */
export function CheckBox(props: { checked: boolean }): React.JSX.Element {
  const { definition } = useThemeAppearance()

  return (
    <View
      testID="checkbox-box"
      className={`h-[18px] w-[18px] items-center justify-center rounded-md${props.checked ? ' bg-primary' : ''}`}
      style={props.checked ? undefined : { backgroundColor: withAlpha(definition.text, 0.14) }}
    >
      {props.checked && (
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <CheckIcon className="h-3 w-3 text-on-primary" strokeWidth={2.5} aria-hidden />
      )}
    </View>
  )
}
