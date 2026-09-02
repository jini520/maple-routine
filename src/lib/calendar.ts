/**
 * 가계부 캘린더가 쓰는 순수 계산. 월간 격자와 주간 격자를 둘 다 만든다.
 *
 * | 무엇 | 축 | 주가 시작하는 요일 |
 * |---|---|---|
 * | 월간 격자(`buildCalendarMonth`) | 달력 월 | 일요일 |
 * | 주간 격자(`buildResetWeek`) | 게임의 주 | 목요일 |
 *
 * 둘은 뒤집힌 관계가 아니라 하는 일이 다르다. 월간은 달력이라 일요일 시작이 관습이고(목요일에서
 * 시작하는 달력은 못 읽는다), 주간은 기간이라 게임 축이 맞는다. 대가로 월간 격자의 한 줄이 주간의
 * 한 주와 다르고, 화면이 목요일 열에 세로 점선을 그어 그것을 드러낸다.
 *
 * **로컬 게터(`getMonth` 등)를 쓰지 말 것.** 타임존을 보는 것은 `getCurrentMonthKey` 하나뿐이고
 * 나머지는 문자열·UTC 필드 산술이다. 로컬 게터를 쓰면 같은 달이 기기마다 다른 격자로 그려진다.
 */

import { getCurrentKstDateKey } from './scheduler/reset-clock'

const DAY_MS = 24 * 60 * 60 * 1000

/** 일요일에서 시작한다. 한국 달력의 관습이다. */
export const WEEKDAY_LABELS: readonly string[] = ['일', '월', '화', '수', '목', '금', '토']

export interface CalendarDay {
  /** `YYYY-MM-DD`. 표식·기록을 붙이는 키다. */
  readonly dateKey: string
  readonly day: number
  /**
   * **이 격자가 다루는 기간에 드는가.** `false` 인 칸은 흐리게 그리고 열지도 기준에서도 빠진다.
   *
   * 월간 격자에서는 보고 있는 달인가 이고(앞뒤 달로 채운 칸이 `false`),
   * **주간 격자에서는 언제나 `true`** 다. 목요일 주는 두 달에 걸칠 수 있지만 이레가 전부 그 주다.
   *
   * 이름이 `inMonth` 였는데 주간이 생기며 **거짓이 됐다**(달을 걸치는 주의 뒷날들이 그 달 이
   * 아니면서 기간에는 든다). 이름이 뜻을 들어야 한다.
   */
  readonly inPeriod: boolean
}

export type CalendarWeek = readonly CalendarDay[]

/**
 * 하루치 금액. 칸이 그리는 두 줄.
 *
 * **`expenseMeso` 는 메소 축의 지출이다**. 메소로 낸 것과 **메소마켓 시세로 환산한 메포**를
 * 합친 값이다.
 *
 * **캐시는 여기 안 들어간다.** 캐시에 메소 값을 매기려면 현금과 게임 재화의 교환비를 앱이 들어야
 * 하는데, 그 비율이 실제로 성립하는 경로가 운영정책 위반 거래다. 정확도가 아니라 무엇을 정상으로
 * 보이게 하는가 의 문제라 **환산 자체를 안 한다.** 그래서 캐시 지출이 있는 날은 이 숫자가 그날
 * 지출의 전부가 아니고, 캐시는 **고른 날의 상세에서 따로 선다**(칸에서 어떻게 알릴지는 지출 기록이
 * 붙을 때 정한다. 그 전에 정하면 빈 화면을 보고 정하는 것이 된다).
 */
export interface CalendarDayAmounts {
  readonly incomeMeso: number
  readonly expenseMeso: number
}

export type CalendarAmounts = Readonly<Record<string, CalendarDayAmounts>>

function parseMonthKey(monthKey: string): { year: number; month: number } {
  return { year: Number(monthKey.slice(0, 4)), month: Number(monthKey.slice(5, 7)) }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dateKeyOf(utcMs: number): string {
  const date = new Date(utcMs)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** 지금이 속한 달. **KST 기준**이다(`reset-clock` 과 같은 규칙). */
export function getCurrentMonthKey(now: Date): string {
  return monthKeyOf(getCurrentKstDateKey(now))
}

export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7)
}

/** 해를 넘긴다. `Date.UTC` 가 월 인덱스 밖의 값을 정규화한다. */
export function getAdjacentMonthKey(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey)
  const moved = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}`
}

/** 8월 23일 (일). 고른 날의 상세 머리글. */
export function formatDayLabel(dateKey: string): string {
  const utcMs = Date.parse(`${dateKey}T00:00:00Z`)
  const date = new Date(utcMs)
  const weekday = WEEKDAY_LABELS[date.getUTCDay()]
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 (${weekday})`
}

/**
 * 하루 단위로 옮긴 날짜 열쇠. 달·해 경계와 윤년을 `Date` 가 알아서 넘긴다.
 *
 * **UTC 로 센다**. `formatDayLabel` 과 같은 이유다. 기기 표준시로 세면 자정 언저리에서 하루가
 * 밀려, 같은 열쇠가 화면과 저장에서 갈린다.
 */
export function shiftDateKey(dateKey: string, delta: number): string {
  const date = new Date(Date.parse(`${dateKey}T00:00:00Z`))
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

/**
 * 몇 주 × 7칸. 달 경계의 빈칸을 **앞뒤 달 날짜로 채운다**. 빈 칸으로 두면
 * 6주째가 통째로 비는 달에서 격자 높이가 달마다 달라지고, 달을 넘길 때 아래 내용이 튄다.
 */
export function buildCalendarMonth(monthKey: string): CalendarWeek[] {
  const { year, month } = parseMonthKey(monthKey)
  const firstOfMonthMs = Date.UTC(year, month - 1, 1)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  // 첫 칸은 그 달 1일이 속한 주의 일요일이고, 마지막 주는 토요일로 끝난다.
  const startMs = firstOfMonthMs - new Date(firstOfMonthMs).getUTCDay() * DAY_MS
  const lastOfMonthMs = Date.UTC(year, month - 1, daysInMonth)
  const endMs = lastOfMonthMs + (6 - new Date(lastOfMonthMs).getUTCDay()) * DAY_MS

  const weeks: CalendarDay[][] = []
  for (let cursor = startMs; cursor <= endMs; cursor += DAY_MS) {
    const date = new Date(cursor)
    if (date.getUTCDay() === 0) weeks.push([])
    weeks[weeks.length - 1]?.push({
      dateKey: dateKeyOf(cursor),
      day: date.getUTCDate(),
      inPeriod: date.getUTCMonth() === month - 1 && date.getUTCFullYear() === year,
    })
  }

  return weeks
}

/**
 * 칸의 **진하기**. 0(안 칠함) ~ `HEAT_LEVELS`(레퍼런스의 열지도).
 *
 * 그 달 안에서 **상대적**이다. 절대 금액으로 자르면 초반 캐릭터의 달은 전부 흐리고 만렙의 달은
 * 전부 진해서 많이 번 날 이 안 보인다. 열지도가 말하려는 것이 그 대비다.
 *
 * 0 과 가장 작은 단계 를 가르는 것이 계약이다: 1 메소라도 있으면 칸이 칠해져야 적은 날 과
 * 안 적은 날 이 구분된다.
 */
export const HEAT_LEVELS = 4

export function heatLevel(amount: number, monthMax: number): number {
  if (amount <= 0 || monthMax <= 0) return 0
  return Math.min(HEAT_LEVELS, Math.ceil((amount / monthMax) * HEAT_LEVELS))
}

/**
 * 진하기의 기준선. **이번 달 칸만** 센다. 앞뒤 달로 채운 칸(결정 7)이 기준을 정해 버리면 이번
 * 달의 대비가 엉뚱해진다: 지난달에 큰 날이 하나 있으면 이번 달이 통째로 흐려진다.
 */
export function monthIncomeMax(weeks: readonly CalendarWeek[], amounts: CalendarAmounts): number {
  let max = 0
  for (const week of weeks) {
    for (const day of week) {
      if (!day.inPeriod) continue
      max = Math.max(max, amounts[day.dateKey]?.incomeMeso ?? 0)
    }
  }
  return max
}

/**
 * 격자 위에 서는 **기간 합계**. 화면이 `CalendarGrid` 에 넘긴 **그 `weeks`** 와
 * **그 `amounts`** 를 받아 접는다. 그래서 칸에 적힌 것을 다 더한 값 이 곧 이 숫자이고, 따로 읽지
 * 않으므로 칸과 합계가 서로 다른 순간을 가질 수 없다.
 *
 * 기준이 `monthIncomeMax` 와 **같은 `inPeriod`** 인 것이 계약이다. 월간 격자는 앞뒤 달 날짜로
 * 빈칸을 채우므로(결정 7) 그 칸을 세면 8월 합계에 7월 말과 9월 초가 섞인다. 주간 격자에서는
 * 이레가 전부 `inPeriod` 라 그대로 이레의 합이다.
 *
 * **넣는 것은 보이는 격자다.** 열지도 기준선용 `heatWeeks` 는 주간 보기에서 그 달 전체라(결정 12)
 * 그것을 접으면 주간 합계 자리에 **달 합계**가 선다.
 */
export function periodTotals(
  weeks: readonly CalendarWeek[],
  amounts: CalendarAmounts,
): CalendarDayAmounts {
  let incomeMeso = 0
  let expenseMeso = 0
  for (const week of weeks) {
    for (const day of week) {
      if (!day.inPeriod) continue
      incomeMeso += amounts[day.dateKey]?.incomeMeso ?? 0
      expenseMeso += amounts[day.dateKey]?.expenseMeso ?? 0
    }
  }
  return { incomeMeso, expenseMeso }
}

// ══ 주간 격자. 게임의 주 ══════════════════════════════

/** 목요일에서 시작한다. **월간 라벨을 회전한 것**이라 요일 이름이 한 곳에만 산다. */
export const WEEKDAY_LABELS_RESET: readonly string[] = [
  ...WEEKDAY_LABELS.slice(4),
  ...WEEKDAY_LABELS.slice(0, 4),
]

/** `getUTCDay()` 의 목요일. */
const THURSDAY = 4

/**
 * 이 날짜가 속한 **게임 주의 시작(목요일)**. `YYYY-MM-DD`.
 *
 * `boss-profit-period.ts` 의 `getCurrentBossProfitPeriod('weekly', now).periodKey` 와 **같은 답을
 * 내야 한다**(테스트가 그 일치를 붙든다). 그쪽을 그대로 부르지 않는 이유는 입력이 다르기 때문이다.
 * 저쪽은 `Date`(시각)를 받아 KST 리셋 경계를 재는데, 여기 오는 것은 **이미 KST 달력 날짜**라
 * 다시 시각으로 바꾸면 타임존이 한 번 더 개입한다. 이 파일이 문자열·UTC 필드 산술만 쓰는 이유가
 * 그것이다(파일 머리).
 */
export function resetWeekStartOf(dateKey: string): string {
  const utcMs = Date.parse(`${dateKey}T00:00:00Z`)
  // 목(4)→0 · 금(5)→1 · 토(6)→2 · 일(0)→3 · 월(1)→4 · 화(2)→5 · 수(3)→6.
  const daysSinceThursday = (new Date(utcMs).getUTCDay() + 7 - THURSDAY) % 7
  return dateKeyOf(utcMs - daysSinceThursday * DAY_MS)
}

/**
 * 목요일부터 **딱 이레**(사용자 지정 딱 7일만).
 *
 * 월간 격자와 달리 채울 빈칸이 없다. 주는 언제나 이레이므로 격자 높이가 흔들릴 일도 없다.
 * 그래서 **이레가 전부 `inPeriod: true`** 다: 달을 걸치는 주에도 앞뒤 달 이라는 개념이 없다.
 */
export function buildResetWeek(weekStartDateKey: string): CalendarWeek {
  const startMs = Date.parse(`${weekStartDateKey}T00:00:00Z`)
  const days: CalendarDay[] = []
  for (let index = 0; index < 7; index += 1) {
    const utcMs = startMs + index * DAY_MS
    days.push({
      dateKey: dateKeyOf(utcMs),
      day: new Date(utcMs).getUTCDate(),
      inPeriod: true,
    })
  }
  return days
}
