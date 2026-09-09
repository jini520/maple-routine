/**
 * 갈래를 고르는 1차 시트의 내용. 제목 · 카드 격자 · 닫기뿐이다.
 *
 * 수입과 지출이 **한 벌을 쓴다**. 갈래를 고르면 그 갈래의 폼이 같은 시트에서 열린다. 그래서
 * 2차에는 갈래 칩이 없고, 갈래를 바꾸는 일은 여기로 돌아오는 일이 된다.
 *
 * 그림은 게임 아이템이고 **파일명으로 찾는다**. `getItemIconUrl` 은 드랍 테이블에 있는 이름만
 * 알아서(정합성 테스트가 그것을 강제한다), 메소나 입장권처럼 표시 전용인 것은 그 표에 없다.
 */
import { Image, Pressable, View } from 'react-native'

import { Text } from '../../components/atoms'
import { getItemIconUrlByFile } from '../../lib/assets/asset-lookup'

/** 카드 그림의 한 변. 이름 두 줄과 위아래 여백까지 92 짜리 카드에 든다. */
const CARD_ICON_SIZE = 28

export function CategoryPicker<T extends string>(props: {
  /** 시트 제목. `수입 추가` · `지출 추가`. */
  title: string
  categories: readonly T[]
  /** 갈래마다 그림 하나. 값은 `src/assets/items/` 의 파일명이다. */
  iconFiles: Record<T, string>
  /** `testID` 뿌리. `income-sheet` · `spend-sheet`. */
  testIdPrefix: string
  onSelect: (category: T) => void
  onClose: () => void
}): React.JSX.Element {
  return (
    /*
      위 여백이 카드와의 간격보다 넓다. 고르는 것과 물러나는 것을 갈라 놓아야 손이 닫기로
      잘못 가지 않는다.
    */
    <View className="gap-2 px-4">
      <Text className="text-base font-bold text-text">{props.title}</Text>

      {/* 퍼센트 폭과 `gap` 을 섞으면 한 줄의 마지막 칸이 다음 줄로 밀린다. 간격은 자식의
          패딩이 만들고 바깥의 `-mx-1` 이 그만큼을 되돌린다(항목 타일 격자와 같은 방식). */}
      <View className="-mx-1 flex-row flex-wrap">
        {props.categories.map((category) => {
          const icon = getItemIconUrlByFile(props.iconFiles[category])
          return (
            <Pressable
              key={category}
              role="button"
              aria-label={category}
              testID={`${props.testIdPrefix}-category-${category}`}
              onPress={() => props.onSelect(category)}
              className="w-1/3 p-1 active:opacity-60"
            >
              <View className="h-[92px] items-center justify-center gap-2.5 rounded-[14px] border border-border bg-surface px-2">
                {/* 그림을 못 찾으면 자리만 지킨다. 카드 높이가 갈래마다 갈리지 않게. */}
                {icon === null ? (
                  <View style={{ width: CARD_ICON_SIZE, height: CARD_ICON_SIZE }} />
                ) : (
                  <Image
                    source={icon}
                    style={{ width: CARD_ICON_SIZE, height: CARD_ICON_SIZE }}
                    // 아이템 아이콘은 **원본 비율 그대로** 둔다. 상자에 맞춰 늘리면 도트가 뭉갠다.
                    resizeMode="contain"
                    testID={`${props.testIdPrefix}-category-icon-${category}`}
                    aria-hidden
                  />
                )}
                <Text numberOfLines={2} className="text-center text-13 font-semibold text-text">
                  {category}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      {/* 닫기의 자리와 상자는 2차 시트의 저장과 같다(전폭 · radius 12 · 44). 칠은 테마의
          `primary` 라 테마를 바꾸면 함께 바뀐다. 고르는 시트에는 으뜸 동작이 없어서 그 자리를
          채우면 카드보다 닫기가 먼저 눈에 든다.

          위 여백은 고르는 것과 물러나는 것을 갈라 놓는 몫이다. */}
      <Pressable
        role="button"
        aria-label="닫기"
        testID={`${props.testIdPrefix}-close`}
        onPress={props.onClose}
        className="mt-4 items-center rounded-xl bg-primary py-3 active:opacity-60"
      >
        <Text className="text-sm font-bold text-on-primary">닫기</Text>
      </Pressable>
    </View>
  )
}

