/**
 * 파티 스케줄 시트의 메모 칸. 추가 · 수정에서는 공용 메모 칸(`MemoField`)이고, 누르면 부르는 쪽이 여러 줄 입력 카드를 연다.
 * 상세에서는 다른 타일처럼 메모 타일이고, 메모가 없으면 칸째 없다.
 */
import { View } from 'react-native'

import { StickyNoteIcon, Text } from '../../components/atoms'
import { MemoField } from '../../components/molecules/MemoField/MemoField'

export interface AppointmentMemoFieldProps {
  /** 저장된 그대로의 메모. 빈 글자는 메모 없음이다 */
  memo: string
  /** 상세. 누를 수 없고 메모가 없으면 아무것도 안 그린다 */
  readOnly?: boolean
  onPress: () => void
}

export function AppointmentMemoField(props: AppointmentMemoFieldProps): React.JSX.Element | null {
  if (props.readOnly !== true) {
    return (
      <View className="px-4">
        <MemoField memo={props.memo} onPress={props.onPress} testID="appointment-memo" />
      </View>
    )
  }
  if (props.memo.trim() === '') return null
  return (
    <View className="px-4">
      <View className="gap-1 rounded-xl bg-surface px-3 pb-3 pt-2.5">
        <View className="flex-row items-center gap-1">
          <StickyNoteIcon className="h-3 w-3 text-text-muted" strokeWidth={2.2} aria-hidden />
          <Text className="text-xs text-text-muted">메모</Text>
        </View>
        <Text testID="appointment-memo-body" className="text-sm text-text">
          {props.memo}
        </Text>
      </View>
    </View>
  )
}
