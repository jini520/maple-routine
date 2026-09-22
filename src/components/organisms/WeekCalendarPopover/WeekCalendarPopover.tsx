/**
 * 주를 고르는 달력 팝오버. 격자는 다른 달력과 같이 일요일에서 시작하고, 고른 주(목~수)는 두 줄에 걸친 띠로 칠해진다.
 *
 * 상자와 머리는 `CalendarPopover` 와 같은 규격이다(폭 248 · 반경 12 · 꼬리). 어느 날을 눌러도 그 날이 든 주의
 * 목요일을 돌려준다. MVP 등급이 매주 목요일에 바뀌어 저장값이 그 날이기 때문이다.
 */
import { Modal, Pressable, useWindowDimensions, View } from 'react-native'

import { ChevronLeftIcon, ChevronRightIcon, Text } from '../../atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import {
  buildCalendarMonth,
  formatDayLabel,
  getAdjacentMonthKey,
  monthKeyOf,
  resetWeekStartOf,
  shiftDateKey,
  WEEKDAY_LABELS,
} from '../../../lib/calendar'
import { anchorPopover } from '../../../lib/popover-anchor'
import type { PopoverAnchorRect } from '../../../hooks/useAnchoredPopover'

const POPOVER_WIDTH = 248
const EDGE_GAP = 12
const CARET_SIZE = 8
const POPOVER_GAP = 8

export type WeekCalendarTab = 'start' | 'end'

export interface WeekCalendarPopoverProps {
  /** 칠할 주. 값은 그 주의 목요일이고, 주 하나면 `start` 와 `end` 가 같다 */
  selection: { start: string | null; end: string | null }
  /** 그 주(목요일)를 고를 수 있나 */
  isSelectable: (week: string) => boolean
  /** 달 이동의 양 끝(`YYYY-MM-DD`) */
  min: string
  max: string
  monthKey: string
  onChangeMonth: (monthKey: string) => void
  /** 고른 주의 목요일 */
  onSelect: (week: string) => void
  /** 아래 줄의 이름. `선택한 주` · `선택한 기간` */
  caption: string
  /** 기간의 어느 끝을 고르나. 넘기면 달력 위에 `시작 주 | 종료 주` 탭이 선다 */
  tabs?: { active: WeekCalendarTab; onChange: (tab: WeekCalendarTab) => void }
  anchor: PopoverAnchorRect | null
  onClose: () => void
}

function percent(cells: number): `${number}%` {
  return `${(cells * 100) / 7}%`
}

export function WeekCalendarPopover(props: WeekCalendarPopoverProps): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions()
  const { anchor, selection } = props
  const geometry = anchorPopover({
    containerWidth: windowWidth,
    anchorCenterX: anchor === null ? 0 : anchor.left + anchor.width / 2,
    popoverWidth: POPOVER_WIDTH,
    edgeGap: EDGE_GAP,
    caretSize: CARET_SIZE,
  })

  const weeks = buildCalendarMonth(props.monthKey)
  const previousMonth = getAdjacentMonthKey(props.monthKey, -1)
  const nextMonth = getAdjacentMonthKey(props.monthKey, 1)
  const canGoPrevious = previousMonth >= monthKeyOf(props.min)
  const canGoNext = nextMonth <= monthKeyOf(props.max)

  const bandStart = selection.start
  // 칠하는 끝은 종료 주의 수요일이다. 종료 주를 아직 안 골랐으면 시작 주 하나를 칠한다.
  const bandEnd = bandStart === null ? null : shiftDateKey(selection.end ?? bandStart, 6)
  const endCap = selection.end === null ? null : bandEnd
  const captionValue =
    bandStart === null
      ? '-'
      : selection.end === null
        ? `${formatDayLabel(bandStart)} ~`
        : `${formatDayLabel(bandStart)} ~ ${formatDayLabel(bandEnd as string)}`

  function tab(which: WeekCalendarTab, label: string, value: string | null): React.JSX.Element {
    const on = props.tabs?.active === which
    return (
      <Pressable
        testID={`week-calendar-tab-${which}`}
        role="button"
        aria-selected={on}
        onPress={() => props.tabs?.onChange(which)}
        className={`flex-1 gap-px rounded-[8px] px-2.5 py-1.5 ${on ? 'bg-primary-tint' : ''}`}
      >
        <Text className="text-10 font-semibold text-text-muted">{label}</Text>
        <Text
          className={`text-xs font-bold ${value === null ? 'text-text-disabled' : on ? 'text-primary-ink' : 'text-text'}`}
          style={TABULAR_NUMS}
        >
          {value ?? '주 선택'}
        </Text>
      </Pressable>
    )
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      <Pressable aria-label="주 고르기 닫기" onPress={props.onClose} className="flex-1" />
      <View
        testID="week-calendar-popover"
        role="dialog"
        aria-label="주 고르기"
        style={{
          left: geometry.left,
          top: anchor === null ? 0 : anchor.top + anchor.height + POPOVER_GAP,
          width: POPOVER_WIDTH,
        }}
        className={`absolute rounded-[12px] border border-border bg-surface p-3 shadow-lg${
          anchor === null ? ' opacity-0' : ''
        }`}
      >
        <View
          aria-hidden
          style={{ left: geometry.caretLeft, width: CARET_SIZE, height: CARET_SIZE, top: -4 }}
          className="absolute rotate-45 border-l border-t border-border bg-surface"
        />

        {props.tabs !== undefined && (
          <View className="mb-2.5 flex-row gap-1 rounded-[10px] border border-border p-0.5">
            {tab('start', '시작 주', bandStart === null ? null : formatDayLabel(bandStart))}
            {tab('end', '종료 주', endCap === null ? null : formatDayLabel(endCap))}
          </View>
        )}

        <View className="mb-2 flex-row items-center justify-between">
          <Pressable
            role="button"
            aria-label="지난달"
            disabled={!canGoPrevious}
            onPress={() => props.onChangeMonth(previousMonth)}
            hitSlop={8}
            className={canGoPrevious ? undefined : 'opacity-40'}
          >
            <ChevronLeftIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
          </Pressable>
          <Text className="text-xs font-bold text-text" style={TABULAR_NUMS}>
            {props.monthKey.replace('-', '년 ')}월
          </Text>
          <Pressable
            role="button"
            aria-label="다음달"
            disabled={!canGoNext}
            onPress={() => props.onChangeMonth(nextMonth)}
            hitSlop={8}
            className={canGoNext ? undefined : 'opacity-40'}
          >
            <ChevronRightIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
          </Pressable>
        </View>

        <View className="flex-row">
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} className="flex-1 text-center text-xs text-text-muted">
              {label}
            </Text>
          ))}
        </View>

        {weeks.map((week) => {
          const inside = week
            .map((day, index) => ({ day, index }))
            .filter(({ day }) => bandStart !== null && day.dateKey >= bandStart && day.dateKey <= (bandEnd as string))
          const lo = inside[0]
          const hi = inside[inside.length - 1]
          return (
            <View key={week[0]?.dateKey} className="relative flex-row">
              {lo !== undefined && hi !== undefined && (
                <View
                  testID="week-calendar-band"
                  aria-hidden
                  pointerEvents="none"
                  style={{
                    left: percent(lo.index),
                    width: percent(hi.index - lo.index + 1),
                    borderTopLeftRadius: lo.day.dateKey === bandStart ? 999 : 0,
                    borderBottomLeftRadius: lo.day.dateKey === bandStart ? 999 : 0,
                    borderTopRightRadius: hi.day.dateKey === bandEnd ? 999 : 0,
                    borderBottomRightRadius: hi.day.dateKey === bandEnd ? 999 : 0,
                  }}
                  className="absolute bottom-0.5 top-0.5 bg-primary-tint"
                />
              )}
              {week.map((day) => {
                const selectable = props.isSelectable(resetWeekStartOf(day.dateKey))
                // 채운 원은 저장되는 끝이다. 시작 주의 목요일과 종료 주의 수요일.
                const cap = day.dateKey === bandStart || day.dateKey === endCap
                return (
                  <Pressable
                    key={day.dateKey}
                    role="button"
                    aria-label={day.dateKey}
                    disabled={!selectable}
                    onPress={() => props.onSelect(resetWeekStartOf(day.dateKey))}
                    className="h-7 flex-1 items-center justify-center"
                  >
                    <View
                      collapsable={false}
                      className={`h-6 w-6 items-center justify-center rounded-full ${cap ? 'bg-primary' : ''}`}
                    >
                      <Text
                        className={`text-xs ${
                          cap ? 'font-semibold text-on-primary' : selectable ? 'text-text' : 'text-text-disabled'
                        }`}
                        style={TABULAR_NUMS}
                      >
                        {day.day}
                      </Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          )
        })}

        <View
          testID="week-calendar-caption"
          className="mt-2 flex-row items-center justify-between gap-2 border-t border-border pt-2"
        >
          <Text className="text-11 text-text-muted">{props.caption}</Text>
          <Text className="text-xs font-bold text-text" style={TABULAR_NUMS}>
            {captionValue}
          </Text>
        </View>
      </View>
    </Modal>
  )
}
