/**
 * 목록 카드 · 선택 줄에서 캐릭터 묶음 왼쪽 열에 서는 얼굴과 이름. 열 폭이 묶음마다 같아 보스 줄의 왼쪽 끝이 맞는다.
 */
import { View } from 'react-native'

import { Text } from '../../components/atoms'
import { CharacterAvatar } from '../../components/molecules/CharacterAvatar/CharacterAvatar'

/** 열 폭. 보스 줄이 이만큼 오른쪽에서 시작한다 */
export const CHARACTER_LABEL_WIDTH = 40
const FACE_SIZE = 24

export function CharacterGroupLabel(props: { name: string; imageUrl: string | null }): React.JSX.Element {
  return (
    <View testID="character-group-label" style={{ width: CHARACTER_LABEL_WIDTH }} className="items-center gap-0.5">
      <CharacterAvatar
        testID="character-group-face"
        imageUrl={props.imageUrl}
        name={props.name}
        size={FACE_SIZE}
        className="bg-surface-2"
      />
      <Text className="text-10 font-semibold text-text-muted" numberOfLines={1}>
        {props.name}
      </Text>
    </View>
  )
}
