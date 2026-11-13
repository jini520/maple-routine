import { Pressable, View } from 'react-native'

import { Text } from '../../atoms'

/**
 * 게임 인벤토리처럼 판 위에 같은 폭으로 늘어선 탭. 판에 붙고, 고른 탭은 판과 같은 색(`surface`)이라 판과 한 덩어리로
 * 이어진다. 나머지 탭은 한 단계 어두운 `surface-2` 다. 세그먼트로 그리면 게임 인벤토리의 느낌이 사라진다.
 *
 * @example
 * <InventoryTabs options={TABS} selected={tab} onSelect={setTab} labelOf={(key) => LABELS[key]} testID="inventory-tabs" />
 */
export function InventoryTabs<T extends string>(props: {
  options: readonly T[]
  selected: T
  onSelect: (value: T) => void
  labelOf: (value: T) => string
  testID: string
}): React.JSX.Element {
  return (
    <View testID={props.testID} role="tablist" className="flex-row gap-1">
      {props.options.map((value) => {
        const on = value === props.selected
        return (
          <Pressable
            key={value}
            testID={`${props.testID}-${value}`}
            role="tab"
            aria-selected={on}
            onPress={() => props.onSelect(value)}
            className={`h-8 flex-1 items-center justify-center rounded-t-[10px] ${on ? 'bg-surface' : 'bg-surface-2'}`}
          >
            <Text className={`text-xs ${on ? 'font-semibold text-text' : 'text-text-muted'}`}>{props.labelOf(value)}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
