/**
 * 시트의 메모 칸. 비어 있으면 파인 바탕의 `메모 추가` 칸, 적으면 `메모` 라벨 아래 표면색 칸에 본문 전체.
 * 누르면 부르는 쪽이 여러 줄 입력 카드를 여는 누르개. 본문이 주황이 아닌 것은 여러 줄 글을 주황으로 쓰면 읽기 어렵기 때문.
 */
import { Pressable, View } from 'react-native'

import { PlusIcon, StickyNoteIcon, Text } from '../../atoms'

export interface MemoFieldProps {
  /** 지금 칸에 든 메모. 공백뿐이면 메모 없음이다 */
  memo: string
  onPress: () => void
  /** 본문 글자의 `testID` 는 이 값 뒤에 `-body` 를 붙인다 */
  testID?: string
}

export function MemoField(props: MemoFieldProps): React.JSX.Element {
  if (props.memo.trim() === '') {
    return (
      <Pressable
        testID={props.testID}
        role="button"
        aria-label="메모 추가"
        onPress={props.onPress}
        className="h-[50px] flex-row items-center gap-2.5 rounded-xl bg-control-track px-3 active:opacity-60"
      >
        <View className="h-[30px] w-[30px] items-center justify-center">
          <StickyNoteIcon className="h-[15px] w-[15px] text-text-muted" strokeWidth={2} aria-hidden />
        </View>
        <Text className="flex-1 text-sm text-text-muted">메모 추가</Text>
        <PlusIcon className="h-4 w-4 text-text-muted" strokeWidth={2.6} aria-hidden />
      </Pressable>
    )
  }
  return (
    <Pressable testID={props.testID} role="button" aria-label="메모 고치기" onPress={props.onPress} className="gap-1.5 active:opacity-60">
      <Text className="text-xs text-text">메모</Text>
      <View className="rounded-xl bg-surface px-3 py-2.5">
        <Text testID={props.testID === undefined ? undefined : `${props.testID}-body`} className="text-sm text-text">
          {props.memo}
        </Text>
      </View>
    </Pressable>
  )
}
