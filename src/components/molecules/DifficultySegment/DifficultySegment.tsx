import { Pressable, View } from 'react-native'

import { Badge } from '../../atoms'
import { selectionFeedback } from '../../../native/haptics'
import type { BossDifficulty } from '../../../types'

export function DifficultySegment(props: {
  difficulties: BossDifficulty[]
  selected: BossDifficulty | null
  onSelect: (difficulty: BossDifficulty) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {props.difficulties.map((difficulty) => {
        const isSelected = props.selected === difficulty
        return (
          <Pressable
            key={difficulty}
            role="button"
            aria-selected={isSelected}
            disabled={props.disabled === true}
            // 두드림은 선택이 실제로 바뀔 때만이다. 안 바뀌는 누름에 내면 손끝이 거짓을 말한다.
            onPress={() => {
              if (isSelected) return
              selectionFeedback()
              props.onSelect(difficulty)
            }}
            className={`rounded-full${isSelected ? '' : ' opacity-40'}`}
          >
            <Badge variant={difficulty}>
              {difficulty}
            </Badge>
          </Pressable>
        )
      })}
    </View>
  )
}
