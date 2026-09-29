/**
 * 캐릭터별 섹션. 왼쪽은 캐릭터마다 0 축 가로 막대, 오른쪽은 그 탭의 상위 셋이 서는 단상이다.
 */
import { useState } from 'react'
import { Image, View } from 'react-native'

import { Text } from '../../components/atoms'
import { Segment } from '../../components/molecules/Segment/Segment'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { CharacterTotals } from '../../features/stats/aggregate'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'
import { StatsSection } from './StatsSection'

const TABS = ['순수익', '수익', '지출'] as const
type Tab = (typeof TABS)[number]

/**
 * 넥슨 전신 그림(300×300)에서 캐릭터가 서는 칸. 발끝이 y≈201 이라 그 아래 3px 까지 자른다.
 * 이 칸을 `PODIUM_FIGURE_WIDTH` 폭으로 줄여 세운다.
 */
const LOOK_SIZE = 300
const FIGURE_BOX = { left: 92, top: 104, width: 116, height: 100 }
const PODIUM_FIGURE_WIDTH = 72
const FIGURE_SCALE = PODIUM_FIGURE_WIDTH / FIGURE_BOX.width
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

function Figure(props: { uri: string }): React.JSX.Element {
  return (
    <View
      style={{ width: PODIUM_FIGURE_WIDTH, height: FIGURE_BOX.height * FIGURE_SCALE, overflow: 'hidden' }}
    >
      <Image
        testID="stats-podium-image"
        source={{ uri: props.uri }}
        style={{
          position: 'absolute',
          width: LOOK_SIZE * FIGURE_SCALE,
          height: LOOK_SIZE * FIGURE_SCALE,
          left: -FIGURE_BOX.left * FIGURE_SCALE,
          top: -FIGURE_BOX.top * FIGURE_SCALE,
        }}
      />
    </View>
  )
}

export function CharacterSection(props: {
  rows: readonly CharacterTotals[]
  /** ocid → 전신 그림 주소 */
  images: ReadonlyMap<string, string>
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('순수익')
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
                  <View
                    className={`absolute bottom-0 top-0 ${fill} ${net ? (positive ? 'rounded-r-full' : 'rounded-l-full') : 'rounded-full'}`}
                    style={{ left: `${positive ? zero : zero - width}%`, width: `${width}%` }}
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
            const uri = row.ocid === null ? undefined : props.images.get(row.ocid)
            const first = rank === 0
            return (
              <View
                key={row.key}
                testID={`stats-podium-${rank + 1}`}
                accessible
                accessibilityLabel={`${rank + 1}위 ${row.name}`}
                className="flex-1 items-center"
              >
                <View className="items-center justify-end" style={{ height: FIGURE_BOX.height * FIGURE_SCALE }}>
                  {uri !== undefined && <Figure uri={uri} />}
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
}
