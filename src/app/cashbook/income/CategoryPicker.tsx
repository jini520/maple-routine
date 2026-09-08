/**
 * 수입 갈래를 고르는 1차 시트의 내용. 카드 셋과 닫기뿐이다.
 *
 * 갈래를 고르면 그 갈래의 폼이 같은 시트에서 열린다. 그래서 2차에는 갈래 칩이 없고, 갈래를
 * 바꾸는 일은 여기로 돌아오는 일이 된다.
 *
 * 아이콘은 lucide 셋이다. 게임 그림을 안 쓰는 것은 아이템 판매와 기타에 붙일 그림이 없어서다.
 * 셋이 나란히 서는 자리라 하나만 게임 그림이면 어긋난다.
 */
import { Pressable, View } from 'react-native'

import { StoreIcon, SwordIcon, Text, WalletIcon } from '../../../components/atoms'
import { INCOME_CATEGORIES, type IncomeCategory } from '../../../storage/income'

/** 갈래마다 그림 하나. 표에 없으면 카드가 안 선다. */
const CATEGORY_ICONS: Record<IncomeCategory, typeof SwordIcon> = {
  사냥: SwordIcon,
  '아이템 판매': StoreIcon,
  기타: WalletIcon,
}

export function CategoryPicker(props: {
  onSelect: (category: IncomeCategory) => void
}): React.JSX.Element {
  return (
    <View className="flex-row gap-2">
      {INCOME_CATEGORIES.map((category) => {
        const Icon = CATEGORY_ICONS[category]
        return (
          <Pressable
            key={category}
            role="button"
            aria-label={category}
            testID={`income-sheet-category-${category}`}
            onPress={() => props.onSelect(category)}
            className="h-[92px] flex-1 items-center justify-center gap-2.5 rounded-[14px] border border-border bg-surface px-2 active:opacity-60"
          >
            <Icon className="h-7 w-7 text-text-muted" strokeWidth={1.75} aria-hidden />
            <Text className="text-13 font-semibold text-text">{category}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
