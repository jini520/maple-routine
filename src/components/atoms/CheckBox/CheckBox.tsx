import { View } from 'react-native'

import { CheckIcon } from '../Icon'

/**
 * 체크박스의 네모 하나. 라벨은 부르는 쪽이 붙인다.
 *
 * 끈 것도 상자가 보인다. 맨 테두리 하나면 어두운 배경에서 그 선이 잘 안 보여 켜짐과 꺼짐이
 * 색 하나로만 갈린다. 끈 쪽에 옅은 바탕을 깔면 상자가 먼저 눈에 들고 그 안이 차는 것이 곧
 * 켜짐이 된다.
 *
 * 모서리는 `rounded-md`(6px)다. 4px 는 각지고 완전한 원은 고르는 하나로 읽힌다. 획이 얇아야
 * 12px 안에서 안 뭉갠다. 3 은 체크가 삼각형처럼 보인다.
 */
export function CheckBox(props: { checked: boolean }): React.JSX.Element {
  return (
    <View
      className={`h-[18px] w-[18px] items-center justify-center rounded-md border ${
        props.checked ? 'border-primary bg-primary' : 'border-border bg-surface-2'
      }`}
    >
      {props.checked && (
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <CheckIcon className="h-3 w-3 text-on-primary" strokeWidth={2.5} aria-hidden />
      )}
    </View>
  )
}
