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
 * 그래서 `amounts` 로 **빈 지도**를 넘긴다 — 누락이 아니라 기록된 상태다. **지우지 말고 채울 것.**
 * 칸은 그동안 모든 날을 «0» 으로 그린다([[ADR-169]] 정정 1 — 수익 줄은 0 도 적는다).
 *
 * ## 이 껍데기는 앞의 둘과 다르다
 *
 * 여기 서 있던 사냥 수익·지출은 `UnderConstruction` 이었고 **아무것도 안 했다**([[ADR-132]] 결정
 * 12 — 자리를 예약하던 장치이고, 그 예약이 이 화면으로 이행돼 둘은 삭제됐다). 이 화면은 데이터가
 * 없을 뿐 격자·이동·선택이 **진짜로 동작한다.**
 *
 * ## 축이 **둘**이다 ([[ADR-170]] 결정 10)
 *
 * | 보기 | 축 | 주가 시작하는 요일 |
 * |---|---|---|
 * | 월간 | 달력 월 | 일요일 — 한국 달력의 관습([[ADR-169]] 결정 8) |
 * | 주간 | **게임의 주** | **목요일** — 보스 수익 탭과 **같은 주**다 |
 *
 * 주간이 게임 축인 덕에 같은 그룹의 두 하위가 「이번 주」로 **같은 숫자**를 말하고, 날짜를 모르는
 * 옛 보스 기록(`defeated_on IS NULL`)도 자기 `period_key` 그대로 한 주에 든다.
 *
 * 대가로 **월간 격자의 한 줄 ≠ 주간의 한 주**다 — 격자에 목요일 경계선을 그어 그것을 드러낸다.
 *
 * ## 상태가 둘로 갈려 있고, 오갈 때만 맞춘다
 *
 * 월간은 `monthKey`, 주간은 `weekStartKey`(목요일)를 든다. 하나로 합쳐 파생시키면 «달을 넘겨도
 * 고른 날은 안 바뀐다» 는 기존 계약이 깨진다([[ADR-169]] 이후 테스트가 붙들고 있다). 대신
 * **모드를 오갈 때 한 번씩 맞춘다**([[ADR-170]] 결정 12 의 함정):
 *
 * - 주간으로 → **고른 날이 든 주**. 화면 아래 상세가 그 날을 말하고 있으므로 격자도 그 주여야 한다.
 * - 월간으로 → **그 주의 목요일이 든 달**. 주가 두 달에 걸쳐도 `weekStartKey` 가 답을 하나로 만든다.
 */

import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import { Text } from '../../components/atoms/Text/Text'
import { CalendarMonth } from '../../components/molecules/CalendarMonth/CalendarMonth'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { SpeedDial } from '../../components/organisms/SpeedDial/SpeedDial'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { getAdjacentPeriodKey } from '../../lib/boss-profit-period'
import {
  WEEKDAY_LABELS_RESET,
  buildCalendarMonth,
  type CalendarWeek,
  buildResetWeek,
  formatDayLabel,
  formatMonthLabel,
  formatResetWeekLabel,
  getAdjacentMonthKey,
  getCurrentMonthKey,
  monthIncomeMax,
  monthKeyOf,
  resetWeekStartOf,
  type CalendarAmounts,
} from '../../lib/calendar-month'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../../lib/icons'
import { formatMesoCompact } from '../../lib/meso-compact'
import { getCurrentKstDateKey } from '../../lib/reset-clock'
import { TABULAR_NUMS } from '../../lib/text-styles'
import {
  loadCalendarAmounts,
  loadLastPointRate,
  recordIncome,
  recordSpend,
  loadDayRecords,
  editIncome,
  editSpend,
  removeRecord,
  recordTitleOf,
  recordMesoOf,
  recordCashOf,
  type DayRecord,
} from '../../features/cashbook/records'
import { useToastStore } from '../../features/toast/store'
import { IncomeSheet, type IncomeDraft } from './IncomeSheet'
import { SpendSheet, type SpendDraft } from './SpendSheet'

const NO_AMOUNTS: CalendarAmounts = {}

/**
 * 두 격자가 **함께 덮는** 날짜 범위 — 보이는 칸(주간이면 이레)과 열지도 기준(언제나 그 달)을 다
 * 담아야 한다. 주간이 달을 걸치면 그 이레가 기준 달의 격자 밖으로 나갈 수 있어(예: 7/30 목요일
 * 주는 8/5 까지 가는데 7월 격자는 8/1 에 끝난다) 둘의 **합집합**을 쓴다.
 */
function coveringRange(...grids: readonly CalendarWeek[][]): { from: string; to: string } {
  const keys = grids.flat().flatMap((week) => week.map((day) => day.dateKey))
  return { from: keys.reduce((a, b) => (a < b ? a : b)), to: keys.reduce((a, b) => (a > b ? a : b)) }
}

/** 「주간 | 월간」 — **보스 수익 탭의 알약 그대로다**(같은 그룹의 두 하위가 같은 어법으로 기간을
 *  가른다). 주간이 먼저인 것도 그쪽 순서다. 고른 값은 **기억하지 않는다** — 그쪽도 화면 상태다. */
function PeriodTab(props: {
  label: string
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-selected={props.selected}
      onPress={props.onPress}
    >
      <Text
        className={
          props.selected
            ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
            : 'px-3 text-sm font-medium text-text-muted'
        }
      >
        {props.label}
      </Text>
    </Pressable>
  )
}

/** 기간을 넘기는 화살표 — 보스 수익의 기간 이동과 같은 치수다(같은 그룹에서 두 모양이면 안 된다). */
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

/**
 * 그날 목록의 한 줄([[ADR-171]] 결정 1).
 *
 * 갈래 표식을 **글자가 아니라 색**으로 든다 — 「수입」·「지출」을 줄마다 적으면 이름이 들어갈
 * 자리를 두 글자가 먹는다. 부호(`+`·`−`)와 색이 같은 것을 말하고 그 둘은 칸의 두 줄과 같은
 * 규칙이라 새로 배울 것이 없다.
 *
 * 캐시로 낸 지출만 **원**으로 적는다 — 환산을 안 하므로 메소로 적을 값이 없다
 * ([[ADR-166]] 정정 2 ①).
 */
function DayRecordRow(props: { entry: DayRecord; onPress: () => void }): React.JSX.Element {
  const { entry } = props
  const income = entry.kind === 'income'
  const cash = recordCashOf(entry)
  const quantity = entry.kind === 'spend' ? entry.record.quantity : null

  return (
    <Pressable
      role="button"
      testID={`cashbook-row-${entry.record.id}`}
      aria-label={`${recordTitleOf(entry)} 고치기`}
      onPress={props.onPress}
      className="flex-row items-center gap-2 py-1"
    >
      <Text numberOfLines={1} className="shrink text-xs text-text">
        {recordTitleOf(entry)}
      </Text>
      {quantity !== null && quantity > 1 && (
        <Text className="shrink-0 text-[11px] text-text-muted" style={TABULAR_NUMS}>
          {quantity}
        </Text>
      )}
      <Text
        className={`ml-auto shrink-0 text-xs font-semibold ${income ? 'text-rise-ink' : 'text-fall-ink'}`}
        style={TABULAR_NUMS}
      >
        {income ? '+' : '−'}
        {cash === null ? formatMesoCompact(recordMesoOf(entry)) : `${cash.toLocaleString()}원`}
      </Text>
    </Pressable>
  )
}

export function CashbookScreen(): React.JSX.Element {
  const todayDateKey = getCurrentKstDateKey(new Date())
  const [isWeekly, setIsWeekly] = useState(false)
  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey(new Date()))
  const [weekStartKey, setWeekStartKey] = useState(() => resetWeekStartOf(todayDateKey))
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey)
  /**
   * 시트가 무엇을 하고 있나 — 셋이다([[ADR-171]] 결정 2).
   *
   * `'income'`·`'expense'` 는 **새로 적는다**. `DayRecord` 면 **그것을 고친다** — 갈래도 그 안에
   * 있으므로 «어느 시트를 열까» 와 «무엇을 채울까» 가 한 값에서 나온다.
   */
  const [sheet, setSheet] = useState<'income' | 'expense' | DayRecord | null>(null)
  const [dayRecords, setDayRecords] = useState<DayRecord[]>([])
  const [amounts, setAmounts] = useState<CalendarAmounts>(NO_AMOUNTS)
  const [lastPointRate, setLastPointRate] = useState<number | null>(null)

  const monthWeeks = buildCalendarMonth(monthKey)
  const weeks = isWeekly ? [buildResetWeek(weekStartKey)] : monthWeeks
  // **기준선은 두 보기가 같다 — 그 달이다**([[ADR-170]] 결정 12). 주간에서 받은 이레로 다시 내면
  // «7칸 중 하나는 언제나 최대» 가 되어 아무것도 안 한 주도 한 칸이 새까매진다. 걸치는 주는
  // 목요일이 든 달을 기준으로 삼는다 — 「어느 달로 돌아가나」 와 같은 답이라 둘이 안 갈린다.
  const heatWeeks = isWeekly ? buildCalendarMonth(monthKeyOf(weekStartKey)) : monthWeeks
  const { from, to } = coveringRange(weeks, heatWeeks)

  /**
   * 기간이 바뀌면 다시 읽는다. **범위가 곧 의존성**이라 «달을 넘겼는데 옛 숫자가 남는» 일이 없고,
   * 저장 뒤에는 이 표를 올려 같은 길로 다시 읽는다(따로 부르는 길을 만들면 두 벌이 된다).
   *
   * `useCallback` 으로 감싸지 않는다 — React 컴파일러가 «지킬 수 없는 수동 메모이제이션» 으로
   * 보고 이 컴포넌트의 최적화를 통째로 건너뛴다(lint 가 막는다).
   *
   * `alive` 로 늦게 온 응답을 버린다 — 달을 빨리 넘기면 이전 범위의 답이 뒤에 도착해 **지금 보는
   * 기간에 남의 숫자**를 얹을 수 있다.
   */
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let alive = true
    void loadCalendarAmounts(from, to).then((next) => {
      if (alive) setAmounts(next)
    })
    return () => {
      alive = false
    }
  }, [from, to, reloadToken])

  // 그날 목록은 **고른 날**에 매인다 — 격자 범위와 의존성이 달라 효과를 따로 둔다.
  useEffect(() => {
    let alive = true
    void loadDayRecords(selectedDateKey).then((next) => {
      if (alive) setDayRecords(next)
    })
    return () => {
      alive = false
    }
  }, [selectedDateKey, reloadToken])

  useEffect(() => {
    void loadLastPointRate().then(setLastPointRate)
  }, [])

  /**
   * 저장 둘 — **던지면 다시 던진다.**
   *
   * 삼키면 시트가 닫히고, 닫힌 뒤에는 친 것이 사라지며 화면에는 «적혔다» 와 구분되지 않는 그림만
   * 남는다. 실기에서 정확히 그랬다(2026-08-25 — `spend_records.form` 마이그레이션이 빠져 INSERT 가
   * 매번 던졌는데 시트는 매번 닫혔다). 토스트는 여기서 띄우고(저장소 실패는 화면의 몫이다 —
   * `DropPriceScreen` 과 같은 자리) 자리를 지키는 일은 시트가 한다.
   *
   * 다시 읽는 것도 **성공했을 때만** 한다 — 실패했으면 읽을 것이 안 바뀌었다.
   */
  async function saveIncome(draft: IncomeDraft): Promise<void> {
    try {
      await recordIncome(draft, new Date())
    } catch (error) {
      useToastStore.getState().showError('수입을 적지 못했습니다')
      throw error
    }
    setReloadToken((token) => token + 1)
  }

  async function saveSpend(draft: SpendDraft): Promise<void> {
    try {
      await recordSpend(draft, new Date())
    } catch (error) {
      useToastStore.getState().showError('지출을 적지 못했습니다')
      throw error
    }
    // 시세는 방금 저장한 값이 다음 기본값이다([[ADR-166]] 결정 5) — 다시 읽지 않고 그대로 든다.
    if (draft.pointPer100mMeso !== null) setLastPointRate(draft.pointPer100mMeso)
    setReloadToken((token) => token + 1)
  }

  /**
   * 고치기 — **`id` 와 `recordedAt` 을 그대로 얹는다**([[ADR-171]] 결정 4).
   *
   * 시트는 그 둘을 모른다(초안만 만든다). 여기서 원본과 합쳐야 «고친 시각이 적은 시각을 덮는»
   * 일이 안 생긴다.
   */
  async function saveEdit(entry: DayRecord, draft: IncomeDraft | SpendDraft): Promise<void> {
    try {
      if (entry.kind === 'spend') {
        await editSpend({ ...(draft as SpendDraft), id: entry.record.id, recordedAt: entry.record.recordedAt })
      } else {
        await editIncome({ ...(draft as IncomeDraft), id: entry.record.id, recordedAt: entry.record.recordedAt })
      }
    } catch (error) {
      useToastStore.getState().showError('기록을 고치지 못했습니다')
      throw error
    }
    setReloadToken((token) => token + 1)
  }

  async function deleteEntry(entry: DayRecord): Promise<void> {
    try {
      await removeRecord(entry)
    } catch (error) {
      useToastStore.getState().showError('기록을 지우지 못했습니다')
      throw error
    }
    setReloadToken((token) => token + 1)
  }

  // 앞뒤 달로 채운 칸을 누르면 **보는 달도 따라간다** — 아니면 고른 날이 격자 밖에 있게 된다.
  // 주간에는 그런 칸이 없으므로(이레가 전부 그 주다) 주는 그대로 둔다.
  function selectDate(dateKey: string): void {
    setSelectedDateKey(dateKey)
    if (!isWeekly) setMonthKey(monthKeyOf(dateKey))
  }

  function showWeekly(): void {
    setWeekStartKey(resetWeekStartOf(selectedDateKey))
    setIsWeekly(true)
  }

  function showMonthly(): void {
    setMonthKey(monthKeyOf(weekStartKey))
    setIsWeekly(false)
  }

  const selectedAmounts = amounts[selectedDateKey] ?? null

  function movePeriod(delta: -1 | 1): void {
    if (isWeekly) {
      setWeekStartKey(getAdjacentPeriodKey('weekly', weekStartKey, delta < 0 ? 'prev' : 'next'))
      return
    }
    setMonthKey(getAdjacentMonthKey(monthKey, delta))
  }

  return (
    <View testID="screen-Cashbook" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <PageHeaderTitleRow className="justify-between">
              <Text className="text-lg font-semibold text-text">가계부</Text>
              <View className="flex-row items-center gap-1">
                <PeriodTab label="주간" selected={isWeekly} onPress={showWeekly} />
                <PeriodTab label="월간" selected={!isWeekly} onPress={showMonthly} />
              </View>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-4 px-4 pb-4">
          <View className="flex-row items-center justify-center gap-4">
            {/* 이름이 모드를 따른다 — 스크린리더가 «무엇이 옮겨지는가» 를 듣는다. */}
            <MonthArrow
              label={isWeekly ? '이전 주' : '이전 달'}
              icon={ChevronLeftIcon}
              onPress={() => movePeriod(-1)}
            />
            <Text
              testID="cashbook-period-label"
              className="text-sm font-semibold text-text"
              style={TABULAR_NUMS}
            >
              {isWeekly ? formatResetWeekLabel(weekStartKey) : formatMonthLabel(monthKey)}
            </Text>
            <MonthArrow
              label={isWeekly ? '다음 주' : '다음 달'}
              icon={ChevronRightIcon}
              onPress={() => movePeriod(1)}
            />
          </View>

          <CalendarMonth
            weeks={weeks}
            selectedDateKey={selectedDateKey}
            todayDateKey={todayDateKey}
            amounts={amounts}
            weekdayLabels={isWeekly ? WEEKDAY_LABELS_RESET : undefined}
            // 열지도 기준은 **화면이 낸다**([[ADR-170]] 결정 12) — 위 `heatWeeks` 참조.
            incomeMax={monthIncomeMax(heatWeeks, amounts)}
            // 주간 격자는 자체가 한 주라 **자를 것이 없다.**
            showResetDivider={!isWeekly}
            onSelectDate={selectDate}
          />

          <View className="gap-2">
            <Text testID="cashbook-selected-day" className="text-sm font-semibold text-text">
              {formatDayLabel(selectedDateKey)}
            </Text>
            {selectedAmounts === null ? (
              <View testID="cashbook-empty">
                <EmptyState
                  icon={CalendarIcon}
                  title="아직 기록이 없어요"
                  description="아래 ＋ 를 눌러 수입·지출을 적어 보세요."
                />
              </View>
            ) : (
              <View testID="cashbook-day-total" className="gap-1">
                <View className="flex-row justify-between">
                  <Text className="text-xs text-text-muted">수입</Text>
                  <Text className="text-sm font-semibold text-rise-ink" style={TABULAR_NUMS}>
                    +{formatMesoCompact(selectedAmounts.incomeMeso)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-text-muted">지출</Text>
                  <Text className="text-sm font-semibold text-fall-ink" style={TABULAR_NUMS}>
                    −{formatMesoCompact(selectedAmounts.expenseMeso)}
                  </Text>
                </View>

                {dayRecords.length > 0 && (
                  // 합계 아래에 **적은 것이 한 줄씩** 선다([[ADR-171]] 결정 1). 접지 않는다 —
                  // 같은 날 같은 것을 두 번 적은 것은 정상이고, 접으면 어느 쪽을 고치는지 못 고른다.
                  // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
                  <View className="mt-1 gap-0.5 border-t border-border pt-1">
                    {dayRecords.map((entry) => (
                      <DayRecordRow
                        key={entry.record.id}
                        entry={entry}
                        onPress={() => setSheet(entry)}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </ScreenScroll>

      <SpeedDial
        onSelectIncome={() => setSheet('income')}
        onSelectExpense={() => setSheet('expense')}
      />

      {/* 시트는 **조건부 마운트**다 — 마운트가 곧 열림이고 `onClose` 로 언마운트한다
          ([[ADR-039]] 결정 3, `BottomSheet` 가 그 계약을 든다). */}
      {(sheet === 'income' || (typeof sheet === 'object' && sheet?.kind === 'income')) && (
        // 고치는 것이면 **그 기록의 날짜**로 연다 — 고른 날이 아니다(둘은 지금 같지만, 목록이
        // 여러 날을 걸치게 되는 날 갈린다).
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <IncomeSheet
          dateKey={typeof sheet === 'object' ? sheet.record.earnedOn : selectedDateKey}
          editing={typeof sheet === 'object' ? sheet.record : undefined}
          onSave={
            typeof sheet === 'object' ? (draft) => saveEdit(sheet, draft) : saveIncome
          }
          onDelete={typeof sheet === 'object' ? () => deleteEntry(sheet) : undefined}
          onClose={() => setSheet(null)}
        />
      )}
      {(sheet === 'expense' || (typeof sheet === 'object' && sheet?.kind === 'spend')) && (
        <SpendSheet
          dateKey={typeof sheet === 'object' ? sheet.record.spentOn : selectedDateKey}
          lastPointRate={lastPointRate}
          editing={typeof sheet === 'object' ? sheet.record : undefined}
          onSave={typeof sheet === 'object' ? (draft) => saveEdit(sheet, draft) : saveSpend}
          onDelete={typeof sheet === 'object' ? () => deleteEntry(sheet) : undefined}
          onClose={() => setSheet(null)}
        />
      )}
    </View>
  )
}
