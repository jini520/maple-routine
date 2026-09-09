/**
 * 수입 갈래를 고르는 1차 시트의 내용. 카드 셋과 닫기뿐이다.
 *
 * 갈래를 고르면 그 갈래의 폼이 같은 시트에서 열린다. 그래서 2차에는 갈래 칩이 없고, 갈래를
 * 바꾸는 일은 여기로 돌아오는 일이 된다.
 *
 * 그림은 게임 아이템이다. 이름으로 찾으므로 파일이 바뀌어도 여기는 안 고친다.
 */
import { Image, Pressable, View } from 'react-native'

import { Text } from '../../../components/atoms'
import { getItemIconUrlByFile } from '../../../lib/assets/asset-lookup'
import { INCOME_CATEGORIES, type IncomeCategory } from '../../../storage/income'

/**
 * 갈래마다 그림 하나. 파일명으로 찾는다.
 *
 * 이름으로 안 찾는 것은 `getItemIconUrl` 이 드랍 테이블에 있는 이름만 알아서다(정합성 테스트가
 * 그것을 강제한다). 재획비와 메소는 드랍이 아니라 **표시 전용**이라 그 표에 없다.
 */
const CATEGORY_ICON_FILES: Record<IncomeCategory, string> = {
  사냥: 'wealth_acquisition_potion_small.webp',
  '아이템 판매': 'dark_boss_pendant.png',
  기타: 'meso.webp',
}

export function CategoryPicker(props: {
  onSelect: (category: IncomeCategory) => void
}): React.JSX.Element {
  return (
    <View className="flex-row gap-2">
      {INCOME_CATEGORIES.map((category) => {
        const icon = getItemIconUrlByFile(CATEGORY_ICON_FILES[category])
        return (
          <Pressable
            key={category}
            role="button"
            aria-label={category}
            testID={`income-sheet-category-${category}`}
            onPress={() => props.onSelect(category)}
            className="h-[92px] flex-1 items-center justify-center gap-2.5 rounded-[14px] border border-border bg-surface px-2 active:opacity-60"
          >
            {/* 그림을 못 찾으면 자리만 지킨다. 줄 높이가 갈래마다 갈리지 않게. */}
            {icon === null ? (
              <View className="h-7 w-7" />
            ) : (
              <Image
                source={icon}
                className="h-7 w-7"
                resizeMode="contain"
                testID={`income-sheet-category-icon-${category}`}
                aria-hidden
              />
            )}
            <Text className="text-13 font-semibold text-text">{category}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
