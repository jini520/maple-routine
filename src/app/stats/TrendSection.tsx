/**
 * 추이 섹션. 고른 기간까지 주간 8주 · 월간 6개월의 순수익(0 선 위아래) 또는 수익 · 지출 한쪽을
 * 막대로 그린다. 막대를 누르면 그 막대만 진해지고 값이 말풍선으로 뜬다. 고르지 않으면 모든 막대가 진하다.
 */
import { memo, useState } from 'react'
import { Pressable, View, type LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg'

import { Text } from '../../components/atoms'
import { Segment } from '../../components/molecules/Segment/Segment'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { totalsSeries, type DaysByDate, type StatsTotals } from '../../features/stats/aggregate'
import type { StatsPeriodRange } from '../../features/stats/periods'
import { weekOfMonthLabel } from '../../lib/boss/boss-profit-period'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'
import { useThemeAppearance } from '../../theme/context'
import type { BossCycle } from '../../types'
import { useRevealProgress } from './reveal'
import { StatsSection } from './StatsSection'

const AnimatedRect = Animated.createAnimatedComponent(Rect)

/** 0 선에서 자라는 막대. 진행값이 1 이면 제 길이다 */
function GrowBar(props: {
  x: number
  width: number
  from: number
  to: number
  fill: string
  opacity: number
  progress: SharedValue<number>
}): React.JSX.Element {
  const { from, to, progress } = props
  const animatedProps = useAnimatedProps(() => {
    const height = Math.abs(to - from) * progress.value
    return { y: to < from ? from - height : from, height }
  })
  return (
    <AnimatedRect
      x={props.x}
      width={props.width}
      rx={3}
      fill={props.fill}
      opacity={props.opacity}
      animatedProps={animatedProps}
    />
  )
}

const MODES = ['순수익', '수익', '지출'] as const
type Mode = (typeof MODES)[number]

/** 말풍선이 차트를 가리지 않도록 그 위에 비워 두는 높이 */
const BUBBLE_SPACE = 54
const CHART_HEIGHT = 162
const AXIS_LEFT = 46
/** 축 글자 두 줄(`10월` · `1주차`) 자리. `10월 1주차` 한 줄은 여덟 칸에 안 들어간다 */
const AXIS_BOTTOM = 32
const AXIS_LINE = 12
const TOP_PAD = 8

function signed(meso: number): string {
  return `${meso > 0 ? '+' : meso < 0 ? '−' : ''}${formatMesoCompact(Math.abs(meso))}`
}

/** 눈금 끝. 1 · 2 · 5 × 10ⁿ 중 값을 덮는 가장 작은 수 */
function niceCeil(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find((candidate) => candidate * power >= value) ?? 10
  return step * power
}

function valueOf(totals: StatsTotals, mode: Mode): number {
  return mode === '순수익' ? totals.netMeso : mode === '수익' ? totals.incomeMeso : totals.expenseMeso
}

/** 축 글자 줄들. 주간은 `10월` · `1주차` 두 줄이다 */
function axisLines(cycle: BossCycle, periodKey: string): string[] {
  if (cycle === 'monthly') return [`${Number(periodKey.slice(5, 7))}월`]
  return weekOfMonthLabel(periodKey).split(' ')
}

function bubbleTitle(cycle: BossCycle, periodKey: string): string {
  if (cycle === 'monthly') return `${Number(periodKey.slice(5, 7))}월`
  return weekOfMonthLabel(periodKey)
}

export const TrendSection = memo(function TrendSection(props: {
  days: DaysByDate
  cycle: BossCycle
  /** 오래된 것부터이고 마지막이 고른 기간이다 */
  trend: readonly StatsPeriodRange[]
  /** 화면에 들어왔나. 들어오는 순간 막대가 자란다 */
  revealed?: boolean
}): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const [mode, setMode] = useState<Mode>('순수익')
  /** 고른 막대. 어느 구간 · 보기에서 골랐는지 함께 들어, 그것이 바뀌면 고름이 풀린다 */
  const [picked, setPicked] = useState<{ scope: string; index: number } | null>(null)
  const [width, setWidth] = useState(312)

  const series = totalsSeries(props.days, props.trend)
  const lastPeriodKey = props.trend[props.trend.length - 1].periodKey
  const progress = useRevealProgress(props.revealed ?? true, `${lastPeriodKey}|${mode}`)
  const scope = `${props.trend[0].periodKey}|${lastPeriodKey}|${mode}`
  const selected = picked !== null && picked.scope === scope ? picked.index : null
  const toggle = (index: number): void => setPicked(selected === index ? null : { scope, index })
  const values = series.map((totals) => valueOf(totals, mode))
  const net = mode === '순수익'

  const plotWidth = Math.max(width - AXIS_LEFT, 1)
  const plotHeight = CHART_HEIGHT - TOP_PAD - AXIS_BOTTOM
  const slot = plotWidth / series.length
  const top = niceCeil(Math.max(...values.map(Math.abs), 1))
  const y = net
    ? (value: number) => TOP_PAD + plotHeight / 2 - (value / top) * (plotHeight / 2)
    : (value: number) => TOP_PAD + plotHeight - (value / top) * plotHeight
  const ticks = net ? [-top, -top / 2, 0, top / 2, top] : [0, top / 2, top]
  const barWidth = Math.min(slot * 0.5, 22)

  const pickedTotals = selected === null ? null : series[selected]
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const span = props.cycle === 'weekly' ? `${series.length}주` : `${series.length}개월`
  const bubbleX = AXIS_LEFT + slot * (selected ?? 0) + slot / 2
  const bubbleAlign = bubbleX / width < 0.3 ? 'left' : bubbleX / width > 0.7 ? 'right' : 'center'

  return (
    <StatsSection
      title="추이"
      testID="stats-trend"
      trailing={<Segment options={MODES} selected={mode} onSelect={setMode} />}
    >
      <View style={{ paddingTop: BUBBLE_SPACE }} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        <Svg width={width} height={CHART_HEIGHT}>
          {ticks.map((tick) => (
            <Line
              key={`grid-${tick}`}
              x1={AXIS_LEFT}
              x2={width}
              y1={y(tick)}
              y2={y(tick)}
              stroke={definition.border}
              strokeWidth={tick === 0 ? 1 : 0.6}
              strokeDasharray={tick === 0 ? undefined : '2 3'}
            />
          ))}
          {ticks.map((tick) => (
            <SvgText key={`tick-${tick}`} x={AXIS_LEFT - 6} y={y(tick) + 3} fontSize={9} fill={definition.textDisabled} textAnchor="end">
              {net ? signed(tick) : formatMesoCompact(tick)}
            </SvgText>
          ))}
          {values.map((value, index) => {
            const x = AXIS_LEFT + slot * index + slot / 2
            const color = mode === '지출' || (net && value < 0) ? definition.fallInk : definition.riseInk
            const from = y(0)
            const to = value === 0 ? from : Math.abs(y(value) - from) < 1 ? from + Math.sign(y(value) - from) : y(value)
            return (
              <GrowBar
                key={props.trend[index].periodKey}
                x={x - barWidth / 2}
                width={barWidth}
                from={from}
                to={to}
                fill={color}
                opacity={selected === null || index === selected ? 0.95 : 0.45}
                progress={progress}
              />
            )
          })}
          {props.trend.flatMap((range, index) => {
            const lines = axisLines(props.cycle, range.periodKey)
            return lines.map((line, row) => (
              <SvgText
                key={`x-${range.periodKey}-${row}`}
                x={AXIS_LEFT + slot * index + slot / 2}
                y={CHART_HEIGHT - 5 - (lines.length - 1 - row) * AXIS_LINE}
                fontSize={9}
                fontWeight={index === selected ? '700' : '400'}
                fill={index === selected ? definition.text : definition.textMuted}
                textAnchor="middle"
              >
                {line}
              </SvgText>
            ))
          })}
        </Svg>

        {/* 누르는 자리. 막대가 가늘어 칸 전체를 받는다 */}
        <View className="absolute bottom-0 flex-row" style={{ left: AXIS_LEFT, right: 0, top: BUBBLE_SPACE }}>
          {props.trend.map((range, index) => (
            <Pressable
              key={`hit-${range.periodKey}`}
              role="button"
              aria-label={`${bubbleTitle(props.cycle, range.periodKey)} 보기`}
              onPress={() => toggle(index)}
              className="flex-1"
            />
          ))}
        </View>

        {pickedTotals !== null && (
          <View
            pointerEvents="none"
            className="absolute top-0 rounded-[10px] border border-border bg-surface px-2 py-1 shadow-sm"
            style={
              bubbleAlign === 'left'
                ? { left: 0 }
                : bubbleAlign === 'right'
                  ? { right: 0 }
                  : { left: bubbleX, transform: [{ translateX: '-50%' }] }
            }
          >
            <Text testID="stats-trend-bubble-title" className="text-10 text-text-muted">
              {bubbleTitle(props.cycle, props.trend[selected!].periodKey)}
            </Text>
            <Text
              testID="stats-trend-bubble-value"
              className={`text-11 font-bold ${mode === '지출' || (net && pickedTotals.netMeso < 0) ? 'text-fall-ink' : 'text-rise-ink'}`}
              style={TABULAR_NUMS}
            >
              {net
                ? `순수익 ${signed(pickedTotals.netMeso)}`
                : `${mode} ${formatMesoCompact(valueOf(pickedTotals, mode))}`}
            </Text>
            {net && (
              <Text testID="stats-trend-bubble-sub" className="text-10 text-text-muted" style={TABULAR_NUMS}>
                {`수입 ${formatMesoCompact(pickedTotals.incomeMeso)} · 지출 ${formatMesoCompact(pickedTotals.expenseMeso)}`}
              </Text>
            )}
          </View>
        )}
      </View>

      <Text testID="stats-trend-average" className="self-end text-11 text-text-muted" style={TABULAR_NUMS}>
        {`${span} 평균 ${mode} ${net ? signed(average) : formatMesoCompact(average)}`}
      </Text>
    </StatsSection>
  )
})
