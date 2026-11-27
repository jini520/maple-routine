/**
 * 유틸리티. 도구 목록이다.
 *
 * 도구를 이 화면 안의 카드로 그리지 않고 하위 페이지로 미는 것이 결정이고, 그 값은 공짜로
 * 따라오는 전환 애니메이션과 iOS 가장자리 스와이프다.
 *
 * 목록은 한 줄에 카드 하나다. 카드는 PC 웹의 유틸리티 카드와 같은 모양이다. 왼쪽에 이름과 설명 두 줄,
 * 오른쪽에 흐리지 않은 그림이 놓인다. 같은 도구가 웹과 앱에서 다른 카드로 보이지 않게 하려는 것이다.
 *
 * 도구는 분류로 묶는다. 위가 `데이터`(MASPI), 아래가 `계산기` 다. MASPI 는 금액을 따지는 도구가 아니라 시세를 보는
 * 도구라 두 계산기와 하는 일이 다르다.
 *
 * 도구를 더할 때는 그 분류에 카드를 형제로 하나 더 놓고 `TOOLS` 에 색 · 설명 · 그림을 더한다. 그리고
 * `routes.ts` 한 줄, `RootNavigator` 의 `STACK_SCREENS` 한 줄, `docs/features/utility.md`.
 */

import { useId } from 'react'
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native'
import { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import bossProfitIllustration from '../../assets/utility/boss-profit-calculator.webp'
import itemSplitIllustration from '../../assets/utility/item-split.webp'
import maspiIllustration from '../../assets/utility/maspi.webp'
import { Badge, Text } from '../../components/atoms'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { FaqButton } from '../../components/organisms/FaqSheet/FaqButton'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { LinearGradient, Svg } from '../../lib/nativewind-interop'
import { useThemeMode } from '../../theme/context'
import type { ThemeMode } from '../../types/theme'
import { BOSS_PROFIT_CALCULATOR_TOOL_NAME, ITEM_SPLIT_TOOL_NAME, MASPI_TOOL_NAME } from './tool-names'

/** 밝게 카드의 색. 바탕은 왼쪽 위가 밝은 선형 그라데이션이고, 오른쪽 위에 흰 빛을 얹는다. */
interface LightPalette {
  /** 바탕 그라데이션. 왼쪽 위 → 오른쪽 아래 */
  backdrop: readonly [string, string]
  /** 이름. 바탕과 같은 계열의 진한 색이고, 설명은 이 색의 72% */
  ink: string
}

/** 어둡게 카드의 색. 바탕은 가운데가 밝은 방사 그라데이션이고 빛은 없다. */
interface DarkPalette {
  /** 바탕 그라데이션. 가운데 → 가장자리, 정지점은 `DARK_STOPS` */
  backdrop: readonly [string, string, string, string]
  /** 이름. 바탕과 같은 계열의 연한 색 */
  ink: string
  /** 설명. 72% 로 흐리면 어두운 바탕에서 묻혀 따로 고른 색 */
  description: string
}

interface ToolArt {
  source: ImageSourcePropType
  /** `ART_BOX` 안에 비율대로 맞춘 크기 */
  width: number
  height: number
}

interface Tool {
  light: LightPalette
  dark: DarkPalette
  /** 줄마다 하나. 줄은 여기서만 바뀐다 */
  description: readonly string[]
  art: ToolArt
}

/** 어둡게 바탕 그라데이션의 정지점 */
const DARK_STOPS = ['0%', '22%', '50%', '100%'] as const
/** 밝게에서 설명 글자의 불투명도 */
const LIGHT_DESCRIPTION_OPACITY = 0.72
/** 카드 높이. 그림을 세로 가운데에 둘 때 쓴다. */
const CARD_HEIGHT = 108
/** 그림이 들어가는 오른쪽 상자. 그림은 이 안에 비율을 지켜 맞추고 오른쪽 끝에 붙인다. */
const ART_BOX = { width: 112, height: 92, right: 12 } as const
/** 글자가 그림과 겹치지 않도록 비워 두는 오른쪽 폭. 그림 상자와 그 사이 8 이다. */
const TEXT_RIGHT_GAP = ART_BOX.right + ART_BOX.width + 8
/** 밝게 카드 오른쪽 위의 흰 빛. 카드 오른쪽 끝에서 10 안쪽, 위로 20 나간 원이다. */
const GLOW = { size: 160, right: 10, top: -20 } as const

/**
 * 도구별 카드 색 · 설명 · 그림. 색은 테마가 아니라 밝게 · 어둡게만 따른다.
 *
 * 그림은 색이 정해진 그림이라, 테마 색을 따르면 그림과 바탕이 어긋난다. 색은 PC 웹 카드와 같다.
 */
const TOOLS = {
  // 그림의 보라 막대 · 분홍 선과 겹치지 않는 청록이다.
  maspi: {
    light: { backdrop: ['#F2FBF9', '#D5F2EC'], ink: '#0E5E52' },
    dark: { backdrop: ['#365E57', '#22453F', '#183833', '#102522'], ink: '#9FE3D5', description: '#7CB5AA' },
    description: ['드롭 아이템 시세와', 'MASPI 지수를 매일 확인해요'],
    art: { source: maspiIllustration, width: 99, height: 92 },
  },
  itemSplit: {
    light: { backdrop: ['#F6F2FF', '#E3DAFC'], ink: '#4A3A9A' },
    dark: { backdrop: ['#50496F', '#383154', '#2B2546', '#1E1A30'], ink: '#D2C7FF', description: '#A69DCD' },
    description: ['수수료를 떼고도 똑같이 나누려면', '얼마를 보낼지 알려 줘요'],
    art: { source: itemSplitIllustration, width: 102, height: 92 },
  },
  // 몬스터도 보라라 계산기 카드와 갈리도록 왕관의 금빛이다.
  bossProfit: {
    light: { backdrop: ['#FFF9EA', '#FFEFC7'], ink: '#7A5300' },
    dark: { backdrop: ['#635430', '#493D1F', '#3B3016', '#2A2210'], ink: '#F3D58A', description: '#C2A96C' },
    description: ['캐릭터마다 보스를 골라', '한 주 수입을 미리 따져 봐요'],
    art: { source: bossProfitIllustration, width: 112, height: 83 },
  },
} as const satisfies Record<string, Tool>

/** SVG `url(#id)` 에 넣을 id. `useId` 의 콜론 같은 기호가 들어가면 그라데이션을 찾지 못하는 기기가 있어 영숫자만 남긴다. */
function useGradientId(): string {
  return `tool-card-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
}

/**
 * 단어 단위로 줄바꿈하는 글자 줄.
 *
 * RN 의 `Text` 는 한글을 글자 단위로 끊는다(판매 분배금 계 / 산기). RN 에는 `word-break` 에
 * 해당하는 스타일이 없으므로 단어마다 `Text` 를 하나씩 두고 flex 아이템으로 감싼다. 줄바꿈이
 * 아이템 경계에서만 일어나므로 단어가 통째로 움직인다.
 */
function WordWrapRow(props: {
  text: string
  className: string
  color: string
  opacity?: number
  testID?: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <View testID={props.testID} className="flex-row flex-wrap items-center gap-x-1">
      {props.text.split(' ').map((word, index) => (
        <Text key={`${word}-${index}`} className={props.className} style={{ color: props.color, opacity: props.opacity }}>
          {word}
        </Text>
      ))}
      {props.children}
    </View>
  )
}

/**
 * 어둡게 바탕. 가운데가 밝은 방사 그라데이션이다. RN 에 방사 그라데이션이 없어 SVG 로 그린다.
 *
 * 카드를 다 덮는 틀 안에 둔다. 절대 위치 자식의 `100%` 는 카드의 안쪽 여백을 뺀 폭이라, SVG 에 바로 주면 글자 자리만 칠해진다.
 */
function DarkBackdrop(props: { colors: DarkPalette['backdrop'] }): React.JSX.Element {
  const id = useGradientId()
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            {props.colors.map((color, index) => (
              <Stop key={DARK_STOPS[index]} offset={DARK_STOPS[index]} stopColor={color} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  )
}

/** 밝게 카드 오른쪽 위의 흰 빛 */
function LightGlow(): React.JSX.Element {
  const id = useGradientId()
  const r = GLOW.size / 2
  return (
    <Svg
      width={GLOW.size}
      height={GLOW.size}
      style={{ position: 'absolute', right: GLOW.right, top: GLOW.top }}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
    </Svg>
  )
}

/** 도구 카드 하나. 왼쪽에 이름과 설명, 오른쪽에 그림. */
function ToolCard(props: {
  name: string
  tool: Tool
  mode: ThemeMode
  /** 베타 기능이면 이름 오른쪽에 `beta` 배지 */
  beta?: boolean
  onPress: () => void
}): React.JSX.Element {
  const { tool, mode } = props
  const ink = mode === 'dark' ? tool.dark.ink : tool.light.ink
  const descriptionColor = mode === 'dark' ? tool.dark.description : tool.light.ink
  const descriptionOpacity = mode === 'dark' ? undefined : LIGHT_DESCRIPTION_OPACITY

  return (
    <Pressable
      role="button"
      // 이름과 설명이 단어별 `Text` 로 쪼개져 있으므로(WordWrapRow) 접근성 이름 · 힌트는 여기서 한 벌로 준다.
      // 그러지 않으면 스크린리더가 **판매** **분배금** **계산기** 를 따로 읽는다.
      aria-label={props.name}
      accessibilityHint={tool.description.join(' ')}
      onPress={props.onPress}
      className="h-[108px] justify-center overflow-hidden rounded-3xl pl-5"
      style={{ paddingRight: TEXT_RIGHT_GAP }}
    >
      {mode === 'dark' ? (
        <DarkBackdrop colors={tool.dark.backdrop} />
      ) : (
        <>
          <LinearGradient
            colors={tool.light.backdrop}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LightGlow />
        </>
      )}
      <Image
        source={tool.art.source}
        aria-hidden
        style={{
          position: 'absolute',
          right: ART_BOX.right,
          top: (CARD_HEIGHT - tool.art.height) / 2,
          width: tool.art.width,
          height: tool.art.height,
        }}
      />
      <WordWrapRow text={props.name} className="text-base font-bold" color={ink}>
        {props.beta === true && (
          <Badge variant="primary" size="sm" className="ml-0.5">
            beta
          </Badge>
        )}
      </WordWrapRow>
      <View className="mt-1.5">
        {tool.description.map((line) => (
          <WordWrapRow
            key={line}
            testID="tool-description-line"
            text={line}
            className="text-sm"
            color={descriptionColor}
            opacity={descriptionOpacity}
          />
        ))}
      </View>
    </Pressable>
  )
}

/** 분류 하나. 섹션 제목 아래에 카드를 10 씩 띄워 쌓는다. */
function ToolGroup(props: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View className="gap-2">
      <Text className="px-1 text-sm font-bold text-text">{props.title}</Text>
      <View className="gap-2.5">{props.children}</View>
    </View>
  )
}

export function UtilityScreen(): React.JSX.Element {
  const faq = useFaqSheet('utility')
  const navigation = useScreenNavigation()
  const mode = useThemeMode()

  return (
    <View testID="screen-Utility" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <PageHeaderTitleRow>
              <Text className="text-lg font-bold text-text">유틸리티</Text>
              <FaqButton sheet={faq} />
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-4 px-4 pb-4">
          <ToolGroup title="데이터">
            <ToolCard
              name={MASPI_TOOL_NAME}
              tool={TOOLS.maspi}
              mode={mode}
              beta
              onPress={() => navigation.navigate('UtilityMaspi')}
            />
          </ToolGroup>
          <ToolGroup title="계산기">
            <ToolCard
              name={ITEM_SPLIT_TOOL_NAME}
              tool={TOOLS.itemSplit}
              mode={mode}
              onPress={() => navigation.navigate('UtilityItemSplit')}
            />
            <ToolCard
              name={BOSS_PROFIT_CALCULATOR_TOOL_NAME}
              tool={TOOLS.bossProfit}
              mode={mode}
              onPress={() => navigation.navigate('UtilityBossProfitCalculator')}
            />
          </ToolGroup>
        </View>
      </ScreenScroll>
    </View>
  )
}
