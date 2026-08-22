/**
 * 달력 한 달의 **격자**를 만든다 — 가계부 캘린더가 쓰는 순수 계산([[ADR-169]] 결정 7).
 *
 * ## 축이 게임이 아니라 달력이다
 *
 * 보스 수익의 `periodKey` 는 **목요일 리셋** 기준이지만(`lib/boss-profit-period.ts`) 이 격자는
 * 그것과 무관하다 — 지출은 게임 리셋과 상관없이 일어나고([[ADR-166]] 결정 4), 주는 **일요일**에
 * 시작한다([[ADR-169]] 결정 8). 두 축은 한 그룹 안에서 공존하고, 합치는 것은 #239 의 일이다.
 *
 * ## 왜 타임존이 «지금» 에만 걸리나
 *
 * `getCurrentMonthKey` 만 KST 를 본다(`reset-clock` 이 그 규칙을 이미 들고 있다). 나머지는 전부
 * **문자열·UTC 필드 산술**이라 기기 타임존이 개입할 자리가 없다 — `'2026-08'` 이 며칠로 이루어져
 * 있는가는 어디서 보든 같은 값이다. 여기서 로컬 게터(`getMonth` 등)를 쓰면 같은 달이 기기마다
 * 다른 격자로 그려진다.
 */

import { getCurrentKstDateKey } from './reset-clock'

const DAY_MS = 24 * 60 * 60 * 1000

/** 일요일에서 시작한다([[ADR-169]] 결정 8) — 한국 달력의 관습이다. */
export const WEEKDAY_LABELS: readonly string[] = ['일', '월', '화', '수', '목', '금', '토']

export interface CalendarDay {
  /** `YYYY-MM-DD`. 표식·기록을 붙이는 키다. */
  readonly dateKey: string
  readonly day: number
  /** 보고 있는 달의 날짜인가. 앞뒤 달로 채운 칸은 `false` — 흐리게 그린다. */
  readonly inMonth: boolean
}

export type CalendarWeek = readonly CalendarDay[]

/**
 * 하루치 금액 — 칸이 그리는 두 줄([[ADR-169]] 정정 1).
 *
 * **`expenseMeso` 는 메소 지출만이다.** 지출은 통화가 셋인데([[ADR-166]] 결정 1) 앱이 환율을
 * 만들지 않으므로 캐시·메포를 이 숫자에 섞을 수 없다. 통화가 섞인 날을 칸에서 어떻게 알릴지는
 * **지출 기록이 붙을 때** 정한다(그 전에 정하면 빈 화면을 보고 정하는 것이 된다).
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

/** 해를 넘긴다 — `Date.UTC` 가 월 인덱스 밖의 값을 정규화한다. */
export function getAdjacentMonthKey(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey)
  const moved = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}`
}

/** 「2026년 8월」 — 0 을 채우지 않는다(읽는 글이지 정렬 키가 아니다). */
export function formatMonthLabel(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey)
  return `${year}년 ${month}월`
}

/** 「8월 23일 (일)」 — 고른 날의 상세 머리글. */
export function formatDayLabel(dateKey: string): string {
  const utcMs = Date.parse(`${dateKey}T00:00:00Z`)
  const date = new Date(utcMs)
  const weekday = WEEKDAY_LABELS[date.getUTCDay()]
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 (${weekday})`
}

/**
 * 「몇 주 × 7칸」. 달 경계의 빈칸을 **앞뒤 달 날짜로 채운다**([[ADR-169]] 결정 7) — 빈 칸으로 두면
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
      inMonth: date.getUTCMonth() === month - 1 && date.getUTCFullYear() === year,
    })
  }

  return weeks
}

/**
 * 칸의 **진하기** — 0(안 칠함) ~ `HEAT_LEVELS`([[ADR-169]] 정정 1, 레퍼런스의 열지도).
 *
 * 그 달 안에서 **상대적**이다. 절대 금액으로 자르면 초반 캐릭터의 달은 전부 흐리고 만렙의 달은
 * 전부 진해서 «많이 번 날» 이 안 보인다 — 열지도가 말하려는 것이 그 대비다.
 *
 * 0 과 «가장 작은 단계» 를 가르는 것이 계약이다: 1 메소라도 있으면 칸이 칠해져야 «적은 날» 과
 * «안 적은 날» 이 구분된다([[ADR-057]] 의 태도).
 */
export const HEAT_LEVELS = 4

export function heatLevel(amount: number, monthMax: number): number {
  if (amount <= 0 || monthMax <= 0) return 0
  return Math.min(HEAT_LEVELS, Math.ceil((amount / monthMax) * HEAT_LEVELS))
}

/**
 * 진하기의 기준선 — **이번 달 칸만** 센다. 앞뒤 달로 채운 칸(결정 7)이 기준을 정해 버리면 이번
 * 달의 대비가 엉뚱해진다: 지난달에 큰 날이 하나 있으면 이번 달이 통째로 흐려진다.
 */
export function monthIncomeMax(weeks: readonly CalendarWeek[], amounts: CalendarAmounts): number {
  let max = 0
  for (const week of weeks) {
    for (const day of week) {
      if (!day.inMonth) continue
      max = Math.max(max, amounts[day.dateKey]?.incomeMeso ?? 0)
    }
  }
  return max
}
