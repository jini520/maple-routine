/**
 * 누적 순수익 섹션. 기록이 처음 있는 기간부터 고른 기간까지 순수익을 더해 큰 숫자와 선으로 그린다.
 * 기간을 누르면 그 기간까지의 누적을 말풍선으로 띄운다.
 */
import { useState } from 'react'
import { Pressable, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, ClipPath, Defs, Line, Path, Rect } from 'react-native-svg'

import { Text } from '../../components/atoms'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { cumulativeNet, totalsSeries, type DaysByDate } from '../../features/stats/aggregate'
import { cumulativeRanges } from '../../features/stats/periods'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'
import { useThemeAppearance } from '../../theme/context'
import type { BossCycle } from '../../types'
import { StatsSection } from './StatsSection'

const BUBBLE_SPACE = 42
const CHART_HEIGHT = 96
const TOP_PAD = 8
const BOTTOM_PAD = 8

function signed(meso: number): string {
  return `${meso > 0 ? '+' : meso < 0 ? '−' : ''}${formatMesoCompact(Math.abs(meso))}`
}

function periodTitle(cycle: BossCycle, periodKey: string): string {
  const month = Number(periodKey.slice(5, 7))
  return cycle === 'monthly' ? `${month}월` : `${month}월 ${Number(periodKey.slice(8, 10))}일 주`
}

export function CumulativeSection(props: { days: DaysByDate; cycle: BossCycle; periodKey: string }): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const [width, setWidth] = useState(312)
  const [picked, setPicked] = useState<number | null>(null)

  const firstDateKey = Object.keys(props.days).sort()[0] ?? null
  const ranges = cumulativeRanges(props.cycle, props.periodKey, firstDateKey)
  const points = cumulativeNet(totalsSeries(props.days, ranges))
  const selected = picked === null || picked >= points.length ? points.length - 1 : picked
  const total = points[points.length - 1]
  const start = ranges[0].from

  const low = Math.min(0, ...points)
  const high = Math.max(0, ...points, 1)
  const plotHeight = CHART_HEIGHT - TOP_PAD - BOTTOM_PAD
  const x = (index: number): number => (points.length === 1 ? width / 2 : (index / (points.length - 1)) * width)
  const y = (value: number): number => TOP_PAD + plotHeight - ((value - low) / (high - low)) * plotHeight
  const line = points.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`
  const zeroY = y(0)
  const pointColor = points[selected] >= 0 ? definition.riseInk : definition.fallInk
  const bubbleRatio = x(selected) / width

  return (
    <StatsSection title="누적 순수익" testID="stats-cumulative">
      <View className="flex-row items-end gap-2">
        <Text testID="stats-cumulative-total" className={`text-2xl font-bold ${total >= 0 ? 'text-rise-ink' : 'text-fall-ink'}`} style={TABULAR_NUMS}>
          {signed(total)}{' '}
          <Text className="text-11 font-bold text-text-muted">메소</Text>
        </Text>
        <Text className="mb-1 text-11 text-text-muted">{`${Number(start.slice(5, 7))}월 ${Number(start.slice(8, 10))}일부터`}</Text>
      </View>

      <View style={{ paddingTop: BUBBLE_SPACE }} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        <Svg width={width} height={CHART_HEIGHT}>
          {/* 0 선을 경계로 같은 선을 두 번 그려 자른다. 위는 수익 색, 아래(누적이 음수인 구간)는 지출 색이다 */}
          <Defs>
            <ClipPath id="stats-cumulative-above">
              <Rect x={0} y={0} width={width} height={zeroY} />
            </ClipPath>
            <ClipPath id="stats-cumulative-below">
              <Rect x={0} y={zeroY} width={width} height={CHART_HEIGHT - zeroY} />
            </ClipPath>
          </Defs>
          <Line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke={definition.border} strokeWidth={1} />
          <Path d={area} fill={definition.riseInk} fillOpacity={0.1} clipPath="url(#stats-cumulative-above)" />
          <Path d={area} fill={definition.fallInk} fillOpacity={0.1} clipPath="url(#stats-cumulative-below)" />
          <Path
            testID="stats-cumulative-line-above"
            d={line}
            fill="none"
            stroke={definition.riseInk}
            strokeWidth={2}
            strokeLinejoin="round"
            clipPath="url(#stats-cumulative-above)"
          />
          <Path
            testID="stats-cumulative-line-below"
            d={line}
            fill="none"
            stroke={definition.fallInk}
            strokeWidth={2}
            strokeLinejoin="round"
            clipPath="url(#stats-cumulative-below)"
          />
          <Line x1={x(selected)} x2={x(selected)} y1={TOP_PAD} y2={y(0)} stroke={definition.textDisabled} strokeDasharray="2 3" />
          <Circle cx={x(selected)} cy={y(points[selected])} r={4} fill={definition.surface} stroke={pointColor} strokeWidth={2} />
        </Svg>

        <View className="absolute bottom-0 left-0 right-0 flex-row" style={{ top: BUBBLE_SPACE }}>
          {ranges.map((range, index) => (
            <Pressable
              key={range.periodKey}
              role="button"
              aria-label={`${periodTitle(props.cycle, range.periodKey)}까지 보기`}
              onPress={() => setPicked(index)}
              className="flex-1"
            />
          ))}
        </View>

        <View
          pointerEvents="none"
          className="absolute top-0 rounded-[10px] border border-border bg-surface px-2 py-1 shadow-sm"
          style={
            bubbleRatio < 0.3
              ? { left: 0 }
              : bubbleRatio > 0.7
                ? { right: 0 }
                : { left: x(selected), transform: [{ translateX: '-50%' }] }
          }
        >
          <Text testID="stats-cumulative-bubble-title" className="text-10 text-text-muted">
            {`${periodTitle(props.cycle, ranges[selected].periodKey)}까지`}
          </Text>
          <Text
            testID="stats-cumulative-bubble-value"
            className={`text-11 font-bold ${points[selected] >= 0 ? 'text-rise-ink' : 'text-fall-ink'}`}
            style={TABULAR_NUMS}
          >
            {signed(points[selected])}
          </Text>
        </View>
      </View>
    </StatsSection>
  )
}
