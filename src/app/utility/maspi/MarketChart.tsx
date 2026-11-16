/**
 * MASPI 상세의 시세 그래프. 날마다의 기준가 꺾은선과 범위 띠(25% ~ 75% 지점), 오른쪽 눈금, 아래 날짜다.
 * 누르거나 끌면 그날에 세로 점선과 점을 찍고 위에 날짜와 기준가 상자를 띄운다.
 *
 * 선과 띠는 victory-native(Skia)가 그리고, 눈금 · 날짜 · 상자 글자는 앱의 `Text` 로 캔버스 위에 얹는다. Skia 글자는
 * 앱 글꼴과 글자 크기 설정을 따르지 않기 때문이다. 자리는 victory-native 가 알려 주는 그림 영역으로 잰다.
 */
import { Circle, DashPathEffect, Line as SkiaLine, vec } from '@shopify/react-native-skia'
import { useState } from 'react'
import { View } from 'react-native'
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated'
import { AreaRange, CartesianChart, Line, useChartPressState, type ChartBounds } from 'victory-native'

import { Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { formatTick, niceScale, trendOf } from '../../../features/market/format'
import { formatMesoUnits } from '../../../lib/drop/drop-price'
import type { MarketSeriesPoint } from '../../../server/market'
import { useThemeAppearance } from '../../../theme/context'
import { toneColor } from './tone'

/** 그림 영역의 높이. 날짜 줄은 그 아래다 */
const PLOT_HEIGHT = 190
const DATE_ROW_HEIGHT = 18
/** 오른쪽 눈금 글자의 자리 */
const TICK_LANE = 34
/** 아래 날짜의 수. 처음과 끝을 넣어 고르게 나눈다 */
const DATE_LABELS = 5
/** 날짜 · 상자 글자를 가운데에 맞추는 상자의 폭 */
const LABEL_BOX = 120

/** `11/5`. 그래프 날짜와 누른 날 상자가 같이 쓴다 */
function shortDate(date: string): string {
  const [, month, day] = date.split('-').map(Number)
  return `${month}/${day}`
}

/** 날짜를 적을 자리. 날이 적으면 모든 날이다 */
function dateLabelIndexes(count: number): number[] {
  if (count <= DATE_LABELS) return Array.from({ length: count }, (_, index) => index)
  return Array.from({ length: DATE_LABELS }, (_, k) => Math.round((k * (count - 1)) / (DATE_LABELS - 1)))
}

export function MarketChart(props: { series: readonly MarketSeriesPoint[] }): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const [bounds, setBounds] = useState<ChartBounds | null>(null)
  const [width, setWidth] = useState(0)
  const [pressed, setPressed] = useState<number | null>(null)
  const { state } = useChartPressState({ x: 0, y: { price: 0, low: 0, high: 0 } })

  // 누른 날을 글자로 적으려면 JS 의 상태가 있어야 한다. 바뀔 때만 넘긴다.
  useAnimatedReaction(
    () => (state.isActive.value ? state.matchedIndex.value : -1),
    (index, previous) => {
      if (index !== previous) runOnJS(setPressed)(index < 0 ? null : index)
    },
  )

  const data = props.series.map((point, index) => ({ index, price: point.price, low: point.low, high: point.high }))
  const scale = niceScale(Math.min(...props.series.map((point) => point.low)), Math.max(...props.series.map((point) => point.high)))
  const color = toneColor(trendOf(props.series.map((point) => point.price)), definition)
  const yOf = (value: number, area: ChartBounds): number =>
    area.top + ((scale.hi - value) / (scale.hi - scale.lo)) * (area.bottom - area.top)
  const xOf = (index: number, area: ChartBounds): number =>
    data.length < 2 ? area.left : area.left + (index / (data.length - 1)) * (area.right - area.left)
  const centeredLeft = (x: number): number => Math.min(Math.max(x - LABEL_BOX / 2, 0), Math.max(width - LABEL_BOX, 0))
  const pressedPoint = pressed === null ? undefined : props.series[pressed]

  return (
    <View testID="market-chart" style={{ height: PLOT_HEIGHT + DATE_ROW_HEIGHT }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={{ height: PLOT_HEIGHT }}>
        <CartesianChart
          data={data}
          xKey="index"
          yKeys={['price', 'low', 'high']}
          domain={{ y: [scale.lo, scale.hi] }}
          padding={{ top: 6, bottom: 6, right: TICK_LANE }}
          chartPressState={state}
          onChartBoundsChange={setBounds}
        >
          {({ points, chartBounds }) => (
            <>
              {scale.ticks.map((tick) => (
                <SkiaLine
                  key={tick}
                  p1={vec(chartBounds.left, yOf(tick, chartBounds))}
                  p2={vec(chartBounds.right, yOf(tick, chartBounds))}
                  color={definition.track}
                  strokeWidth={1}
                />
              ))}
              <AreaRange upperPoints={points.high} lowerPoints={points.low} color={color} opacity={0.14} />
              {pressed !== null && (
                <SkiaLine
                  p1={vec(xOf(pressed, chartBounds), chartBounds.top)}
                  p2={vec(xOf(pressed, chartBounds), chartBounds.bottom)}
                  color={definition.textMuted}
                  strokeWidth={1}
                >
                  <DashPathEffect intervals={[3, 3]} />
                </SkiaLine>
              )}
              <Line points={points.price} color={color} strokeWidth={2} strokeCap="round" strokeJoin="round" />
              {pressed !== null && points.price[pressed]?.y != null && (
                <>
                  {/* 바탕색 테를 둘러 선 위에서 점이 떠 보이게 한다. */}
                  <Circle cx={points.price[pressed].x} cy={points.price[pressed].y ?? 0} r={6.5} color={definition.surface} />
                  <Circle cx={points.price[pressed].x} cy={points.price[pressed].y ?? 0} r={4.5} color={color} />
                </>
              )}
            </>
          )}
        </CartesianChart>

        {bounds !== null &&
          scale.ticks.map((tick) => (
            <Text
              key={tick}
              className="absolute text-9 text-text-muted"
              style={[TABULAR_NUMS, { left: bounds.right + 6, top: yOf(tick, bounds) - 6.5 }]}
              maxScale={1}
            >
              {formatTick(tick, scale.step)}
            </Text>
          ))}

        {bounds !== null && pressedPoint !== undefined && pressed !== null && (
          <View pointerEvents="none" className="absolute top-0.5 items-center" style={{ left: centeredLeft(xOf(pressed, bounds)), width: LABEL_BOX }}>
            <View testID="market-chart-tip" className="items-center rounded-[10px] bg-surface px-2.5 py-1.5 shadow-lg">
              <Text className="text-11 text-text-muted" style={TABULAR_NUMS}>
                {shortDate(pressedPoint.date)}
              </Text>
              <Text className="text-xs font-bold text-text" style={TABULAR_NUMS}>
                {formatMesoUnits(pressedPoint.price)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {bounds !== null &&
        dateLabelIndexes(props.series.length).map((index, k, all) => {
          // 처음과 끝 날짜는 그림 영역의 양 끝에 붙인다. 가운데에 맞추면 반이 그림 밖으로 나가거나 점에서 멀어진다.
          const edge = k === 0 ? 'start' : k === all.length - 1 ? 'end' : 'center'
          const left =
            edge === 'start' ? bounds.left : edge === 'end' ? bounds.right - LABEL_BOX : xOf(index, bounds) - LABEL_BOX / 2
          return (
            <Text
              key={index}
              className={`absolute text-10 text-text-muted ${edge === 'start' ? 'text-left' : edge === 'end' ? 'text-right' : 'text-center'}`}
              style={[TABULAR_NUMS, { top: PLOT_HEIGHT + 3, left, width: LABEL_BOX }]}
              maxScale={1}
            >
              {shortDate(props.series[index].date)}
            </Text>
          )
        })}
    </View>
  )
}
