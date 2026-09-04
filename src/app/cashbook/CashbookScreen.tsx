/**
 * 가계부 화면. 수익·지출 그룹의 둘째 하위 탭.
 *
 * 담기는 것이 넷이고 그중 둘만 여기서 고친다.
 *
 * | 무엇 | 어디서 | 여기서 고치나 |
 * |---|---|---|
 * | 지출 | `spend_records` | 예 |
 * | 손입력 수익 | `income_records` | 예 |
 * | 보스 결정석 | `boss_profit_records` | 아니오. 그 자리에서 펼쳐진다 |
 * | 아이템 판매 | `boss_drop_records` | 아니오. 보스 수익 탭으로 간다 |
 *
 * 자동으로 흘러든 둘을 여기서 못 고치는 것은 원천이 저쪽이라서다. 두 곳에서 고치면 어느 쪽이
 * 참인지 사라진다. 시트 상태의 타입(`ManualDayRecord`)이 그것을 컴파일 단계에서 막는다.
 *
 * 축이 둘이다. 월간은 달력 월이고 주가 일요일에 시작하며, 주간은 **게임의 주**라 목요일에 시작해
 * 보스 수익 탭과 같은 주가 된다. 대가로 월간 격자의 한 줄이 주간의 한 주와 다르고, 격자에 목요일
 * 경계선을 그어 그것을 드러낸다.
 *
 * 상태도 둘로 갈려 있다(`monthKey` · `weekStartKey`). 하나로 합쳐 파생시키면 달을 넘겨도 고른 날은
 * 안 바뀐다는 계약이 깨져서, 모드를 오갈 때만 한 번씩 맞춘다.
 *
 * @see docs/features/cashbook.md 정책
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Pressable, RefreshControl, View } from 'react-native'

import {
  Badge,
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ProfitIcon,
  ShoppingCartIcon,
  Text,
} from '../../components/atoms'
import { CalendarGrid } from '../../components/molecules/CalendarGrid/CalendarGrid'
import { DIFFICULTY_SHORT } from '../../constants/domain/boss-difficulty'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { SpeedDial } from '../../components/organisms/SpeedDial/SpeedDial'
import { SPEED_DIAL_SPACE_PX } from '../../components/organisms/SpeedDial/speed-dial-metrics'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import {
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  isLatestPeriod,
} from '../../lib/boss/boss-profit-period'
import {
  WEEKDAY_LABELS_RESET,
  buildCalendarMonth,
  type CalendarWeek,
  buildResetWeek,
  formatDayLabel,
  getAdjacentMonthKey,
  getCurrentMonthKey,
  monthIncomeMax,
  monthKeyOf,
  periodTotals,
  resetWeekStartOf,
  type CalendarAmounts,
} from '../../lib/calendar'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import {
  cashbookDataRevision,
  dayTotalsOf,
  loadCalendarAmounts,
  loadLastPointRate,
  loadTrackedCharacters,
  refreshCashbook,
  recordIncome,
  recordSpend,
  loadDayRecords,
  editIncome,
  editSpend,
  removeRecord,
  recordTitleOf,
  recordMesoOf,
  recordCashOf,
  recordCountLabelOf,
  resolveTrackedDefeatDates,
  isManualRecord,
  rowKeyOf,
  type DayRecord,
  type DefeatedBoss,
  type ManualDayRecord,
} from '../../features/cashbook/records'
import { loadMesoRate } from '../../features/cashbook/meso-rate'
// 보스 수익 탭의 행이 초상을 찾는 그 함수다. 같은 보스가 두 화면에서 다른 그림이면 안 된다.
import { findPortraitSlug } from '../boss-profit/character-groups'
import { usePullRefresh } from '../../hooks/usePullRefresh'
import { useOpenTab } from '../../hooks/useOpenTab'
import { useThemeAppearance } from '../../theme/context'
import { useToastStore } from '../../features/toast/store'
import { IncomeSheet, type IncomeDraft } from './IncomeSheet'
import { SpendSheet, type SpendDraft } from './SpendSheet'

const NO_AMOUNTS: CalendarAmounts = {}

/**
 * 두 격자가 **함께 덮는** 날짜 범위. 보이는 칸(주간이면 이레)과 열지도 기준(언제나 그 달)을 다
 * 담아야 한다. 주간이 달을 걸치면 그 이레가 기준 달의 격자 밖으로 나갈 수 있어(예: 7/30 목요일
 * 주는 8/5 까지 가는데 7월 격자는 8/1 에 끝난다) 둘의 **합집합**을 쓴다.
 */
function coveringRange(...grids: readonly CalendarWeek[][]): { from: string; to: string } {
  const keys = grids.flat().flatMap((week) => week.map((day) => day.dateKey))
  return { from: keys.reduce((a, b) => (a < b ? a : b)), to: keys.reduce((a, b) => (a > b ? a : b)) }
}

/** 주간 · 월간. 보스 수익 탭의 알약 그대로다. 고른 값은 기억하지 않는다. 그쪽도 화면 상태다. */
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

/**
 * 기간을 넘기는 화살표. 보스 수익의 기간 이동과 같은 치수·같은 죽는 법이다.
 *
 * 흐려지는 것을 JS 조건으로 준다. NativeWind 의 `disabled:` 는 웹 CSS 의사 클래스라
 * `Pressable disabled` 와 이어져 있지 않고, 남겨 두면 비활성 화살표가 멀쩡한 색으로 보인다.
 *
 * `aria-disabled` 를 `disabled` 와 같이 준다. 앞은 손가락을, 뒤는 스크린리더를 막는다.
 */
function MonthArrow(props: {
  label: string
  icon: typeof ChevronLeftIcon
  disabled?: boolean
  onPress: () => void
}): React.JSX.Element {
  const Icon = props.icon
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-disabled={props.disabled}
      disabled={props.disabled}
      onPress={props.onPress}
      className={`h-7 w-7 items-center justify-center rounded-full border border-border${
        props.disabled ? ' opacity-30' : ''
      }`}
    >
      <Icon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
    </Pressable>
  )
}

/**
 * 재료 한 줄(수익 · 지출). 답 옆에 각주처럼 쌓인다.
 *
 * 열을 안 세운다. 오른쪽 정렬 상자 안이라 금액의 오른쪽 끝이 저절로 한 x 에 서고 라벨은 자기
 * 금액에 붙는다. 라벨에 고정 폭을 주면 자릿수가 다른 두 금액 사이에 빈자리가 생긴다.
 *
 * 부호를 값에서 뽑지 않고 받는다. `formatMesoCompact` 는 음수에 ASCII `-` 를 붙이는데 답은
 * `−`(U+2212)를 쓰므로, 함수에 맡기면 한 카드에 두 종류의 빼기 기호가 선다.
 */
function SourceRow(props: {
  testID: string
  label: string
  sign: string
  amount: number
  tone: string
}): React.JSX.Element {
  return (
    <View className="flex-row items-baseline gap-1.5">
      <Text className="text-11 text-text-muted">{props.label}</Text>
      <Text
        testID={props.testID}
        numberOfLines={1}
        className={`text-11 font-medium ${props.tone}`}
        style={TABULAR_NUMS}
      >
        {props.sign}
        {formatMesoCompact(props.amount)}
      </Text>
    </View>
  )
}

/**
 * 보고 있는 기간의 합계. 범위 이동 아래, 격자 위다.
 *
 * 값은 화면이 `periodTotals` 로 낸다. 격자에 넘긴 그 `weeks`·`amounts` 라 칸에 적힌 것을 다
 * 더한 값이 곧 이 숫자다. 따로 읽으면 둘이 서로 다른 순간을 갖는다.
 *
 * 답이 헤드라인, 재료가 각주다.
 *
 * ```
 * ┌────────────────────────────────────┐
 * │ 순 수익                수익 +8,500만 │
 * │ +5,700만              지출 −2,800만 │
 * └────────────────────────────────────┘
 * ```
 *
 * 셋을 한 표 안에서 줄 세우면 답이 셋 중 큰 하나로만 갈린다. 답과 재료를 서로 다른 종류로
 * 두면 표가 아니라 위계가 관계를 말한다.
 *
 * 바닥을 `items-end` 로 맞춘다. 큰 숫자의 밑선과 지출 줄의 밑선이 같은 x 에 서야 두 덩이가
 * 한 카드에 앉은 것으로 읽힌다.
 *
 * 막대는 안 그린다. 얼마인가 를 묻던 화면에 어느 비율인가 를 더하는 일이라, 더할지는 따로 정한다.
 *
 * 라벨은 `순 수익` 이다. 바로 위 줄이 기간을 이미 말하고 있어 한 화면에서 같은 말이 두 번 선다.
 *
 * 단위는 큰 숫자에만 붙인다. 셋이 같은 단위이므로 헤드라인이 한 번 말하면 카드 전체가 그 축이다.
 *
 * 부호와 색은 칸의 두 줄과 같은 어법이다. `+`·`rise-ink` 와 `−`·`fall-ink`. 재료는 크기로
 * 약해질 뿐 색은 안 걷는다. 순 수익만 부호를 따라 갈린다. 셋을 늘 같은 색으로 칠하면
 * 이번 달은 적자다 가 숫자를 끝까지 읽어야만 보인다. 0 이면 부호도 색도 없다.
 *
 * 테두리는 없다. 채움만으로 격자와 갈린다.
 */
function PeriodSummary(props: { incomeMeso: number; expenseMeso: number }): React.JSX.Element {
  const net = props.incomeMeso - props.expenseMeso
  return (
    <View
      testID="cashbook-period-summary"
      className="flex-row items-end justify-between gap-3 rounded-xl bg-surface px-3.5 py-3"
    >
      <View className="shrink">
        <Text className="text-10 tracking-wide text-text-muted">순 수익</Text>
        {/* `leading-none` 이라 큰 글자가 자기 줄 높이로 카드를 밀지 않는다. 카드가 낮아야 격자가
            주간 보기에서 스크롤 없이 남는다. */}
        <Text
          testID="cashbook-summary-net"
          numberOfLines={1}
          className={`mt-1 text-xl font-extrabold leading-none ${
            net > 0 ? 'text-rise-ink' : net < 0 ? 'text-fall-ink' : 'text-text'
          }`}
          style={TABULAR_NUMS}
        >
          {net > 0 ? '+' : net < 0 ? '−' : ''}
          {formatMesoCompact(Math.abs(net))}{' '}
          {/* 단위는 작은 글자로 격하하되 사이에 진짜 공백을 남긴다. 마진으로만 띄우면 읽히는
              문자열이 `N메소`로 붙어 스크린리더가 이어 읽는다. */}
          <Text className="text-11 font-bold text-text-muted">메소</Text>
        </Text>
      </View>

      <View testID="cashbook-summary-sources" className="shrink-0 items-end gap-1">
        <SourceRow
          testID="cashbook-summary-income"
          label="수익"
          sign="+"
          amount={props.incomeMeso}
          tone="text-rise-ink"
        />
        <SourceRow
          testID="cashbook-summary-expense"
          label="지출"
          sign="−"
          amount={props.expenseMeso}
          tone="text-fall-ink"
        />
      </View>
    </View>
  )
}

/**
 * 그날 목록의 한 줄. 누를 수 있어 보여야 한다.
 *
 * 글자 둘(이름 · 금액)만 놓으면 줄이 목록이 아니라 요약으로 보인다. 바로 위 두 줄
 * (수입/지출 합계)이 정확히 그 모양이라 눈이 같은 것으로 묶는다. 셋으로 가른다.
 *
 * ① 상자를 준다. 합계는 배경 없는 줄, 기록은 `bg-surface` 카드.
 * ② 왼쪽에 갈래 표식. 수입은 `ProfitIcon`, 지출은 `ShoppingCartIcon`.
 * ③ 오른쪽에 화살촉. 눌러서 들어가는 줄에 이 저장소가 쓰는 표식 그대로다.
 *
 * 누를 때 흐려지는 것은 `active:` 로 준다. className 과 함수형 `style` 을 같이 주면
 * cssInterop 에서 정적 스타일이 통째로 사라진다.
 *
 * 캐시로 낸 지출만 원으로 적는다. 환산을 안 하므로 메소로 적을 값이 없다.
 *
 * 자동 줄(보스 결정석 · 아이템 판매)도 여기서 못 고치는데 같은 카드를 쓴다. 셋 다 눌러서
 * 무언가가 일어나는 줄이기 때문이다. 일어나는 일은 화살촉이 미리 말한다. `›`(간다) 대
 * `⌄`/`⌃`(편다). 읽어 주는 이름도 함께 갈린다(`고치기` · `펼치기`/`접기` · `보스 수익에서 보기`).
 * 아이콘은 자동 줄 둘 다 수익이라 `ProfitIcon` 이다. 둘을 가르는 것은 그림이 아니라 이름이다.
 */
/** 타일 한 변. **칸 폭과 무관하게 고정**이다. 칸은 줄을 여섯이 나눠 기기마다 넓다. */
const BOSS_TILE_PX = 44

/** 한 줄에 서는 마리 수. 레이아웃의 결과가 아니라 여기서 정한다. */
const BOSSES_PER_ROW = 6

/**
 * 칸 폭의 상한. 타일 사이의 좌우 간격이 여기서 나온다(`상한 − 타일` = 8px, 줄 사이 간격과
 * 같은 값).
 *
 * 상한이 없으면 칸이 줄을 그냥 여섯으로 나눠 넓은 기기일수록 타일 사이가 벌어진다
 * (390dp 에서 12.7px, 430dp 에서 15.5px). 남는 폭은 줄 양끝으로 간다(`justify-center`).
 *
 * `flex-1` 을 안 버리고 상한만 얹는 것은 좁은 기기 때문이다. 320dp 에서는 칸이 상한보다
 * 좁아져야 여섯이 다 들어간다.
 */
export const BOSS_SLOT_MAX_PX = BOSS_TILE_PX + 8

function chunkBosses(bosses: readonly DefeatedBoss[]): DefeatedBoss[][] {
  const rows: DefeatedBoss[][] = []
  for (let index = 0; index < bosses.length; index += BOSSES_PER_ROW) {
    rows.push(bosses.slice(index, index + BOSSES_PER_ROW))
  }
  return rows
}

/**
 * 펼친 결정석 줄의 타일 판. 그날 잡은 보스를 초상으로 편다.
 *
 * 새로 만든 그림이 0개다. 초상은 `BossPortrait`, 난이도는 `Badge`, 슬러그는 `findPortraitSlug`.
 * 셋 다 보스 수익 탭의 보스 행이 쓰는 그것이다.
 *
 * 마리당 금액은 안 적는다. 줄 머리가 합계를 이미 들고 있고, 마리당 금액은 파티원 수·정가와
 * 함께 봐야 뜻이 생긴다. 여기서 답하는 질문은 얼마 가 아니라 무엇 이다.
 *
 * 모양은 네모(`shape="square"`)다. 원이 격자로 서면 네 귀가 비어 사이가 성겨 보인다.
 * 난이도는 초상 위 왼쪽 아래에 겹친다. 따로 한 줄로 두면 타일 높이가 배지만큼 늘어 격자가
 * 세로로 성겨진다. 글자는 한 칸이다(`H`·`EX`). 색이 이미 난이도를 말한다.
 *
 * 한 줄에 여섯이고 폭으로 재지 않는다. `w-1/6` 은 `16.67%` 로 컴파일돼 여섯이면 100.02% 라
 * 마지막 하나가 다음 줄로 밀린다. 그래서 여섯씩 끊은 배열을 만들고 한 줄은 `flex-1` 칸
 * 여섯이다. `flex-1` 은 남는 픽셀까지 Yoga 가 나눠 줘 반올림으로 넘칠 자리가 없다.
 *
 * 초상은 칸 안에 가운데로 44px 고정이다. 넓은 기기에서 칸이 넓어져도 타일은 안 커지고,
 * 칸 상한(`BOSS_SLOT_MAX_PX`)이 남는 폭을 줄 양끝으로 보내 좌우 간격이 어디서나 8px 다.
 *
 * 이름은 없고 그 자리를 접근성 이름이 받는다(난이도 + 보스). 눈으로 읽던 것이 사라졌다고
 * 스크린리더에서도 사라지면 그것은 간략하게 가 아니라 없어짐 이다.
 */
function DefeatedBossTiles(props: { rowKey: string; bosses: readonly DefeatedBoss[] }): React.JSX.Element {
  return (
    <View
      testID={`cashbook-row-bosses-${props.rowKey}`}
      className="gap-y-2 rounded-b-xl border border-t-0 border-border bg-surface px-2 pb-2.5 pt-1.5"
    >
      {chunkBosses(props.bosses).map((row, rowIndex) => (
        <View
          key={`${row[0].boss}|${row[0].difficulty}`}
          testID={`cashbook-boss-row-${rowIndex}`}
          className="flex-row justify-center"
        >
          {row.map((boss) => (
            <View
              key={`${boss.boss}|${boss.difficulty}`}
              testID={`cashbook-boss-slot-${boss.boss}|${boss.difficulty}`}
              className="flex-1 items-center"
              style={{ maxWidth: BOSS_SLOT_MAX_PX }}
            >
              <View testID={`cashbook-boss-tile-${boss.boss}|${boss.difficulty}`}>
                <BossPortrait
                  portraitSlug={findPortraitSlug(boss.boss)}
                  // 이름 줄이 없으므로 그 정보는 여기서만 말한다.
                  label={`${boss.difficulty} ${boss.boss}`}
                  size={BOSS_TILE_PX}
                  shape="square"
                />
                <View className="absolute bottom-0.5 left-0.5">
                  <Badge variant={boss.difficulty} size="mini">
                    {DIFFICULTY_SHORT[boss.difficulty]}
                  </Badge>
                </View>
              </View>
            </View>
          ))}
          {/* 덜 찬 줄을 빈 칸으로 채운다. 안 채우면 남은 둘이 반반씩 벌어져 앞줄과 격자가 안 맞는다. */}
          {Array.from({ length: BOSSES_PER_ROW - row.length }, (_, index) => (
            <View
              key={`empty-${index}`}
              testID={`cashbook-boss-slot-empty-${index}`}
              className="flex-1"
              style={{ maxWidth: BOSS_SLOT_MAX_PX }}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

function DayRecordRow(props: {
  entry: DayRecord
  expanded: boolean
  onPress: () => void
}): React.JSX.Element {
  const { entry, expanded } = props
  const rowKey = rowKeyOf(entry)
  // 자동 줄은 언제나 수익이다. 결정석도 판매도 들어오는 돈이다.
  const income = entry.kind !== 'spend'
  const cash = recordCashOf(entry)
  const countLabel = recordCountLabelOf(entry)
  const Icon = income ? ProfitIcon : ShoppingCartIcon
  /**
   * 펼칠 수 있는 줄은 결정석 하나다. 판매 줄은 `bosses` 를 아예 안 갖는 타입이라
   * (`AutoDayRecord` 가 합집합이다) 이 분기를 잘못 쓰면 컴파일 단계에서 걸린다.
   */
  const bosses = entry.kind === 'bossCrystal' ? entry.bosses : null
  const isOpen = expanded && bosses !== null
  /**
   * 무슨 일이 일어날지 미리 말하는 화살촉. 같은 카드 두 줄이 서로 다르게 반응하는데
   * 그림이 같으면 그것이 고장으로 읽힌다.
   */
  const Chevron = bosses === null ? ChevronRightIcon : isOpen ? ChevronUpIcon : ChevronDownIcon
  const action = isManualRecord(entry)
    ? '고치기'
    : bosses === null
      ? '보스 수익에서 보기'
      : isOpen
        ? '접기'
        : '펼치기'

  return (
    <View>
      <Pressable
        role="button"
        testID={`cashbook-row-${rowKey}`}
        // 자동 줄은 고치러 가는 것이 아니라 보러 가는 것이다. 읽어 주는 이름이 그 사실을 말해야
        // 눌렀더니 시트가 안 열린다 가 고장으로 읽히지 않는다.
        aria-label={`${recordTitleOf(entry)} ${action}`}
        aria-expanded={bosses === null ? undefined : isOpen}
        onPress={props.onPress}
        // 펼치면 한 카드가 된다. 아래 판과 테두리를 잇고 그 사이의 선을 지운다. 판이 따로 선
        // 상자로 보이면 이 줄이 편 것 이라는 사실이 끊긴다.
        className={`flex-row items-center gap-2 border border-border bg-surface py-2 pl-2 pr-1.5 active:opacity-60 ${
          isOpen ? 'rounded-t-xl border-b-0' : 'rounded-xl'
        }`}
      >
        <View
          testID={`cashbook-row-icon-${rowKey}`}
          className={`h-6 w-6 items-center justify-center rounded-full ${
            income ? 'bg-rise-tint' : 'bg-fall-tint'
          }`}
        >
          <Icon
            className={`h-3.5 w-3.5 ${income ? 'text-rise-ink' : 'text-fall-ink'}`}
            strokeWidth={2}
            aria-hidden
          />
        </View>

        <Text numberOfLines={1} className="shrink text-xs text-text">
          {recordTitleOf(entry)}
        </Text>
        {countLabel !== null && (
          // 갈래마다 세는 것이 다르다(`×2` · `12마리` · `3건 · 미입력 2`). 그 분기는 화면이 아니라
          // `recordCountLabelOf` 가 든다.
          <Text numberOfLines={1} className="shrink-0 text-11 text-text-muted" style={TABULAR_NUMS}>
            {countLabel}
          </Text>
        )}

        <Text
          className={`ml-auto shrink-0 text-xs font-semibold ${income ? 'text-rise-ink' : 'text-fall-ink'}`}
          style={TABULAR_NUMS}
        >
          {income ? '+' : '−'}
          {cash === null ? formatMesoCompact(recordMesoOf(entry)) : `${cash.toLocaleString()}원`}
        </Text>
        {/* 화살촉이 상자를 하나 쓰는 이유는 lucide 아이콘이 `testID` 를 SVG 안으로 안 흘려보내
            화살촉이 사라졌다 를 테스트가 못 잡기 때문이다. 상자는 `shrink-0` 도 함께 든다. */}
        <View testID={`cashbook-row-chevron-${rowKey}`} className="shrink-0">
          <Chevron className="h-4 w-4 text-text-disabled" strokeWidth={2} aria-hidden />
        </View>
      </Pressable>
      {isOpen && <DefeatedBossTiles rowKey={rowKey} bosses={bosses} />}
    </View>
  )
}

export function CashbookScreen(): React.JSX.Element {
  /**
   * 렌더당 한 번만 만드는 지금. 두 번 부르면 두 시각이 기간 경계를 사이에 두고 갈려 오늘 과
   * 기간 라벨이 서로 다른 기간을 가리킬 수 있다.
   */
  const now = new Date()
  const todayDateKey = getCurrentKstDateKey(now)
  /**
   * 들어오면 주간이다. 고른 값은 기억하지 않는다. 나갔다 들어오면 다시 주간이다.
   */
  const [isWeekly, setIsWeekly] = useState(true)
  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey(now))
  const [weekStartKey, setWeekStartKey] = useState(() => resetWeekStartOf(todayDateKey))
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey)
  /**
   * 시트가 무엇을 하고 있나. 셋이다.
   *
   * `'income'`·`'expense'` 는 새로 적는다. `ManualDayRecord` 면 그것을 고친다. 갈래도 그 안에
   * 있으므로 어느 시트를 열까 와 무엇을 채울까 가 한 값에서 나온다. 자동 줄은 타입이 막아
   * 여기 못 들어온다.
   */
  const [sheet, setSheet] = useState<'income' | 'expense' | ManualDayRecord | null>(null)
  const [dayRecords, setDayRecords] = useState<DayRecord[]>([])
  /**
   * 펼쳐 둔 결정석 줄. 한 번에 하나다. 값은 `rowKeyOf` 가 만든 줄의 신원
   * (`bossCrystal:{ocid}`)이고, 그것이 날짜를 안 들고 있으므로 날을 바꿀 때 여기서 지워야 한다.
   */
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<CalendarAmounts>(NO_AMOUNTS)
  const [lastPointRate, setLastPointRate] = useState<number | null>(null)
  /**
   * 시트의 캐릭터 고르개가 쓸 목록. 화면이 읽는다(시트는 `storage/` 를 모른다).
   * 들어올 때 한 번이면 된다. 추적 목록이 시트를 여는 사이에 바뀌지 않는다.
   */
  const [characters, setCharacters] = useState<
    Array<{ ocid: string; name: string; level: number | null }>
  >([])
  const openTab = useOpenTab()
  const { definition } = useThemeAppearance()

  const monthWeeks = buildCalendarMonth(monthKey)
  const weeks = isWeekly ? [buildResetWeek(weekStartKey)] : monthWeeks
  // 기준선은 두 보기가 같다. 그 달이다. 주간에서 받은 이레로 다시 내면 7칸 중 하나는 언제나
  // 최대가 되어 아무것도 안 한 주도 한 칸이 새까매진다. 걸치는 주는 목요일이 든 달을 기준으로 삼는다.
  const heatWeeks = isWeekly ? buildCalendarMonth(monthKeyOf(weekStartKey)) : monthWeeks
  const { from, to } = coveringRange(weeks, heatWeeks)

  /**
   * 기간이 바뀌면 다시 읽게 하는 토큰. 범위가 곧 의존성이라 달을 넘겼는데 옛 숫자가 남는 일이 없고,
   * 저장 뒤에도 이 표를 올려 같은 길로 다시 읽는다.
   *
   * `useCallback` 으로 안 감싼다. React 컴파일러가 지킬 수 없는 수동 메모이제이션으로 보고
   * 이 컴포넌트의 최적화를 통째로 건너뛴다(lint 가 막는다).
   *
   * `alive` 로 늦게 온 응답을 버린다. 달을 빨리 넘기면 이전 범위의 답이 뒤에 도착한다.
   */
  const [reloadToken, setReloadToken] = useState(0)

  /**
   * 당겨서 새로고침. 동기화 → 날짜 캐기 → 다시 읽기 순서는 `refreshCashbook` 이 든다.
   */
  const pull = usePullRefresh(async () => {
    await refreshCashbook(new Date())
    setReloadToken((token) => token + 1)
  })


  /**
   * 마지막으로 읽은 판. 다시 들어올 때 내 숫자가 낡았나 를 재는 기준이다.
   *
   * 조회 전에 찍는다. 읽는 중에 들어온 변경을 본 것으로 표시하면 영영 놓친다. 반대 방향은
   * 다음 포커스에 한 번 더 읽을 뿐이라 안전하다.
   */
  const loadedRevision = useRef(cashbookDataRevision())

  useEffect(() => {
    let alive = true
    loadedRevision.current = cashbookDataRevision()
    void loadCalendarAmounts(from, to).then((next) => {
      if (alive) setAmounts(next)
    })
    return () => {
      alive = false
    }
  }, [from, to, reloadToken])

  /**
   * 다시 들어오면 바뀌었을 때만 다시 읽는 포커스 효과.
   *
   * 이 화면은 탭이라 마운트가 앱 실행당 한 번뿐인데, 접는 원천 넷 중 둘은 남의 화면이 쓴다.
   * 가격 입력 화면이 `boss_drop_records` 를, 보스 수익 동기화가 `boss_profit_records` 를.
   * 그래서 첫 방문의 숫자에 굳는다.
   *
   * 포커스마다 무조건 안 읽는 것은 한 번의 조회가 SQLite 넷을 치기 때문이다. 여기서 동기화는
   * 안 튼다. 넥슨 API 는 당김과 보스 수익 탭의 몫이다.
   */
  useFocusEffect(
    useCallback(() => {
      if (loadedRevision.current !== cashbookDataRevision()) {
        setReloadToken((token) => token + 1)
      }
    }, []),
  )

  // 그날 목록은 고른 날에 매인다. 격자 범위와 의존성이 달라 효과를 따로 둔다.
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
    void loadTrackedCharacters().then(setCharacters)
  }, [])

  /**
   * 들어올 때 한 번 처치 날짜를 캔다. 캔 것이 있을 때만 다시 읽는다.
   *
   * 기간마다 안 돌리는 이유는 캘 수 있는 범위를 조회 창이 정하지 보는 달이 정하지 않아서다.
   * 그래서 첫 렌더의 숫자가 나중에 늘 수 있다. 사라지는 방향은 없다(NULL → 날짜).
   */
  useEffect(() => {
    let alive = true
    void resolveTrackedDefeatDates(new Date()).then((dated) => {
      if (alive && dated > 0) setReloadToken((token) => token + 1)
    })
    return () => {
      alive = false
    }
  }, [])

  /**
   * 저장 둘. 던지면 다시 던진다.
   *
   * 삼키면 시트가 닫히고, 닫힌 뒤에는 친 것이 사라져 화면에 적혔다 와 구분되지 않는 그림만
   * 남는다. 토스트는 여기서 띄우고(저장소 실패는 화면의 몫이다) 자리를 지키는 일은 시트가 한다.
   *
   * 다시 읽는 것도 성공했을 때만 한다. 실패했으면 읽을 것이 안 바뀌었다.
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
    // 시세는 방금 저장한 값이 다음 기본값이다. 다시 읽지 않고 그대로 든다.
    if (draft.pointPer100mMeso !== null) setLastPointRate(draft.pointPer100mMeso)
    setReloadToken((token) => token + 1)
  }

  /**
   * 고치기. `id` 와 `recordedAt` 을 그대로 얹는다. 시트는 그 둘을 모르므로(초안만 만든다)
   * 여기서 원본과 합쳐야 고친 시각이 적은 시각을 덮지 않는다.
   */
  async function saveEdit(entry: ManualDayRecord, draft: IncomeDraft | SpendDraft): Promise<void> {
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

  async function deleteEntry(entry: ManualDayRecord): Promise<void> {
    try {
      await removeRecord(entry)
    } catch (error) {
      useToastStore.getState().showError('기록을 지우지 못했습니다')
      throw error
    }
    setReloadToken((token) => token + 1)
  }

  /**
   * 줄을 누르면. 손입력은 시트, 자동은 보스 수익 탭이다.
   *
   * 자동 줄을 여기서 고치게 하면 두 곳에서 고칠 수 있게 되어 어느 쪽이 참인지 사라진다.
   * 삭제도 없다. 여기서 지워도 원천이 그대로라 다음에 읽으면 되살아난다.
   */
  function openRecord(entry: DayRecord): void {
    if (isManualRecord(entry)) {
      setSheet(entry)
      return
    }
    /**
     * 결정석 줄은 안 나간다. 그 자리에서 편다. 펼친 타일은 읽기 전용이라 두 곳에서 고칠 수
     * 있게 되지 않는다. 탭을 옮기면 고른 날과 보던 기간을 함께 잃어 그 날의 다른 줄을 못 본다.
     */
    if (entry.kind === 'bossCrystal') {
      const key = rowKeyOf(entry)
      setExpandedRowKey((current) => (current === key ? null : key))
      return
    }
    // 판매 줄은 그대로 간다. `미입력 n` 이 **여기서 못 하는 일**(값 넣기)을 가리킨다.
    openTab('Profit')
  }

  // 앞뒤 달로 채운 칸을 누르면 **보는 달도 따라간다**. 아니면 고른 날이 격자 밖에 있게 된다.
  // 주간에는 그런 칸이 없으므로(이레가 전부 그 주다) 주는 그대로 둔다.
  function selectDate(dateKey: string): void {
    setSelectedDateKey(dateKey)
    // 펼친 판은 그 날의 것이다. 줄의 신원이 날짜를 안 들어 여기서 접지 않으면 다른 날의 줄이
    // 펼쳐진 채로 남는다.
    setExpandedRowKey(null)
    /**
     * 달 동기화는 이번 달까지만. 월간 격자의 꼬리 칸은 다음 달 날짜라 그냥 맞추면 한 번의 탭이
     * 화살표가 막은 곳에 도착한다.
     *
     * 막는 것은 보는 기간이지 고른 날이 아니다. 미래의 날에도 적을 수 있어야 하므로 고른 날은
     * 그대로 바뀌고 격자만 남는다. `<=` 라 이번 달은 든다.
     */
    if (!isWeekly && monthKeyOf(dateKey) <= getCurrentMonthKey(now)) {
      setMonthKey(monthKeyOf(dateKey))
    }
  }

  function showWeekly(): void {
    setWeekStartKey(resetWeekStartOf(selectedDateKey))
    setIsWeekly(true)
  }

  function showMonthly(): void {
    setMonthKey(monthKeyOf(weekStartKey))
    setIsWeekly(false)
  }

  /**
   * 고른 날의 합계. 그날 읽기에서 나온다.
   *
   * 칸 금액 표(`amounts`)를 안 보는 이유는 그것이 격자가 덮는 범위의 값이기 때문이다. 고른 날은
   * 기간을 옮겨도 안 바뀌므로, 표를 보면 그 날이 범위 밖으로 나가는 순간 상세가 사라진다.
   * 빈 상태 판정도 같은 이유로 그 날 자신의 기록이 낸다.
   */
  const selectedTotals = dayTotalsOf(dayRecords)
  /**
   * 격자 위 세 칸이 읽는 기간 합계. 격자에 넘기는 그 `weeks`·`amounts` 를 접는다. 열지도
   * 기준선용 `heatWeeks` 를 넣으면 주간 자리에 달 합계가 선다.
   */
  const periodSums = periodTotals(weeks, amounts)
  const periodLabel = isWeekly
    ? formatBossProfitPeriodLabel('weekly', weekStartKey, now)
    : formatBossProfitPeriodLabel('monthly', monthKey, now)

  /**
   * 앞으로 갈 자리가 없는지. 지금 보는 것이 이번 주·이번 달이면 다음이 미래다.
   *
   * 판정은 보스 수익 탭이 쓰는 `isLatestPeriod` 그대로다. 두 축의 `periodKey` 가 이미 그쪽과
   * 같은 모양이라(주간은 목요일 날짜, 월간은 `YYYY-MM`) 같은 그룹의 두 하위가 한 경계를 갖는다.
   */
  const isLatest = isLatestPeriod(isWeekly ? 'weekly' : 'monthly', isWeekly ? weekStartKey : monthKey, now)

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
        // 색만 테마에서 넘기고 컨트롤은 셸이 그대로 받는다.
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            tintColor={definition.primaryInk}
            colors={[definition.primaryInk]}
            progressBackgroundColor={definition.surface}
          />
        }
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
        {/* 바닥 여백이 떠 있는 ＋ 의 몫이다. FAB 는 콘텐츠를 밀어내지 않아 여기서 갚지 않으면
            끝까지 내렸을 때 마지막 줄이 버튼 뒤로 들어간다.

            `pb-4` 를 대신한다. 그 상수가 숨돌림 16 을 이미 품고 있어(`speed-dial-metrics.ts`)
            함께 주면 바닥 여백이 두 번 붙는다. 하단바의 몫은 `ScreenScroll` 이 이미 남긴다. */}
        <View
          testID="cashbook-content"
          className="gap-4 px-4"
          style={{ paddingBottom: SPEED_DIAL_SPACE_PX }}
        >
          <View
            testID="cashbook-period-nav"
            className="flex-row items-center justify-center gap-4"
          >
            {/* 이름이 모드를 따른다. 스크린리더가 무엇이 옮겨지는가 를 듣는다. */}
            <MonthArrow
              label={isWeekly ? '이전 주' : '이전 달'}
              icon={ChevronLeftIcon}
              onPress={() => movePeriod(-1)}
            />
            {/* 윗줄이 상대 표현(`이번 주`·`지난 달`), 아랫줄이 언제나 정확한 날짜다. 라벨은
                `formatBossProfitPeriodLabel` 을 그대로 부른다. 보스 수익 탭과 같은 `periodKey` 를
                쓰므로 두 하위 탭이 한 어법으로 기간을 말하게 된다. */}
            <View className="items-center">
              <Text
                testID="cashbook-period-label"
                className="text-sm font-semibold text-text"
              >
                {periodLabel.primary}
              </Text>
              <Text
                testID="cashbook-period-range"
                className="mt-0.5 text-xs text-text-muted"
                style={TABULAR_NUMS}
              >
                {periodLabel.secondary}
              </Text>
            </View>
            {/* 앞으로는 못 간다. 미래의 합계는 언제나 0 이라 아직 안 적었나 와 올 수 없는 곳인가 가
                같은 화면으로 말해진다. */}
            <MonthArrow
              label={isWeekly ? '다음 주' : '다음 달'}
              icon={ChevronRightIcon}
              disabled={isLatest}
              onPress={() => movePeriod(1)}
            />
          </View>

          {/* 합계는 이동 아래 · 격자 위다. 어느 기간인가 를 말한 줄 다음이 그 기간이 얼마인가 이고,
              그 둘이 격자를 받친다. */}
          <PeriodSummary
            incomeMeso={periodSums.incomeMeso}
            expenseMeso={periodSums.expenseMeso}
          />

          <CalendarGrid
            weeks={weeks}
            selectedDateKey={selectedDateKey}
            todayDateKey={todayDateKey}
            amounts={amounts}
            weekdayLabels={isWeekly ? WEEKDAY_LABELS_RESET : undefined}
            // 열지도 기준은 화면이 낸다(`heatWeeks`).
            incomeMax={monthIncomeMax(heatWeeks, amounts)}
            onSelectDate={selectDate}
          />

          <View className="gap-2">
            <Text testID="cashbook-selected-day" className="text-sm font-semibold text-text">
              {formatDayLabel(selectedDateKey)}
            </Text>
            {dayRecords.length === 0 ? (
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
                    +{formatMesoCompact(selectedTotals.incomeMeso)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-text-muted">지출</Text>
                  <Text className="text-sm font-semibold text-fall-ink" style={TABULAR_NUMS}>
                    −{formatMesoCompact(selectedTotals.expenseMeso)}
                  </Text>
                </View>

                {dayRecords.length > 0 && (
                  // 합계 아래에 적은 것이 한 줄씩 선다. 접지 않는다. 같은 날 같은 것을 두 번
                  // 적은 것은 정상이고, 접으면 어느 쪽을 고치는지 못 고른다.
                  <View className="mt-1.5 gap-1.5 border-t border-border pt-2">
                    {dayRecords.map((entry) => (
                      <DayRecordRow
                        key={rowKeyOf(entry)}
                        entry={entry}
                        expanded={expandedRowKey === rowKeyOf(entry)}
                        onPress={() => openRecord(entry)}
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

      {/* 시트는 조건부 마운트다. 마운트가 곧 열림이고 `onClose` 로 언마운트한다. */}
      {(sheet === 'income' || (typeof sheet === 'object' && sheet?.kind === 'income')) && (
        // 고치는 것이면 그 기록의 날짜로 연다. 고른 날이 아니다(둘은 지금 같지만 목록이
        // 여러 날을 걸치게 되는 날 갈린다).
        <IncomeSheet
          characters={characters}
          lastPointRate={lastPointRate}
          // 캐릭터의 메소 획득량. 시트는 `nexon/` 도 `storage/` 도 모른다.
          loadMesoRate={loadMesoRate}
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
          characters={characters}
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
