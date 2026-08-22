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
