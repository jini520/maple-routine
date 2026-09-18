/**
 * 미완료 행의 둘째 줄을 통째로 채우는 단추. 누르면 완료 기록 시트가 열린다.
 *
 * 파티원 수 스테퍼 자리부터 상태 배지 자리까지가 이 단추다. 그 줄의 스테퍼는 미완료 행에서 어차피
 * 꺼져 있고(금액이 0으로 고정이라 조절할 것이 없다) 배지는 `미완료` 한 낱말이라, 둘을 비우고 여기에
 * **무엇을 할 수 있는지**를 적는다.
 *
 * 글자가 두 줄인 것은 단추 하나가 두 가지를 말해야 해서다. 위는 왜 이 단추가 여기 있나, 아래는
 * 누르면 무엇이 되나. `완료 처리` 한 낱말만 두면 무슨 일이 일어날지 아무도 모른다(사용자 지적).
 */
import { Pressable, View } from 'react-native'

import { CheckCircle2Icon, ChevronRightIcon, Text } from '../../components/atoms'

export function ManualCompletionButton(props: {
  /** 읽어 주는 이름의 뿌리. 보스 이름이 든다. */
  label: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      role="button"
      aria-label={`${props.label} 완료 상태로 변경`}
      onPress={props.onPress}
      className="mt-2 w-full flex-row items-center gap-2.5 rounded-xl bg-primary-tint px-3 py-2 active:opacity-60"
    >
      <CheckCircle2Icon className="h-5 w-5 shrink-0 text-primary-ink" strokeWidth={1.75} aria-hidden />

      <View className="min-w-0 flex-1">
        <Text className="text-11 text-text-muted">직접 완료할 수 있는 보스예요</Text>
        <Text className="mt-px text-13 font-bold text-primary-ink">완료 상태로 변경하기</Text>
      </View>

      {/* 꺾쇠가 **창이 하나 더 열린다**고 말한다. 눌러서 바로 완료가 되는 것이 아니라 난이도와
          날짜를 고르는 자리로 간다. */}
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-primary-ink" strokeWidth={2} aria-hidden />
    </Pressable>
  )
}
