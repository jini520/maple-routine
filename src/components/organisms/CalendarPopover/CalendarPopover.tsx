/**
 * 날짜를 고르는 달력 팝오버. `DateSelect` 를 누르면 그 아래로 열린다.
 *
 * 상자는 아이템 수익 팝오버와 **같은 규격**이다(폭 248 · 반경 12 · 테두리 · 꼬리 · 그림자). 칸의
 * 생김새는 가계부 캘린더와 같다 - 고른 날은 채움, 오늘은 테두리다. 같은 앱에서 날짜를 고르는 두
 * 자리가 다르게 생기면 안 된다.
 *
 * **고를 수 있는 범위를 받는다.** 그 밖의 날은 흐리고 눌러도 안 고른다. 범위 밖으로 나가는 달
 * 이동도 막는다 - 갈 수 없는 달을 열어 두면 빈 달력을 보고 왜 못 고르는지를 화면이 설명해야 한다.
 */
import { Modal, Pressable, useWindowDimensions, View } from 'react-native'

import { ChevronLeftIcon, ChevronRightIcon, Text } from '../../atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import {
  buildCalendarMonth,
  getAdjacentMonthKey,
  monthKeyOf,
  WEEKDAY_LABELS,
} from '../../../lib/calendar'
import { anchorPopover } from '../../../lib/popover-anchor'
import type { PopoverAnchorRect } from '../../../hooks/useAnchoredPopover'

/** 아이템 수익 팝오버와 같은 값들. 한 화면에서 팝오버 폭이 갈리면 안 된다. */
const POPOVER_WIDTH = 248
const EDGE_GAP = 12
const CARET_SIZE = 8
const POPOVER_GAP = 8

export interface CalendarPopoverProps {
  /** 지금 고른 날(KST `YYYY-MM-DD`). 달력이 이 날이 든 달로 열린다. */
  selected: string
  /** 고를 수 있는 첫날·마지막 날(두 끝 포함). */
  min: string
  max: string
  /** 그리는 달. 사용자가 화살표로 옮긴다. */
  monthKey: string
  onChangeMonth: (monthKey: string) => void
  onSelect: (dateKey: string) => void
  /** `null` 이면 아직 못 쟀다. 그리되 보이지 않는다(아이템 수익 팝오버와 같은 규약). */
  anchor: PopoverAnchorRect | null
  onClose: () => void
}

export function CalendarPopover(props: CalendarPopoverProps): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions()
  const { anchor } = props

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
  // 범위의 양 끝이 든 달 밖으로는 안 간다. 빈 달력을 열어 두면 왜 못 고르는지를 화면이 설명해야 한다.
  const canGoPrevious = previousMonth >= monthKeyOf(props.min)
  const canGoNext = nextMonth <= monthKeyOf(props.max)

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      {/* 바깥 탭으로 닫는다. 스크림이 없다(아이템 수익 팝오버와 같다). */}
      <Pressable aria-label="날짜 고르기 닫기" onPress={props.onClose} className="flex-1" />
      <View
        testID="calendar-popover"
        role="dialog"
        aria-label="날짜 고르기"
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

        <View className="mb-2 flex-row items-center justify-between">
          <Pressable
            role="button"
            aria-label="지난달"
            disabled={!canGoPrevious}
            onPress={() => props.onChangeMonth(previousMonth)}
            hitSlop={8}
            className={canGoPrevious ? undefined : 'opacity-40'}
          >
            <ChevronLeftIcon
              className={`h-4 w-4 ${canGoPrevious ? 'text-text-muted' : 'text-text-disabled'}`}
              strokeWidth={2}
              aria-hidden
            />
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
            <ChevronRightIcon
              className={`h-4 w-4 ${canGoNext ? 'text-text-muted' : 'text-text-disabled'}`}
              strokeWidth={2}
              aria-hidden
            />
          </Pressable>
        </View>

        <View className="flex-row">
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} className="flex-1 text-center text-xs text-text-muted">
              {label}
            </Text>
          ))}
        </View>

        {weeks.map((week) => (
          <View key={week[0]?.dateKey} className="flex-row">
            {week.map((day) => {
              const selectable = day.dateKey >= props.min && day.dateKey <= props.max
              const isSelected = day.dateKey === props.selected
              return (
                <Pressable
                  key={day.dateKey}
                  role="button"
                  aria-label={day.dateKey}
                  aria-selected={isSelected}
                  disabled={!selectable}
                  onPress={() => props.onSelect(day.dateKey)}
                  className="h-7 flex-1 items-center justify-center"
                >
                  {/* 채움과 테두리를 한 뷰에 겹치지 않는다. 고른 날이 오늘이기도 한 경우가 있어
                      둘이 같은 칸을 쓴다(가계부 캘린더와 같은 규칙). */}
                  <View
                    collapsable={false}
                    className={`h-6 w-6 items-center justify-center rounded-full ${
                      isSelected ? 'bg-primary' : ''
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        isSelected
                          ? 'font-semibold text-on-primary'
                          : selectable
                            ? 'text-text'
                            : 'text-text-disabled'
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
        ))}
      </View>
    </Modal>
  )
}
