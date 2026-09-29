/**
 * 수입 내역 · 지출 내역 섹션. 갈래별 합계를 반원 도넛으로 그린다.
 *
 * 넷까지 조각이 되고 나머지는 `그 외` 한 조각이다(남는 것이 하나면 묶지 않는다). 넓은 조각은 안에,
 * 좁은 조각은 반원 오른쪽에 선으로 이어 적는다. 그림 높이는 반원에 고정해 두 카드의 높이가 같다.
 */
import { memo, useState } from 'react'
import { Pressable, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Path, Polyline } from 'react-native-svg'

import { Text } from '../../components/atoms'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { CategoryTotal } from '../../features/stats/aggregate'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'
import { useThemeAppearance } from '../../theme/context'
import { StatsSection } from './StatsSection'

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
}

function slicesOf(items: readonly CategoryTotal[]): { slices: Slice[]; rest: CategoryTotal[] } {
  const cut = items.length === SLICE_LIMIT + 1 ? items.length : SLICE_LIMIT
  const top = items.slice(0, cut)
  const rest = items.slice(cut)
  const slices: Slice[] = top.map((item, index) => ({ ...item, opacity: SLICE_OPACITY[index], rest: false }))
  if (rest.length > 0) {
    slices.push({
      key: 'rest',
      name: `그 외 ${rest.length}`,
      meso: rest.reduce((sum, item) => sum + item.meso, 0),
      opacity: 1,
      rest: true,
    })
  }
  return { slices, rest }
}

function arcPath(cx: number, cy: number, outer: number, inner: number, from: number, to: number): string {
  const point = (radius: number, angle: number): string =>
    `${(cx + radius * Math.sin(angle)).toFixed(2)} ${(cy - radius * Math.cos(angle)).toFixed(2)}`
  const large = to - from > Math.PI ? 1 : 0
  return `M${point(outer, from)} A${outer} ${outer} 0 ${large} 1 ${point(outer, to)} L${point(inner, to)} A${inner} ${inner} 0 ${large} 0 ${point(inner, from)} Z`
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
}): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const [width, setWidth] = useState(BASE.width)
  /** 팝오버를 연 항목 목록. 기간이 바뀌어 목록이 달라지면 저절로 닫힌다 */
  const [openFor, setOpenFor] = useState<readonly CategoryTotal[] | null>(null)
  const open = openFor === props.items
  const toggle = (): void => setOpenFor(open ? null : props.items)

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

  const { slices, rest } = slicesOf(props.items)
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
          {slice.rest ? `${slice.name} ›` : slice.name}
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
    return slice.rest ? (
      <Pressable role="button" aria-label={`${slice.name} 세부 항목`} onPress={toggle} className={inside ? 'items-center' : ''}>
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
            <Path
              key={slice.key}
              d={arcPath(cx, cy, outer, inner, from, to)}
              fill={slice.rest ? definition.surface2 : color}
              fillOpacity={slice.rest ? 1 : slice.opacity}
              stroke={definition.surface}
              strokeWidth={2}
              strokeLinejoin="round"
              onPress={slice.rest ? toggle : undefined}
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

        {open && (
          <>
            <Pressable aria-label="세부 항목 닫기" onPress={() => setOpenFor(null)} className="absolute inset-0" />
            <View
              testID="stats-category-popover"
              className="absolute right-0 top-0 w-[248px] max-w-full gap-1.5 rounded-[12px] border border-border bg-surface p-3 shadow-lg"
            >
              <Text className="text-10 font-bold tracking-wide text-text-muted">{`그 외 ${rest.length}`}</Text>
              {rest.map((item) => (
                <View key={item.key} className="flex-row items-center justify-between">
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
            </View>
          </>
        )}
      </View>
    </StatsSection>
  )
})
