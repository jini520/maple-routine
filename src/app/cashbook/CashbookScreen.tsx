/**
 * 가계부 — 「수익·지출」 그룹의 둘째 하위 탭([[ADR-169]] 결정 1).
 *
 * ## 지금은 캘린더뿐이다
 *
 * 사용자 결정(2026-08-23): *"우선 캘린더만 먼저 만들어."* 그래서 이 화면이 그리는 것은 **격자 ·
 * 달 이동 · 날짜 선택** 셋이고, 담길 것은 아직 없다([[ADR-169]] 결정 6):
 *
 * - **지출** → `spend_records` 가 아직 없다([[ADR-166]] — 결정 10건은 서 있고 코드가 0줄이다.
 *   임계경로는 코드가 아니라 [[ADR-006]] 대기 중인 선택 목록 셋이다).
 * - **수익** → **날짜가 없다.** `boss_profit_records` 의 `periodKey` 는 주간(목요일)·월간뿐이라
 *   앱이 «며칟날 잡았나» 를 모른다. 그 날짜를 만드는 일이 **#239** 다.
 *
 * 그래서 `marks` 로 **빈 지도**를 넘긴다 — 누락이 아니라 기록된 상태다. **지우지 말고 채울 것.**
 *
 * ## 이 껍데기는 앞의 둘과 다르다
 *
 * 여기 서 있던 사냥 수익·지출은 `UnderConstruction` 이었고 **아무것도 안 했다**([[ADR-132]] 결정
 * 12 — 자리를 예약하던 장치이고, 그 예약이 이 화면으로 이행돼 둘은 삭제됐다). 이 화면은 데이터가
 * 없을 뿐 격자·이동·선택이 **진짜로 동작한다.**
 *
 * ## 축은 달력이다
 *
 * 보스 수익이 같은 그룹에서 **목요일 리셋** 축을 쓰지만(`lib/boss-profit-period.ts`) 이 화면은
 * 달력 월이다([[ADR-166]] 결정 4 · [[ADR-169]] 결정 4). 두 축을 합치는 것은 #239 의 일이고,
 * 이 화면은 그것을 앞당기지 않는다.
 */

import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { Text } from '../../components/atoms/Text/Text'
import { CalendarMonth, type CalendarMarks } from '../../components/molecules/CalendarMonth/CalendarMonth'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import {
  buildCalendarMonth,
  formatDayLabel,
  formatMonthLabel,
  getAdjacentMonthKey,
  getCurrentMonthKey,
  monthKeyOf,
} from '../../lib/calendar-month'
import { ChevronLeftIcon, ChevronRightIcon, NotebookTextIcon } from '../../lib/icons'
import { getCurrentKstDateKey } from '../../lib/reset-clock'
import { TABULAR_NUMS } from '../../lib/text-styles'

/** 공급원이 붙기 전까지 격자가 받는 값([[ADR-169]] 결정 6). */
const NO_MARKS: Readonly<Record<string, CalendarMarks>> = {}

/** 달을 넘기는 화살표 — 보스 수익의 기간 이동과 같은 치수다(같은 그룹에서 두 모양이면 안 된다). */
function MonthArrow(props: {
  label: string
  icon: typeof ChevronLeftIcon
  onPress: () => void
}): React.JSX.Element {
  const Icon = props.icon
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      onPress={props.onPress}
      className="h-7 w-7 items-center justify-center rounded-full border border-border"
    >
      <Icon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
    </Pressable>
  )
}

export function CashbookScreen(): React.JSX.Element {
  const todayDateKey = getCurrentKstDateKey(new Date())
  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey(new Date()))
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey)

  // 앞뒤 달로 채운 칸을 누르면 **보는 달도 따라간다** — 아니면 고른 날이 격자 밖에 있게 된다.
  // 격자는 자기가 어느 달인지 모르므로(그리기만 한다) 이 판단이 여기 있다.
  function selectDate(dateKey: string): void {
    setSelectedDateKey(dateKey)
    setMonthKey(monthKeyOf(dateKey))
  }

  return (
    <View testID="screen-Cashbook" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <PageHeaderTitleRow>
              <Text className="text-lg font-semibold text-text">가계부</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-4 px-4 pb-4">
          <View className="flex-row items-center justify-center gap-4">
            <MonthArrow
              label="이전 달"
              icon={ChevronLeftIcon}
              onPress={() => setMonthKey(getAdjacentMonthKey(monthKey, -1))}
            />
            <Text
              testID="cashbook-month-label"
              className="text-sm font-semibold text-text"
              style={TABULAR_NUMS}
            >
              {formatMonthLabel(monthKey)}
            </Text>
            <MonthArrow
              label="다음 달"
              icon={ChevronRightIcon}
              onPress={() => setMonthKey(getAdjacentMonthKey(monthKey, 1))}
            />
          </View>

          <CalendarMonth
            weeks={buildCalendarMonth(monthKey)}
            selectedDateKey={selectedDateKey}
            todayDateKey={todayDateKey}
            marks={NO_MARKS}
            onSelectDate={selectDate}
          />

          <View className="gap-2">
            <Text testID="cashbook-selected-day" className="text-sm font-semibold text-text">
              {formatDayLabel(selectedDateKey)}
            </Text>
            <View testID="cashbook-empty">
              <EmptyState
                icon={NotebookTextIcon}
                title="아직 기록이 없어요"
                description="수익·지출을 적는 자리는 준비 중입니다."
              />
            </View>
          </View>
        </View>
      </ScreenScroll>
    </View>
  )
}
