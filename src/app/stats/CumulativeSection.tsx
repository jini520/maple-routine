/**
 * 누적 순수익 섹션. 시작 날짜부터 고른 기간까지 순수익을 더해 큰 숫자와 선으로 그린다. 시작 날짜는 알약을
 * 눌러 달력에서 고르고, 고르지 않으면 기록이 처음 있는 날부터다. 기간을 누르면 그 기간까지의 누적을 말풍선으로 띄운다.
 */
import { memo, useState } from 'react'
import { Pressable, View, type LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedProps } from 'react-native-reanimated'
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg'

import { Text } from '../../components/atoms'
import { DateSelect } from '../../components/molecules/DateSelect/DateSelect'
import { CalendarPopover } from '../../components/organisms/CalendarPopover/CalendarPopover'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { monthKeyOf } from '../../lib/calendar'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { cumulativeNet, totalsSeries, type DaysByDate } from '../../features/stats/aggregate'
import { cumulativeRanges } from '../../features/stats/periods'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'
import { useThemeAppearance } from '../../theme/context'
import type { BossCycle } from '../../types'
import { useRevealProgress } from './reveal'
import { StatsSection } from './StatsSection'

const AnimatedRect = Animated.createAnimatedComponent(Rect)

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

export const CumulativeSection = memo(function CumulativeSection(props: {
  days: DaysByDate
  cycle: BossCycle
  periodKey: string
  /** 더하기 시작하는 날. `null` 이면 기록이 처음 있는 날부터다 */
  startDateKey: string | null
  /** 달력에서 고를 수 있는 첫날 · 끝날 */
  earliest: string
  latest: string
  /** `null` 이면 처음부터 더한다 */
  onChangeStart: (next: string | null) => void
  /** 화면에 들어왔나. 들어오는 순간 선이 왼쪽부터 그려진다 */
  revealed?: boolean
}): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const progress = useRevealProgress(props.revealed ?? true, `${props.periodKey}|${props.startDateKey ?? ''}`)
  const [width, setWidth] = useState(312)
  /** 고른 점. 어느 기간에서 골랐는지 함께 들어, 기간이 바뀌면 새 기간의 끝으로 돌아간다 */
  const [picked, setPicked] = useState<{ periodKey: string; index: number } | null>(null)

  const firstRecordDateKey = Object.keys(props.days).sort()[0] ?? null
  const ranges = cumulativeRanges(props.cycle, props.periodKey, props.startDateKey ?? firstRecordDateKey)
  const points = cumulativeNet(totalsSeries(props.days, ranges))
  const selected =
    picked !== null && picked.periodKey === props.periodKey && picked.index < points.length ? picked.index : points.length - 1
  const total = points[points.length - 1]
  const start = ranges[0].from
  const { ref: startRef, isOpen, anchor, toggle, close } = useAnchoredPopover()
  const [calendarMonth, setCalendarMonth] = useState(monthKeyOf(start))

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
  const revealProps = useAnimatedProps(() => ({ width: width * progress.value }))

  return (
    <StatsSection title="누적 순수익" testID="stats-cumulative">
      <View className="flex-row items-end gap-2">
        <Text testID="stats-cumulative-total" className={`text-2xl font-bold ${total >= 0 ? 'text-rise-ink' : 'text-fall-ink'}`} style={TABULAR_NUMS}>
          {signed(total)}{' '}
          <Text className="text-11 font-bold text-text-muted">메소</Text>
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <DateSelect
          ref={startRef}
          dateKey={start}
          label="누적 시작 날짜"
          testID="stats-cumulative-start"
          onPress={() => {
            // 달력은 늘 지금 시작 날짜가 든 달로 열린다.
            setCalendarMonth(monthKeyOf(start))
            toggle()
          }}
        />
        <Text className="text-11 text-text-muted">부터</Text>
        {props.startDateKey !== null && (
          <Pressable role="button" aria-label="처음부터 더하기" onPress={() => props.onChangeStart(null)} className="ml-auto active:opacity-60">
            <Text className="text-11 font-semibold text-primary-ink">처음부터</Text>
          </Pressable>
        )}
      </View>
      {isOpen && (
        <CalendarPopover
          selected={start}
          min={props.earliest}
          max={props.latest}
          monthKey={calendarMonth}
          anchor={anchor}
          onChangeMonth={setCalendarMonth}
          onSelect={(next) => {
            props.onChangeStart(next)
            close()
          }}
          onClose={close}
        />
      )}

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
            <ClipPath id="stats-cumulative-reveal">
              <AnimatedRect x={0} y={0} height={CHART_HEIGHT} animatedProps={revealProps} />
            </ClipPath>
          </Defs>
          <Line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke={definition.border} strokeWidth={1} />
          <G clipPath="url(#stats-cumulative-reveal)">
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
          </G>
        </Svg>

        <View className="absolute bottom-0 left-0 right-0 flex-row" style={{ top: BUBBLE_SPACE }}>
          {ranges.map((range, index) => (
            <Pressable
              key={range.periodKey}
              role="button"
              aria-label={`${periodTitle(props.cycle, range.periodKey)}까지 보기`}
              onPress={() => setPicked({ periodKey: props.periodKey, index })}
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
})
