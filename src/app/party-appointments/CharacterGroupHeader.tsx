/**
 * 시트 보스 목록의 캐릭터 묶음 머리 줄. 캐릭터 얼굴 · 이름 · 보스 수. 캐릭터 색 대신 얼굴로 어느 캐릭터인지 알린다.
 */
import { View } from 'react-native'

import { Text } from '../../components/atoms'
import { CharacterAvatar } from '../../components/molecules/CharacterAvatar/CharacterAvatar'

export interface CharacterGroupHeaderProps {
  name: string
  imageUrl: string | null
  /** 묶음의 보스 수 */
  count: number
}

export function CharacterGroupHeader(props: CharacterGroupHeaderProps): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-1.5">
      <CharacterAvatar imageUrl={props.imageUrl} name={props.name} size={20} className="bg-surface-2" />
      <Text className="shrink text-13 font-bold text-text" numberOfLines={1}>
        {props.name}
      </Text>
      <Text className="text-11 text-text-muted">보스 {props.count}</Text>
    </View>
  )
}
