/**
 * 값 하나의 **축**을 고르는 붙은 조각([[ADR-173]] 결정 3).
 *
 * ## 왜 칩이 아닌가
 *
 * 가계부 시트에는 고르는 것이 세 종류였는데 **셋 다 같은 알약**이었다 — 갈래(무엇을) · 통화
 * (무엇으로) · 빠른 금액(얼마). 자리를 두 번 옮겨도 «무엇을 고르는 줄인지» 가 안 읽혔고, 그래서
 * 모양을 갈랐다: **갈래는 칩, 그 밖은 세그먼트, 빠른 금액은 키보드 위.**
 *
 * 세그먼트가 그 축을 맡는 이유는 **라벨–값 줄의 값 자리에 앉기 때문**이다. 칩은 줄 하나를
 * 통째로 쓰지만 이것은 「통화  [메소|메포|캐시]」 처럼 라벨 오른쪽에 선다.
 *
 * ## `DifficultySegment` 와 갈라 둔 이유
 *
 * 그쪽은 **난이도 값 표**를 그린다(`Badge` 의 난이도 variant — 게임 안의 색이 조각마다 다르다). 여기서는
 * 조각이 글자뿐이고 고른 것만 칠해진다. 합치면 «색이 있는 세그먼트» 와 «글자 세그먼트» 가 한
 * 컴포넌트의 분기가 되어, 한쪽을 고칠 때 다른 쪽이 딸려 온다([[ADR-121]] 결정 7 이 크기 둘을
 * 갈라 둔 것과 같은 판단).
 */
import { Pressable, View } from 'react-native'

import { Text } from '../../atoms/Text/Text'

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
