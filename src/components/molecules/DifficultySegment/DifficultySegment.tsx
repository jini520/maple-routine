import { Pressable, View } from 'react-native'

import { Badge } from '../../atoms'
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
            onPress={() => {
              if (!isSelected) props.onSelect(difficulty)
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
