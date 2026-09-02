import { Pressable, View } from 'react-native'

import { Text } from '../../atoms'

export function Segment<T extends string>(props: {
  options: readonly T[]
  /** `null` 이면 **아무것도 안 골랐다** — 형태처럼 기본값을 안 정하는 자리가 있다([[ADR-166]] 정정 1). */
  selected: T | null
  onSelect: (value: T) => void
}): React.JSX.Element {
  return (
    <View
      testID="segment"
      // **테두리는 상자 하나뿐**이다 — 조각마다 두르면 칩 여럿과 같은 그림이 된다.
      className="flex-row items-center rounded-full border border-border bg-surface p-0.5"
    >
      {props.options.map((option) => {
        const isSelected = option === props.selected
        return (
          <Pressable
            key={option}
            role="button"
            aria-label={option}
            aria-selected={isSelected}
            // 이미 고른 것을 다시 눌러도 아무 일이 없어야 한다 — `DifficultySegment` 와 같은 계약이다.
            onPress={() => {
              if (!isSelected) props.onSelect(option)
            }}
            className={`rounded-full px-2.5 py-0.5 ${isSelected ? 'bg-primary-tint' : ''}`}
          >
            <Text
              className={`text-11 font-semibold ${
                isSelected ? 'text-primary-ink' : 'text-text-muted'
              }`}
            >
              {option}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
