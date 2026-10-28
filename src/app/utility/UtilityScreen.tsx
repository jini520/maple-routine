/**
 * 유틸리티. 도구 목록이다.
 *
 * 도구를 이 화면 안의 카드로 그리지 않고 하위 페이지로 미는 것이 결정이고, 그 값은 공짜로
 * 따라오는 전환 애니메이션과 iOS 가장자리 스와이프다.
 *
 * 목록은 한 줄에 카드 하나다. 카드에는 일러스트와 이름만 있고 설명은 없다. 도구 이름이 곧
 * 설명이어야 한다는 뜻이고, 그렇지 않은 이름은 이름 쪽을 고칠 일이다.
 *
 * 도구를 더할 때는 아래 카드를 형제로 하나 더 놓고 `TOOL_PALETTES` 에 색을 더한다. 그리고
 * `routes.ts` 한 줄, `RootNavigator` 의 `STACK_SCREENS` 한 줄, `docs/features/utility.md`.
 * 목록을 데이터 배열로 돌리지 않는 것은 아직 둘뿐이기 때문이고, 셋쯤 되면 그때 돌린다.
 */

import { Image, Pressable, View } from 'react-native'

import bossProfitIllustration from '../../assets/utility/boss-profit-calculator.webp'
import itemSplitIllustration from '../../assets/utility/item-split.webp'
import { Text } from '../../components/atoms'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { useThemeMode } from '../../theme/context'
import type { ThemeMode } from '../../types/theme'
import { BOSS_PROFIT_CALCULATOR_TOOL_NAME, ITEM_SPLIT_TOOL_NAME } from './tool-names'

interface ToolPalette {
  /** 카드 바탕 */
  tint: string
  /** 이름. 바탕과 같은 계열의 진한 색(어둡게에서는 연한 색) */
  ink: string
}

/**
 * 도구별 카드 색. 테마가 아니라 밝게 · 어둡게만 따른다.
 *
 * 일러스트는 색이 정해진 그림이라, 테마 색을 따르면 그림과 바탕이 어긋난다.
 */
const TOOL_PALETTES: Record<'itemSplit' | 'bossProfit', Record<ThemeMode, ToolPalette>> = {
  itemSplit: {
    light: { tint: '#E3DAFC', ink: '#4A3A9A' },
    dark: { tint: '#1E1A30', ink: '#D2C7FF' },
  },
  // 몬스터도 보라라 계산기 카드와 갈리도록 왕관의 금빛이다.
  bossProfit: {
    light: { tint: '#FFEFC7', ink: '#7A5300' },
    dark: { tint: '#2A2210', ink: '#F3D58A' },
  },
}

/** 이름이 놓이는 자리의 왼쪽 끝. 이보다 왼쪽은 일러스트 자리라 이름이 겹친다. */
const ILLUSTRATION_LANE = 96

/**
 * 카드 이름. 단어 단위로 줄바꿈한다.
 *
 * RN 의 `Text` 는 한글을 글자 단위로 끊는다(판매 분배금 계 / 산기). RN 에는 `word-break` 에
 * 해당하는 스타일이 없으므로 단어마다 `Text` 를 하나씩 두고 flex 아이템으로 감싼다. 줄바꿈이
 * 아이템 경계에서만 일어나므로 단어가 통째로 움직인다. 줄바꿈 문자를 박아 넣으면 넓은
 * 화면에서도 끊긴다.
 *
 * 가운데 정렬이다. 정렬은 `Text` 의 `text-center` 가 아니라 이 줄의 `justify-center` 가 한다.
 * 글자가 단어별 flex 아이템이라 각 줄을 미는 것이 그쪽 축이기 때문이다.
 */
function ToolLabel(props: { text: string; color: string }): React.JSX.Element {
  return (
    <View className="flex-1 flex-row flex-wrap justify-center gap-x-1">
      {props.text.split(' ').map((word, index) => (
        <Text
          key={`${word}-${index}`}
          className="text-15 font-semibold"
          style={{ color: props.color }}
        >
          {word}
        </Text>
      ))}
    </View>
  )
}

/** 도구 카드 하나. 일러스트를 왼쪽에 흐리게 깔고, 이름은 그 오른쪽 자리의 가운데. */
function ToolCard(props: {
  name: string
  palette: ToolPalette
  illustration: React.ReactNode
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      role="button"
      // 이름이 단어별 `Text` 로 쪼개져 있으므로(ToolLabel) 접근성 이름은 여기서 한 벌로 준다.
      // 그러지 않으면 스크린리더가 **판매** **분배금** **계산기** 를 따로 읽는다.
      aria-label={props.name}
      onPress={props.onPress}
      className="h-20 flex-row items-center overflow-hidden rounded-[14px] pr-[18px]"
      style={{ backgroundColor: props.palette.tint, paddingLeft: ILLUSTRATION_LANE }}
    >
      <View
        className="absolute inset-0 opacity-30"
        aria-hidden
        importantForAccessibility="no-hide-descendants"
      >
        {props.illustration}
      </View>
      <ToolLabel text={props.name} color={props.palette.ink} />
    </Pressable>
  )
}

export function UtilityScreen(): React.JSX.Element {
  const navigation = useScreenNavigation()
  const mode = useThemeMode()

  return (
    <View testID="screen-Utility" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <PageHeaderTitleRow>
              <Text className="text-lg font-semibold text-text">유틸리티</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-2.5 px-4 pb-4">
          <ToolCard
            name={ITEM_SPLIT_TOOL_NAME}
            palette={TOOL_PALETTES.itemSplit[mode]}
            // 원본 400×560. 카드(80)보다 크게 그려 위아래를 잘라 내고, 계산기 화면 부분이 보이게 둔다.
            illustration={
              <Image
                source={itemSplitIllustration}
                style={{ position: 'absolute', left: 6, top: -14, width: 107, height: 150 }}
              />
            }
            onPress={() => navigation.navigate('UtilityItemSplit')}
          />
          <ToolCard
            name={BOSS_PROFIT_CALCULATOR_TOOL_NAME}
            palette={TOOL_PALETTES.bossProfit[mode]}
            // 원본 정사각. 왕관과 눈이 보이도록 위에서 28 잘라 낸다.
            illustration={
              <Image
                source={bossProfitIllustration}
                style={{ position: 'absolute', left: 4, top: -28, width: 120, height: 120 }}
              />
            }
            onPress={() => navigation.navigate('UtilityBossProfitCalculator')}
          />
        </View>
      </ScreenScroll>
    </View>
  )
}
