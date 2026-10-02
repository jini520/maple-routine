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
import { unknownCharacterAsset } from '../../lib/assets/asset-lookup'
import { useRevealProgress } from './reveal'
import { StatsSection } from './StatsSection'

/**
 * 애니메이션이 붙는 상자. NativeWind 가 등록한 `Animated.View` 는 정적 스타일과 애니메이션 스타일을 한
 * 배열로 받으면 정적 쪽을 버리고 `className` 도 안 먹는다(`TabSegment` 와 같은 함정). 그래서 따로 만든다.
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

const TABS = ['순수익', '수익', '지출'] as const
type Tab = (typeof TABS)[number]

/**
 * 넥슨 전신 그림(300×300)에서 캐릭터가 서는 칸. 발끝이 y≈201 이라 그 아래 3px 까지 자른다.
 * 이 칸을 `PODIUM_FIGURE_WIDTH` 폭으로 줄여 세운다.
 */
const LOOK_SIZE = 300
const FIGURE_BOX = { left: 92, top: 104, width: 116, height: 100 }
/** 흰 실루엣(180×180)에서 같은 크기로 서는 칸. 발끝이 y≈144 라 넥슨 그림과 같은 줄에 발이 닿는다 */
const UNKNOWN_SIZE = 180
const UNKNOWN_BOX = { left: 28.5, top: 47 }
const PODIUM_FIGURE_WIDTH = 72
const FIGURE_SCALE = PODIUM_FIGURE_WIDTH / FIGURE_BOX.width
/** 그림 칸이 단상 블록 위로 겹쳐 내려가는 높이. 발끝 아래가 잘리지 않고 블록 앞에 그려진다 */
const FIGURE_OVERLAP = 16
/** 단상 블록 높이. 1 · 2 · 3위 차례다 */
const BLOCK_HEIGHTS = [74, 60, 50]
/** 화면에 서는 차례. 2위 · 1위 · 3위 */
const PODIUM_ORDER = [1, 0, 2]

function valueOf(row: CharacterTotals, tab: Tab): number {
  return tab === '순수익' ? row.netMeso : tab === '수익' ? row.incomeMeso : row.expenseMeso
}

function signed(meso: number): string {
  return `${meso > 0 ? '+' : meso < 0 ? '−' : ''}${formatMesoCompact(Math.abs(meso))}`
}

/** 단상 위 캐릭터. 그림 주소를 모르면 흰 실루엣이 같은 자리에 선다 */
function Figure(props: { uri: string | undefined }): React.JSX.Element {
  const known = props.uri !== undefined
  const size = known ? LOOK_SIZE : UNKNOWN_SIZE
  const box = known ? FIGURE_BOX : UNKNOWN_BOX
  return (
    <View
      style={{ width: PODIUM_FIGURE_WIDTH, height: FIGURE_BOX.height * FIGURE_SCALE + FIGURE_OVERLAP, overflow: 'hidden' }}
    >
      <Image
        testID={known ? 'stats-podium-image' : 'stats-podium-image-unknown'}
        source={known ? { uri: props.uri } : unknownCharacterAsset()}
        style={{
          position: 'absolute',
          width: size * FIGURE_SCALE,
          height: size * FIGURE_SCALE,
          left: -box.left * FIGURE_SCALE,
          top: -box.top * FIGURE_SCALE,
        }}
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
  const [tab, setTab] = useState<Tab>('순수익')
  const progress = useRevealProgress(props.revealed ?? true, `${props.replayKey ?? ''}|${tab}`)
  const net = tab === '순수익'

  const shown = props.rows
    .filter((row) => valueOf(row, tab) !== 0)
    .sort((left, right) => valueOf(right, tab) - valueOf(left, tab))
  const total = shown.reduce((sum, row) => sum + valueOf(row, tab), 0)
  const maxPositive = Math.max(0, ...shown.map((row) => valueOf(row, tab)))
  const maxNegative = Math.max(0, ...shown.map((row) => -valueOf(row, tab)))
  const span = maxPositive + maxNegative || 1
  const zero = (maxNegative / span) * 100
  const podium = shown.slice(0, 3)

  return (
    <StatsSection
      title="캐릭터별"
      testID="stats-characters"
      trailing={<Segment options={TABS} selected={tab} onSelect={setTab} />}
    >
      <View className="flex-row items-end gap-2">
        <View className="flex-1 gap-2">
          <View className="flex-row items-baseline gap-1.5">
            <Text className="text-11 text-text-muted">{tab}</Text>
            <Text className="text-sm font-bold text-text" style={TABULAR_NUMS}>
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
                  <View className="flex-row items-baseline gap-1.5">
                    {!net && (
                      <Text testID="stats-character-percent" className="text-10 text-text-muted" style={TABULAR_NUMS}>
                        {`${Math.round((value / total) * 100)}%`}
                      </Text>
                    )}
                    <Text testID="stats-character-amount" className={`text-11 font-semibold ${tone}`} style={TABULAR_NUMS}>
                      {net ? signed(value) : formatMesoCompact(value)}
                    </Text>
                  </View>
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
                  style={{ height: BLOCK_HEIGHTS[rank] }}
                >
                  <Text className={`text-xs font-bold ${first ? 'text-primary-ink' : 'text-text-muted'}`}>{rank + 1}</Text>
                  <Text numberOfLines={1} className="max-w-full px-0.5 text-10 font-semibold text-text">
                    {row.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    className={`max-w-full px-0.5 text-10 font-bold ${tab === '지출' || value < 0 ? 'text-fall-ink' : 'text-rise-ink'}`}
                    style={TABULAR_NUMS}
                  >
                    {net ? signed(value) : formatMesoCompact(value)}
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
