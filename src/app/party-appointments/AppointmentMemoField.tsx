/**
 * 시트의 메모 칸. 시트는 키보드를 받지 않으므로 칸은 누르개이고, 누르면 부르는 쪽이 여러 줄 입력 카드를 연다.
 *
 * 추가 · 수정에서 메모가 없으면 파인 바탕의 `메모 추가` 칸이다. 다른 칸이 표면색으로 떠 있어 아직 비어 있는 칸으로 읽힌다.
 * 메모가 있으면 `메모` 라벨 아래 표면색 칸에 본문 전체를 일반 글자색으로 적는다. 바꿀 수 있는 값을 주황으로 쓰는 시트 규칙의
 * 예외다. 여러 줄의 글은 주황이면 읽기 어렵다. 상세에서는 다른 타일처럼 메모 타일이고, 메모가 없으면 칸째 없다.
 */
import { Pressable, View } from 'react-native'

import { PlusIcon, StickyNoteIcon, Text } from '../../components/atoms'

export interface AppointmentMemoFieldProps {
  /** 저장된 그대로의 메모. 빈 글자는 메모 없음이다 */
  memo: string
  /** 상세. 누를 수 없고 메모가 없으면 아무것도 안 그린다 */
  readOnly?: boolean
  onPress: () => void
}

function MemoBody(props: { memo: string }): React.JSX.Element {
  return (
    <Text testID="appointment-memo-body" className="text-sm text-text">
      {props.memo}
    </Text>
  )
}

export function AppointmentMemoField(props: AppointmentMemoFieldProps): React.JSX.Element | null {
  const empty = props.memo.trim() === ''
  if (props.readOnly === true) {
    if (empty) return null
    return (
      <View className="px-4">
        <View className="gap-1 rounded-xl bg-surface px-3 pb-3 pt-2.5">
          <View className="flex-row items-center gap-1">
            <StickyNoteIcon className="h-3 w-3 text-text-muted" strokeWidth={2.2} aria-hidden />
            <Text className="text-11 text-text-muted">메모</Text>
          </View>
          <MemoBody memo={props.memo} />
        </View>
      </View>
    )
  }
  if (empty) {
    return (
      <View className="px-4">
        <Pressable
          role="button"
          aria-label="메모 추가"
          onPress={props.onPress}
          className="h-[50px] flex-row items-center gap-2.5 rounded-xl bg-control-track px-3 active:opacity-60"
        >
          <View className="h-[30px] w-[30px] items-center justify-center">
            <StickyNoteIcon className="h-[15px] w-[15px] text-text-muted" strokeWidth={2} aria-hidden />
          </View>
          <Text className="flex-1 text-sm font-semibold text-text-muted">메모 추가</Text>
          <PlusIcon className="h-4 w-4 text-text-muted" strokeWidth={2.6} aria-hidden />
        </Pressable>
      </View>
    )
  }
  return (
    <Pressable role="button" aria-label="메모 고치기" onPress={props.onPress} className="gap-1.5 px-4 active:opacity-60">
      <Text className="text-13 font-semibold text-text">메모</Text>
      <View className="rounded-xl bg-surface px-3 py-2.5">
        <MemoBody memo={props.memo} />
      </View>
    </Pressable>
  )
}
