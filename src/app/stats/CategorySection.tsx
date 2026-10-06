/**
 * 수입 내역 · 지출 내역 섹션. 갈래별 합계를 반원 도넛으로 그린다.
 *
 * 넷까지 조각이 되고 나머지는 `그 외` 한 조각이다(남는 것이 하나면 묶지 않는다). 넓은 조각은 안에,
 * 좁은 조각은 반원 오른쪽에 선으로 이어 적는다. 그림 높이는 반원에 고정해 두 카드의 높이가 같다.
 * `그 외` 와 갈래 여럿을 품은 조각(사냥 · 버프)은 누르면 세부 줄이 그 조각의 라벨 아래 팝오버로 뜬다.
 */
import { memo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { interpolate, useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Svg, { Path, Polyline } from 'react-native-svg'

import { Text } from '../../components/atoms'
import { AnchoredPopover } from '../../components/molecules/Popover/Popover'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { CategoryTotal } from '../../features/stats/aggregate'
import type { PopoverAnchorRect } from '../../hooks/useAnchoredPopover'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'
import { useThemeAppearance } from '../../theme/context'
import { useRevealProgress } from './reveal'
import { StatsSection } from './StatsSection'

const AnimatedPath = Animated.createAnimatedComponent(Path)
/** NativeWind 가 등록한 `Animated.View` 는 정적 스타일을 버려서(`TabSegment` 와 같은 함정) 따로 만든다 */
const AnimatedBox = Animated.createAnimatedComponent(View)

/** 조각이 되는 갈래 수. 넘는 것은 `그 외` 로 묶는다 */
const SLICE_LIMIT = 4
/** 진하기. 큰 조각이 가장 진하다 */
const SLICE_OPACITY = [1, 0.72, 0.5, 0.32, 0.2]
/** 안에 적을 수 있는 가장 좁은 조각(라디안) */
const INSIDE_MIN_SPAN = 0.62
/** 설계 좌표. 폭 300 기준이고 실제 폭에 맞춰 곱한다 */
const BASE = { width: 300, cx: 116, cy: 122, outer: 108, inner: 52 }
/** 바깥 라벨(두 줄) 사이 간격과 높이. 글자는 화면 폭을 안 따라 커지므로 설계 좌표가 아니라 px 이다 */
const LABEL_GAP = 32
const LABEL_HEIGHT = 30

interface Slice {
  key: string
  name: string
  meso: number
  opacity: number
  rest: boolean
  /** 누르면 팝오버에 뜨는 줄. 없으면 안 눌린다 */
  details: readonly CategoryTotal[]
}

function slicesOf(items: readonly CategoryTotal[]): Slice[] {
  const cut = items.length === SLICE_LIMIT + 1 ? items.length : SLICE_LIMIT
  const top = items.slice(0, cut)
  const rest = items.slice(cut)
  const slices: Slice[] = top.map((item, index) => ({
    key: item.key,
    name: item.name,
    meso: item.meso,
    opacity: SLICE_OPACITY[index],
    rest: false,
    details: item.parts ?? [],
  }))
  if (rest.length > 0) {
    slices.push({
      key: 'rest',
      name: `그 외 ${rest.length}`,
      meso: rest.reduce((sum, item) => sum + item.meso, 0),
      opacity: 1,
      rest: true,
      details: rest,
    })
  }
  return slices
}

function arcPath(cx: number, cy: number, outer: number, inner: number, from: number, to: number): string {
  'worklet'
  const point = (radius: number, angle: number): string =>
    `${(cx + radius * Math.sin(angle)).toFixed(2)} ${(cy - radius * Math.cos(angle)).toFixed(2)}`
  const large = to - from > Math.PI ? 1 : 0
  return `M${point(outer, from)} A${outer} ${outer} 0 ${large} 1 ${point(outer, to)} L${point(inner, to)} A${inner} ${inner} 0 ${large} 0 ${point(inner, from)} Z`
}

/**
 * 왼쪽 끝에서 진행값만큼 자라는 조각. 쓸기를 `ClipPath` 로 내면 안드로이드에서 안 보인다. react-native-svg 가
 * 클립 안 도형이 바뀌어도 다시 그리지 않아 첫 프레임의 빈 클립에 굳는다. 그래서 조각 자신의 `d` 를 움직인다.
 */
function SweepSlice(props: {
  progress: SharedValue<number>
  cx: number
  cy: number
  outer: number
  inner: number
  from: number
  to: number
  fill: string
  fillOpacity: number
  stroke: string
  onPress?: () => void
}): React.JSX.Element {
  const { progress, cx, cy, outer, inner, from, to } = props
  const animatedProps = useAnimatedProps(() => {
    const end = Math.min(to, -Math.PI / 2 + Math.PI * progress.value)
    return { d: end <= from ? 'M0 0' : arcPath(cx, cy, outer, inner, from, end) }
  })
  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill={props.fill}
      fillOpacity={props.fillOpacity}
      stroke={props.stroke}
      strokeWidth={2}
      strokeLinejoin="round"
      onPress={props.onPress}
    />
  )
}

interface DrawnSlice {
  slice: Slice
  from: number
  to: number
  mid: number
  span: number
}

interface OutsideLabel extends DrawnSlice {
  x0: number
  y0: number
  y: number
}

/**
 * 조각의 각도와 바깥 라벨의 자리. 좁은 조각의 라벨은 반원 오른쪽에 조각 높이로 세우고, 겹치면 아래로
 * 민 뒤 바닥을 넘으면 통째로 올린다.
 */
function layoutSlices(
  slices: readonly Slice[],
  total: number,
  box: { cx: number; cy: number; outer: number; height: number },
): { drawn: DrawnSlice[]; outside: OutsideLabel[] } {
  const drawn: DrawnSlice[] = []
  let angle = -Math.PI / 2
  for (const slice of slices) {
    const span = (slice.meso / total) * Math.PI
    drawn.push({ slice, from: angle, to: angle + span, mid: angle + span / 2, span })
    angle += span
  }

  const outside: OutsideLabel[] = drawn
    .filter((part) => part.span < INSIDE_MIN_SPAN)
    .map((part) => {
      const x0 = box.cx + (box.outer + 1) * Math.sin(part.mid)
      const y0 = box.cy - (box.outer + 1) * Math.cos(part.mid)
      return { ...part, x0, y0, y: y0 + 4 }
    })
    .sort((left, right) => left.y - right.y)
  for (let index = 1; index < outside.length; index += 1) {
    if (outside[index].y - outside[index - 1].y < LABEL_GAP) outside[index].y = outside[index - 1].y + LABEL_GAP
  }
  const overflow = outside.length > 0 ? outside[outside.length - 1].y + LABEL_HEIGHT / 2 - box.height : 0
  if (overflow > 0) for (const part of outside) part.y -= overflow
  return { drawn, outside }
}

export const CategorySection = memo(function CategorySection(props: {
  title: string
  side: 'income' | 'expense'
  items: readonly CategoryTotal[]
  /** 화면에 들어왔나. 들어오는 순간 반원이 왼쪽부터 쓸려 나온다 */
  revealed?: boolean
  /** 바뀌면 반원을 다시 쓴다. 화면이 기간으로 준다 */
  replayKey?: string
}): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const progress = useRevealProgress(props.revealed ?? true, props.replayKey)
  const [width, setWidth] = useState(BASE.width)
  /** 팝오버를 연 조각과 그때의 항목 목록. 기간이 바뀌어 목록이 달라지면 저절로 닫힌다 */
  const [openFor, setOpenFor] = useState<{
    items: readonly CategoryTotal[]
    key: string
    anchor: PopoverAnchorRect | null
  } | null>(null)
  const openKey = openFor !== null && openFor.items === props.items ? openFor.key : null
  /** 조각 key → 그 라벨. 조각(SVG)을 눌러도 팝오버는 같은 조각의 라벨에 붙는다 */
  const labelNodes = useRef(new Map<string, View>())

  function toggle(key: string): void {
    if (openKey === key) {
      setOpenFor(null)
      return
    }
    const items = props.items
    setOpenFor({ items, key, anchor: null })
    labelNodes.current.get(key)?.measureInWindow((left, top, width, height) => {
      setOpenFor((current) =>
        current !== null && current.key === key && current.items === items
          ? { ...current, anchor: { left, top, width, height } }
          : current,
      )
    })
  }

  // 글자는 쓸기가 거의 끝날 때 나타난다.
  const labelStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.6, 1], [0, 1], 'clamp') }))

  const label = props.side === 'income' ? '수입' : '지출'
  const color = props.side === 'income' ? definition.riseInk : definition.fallInk
  const tone = props.side === 'income' ? 'text-rise-ink' : 'text-fall-ink'
  const total = props.items.reduce((sum, item) => sum + item.meso, 0)

  if (props.items.length === 0 || total <= 0) {
    return (
      <StatsSection title={props.title} testID={`stats-category-${props.side}`}>
        <Text className="py-6 text-center text-xs text-text-muted">{`이 기간의 ${label} 기록이 없어요`}</Text>
      </StatsSection>
    )
  }

  const slices = slicesOf(props.items)
  const opened = slices.find((slice) => slice.key === openKey) ?? null
  const scale = width / BASE.width
  const cx = BASE.cx * scale
  const cy = BASE.cy * scale
  const outer = BASE.outer * scale
  const inner = BASE.inner * scale
  const height = cy + 8

  const { drawn, outside } = layoutSlices(slices, total, { cx, cy, outer, height })
  const labelX = cx + outer + 14 * scale

  const percent = (meso: number): string => `${Math.round((meso / total) * 100)}%`

  function labelText(slice: Slice, inside: boolean, ink: string): React.JSX.Element {
    const body = (
      <>
        <Text className={`text-11 font-bold ${inside ? '' : 'text-text'}`} style={inside ? { color: ink } : undefined}>
          {slice.details.length > 0 ? `${slice.name} ›` : slice.name}
        </Text>
        {inside ? (
          <>
            <Text className="text-10" style={[TABULAR_NUMS, { color: ink }]}>
              {percent(slice.meso)}
            </Text>
            <Text className="text-10 font-semibold" style={[TABULAR_NUMS, { color: ink }]}>
              {formatMesoCompact(slice.meso)}
            </Text>
          </>
        ) : (
          <Text className="text-10 text-text-muted" style={TABULAR_NUMS}>
            <Text>{percent(slice.meso)}</Text>
            {' · '}
            <Text>{formatMesoCompact(slice.meso)}</Text>
          </Text>
        )}
      </>
    )
    return slice.details.length > 0 ? (
      <Pressable
        ref={(node) => {
          if (node === null) labelNodes.current.delete(slice.key)
          else labelNodes.current.set(slice.key, node)
        }}
        role="button"
        aria-label={`${slice.name} 세부 항목`}
        onPress={() => toggle(slice.key)}
        className={inside ? 'items-center' : ''}
      >
        {body}
      </Pressable>
    ) : (
      body
    )
  }

  return (
    <StatsSection title={props.title} testID={`stats-category-${props.side}`}>
      <View style={{ height }} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        <Svg width={width} height={height}>
          {drawn.map(({ slice, from, to }) => (
            <SweepSlice
              key={slice.key}
              progress={progress}
              cx={cx}
              cy={cy}
              outer={outer}
              inner={inner}
              from={from}
              to={to}
              fill={slice.rest ? definition.surface2 : color}
              fillOpacity={slice.rest ? 1 : slice.opacity}
              stroke={definition.surface}
              onPress={slice.details.length > 0 ? () => toggle(slice.key) : undefined}
            />
          ))}
          {outside.map((part) => (
            <Polyline
              key={`leader-${part.slice.key}`}
              points={`${part.x0},${part.y0} ${labelX - 6},${part.y - 4} ${labelX - 2},${part.y - 4}`}
              fill="none"
              stroke={definition.textDisabled}
              strokeWidth={1}
            />
          ))}
        </Svg>

        <AnimatedBox pointerEvents="box-none" style={[StyleSheet.absoluteFill, labelStyle]}>
        {drawn
          .filter((part) => part.span >= INSIDE_MIN_SPAN)
          .map(({ slice, mid }) => {
            const radius = (outer + inner) / 2
            const ink = !slice.rest && slice.opacity >= 0.7 ? definition.surface : definition.text
            return (
              <View
                key={`label-${slice.key}`}
                testID={`stats-category-label-${slice.key}`}
                className="absolute items-center"
                style={{
                  left: cx + radius * Math.sin(mid),
                  top: cy - radius * Math.cos(mid),
                  transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
                }}
              >
                {labelText(slice, true, ink)}
              </View>
            )
          })}
        {outside.map((part) => (
          <View
            key={`label-${part.slice.key}`}
            testID={`stats-category-label-${part.slice.key}`}
            className="absolute"
            style={{ left: labelX, top: part.y - 14 }}
          >
            {labelText(part.slice, false, definition.text)}
          </View>
        ))}

        <View className="absolute items-center" style={{ left: cx, top: cy - 34, transform: [{ translateX: '-50%' }] }}>
          <Text className="text-11 font-semibold text-text-muted">{label}</Text>
          <Text testID="stats-category-total" className="text-lg font-bold text-text" style={TABULAR_NUMS}>
            {formatMesoCompact(total)}
          </Text>
        </View>
        </AnimatedBox>

        {opened !== null && (
          <AnchoredPopover
            testID="stats-category-popover"
            ariaLabel={opened.name}
            closeLabel="세부 항목 닫기"
            anchor={openFor?.anchor ?? null}
            onClose={() => setOpenFor(null)}
            className="gap-1.5 p-3"
          >
              <Text className="text-10 font-bold tracking-wide text-text-muted">{opened.name}</Text>
              {opened.details.map((item) => (
                <View key={item.key} className="flex-row items-center justify-between gap-3">
                  <Text className="text-11 text-text">{item.name}</Text>
                  <View className="flex-row items-baseline gap-1.5">
                    <Text className="text-10 text-text-muted" style={TABULAR_NUMS}>
                      {percent(item.meso)}
                    </Text>
                    <Text className={`text-11 font-bold ${tone}`} style={TABULAR_NUMS}>
                      {formatMesoCompact(item.meso)}
                    </Text>
                  </View>
                </View>
              ))}
          </AnchoredPopover>
        )}
      </View>
    </StatsSection>
  )
})
