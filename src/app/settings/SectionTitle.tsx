/**
 * 카드 하나를 덮는 제목 줄. 더보기와 설정이 같이 쓴다.
 *
 * 더보기의 소식 갈래 제목(`NoticeSectionHeader`)과 **같은 자리·같은 글자인데 `전체` 가 없다.**
 * 소식의 `전체` 는 그 갈래의 목록 화면을 여는 것이고, 이 제목이 덮는 카드에는 열 목록이 없다.
 */
import { View } from 'react-native'

import { Text } from '../../components/atoms'

export function SectionTitle(props: { children: string }): React.JSX.Element {
  return (
    <View className="px-1">
      <Text className="text-sm font-semibold text-text">{props.children}</Text>
    </View>
  )
}
