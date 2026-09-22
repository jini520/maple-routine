/**
 * 메이플 ID 한 개의 MVP 등급 이력 계산. 이력은 `(시작 주의 목요일, 등급)` 줄의 목록이고,
 * 고치는 함수는 시작 날짜 오름차순의 새 배열을 돌려준다.
 */
import { resetWeekStartOf, shiftDateKey } from '../calendar'
import type { MvpGradeKey } from './grades'

export interface MvpGradeEntry {
  /** 그 주의 목요일, `YYYY-MM-DD` */
  startDate: string
  /** `null` 은 등급 없음. 첫 기록 앞에 끼워 넣은 기간을 닫는 줄 */
  grade: MvpGradeKey | null
}

function sorted(history: readonly MvpGradeEntry[]): MvpGradeEntry[] {
  return [...history].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
}

/** 맨 앞의 등급 없음 줄을 뗀 이력. 그 앞도 등급이 없어 뜻이 없는 줄이다. */
function withoutLeadingEmpty(history: MvpGradeEntry[]): MvpGradeEntry[] {
  const first = history.findIndex((entry) => entry.grade !== null)
  return first === -1 ? [] : history.slice(first)
}

/** 그 날이 든 주의 등급. 첫 줄보다 앞이거나 등급 없음 줄 안이면 `null`. */
export function mvpGradeAt(history: readonly MvpGradeEntry[], dateKey: string): MvpGradeKey | null {
  const week = resetWeekStartOf(dateKey)
  let found: MvpGradeEntry | null = null
  for (const entry of history) {
    if (entry.startDate <= week && (found === null || entry.startDate > found.startDate)) found = entry
  }
  return found?.grade ?? null
}

/** 그 주부터 새 등급을 적은 이력. 같은 주의 줄은 덮는다. */
export function setGradeFrom(history: readonly MvpGradeEntry[], startDate: string, grade: MvpGradeKey | null): MvpGradeEntry[] {
  const rest = history.filter((entry) => entry.startDate !== startDate)
  return withoutLeadingEmpty(sorted([...rest, { startDate, grade }]))
}

/**
 * 닫힌 기간 하나를 끼워 넣은 이력. 종료 주 다음 주에 감싸던 등급(없으면 등급 없음)을 다시 적는다.
 * 기간 안에 기록이 없는지는 부르는 쪽의 달력이 막는다.
 *
 * @param startWeek 시작 주의 목요일
 * @param endWeek 종료 주의 목요일
 */
export function insertPeriod(
  history: readonly MvpGradeEntry[],
  startWeek: string,
  endWeek: string,
  grade: MvpGradeKey,
): MvpGradeEntry[] {
  const resumeWeek = shiftDateKey(endWeek, 7)
  const entries = history.filter((entry) => entry.startDate !== startWeek)
  if (!entries.some((entry) => entry.startDate === resumeWeek)) {
    entries.push({ startDate: resumeWeek, grade: mvpGradeAt(history, resumeWeek) })
  }
  entries.push({ startDate: startWeek, grade })
  return withoutLeadingEmpty(sorted(entries))
}

/**
 * 기간 추가의 가장 늦은 종료 주. 시작 주 뒤 첫 기록의 앞 주와 지난주 가운데 이른 쪽.
 *
 * @param thisWeek 이번 주의 목요일. 이번 주가 든 기간은 등급 변경의 몫
 */
export function insertEndLimit(history: readonly MvpGradeEntry[], startWeek: string, thisWeek: string): string {
  const lastWeek = shiftDateKey(thisWeek, -7)
  const next = sorted(history).find((entry) => entry.startDate > startWeek)
  if (next === undefined) return lastWeek
  const beforeNext = shiftDateKey(next.startDate, -7)
  return beforeNext < lastWeek ? beforeNext : lastWeek
}

/** 그 줄을 지운 이력. */
export function removeGradeEntry(history: readonly MvpGradeEntry[], startDate: string): MvpGradeEntry[] {
  return withoutLeadingEmpty(sorted(history.filter((entry) => entry.startDate !== startDate)))
}
