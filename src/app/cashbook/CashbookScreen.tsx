/**
 * 가계부 — 「수익·지출」 그룹의 둘째 하위 탭([[ADR-169]] 결정 1).
 *
 * ## 담기는 것이 넷이다
 *
 * | 무엇 | 어디서 | 여기서 고치나 |
 * |---|---|---|
 * | 지출 | `spend_records`([[ADR-166]]) | **예** |
 * | 손입력 수익 | `income_records`([[ADR-170]]) | **예** |
 * | 보스 결정석 | `boss_profit_records` 의 `defeated_on`([[ADR-172]]) | **아니오** — 그 자리에서 **펼쳐진다**(정정 1) |
 * | 아이템 판매 | `boss_drop_records` — 날짜는 위에서 **물려받는다** | **아니오** — 보스 수익 탭으로 간다 |
 *
 * 넷째까지 붙은 것이 #239 다. 남은 원천은 **사냥 타이머 자동 수익** 하나이고, 그때까지 사냥 수익은
 * 손으로 적는다([[ADR-170]] 결정 1).
 *
 * 자동으로 흘러든 둘을 여기서 못 고치는 이유는 **원천이 저쪽이기 때문**이다 — 두 곳에서 고치면
 * 어느 쪽이 참인지 사라진다([[ADR-170]] 결정 3 · [[ADR-172]] 결정 8). 갈리는 기준은 테이블이고,
 * 시트 상태의 타입(`ManualDayRecord`)이 그것을 **컴파일 단계에서** 막는다.
 *
 * ## 이 화면은 앞의 껍데기 둘과 다르다
 *
 * 여기 서 있던 사냥 수익·지출은 `UnderConstruction` 이었고 **아무것도 안 했다**([[ADR-132]] 결정
 * 12 — 자리를 예약하던 장치이고, 그 예약이 이 화면으로 이행돼 둘은 삭제됐다).
 *
 * ## 축이 **둘**이다 ([[ADR-170]] 결정 10)
 *
 * | 보기 | 축 | 주가 시작하는 요일 |
 * |---|---|---|
 * | 월간 | 달력 월 | 일요일 — 한국 달력의 관습([[ADR-169]] 결정 8) |
 * | 주간 | **게임의 주** | **목요일** — 보스 수익 탭과 **같은 주**다 |
 *
 * 주간이 게임 축인 덕에 같은 그룹의 두 하위가 「이번 주」로 **같은 숫자**를 말하고, 날짜를 못 캔
 * 보스 기록(`defeated_on IS NULL`)도 자기 `period_key` 그대로 한 주에 든다 — 월간 격자에서만
 * 어느 칸에도 안 선다([[ADR-172]] 결정 4).
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
import { DifficultyBadge } from '../../components/atoms/DifficultyBadge/DifficultyBadge'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { ProfitIcon } from '../../components/atoms/ProfitIcon/ProfitIcon'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { SpeedDial } from '../../components/organisms/SpeedDial/SpeedDial'
import { SPEED_DIAL_SPACE_PX } from '../../components/organisms/SpeedDial/speed-dial-metrics'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { formatBossProfitPeriodLabel, getAdjacentPeriodKey } from '../../lib/boss-profit-period'
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
  resetWeekStartOf,
  type CalendarAmounts,
} from '../../lib/calendar-month'
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ShoppingCartIcon,
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
  recordCountLabelOf,
  resolveTrackedDefeatDates,
  isManualRecord,
  rowKeyOf,
  type DayRecord,
  type DefeatedBoss,
  type ManualDayRecord,
} from '../../features/cashbook/records'
// 보스 수익 탭의 행이 초상을 찾는 **그 함수**다([[ADR-172]] 정정 1) — 같은 보스가 두 화면에서
// 다른 그림이면 안 된다. 화면끼리의 참조는 `app/today/view-model.ts` 가 이미 트고 있는 길이다.
import { findPortraitSlug } from '../boss-profit/character-groups'
import { useOpenTab } from '../use-open-tab'
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
 * 그날 목록의 한 줄([[ADR-171]] 결정 1) — **누를 수 있어 보여야 한다.**
 *
 * 처음에는 글자 둘(이름 · 금액)만 놓았는데 «눌러서 고칠 수 있다» 가 **전혀 안 읽혔다**
 * (사용자 지적 2026-08-25). 줄이 목록이 아니라 **요약**으로 보였기 때문이다 — 바로 위 두 줄
 * (수입/지출 합계)이 정확히 그 모양이라 눈이 같은 것으로 묶는다.
 *
 * 셋으로 가른다. **새로 만든 그림은 0개**다.
 *
 * ① **상자를 준다.** 합계는 배경 없는 줄, 기록은 `bg-surface` 카드 — 표면이 갈리면 «만질 수 있는
 *    것» 과 «읽는 것» 이 갈린다.
 * ② **왼쪽에 갈래 표식.** 수입은 `ProfitIcon`, 지출은 `ShoppingCartIcon` — 펼침판이 이미 쓰는
 *    그 둘이다([[ADR-170]] 결정 9). 부호·색만으로 갈래를 말하던 것을 그림이 거든다.
 * ③ **오른쪽에 화살촉.** 이 저장소가 「눌러서 들어가는 줄」에 쓰는 표식 그대로다
 *    (`SettingsFeatureGuideListScreen`) — 새 관용구를 만들지 않는다.
 *
 * 누를 때 흐려지는 것은 `active:` 로 준다. NativeWind 가 `Pressable` 의 눌림 상태를 그 변형에
 * 이어 주므로 **함수형 `style` 을 안 쓴다** — className 과 함수 style 을 같이 주면 cssInterop
 * 에서 정적 스타일이 통째로 사라진다(`SpeedDial` 이 밟은 함정).
 *
 * 캐시로 낸 지출만 **원**으로 적는다 — 환산을 안 하므로 메소로 적을 값이 없다
 * ([[ADR-166]] 정정 2 ①).
 *
 * ## 자동 줄도 같은 모양이다 ([[ADR-172]] 결정 7·8)
 *
 * 보스 결정석·아이템 판매 줄은 **여기서 못 고치는데도 같은 카드**를 쓴다. 셋 다 «눌러서 무언가가
 * 일어나는 줄» 이기 때문이다. **일어나는 일은 셋으로 갈린다** — 손입력은 시트가 열리고, 결정석은
 * 그 자리에서 펼쳐지며([[ADR-172]] 정정 1), 판매는 보스 수익 탭으로 간다.
 *
 * 그 셋을 **화살촉이 미리 말한다** — `›`(간다) vs `⌄`/`⌃`(편다). 읽어 주는 이름도 함께 갈린다
 * (`고치기` · `펼치기`/`접기` · `보스 수익에서 보기`). 같은 카드가 서로 다르게 반응하는데 표식이
 * 하나면 그 차이가 고장으로 읽힌다.
 *
 * 아이콘도 **새로 안 만든다**([[ADR-170]] 결정 9) — 자동 줄은 둘 다 수익이라 `ProfitIcon` 이다.
 * 결정석과 판매를 가르는 것은 그림이 아니라 이름이고, 그 둘을 다른 그림으로 그리면 «거의 같은데
 * 다른 동전» 이 하나 더 생긴다.
 */
/** 타일 한 변 — **칸 폭과 무관하게 고정**이다([[ADR-172]] 정정 3). 칸은 줄을 여섯이 나눠 기기마다 넓다. */
const BOSS_TILE_PX = 44

/** 한 줄에 서는 마리 수([[ADR-172]] 정정 3, 사용자 지정) — 레이아웃의 결과가 아니라 **여기서 정한다.** */
const BOSSES_PER_ROW = 6

function chunkBosses(bosses: readonly DefeatedBoss[]): DefeatedBoss[][] {
  const rows: DefeatedBoss[][] = []
  for (let index = 0; index < bosses.length; index += BOSSES_PER_ROW) {
    rows.push(bosses.slice(index, index + BOSSES_PER_ROW))
  }
  return rows
}

/**
 * 펼친 결정석 줄의 **타일 판**([[ADR-172]] 정정 1) — 그날 잡은 보스를 초상으로 편다.
 *
 * **새로 만든 그림이 0개**다([[ADR-170]] 결정 9 와 같은 태도). 초상은 `BossPortrait`, 난이도는
 * `DifficultyBadge`, 슬러그는 `findPortraitSlug` — 셋 다 보스 수익 탭의 보스 행이 쓰는 그것이다.
 *
 * **마리당 금액을 안 적는다.** 줄 머리가 합계를 이미 들고 있고, 마리당 금액은 파티원 수·정가와
 * 함께 봐야 뜻이 생긴다(그 자리가 보스 수익 탭이다). 여기서 답하는 질문은 «얼마» 가 아니라 «무엇» 이다.
 *
 * ## 모양은 **네모**다 ([[ADR-172]] 정정 2)
 *
 * `shape="square"` 다. 원형은 **줄 안의 표식**을 위한 모양이고(보스 수익 행의 아바타 자리), 여기서는
 * 초상 자체가 타일이라 격자를 이룬다 — 원이 격자로 서면 네 귀가 비어 사이가 성겨 보인다.
 *
 * 난이도는 **초상 위 왼쪽 아래에 겹친다**. 아래에 한 줄로 따로 두면 타일 높이가 배지만큼 늘어
 * 격자가 세로로 성겨지고, 그러면 «타일» 이 아니라 «세로로 쌓인 작은 카드» 가 된다. 겹치는 것은
 * 드롭 아이콘의 `lv` 배지가 이미 쓰는 관용구다(`BossProfitBossRow`).
 *
 * 글자는 **한 칸**이다(`H`·`EX` …). 44px 위에 「익스트림」 넉 자가 앉으면 초상을 거의 다 덮는데,
 * **색이 이미 난이도를 말하고 있어** 글자는 그것을 확인만 하면 된다. 색은 한 값도 안 갈린다.
 *
 * ## 한 줄에 **여섯**, 이름은 **없다** ([[ADR-172]] 정정 3)
 *
 * **폭으로 재지 않는다.** 고정 px 면 같은 코드가 기기마다 다섯도 되고 일곱도 되고, 퍼센트도
 * 답이 아니다 — `w-1/6` 은 `16.67%` 로 컴파일돼(실측) 여섯이면 **100.02%** 라 마지막 하나가
 * 다음 줄로 밀린다. 1/6 은 유한소수가 아니라 퍼센트로 **표현할 수 없다.**
 *
 * 그래서 **줄 자체를 만든다** — 여섯씩 끊은 배열이고, 한 줄은 `flex-1` 칸 여섯이다. `flex-1`
 * 여섯은 남는 픽셀까지 Yoga 가 나눠 주므로 반올림으로 넘칠 자리가 없다. 이 저장소가 캘린더에서
 * 이미 하는 그 모양이다([[ADR-169]] 결정 7 — 계산이 배열을 만들고 렌더러는 그리기만 한다).
 *
 * 초상은 칸 안에 **가운데로 44px 고정**이다. 넓은 기기에서 칸이 넓어져도 타일은 안 커진다 —
 * 커진 것이 문제였으므로 그것을 폭에 따라 되돌리지 않는다.
 *
 * **이름을 뺀 자리는 접근성 이름이 받는다**(「난이도 + 보스」). 타일 높이의 절반이 이름이었고,
 * 캐릭터가 여럿이면 그 판이 화면을 덮어 «그 날» 을 보러 온 목적을 잃었다. 눈으로 읽던 것이
 * 사라졌다고 스크린리더에서도 사라지면 그것은 «간략하게» 가 아니라 «없어짐» 이다.
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
          className="flex-row"
        >
          {row.map((boss) => (
            <View
              key={`${boss.boss}|${boss.difficulty}`}
              testID={`cashbook-boss-slot-${boss.boss}|${boss.difficulty}`}
              className="flex-1 items-center"
            >
              <View testID={`cashbook-boss-tile-${boss.boss}|${boss.difficulty}`}>
                <BossPortrait
                  portraitSlug={findPortraitSlug(boss.boss)}
                  // 이름 줄이 없어졌으므로 **여기가 그 정보를 드는 유일한 자리**다.
                  label={`${boss.difficulty} ${boss.boss}`}
                  size={BOSS_TILE_PX}
                  shape="square"
                />
                <View className="absolute bottom-0.5 left-0.5">
                  <DifficultyBadge difficulty={boss.difficulty} size="small" short />
                </View>
              </View>
            </View>
          ))}
          {/* 덜 찬 줄을 빈 칸으로 채운다 — 안 채우면 남은 둘이 반반씩 벌어져 앞줄과 격자가 안 맞는다. */}
          {Array.from({ length: BOSSES_PER_ROW - row.length }, (_, index) => (
            <View key={`empty-${index}`} testID={`cashbook-boss-slot-empty-${index}`} className="flex-1" />
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
  // **자동 줄은 언제나 수익**이다([[ADR-172]] 결정 7) — 결정석도 판매도 들어오는 돈이다.
  const income = entry.kind !== 'spend'
  const cash = recordCashOf(entry)
  const countLabel = recordCountLabelOf(entry)
  const Icon = income ? ProfitIcon : ShoppingCartIcon
  /**
   * **펼칠 수 있는 줄은 결정석 하나**다([[ADR-172]] 정정 1). 판매 줄은 `bosses` 를 아예 안 갖는
   * 타입이라(`AutoDayRecord` 가 합집합이다) 이 분기를 잘못 쓰면 컴파일 단계에서 걸린다.
   */
  const bosses = entry.kind === 'bossCrystal' ? entry.bosses : null
  const isOpen = expanded && bosses !== null
  /**
   * 화살촉이 **무슨 일이 일어날지 미리 말한다.** 같은 카드 두 줄이 서로 다르게 반응하는데
   * (하나는 펼치고 하나는 탭을 옮긴다) 그림이 같으면 그것이 고장으로 읽힌다.
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
        // 자동 줄은 **고치러 가는 것이 아니라 보러 가는 것**이다([[ADR-172]] 결정 8) — 읽어 주는
        // 이름이 그 사실을 말해야 «눌렀더니 시트가 안 열린다» 가 고장으로 읽히지 않는다.
        aria-label={`${recordTitleOf(entry)} ${action}`}
        aria-expanded={bosses === null ? undefined : isOpen}
        onPress={props.onPress}
        // 펼치면 **한 카드**가 된다 — 아래 판과 테두리를 잇고 그 사이의 선을 지운다. 판이 따로 선
        // 상자로 보이면 «이 줄이 편 것» 이라는 사실이 끊긴다.
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
          // 갈래마다 세는 것이 다르다(`×2` · `12마리` · `3건 · 미입력 2`) — 그 분기는 화면이 아니라
          // `recordCountLabelOf` 가 든다([[ADR-147]] 결정 8).
          // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
          <Text numberOfLines={1} className="shrink-0 text-[11px] text-text-muted" style={TABULAR_NUMS}>
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
        {/* 화살촉이 상자를 하나 쓰는 이유: lucide 아이콘은 `testID` 를 SVG 안으로 흘려보내지 않아
            «화살촉이 사라졌다» 를 테스트가 못 잡는다. 상자는 `shrink-0` 도 함께 든다. */}
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
   * **렌더당 한 번만 만든다** — 보스 수익 화면이 같은 이유로 그렇게 한다. 두 번 부르면 두 시각이
   * 기간 경계를 사이에 두고 갈려 «오늘» 과 «기간 라벨» 이 서로 다른 기간을 가리킬 수 있다.
   */
  const now = new Date()
  const todayDateKey = getCurrentKstDateKey(now)
  /**
   * **들어오면 주간이다**([[ADR-170]] 결정 10 정정, 사용자 지정 2026-08-26).
   *
   * 고른 값은 여전히 **기억하지 않는다** — 나갔다 들어오면 다시 주간이다(보스 수익 탭도 자기
   * 탭을 화면 상태로 둔다).
   */
  const [isWeekly, setIsWeekly] = useState(true)
  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey(now))
  const [weekStartKey, setWeekStartKey] = useState(() => resetWeekStartOf(todayDateKey))
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey)
  /**
   * 시트가 무엇을 하고 있나 — 셋이다([[ADR-171]] 결정 2).
   *
   * `'income'`·`'expense'` 는 **새로 적는다**. `ManualDayRecord` 면 **그것을 고친다** — 갈래도 그
   * 안에 있으므로 «어느 시트를 열까» 와 «무엇을 채울까» 가 한 값에서 나온다.
   *
   * **자동 줄은 여기 못 들어온다**([[ADR-172]] 결정 8) — 타입이 그것을 막는다. 그 줄을 누르면
   * 시트가 아니라 보스 수익 탭이 열린다.
   */
  const [sheet, setSheet] = useState<'income' | 'expense' | ManualDayRecord | null>(null)
  const [dayRecords, setDayRecords] = useState<DayRecord[]>([])
  /**
   * 펼쳐 둔 결정석 줄([[ADR-172]] 정정 1) — **한 번에 하나**다. 캐릭터가 여럿이면 판 여럿이 한
   * 화면을 넘긴다.
   *
   * 값은 `rowKeyOf` 가 만든 줄의 신원(`bossCrystal:{ocid}`)이다. 그것이 **날짜를 안 들고 있으므로**
   * (결정 7) 날을 바꿀 때 여기서 지워야 한다 — 안 그러면 다른 날의 줄이 펼쳐진 채로 보인다.
   */
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<CalendarAmounts>(NO_AMOUNTS)
  const [lastPointRate, setLastPointRate] = useState<number | null>(null)
  const openTab = useOpenTab()

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
   * 들어올 때 **한 번** 처치 날짜를 캔다([[ADR-172]] 결정 9). 캔 것이 있을 때만 다시 읽는다 —
   * 0 이면 화면에 바뀔 것이 없다.
   *
   * 기간이 바뀔 때마다 돌리지 않는 이유: 캘 수 있는 범위는 **조회 창이 정하지 보는 달이 정하지
   * 않는다**([[ADR-172]] 결정 4). 지난 3월로 넘겨도 캘 것이 늘지 않으므로 호출만 낭비된다.
   *
   * 그래서 **첫 렌더의 숫자가 나중에 늘 수 있다.** 사라지는 방향은 없다(NULL → 날짜).
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
   * 줄을 누르면 — **손입력은 시트, 자동은 보스 수익 탭**이다([[ADR-172]] 결정 8 = [[ADR-171]] 결정 5).
   *
   * 자동 줄을 여기서 고치게 하면 두 곳에서 고칠 수 있게 되어 **어느 쪽이 참인지 사라진다**
   * ([[ADR-170]] 결정 3). 삭제도 없다 — 가계부에서 지워도 원천이 그대로라 다음에 읽으면 되살아난다.
   */
  function openRecord(entry: DayRecord): void {
    if (isManualRecord(entry)) {
      setSheet(entry)
      return
    }
    /**
     * **결정석 줄은 안 나간다 — 그 자리에서 편다**([[ADR-172]] 정정 1, 사용자 지정 2026-08-26).
     *
     * 결정 8 의 근거(«고치면 어느 쪽이 참인지 사라진다»)는 그대로다 — 펼친 타일은 읽기 전용이다.
     * 사용자가 하려던 것이 고치기가 아니라 «무엇을 잡았지» 였고, 그 답을 이 줄이 이미 들고 있다.
     * 탭을 옮기면 고른 날과 보던 기간을 함께 잃어 그 날의 다른 줄을 마저 못 본다.
     */
    if (entry.kind === 'bossCrystal') {
      const key = rowKeyOf(entry)
      setExpandedRowKey((current) => (current === key ? null : key))
      return
    }
    // 판매 줄은 그대로 간다 — 「미입력 n」 이 **여기서 못 하는 일**(값 넣기)을 가리킨다.
    openTab('Profit')
  }

  // 앞뒤 달로 채운 칸을 누르면 **보는 달도 따라간다** — 아니면 고른 날이 격자 밖에 있게 된다.
  // 주간에는 그런 칸이 없으므로(이레가 전부 그 주다) 주는 그대로 둔다.
  function selectDate(dateKey: string): void {
    setSelectedDateKey(dateKey)
    // 펼친 판은 **그 날의 것**이다 — 줄의 신원이 날짜를 안 들어([[ADR-172]] 결정 7) 여기서 접지
    // 않으면 다른 날의 줄이 펼쳐진 채로 남는다.
    setExpandedRowKey(null)
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
  const periodLabel = isWeekly
    ? formatBossProfitPeriodLabel('weekly', weekStartKey, now)
    : formatBossProfitPeriodLabel('monthly', monthKey, now)

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
        {/*
          바닥 여백이 **떠 있는 ＋ 의 몫**이다([[ADR-170]] 결정 5 의 «딸려 오는 결함»). FAB 는 화면
          위에 떠 있어 콘텐츠를 밀어내지 않으므로, 여기서 갚지 않으면 스크롤을 끝까지 내렸을 때
          마지막 줄이 버튼 뒤로 들어간다(사용자 보고 2026-08-25).

          `pb-4` 를 **대신한다** — 그 상수가 숨돌림 16 을 이미 품고 있어(`speed-dial-metrics.ts`)
          함께 주면 바닥 여백이 두 번 붙는다. 하단바의 몫은 여기 없다: `ScreenScroll` 이 이미 콘텐츠
          끝에 남기고 다이얼은 그 위에 앉는다.
        */}
        <View
          testID="cashbook-content"
          className="gap-4 px-4"
          style={{ paddingBottom: SPEED_DIAL_SPACE_PX }}
        >
          <View className="flex-row items-center justify-center gap-4">
            {/* 이름이 모드를 따른다 — 스크린리더가 «무엇이 옮겨지는가» 를 듣는다. */}
            <MonthArrow
              label={isWeekly ? '이전 주' : '이전 달'}
              icon={ChevronLeftIcon}
              onPress={() => movePeriod(-1)}
            />
            {/*
              **보스 수익 탭과 같은 모양**이다([[ADR-170]] 정정 3) — 윗줄이 상대 표현
              (「이번 주」·「지난 달」), 아랫줄이 **언제나 정확한 날짜**다.

              라벨을 새로 만들지 않고 `formatBossProfitPeriodLabel` 을 그대로 부른다. 두 축이 이미
              같은 `periodKey` 를 쓰므로(주간은 목요일 날짜, 월간은 `YYYY-MM`) 넘길 것이 그대로 있고,
              같은 그룹의 두 하위가 **한 어법**으로 기간을 말하게 된다([[ADR-170]] 결정 10 의 논지).
            */}
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
