/**
 * 통계 화면의 섹션 하나. 테두리 없이 화면 양끝까지 펴고 섹션 사이는 페이지 바탕색 틈이다.
 */
import { View } from 'react-native'

import { Text } from '../../components/atoms'

export function StatsSection(props: {
  title: string
  trailing?: React.ReactNode
  children: React.ReactNode
  testID?: string
}): React.JSX.Element {
  return (
    <View testID={props.testID} className="-mx-4 gap-3 bg-stats-section px-4 py-[18px]">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text">{props.title}</Text>
        {props.trailing}
      </View>
      {props.children}
    </View>
  )
}
