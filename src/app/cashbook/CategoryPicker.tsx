/**
 * 갈래를 고르는 1차 시트의 내용. 제목 · 카드 격자 · 닫기뿐이다.
 *
 * 수입과 지출이 **한 벌을 쓴다**. 갈래를 고르면 그 갈래의 폼이 같은 시트에서 열린다. 그래서
 * 2차에는 갈래 칩이 없고, 갈래를 바꾸는 일은 여기로 돌아오는 일이 된다.
 *
 * 카드는 **가로로 눕고 한 줄에 둘**이다(사용자 지정 2026-09-21). 그림 옆에 이름이 서고, 갈래 표가
 * 그 아래 갈래 표의 `description` 이 한 줄 더 선다. 카드가 92 에서 56 으로 낮아진다. 갈래가 일곱인 지출은 줄이 셋에서 넷으로 늘지만, 줄당 높이가 더 많이 줄어 시트 전체는
 * 짧아진다.
 *
 * 그림은 게임 아이템이고 **파일명으로 찾는다**. `dropItemIconOf` 는 드롭 아이템 마스터 표의 key 만
 * 알아서, 메소나 입장권처럼 표시 전용인 것은 그 표에 없다.
 */
import { Image, Pressable, View } from 'react-native'

import { Text } from '../../components/atoms'
import { getItemIconUrlByFile } from '../../lib/assets/asset-lookup'

/** 카드 그림의 한 변. 이름과 나란히 한 줄에 선다. */
const CARD_ICON_SIZE = 28

export function CategoryPicker<T extends string>(props: {
  /** 갈래 표(`lib/cashbook/categories.ts`). 그림은 `src/assets/items/` 의 파일명이다. */
  categories: ReadonlyArray<{
    readonly key: T
    readonly name: string
    readonly icon: string
    /**
     * 이름 아래 한 줄. **한 줄에 들어가게 쓸 것** - 반폭 카드의 글자 폭이 390 화면에서 115 뿐이라
     * 10px 로 열한 자 남짓이다. 넘치면 말줄임표가 붙는다.
     */
    readonly description: string
  }>
  /** `testID` 뿌리. `income-sheet` · `spend-sheet`. */
  testIdPrefix: string
  onSelect: (category: T) => void
}): React.JSX.Element {
  return (
    /*
      위 여백이 카드와의 간격보다 넓다. 고르는 것과 물러나는 것을 갈라 놓아야 손이 닫기로
      잘못 가지 않는다.
    */
    <View className="px-4">
      {/* 퍼센트 폭과 `gap` 을 섞으면 한 줄의 마지막 칸이 다음 줄로 밀린다. 간격은 자식의
          패딩이 만들고 바깥의 `-mx-1` 이 그만큼을 되돌린다(항목 타일 격자와 같은 방식). */}
      <View className="-mx-1 flex-row flex-wrap">
        {props.categories.map((category) => {
          const icon = getItemIconUrlByFile(category.icon)
          return (
            <Pressable
              key={category.key}
              role="button"
              aria-label={category.name}
              testID={`${props.testIdPrefix}-category-${category.key}`}
              onPress={() => props.onSelect(category.key)}
              className="w-1/2 p-1 active:opacity-60"
            >
              <View
                testID={`${props.testIdPrefix}-category-box-${category.key}`}
                className="h-[56px] flex-row items-center gap-2 rounded-[14px] border border-border bg-surface px-3"
              >
                {/* 그림을 못 찾으면 자리만 지킨다. 카드 높이가 갈래마다 갈리지 않게. */}
                {icon === null ? (
                  <View style={{ width: CARD_ICON_SIZE, height: CARD_ICON_SIZE }} />
                ) : (
                  <Image
                    source={icon}
                    style={{ width: CARD_ICON_SIZE, height: CARD_ICON_SIZE }}
                    // 아이템 아이콘은 **원본 비율 그대로** 둔다. 상자에 맞춰 늘리면 도트가 뭉갠다.
                    resizeMode="contain"
                    testID={`${props.testIdPrefix}-category-icon-${category.key}`}
                    aria-hidden
                  />
                )}
                {/* 둘 다 한 줄이다. 줄 수가 갈래마다 갈리면 카드 높이도 갈린다. */}
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-13 font-semibold leading-tight text-text">
                    {category.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    testID={`${props.testIdPrefix}-category-desc-${category.key}`}
                    className="mt-0.5 text-10 leading-tight text-text-muted"
                  >
                    {category.description}
                  </Text>
                </View>
              </View>
            </Pressable>
          )
        })}
      </View>

    </View>
  )
}

