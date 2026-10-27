/**
 * 캐릭터별 섹션. 왼쪽은 캐릭터마다 0 축 가로 막대, 오른쪽은 그 탭의 상위 셋이 서는 단상이다.
 */
import { memo, useState } from 'react'
import { Image, View, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { Text } from '../../components/atoms'
import { Segment } from '../../components/molecules/Segment/Segment'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { CharacterTotals } from '../../features/stats/aggregate'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'
import { useTextScale } from '../../theme/text-scale'
import { unknownCharacterAsset } from '../../lib/assets/asset-lookup'
import { FIGURE_BOX, figureCropStyle } from '../../lib/figure-crop'
import { podiumAmountScale, podiumBlockPadding, podiumNameLines } from './podium-name'
import { useRevealProgress } from './reveal'
import { StatsSection } from './StatsSection'

/**
 * 애니메이션이 붙는 상자. NativeWind 가 등록한 `Animated.View` 는 정적 스타일과 애니메이션 스타일을 한
 * 배열로 받으면 정적 쪽을 버리고 `className` 도 안 먹는다(`Segment` 와 같은 함정). 그래서 따로 만든다.
 */
const AnimatedBox = Animated.createAnimatedComponent(View)

/**
 * 진행값만큼 0 축에서 옆으로 뻗는 막대.
 *
 * 움직이는 겉 상자에는 `style` 만 주고 모양(`className`)은 안쪽 `View` 가 든다.
 */
function Grow(props: {
  progress: SharedValue<number>
  origin: 'left' | 'right'
  className?: string
  style?: ViewStyle
  children?: React.ReactNode
}): React.JSX.Element {
  const { progress } = props
  const animated = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }))
  return (
    <AnimatedBox style={[props.style, { transformOrigin: props.origin }, animated]}>
      <View className={`flex-1 ${props.className ?? ''}`}>{props.children}</View>
    </AnimatedBox>
  )
}

const TABS = ['순 수익', '수입', '지출'] as const
type Tab = (typeof TABS)[number]

/** 전신 칸(`FIGURE_BOX`)을 이 폭으로 줄여 세운다 */
const PODIUM_FIGURE_WIDTH = 72
const FIGURE_SCALE = PODIUM_FIGURE_WIDTH / FIGURE_BOX.width
/** 그림 칸이 단상 블록 위로 겹쳐 내려가는 높이. 발끝 아래가 잘리지 않고 블록 앞에 그려진다 */
const FIGURE_OVERLAP = 16
/** `text-10` 의 줄 높이(`typography.cjs`). 줄이 적은 블록을 이만큼씩 늘려 순위가 안 뒤집히게 */
const NAME_LINE_HEIGHT = 15
/** 단상 금액의 좌우 여백. 금액이 쓸 폭은 블록 폭에서 이 두 배를 뺀 것이다 */
const AMOUNT_PAD = 2
/** 화면에 서는 차례. 2위 · 1위 · 3위 */
const PODIUM_ORDER = [1, 0, 2]

function valueOf(row: CharacterTotals, tab: Tab): number {
  return tab === '순 수익' ? row.netMeso : tab === '수입' ? row.incomeMeso : row.expenseMeso
}

function signed(meso: number): string {
  return `${meso > 0 ? '+' : meso < 0 ? '−' : ''}${formatMesoCompact(Math.abs(meso))}`
}

/** 단상 위 캐릭터. 그림 주소를 모르면 흰 실루엣이 같은 자리에 선다 */
function Figure(props: { uri: string | undefined }): React.JSX.Element {
  const known = props.uri !== undefined
  return (
    <View
      style={{ width: PODIUM_FIGURE_WIDTH, height: FIGURE_BOX.height * FIGURE_SCALE + FIGURE_OVERLAP, overflow: 'hidden' }}
    >
      <Image
        testID={known ? 'stats-podium-image' : 'stats-podium-image-unknown'}
        source={known ? { uri: props.uri } : (unknownCharacterAsset() ?? undefined)}
        style={{ position: 'absolute', ...figureCropStyle(FIGURE_SCALE, known) }}
      />
    </View>
  )
}

export const CharacterSection = memo(function CharacterSection(props: {
  rows: readonly CharacterTotals[]
  /** 줄의 키 → 전신 그림 주소. 없는 줄은 흰 실루엣이 선다 */
  images: ReadonlyMap<string, string>
  /** 화면에 들어왔나. 들어오는 순간 막대가 자란다 */
  revealed?: boolean
  /** 바뀌면 막대가 다시 자란다. 화면이 기간으로 준다 */
  replayKey?: string
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('순 수익')
  const progress = useRevealProgress(props.revealed ?? true, `${props.replayKey ?? ''}|${tab}`)
  const net = tab === '순 수익'
  const textScale = useTextScale()

  const shown = props.rows
    .filter((row) => valueOf(row, tab) !== 0)
    .sort((left, right) => valueOf(right, tab) - valueOf(left, tab))
  const total = shown.reduce((sum, row) => sum + valueOf(row, tab), 0)
  const maxPositive = Math.max(0, ...shown.map((row) => valueOf(row, tab)))
  const maxNegative = Math.max(0, ...shown.map((row) => -valueOf(row, tab)))
  const span = maxPositive + maxNegative || 1
  const zero = (maxNegative / span) * 100
  const podium = shown.slice(0, 3)
  const nameLineCounts = podium.map((row) => podiumNameLines(row.name).length)
  const amountOf = (row: CharacterTotals): string => (net ? signed(valueOf(row, tab)) : formatMesoCompact(valueOf(row, tab)))
  const [amountWidths, setAmountWidths] = useState<Record<number, number>>({})
  const [amountRoom, setAmountRoom] = useState(0)
  const amountScale = podiumAmountScale(
    podium.flatMap((_, rank) => amountWidths[rank] ?? []),
    amountRoom - AMOUNT_PAD * 2,
  )

  return (
    <StatsSection
      title="캐릭터별"
      testID="stats-characters"
      trailing={<Segment size="sm" options={TABS} selected={tab} onSelect={setTab} />}
    >
      <View className="flex-row items-end gap-2">
        <View className="flex-1 gap-2">
          <View className="flex-row items-baseline gap-1.5">
            <Text className="text-11 text-text-muted">{tab}</Text>
            <Text
              testID="stats-characters-total"
              // 수입은 붉은색, 지출은 파란색이다. 순 수익은 부호를 따른다.
              className={`text-sm font-bold ${(net ? total >= 0 : tab !== '지출') ? 'text-rise-ink' : 'text-fall-ink'}`}
              style={TABULAR_NUMS}
            >
              {net ? signed(total) : formatMesoCompact(total)}
            </Text>
          </View>
          {shown.map((row) => {
            const value = valueOf(row, tab)
            const width = (Math.abs(value) / span) * 100
            const positive = value >= 0
            const tone = tab === '지출' || !positive ? 'text-fall-ink' : 'text-rise-ink'
            const fill = tab === '지출' || !positive ? 'bg-fall-ink' : 'bg-rise-ink'
            return (
              <View key={row.key} testID={`stats-character-row-${row.key}`} className="gap-1">
                <View className="flex-row items-baseline justify-between gap-2">
                  <Text testID="stats-character-name" numberOfLines={1} className="shrink text-11 text-text">
                    {row.name}
                  </Text>
                  {/* % 와 금액은 한 Text 다. 따로 두고 기준선을 맞추면 % 가 선 탭에서만 줄이 커진다 */}
                  <Text testID="stats-character-value" className="text-11" style={TABULAR_NUMS}>
                    {!net && (
                      <Text testID="stats-character-percent" className="text-10 text-text-muted">
                        {`${Math.round((value / total) * 100)}%`}
                      </Text>
                    )}
                    {!net && ' '}
                    <Text testID="stats-character-amount" className={`font-semibold ${tone}`}>
                      {net ? signed(value) : formatMesoCompact(value)}
                    </Text>
                  </Text>
                </View>
                <View className="h-[7px] rounded-full bg-surface-2">
                  {net && <View className="absolute -bottom-[3px] -top-[3px] w-px bg-text-disabled" style={{ left: `${zero}%` }} />}
                  <Grow
                    progress={progress}
                    origin={positive ? 'left' : 'right'}
                    className={`${fill} ${net ? (positive ? 'rounded-r-full' : 'rounded-l-full') : 'rounded-full'}`}
                    style={{ position: 'absolute', top: 0, bottom: 0, left: `${positive ? zero : zero - width}%`, width: `${width}%` }}
                  />
                </View>
              </View>
            )
          })}
        </View>

        <View className="w-[132px] flex-row items-end gap-0.5">
          {/* 줄이지 않은 금액의 폭을 재는 보이지 않는 글자. 블록보다 넓은 곳에 두어야 잘리지 않은 폭이 나온다. */}
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="absolute left-0 top-0 items-start opacity-0"
            style={{ width: 400 }}
          >
            {podium.map((row, rank) => (
              <Text
                key={row.key}
                testID="stats-podium-amount-measure"
                numberOfLines={1}
                className="text-10 font-bold"
                style={TABULAR_NUMS}
                onLayout={(event) => {
                  const width = event.nativeEvent.layout.width
                  setAmountWidths((widths) => (widths[rank] === width ? widths : { ...widths, [rank]: width }))
                }}
              >
                {amountOf(row)}
              </Text>
            ))}
          </View>
          {PODIUM_ORDER.map((rank) => {
            const row = podium[rank]
            if (row === undefined) return <View key={`empty-${rank}`} className="flex-1" />
            const value = valueOf(row, tab)
            const uri = props.images.get(row.key)
            const first = rank === 0
            return (
              <View
                key={row.key}
                testID={`stats-podium-${rank + 1}`}
                accessible
                accessibilityLabel={`${rank + 1}위 ${row.name}`}
                className="flex-1 items-center"
              >
                <View
                  testID="stats-podium-figure"
                  className="items-center justify-end"
                  style={{
                    height: FIGURE_BOX.height * FIGURE_SCALE + FIGURE_OVERLAP,
                    marginBottom: -FIGURE_OVERLAP,
                    zIndex: 1,
                  }}
                >
                  <Figure uri={uri} />
                </View>
                <View
                  className={`w-full items-center gap-px rounded-b-[3px] rounded-t-lg pt-1 ${first ? 'bg-primary-tint' : 'bg-surface-2'}`}
                  style={{ paddingBottom: podiumBlockPadding(nameLineCounts, rank, NAME_LINE_HEIGHT * textScale) }}
                >
                  <Text className={`text-xs font-bold ${first ? 'text-primary-ink' : 'text-text-muted'}`}>{rank + 1}</Text>
                  {/* 줄은 `podiumNameLines` 가 나눈다. 폭을 블록보다 넓게 열어 네 자 이름이 조금 넘쳐도
                      RN 이 다시 꺾지 않게 한다. 넘친 만큼은 부모의 `items-center` 로 양옆에 고르게 나간다. */}
                  <View className="items-center" style={{ width: '140%' }}>
                    <Text testID="stats-podium-name" className="text-center text-10 font-semibold text-text">
                      {podiumNameLines(row.name).join('\n')}
                    </Text>
                  </View>
                  {/* 크기는 `amountScale` 이 셋에 같게 정한다. `adjustsFontSizeToFit` 는 재기 전 첫 화면을 받친다. */}
                  <Text
                    testID="stats-podium-amount"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    className={`w-full text-center text-10 font-bold ${tab === '지출' || value < 0 ? 'text-fall-ink' : 'text-rise-ink'}`}
                    style={[TABULAR_NUMS, { paddingHorizontal: AMOUNT_PAD, fontSize: 10 * amountScale }]}
                    onLayout={(event) => setAmountRoom(event.nativeEvent.layout.width)}
                  >
                    {amountOf(row)}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      </View>
    </StatsSection>
  )
})
