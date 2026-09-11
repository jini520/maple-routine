import { Pressable, View } from 'react-native'

import { BanIcon, Text } from '../../atoms'

/** 상자·아이콘·글자. 누를 수 있든 아니든 그림은 한 벌이다. */
const BOX_CLASS = 'flex-row items-center gap-1 rounded-full bg-error-tint px-2 py-0.5'

/**
 * **조회할 수 없다**를 값 자리에 적는 알약. 금지 아이콘과 글자가 한 상자에 든다.
 *
 * `Badge` 를 안 쓰는 이유는 아이콘이다. 그쪽은 `Text` 하나거나 그라디언트 상자 하나라 안에
 * 아이콘을 못 넣는다. 색은 `Badge` 의 `error` 와 **같은 값**이다(`bg-error-tint`·`text-error-ink`).
 *
 * 값을 대신 차지하는 자리에만 선다. 이름 옆에 서는 표식은 아이콘만이고 그쪽은
 * `boss-profit/CharacterIssue` 의 `CharacterIssueBadge` 다.
 *
 * @example
 * // 누르면 설명 팝오버가 열리는 자리
 * <UnavailableBadge label="조회 불가" onPress={toggleIssue} />
 *
 * // 열 팝오버가 없는 자리. 칸에 묶여 있으면 `fixed` 를 함께 준다
 * <UnavailableBadge fixed label="조회 불가" />
 */
export function UnavailableBadge(props: {
  label: string
  /** 주면 버튼이 되고 안 주면 그림이다. 누를 곳이 없는 자리가 버튼으로 들리면 안 된다. */
  onPress?: () => void
  /** 상자가 여백으로 자라므로 글자 배수를 끌지는 호출부가 정한다. */
  fixed?: boolean
  className?: string
  testID?: string
}): React.JSX.Element {
  const box = props.className === undefined ? BOX_CLASS : `${BOX_CLASS} ${props.className}`
  const inside = (
    <>
      <BanIcon className="h-3 w-3 text-error-ink" strokeWidth={2.5} aria-hidden />
      <Text fixed={props.fixed} className="text-11 font-bold text-error-ink">
        {props.label}
      </Text>
    </>
  )

  if (props.onPress === undefined) {
    return (
      <View testID={props.testID} className={box}>
        {inside}
      </View>
    )
  }

  return (
    <Pressable
      testID={props.testID}
      role="button"
      aria-label={props.label}
      onPress={props.onPress}
      className={box}
    >
      {inside}
    </Pressable>
  )
}
