/**
 * 통계 화면의 섹션 하나. 페이지 좌우 여백 안에 선 테두리 없는 카드이고 섹션 사이는 페이지 바탕색 틈이다.
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
    <View testID={props.testID} className="gap-3 rounded-[14px] bg-stats-section px-4 py-[18px]">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text">{props.title}</Text>
        {props.trailing}
      </View>
      {props.children}
    </View>
  )
}
