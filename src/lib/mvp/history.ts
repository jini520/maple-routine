/**
 * 메이플 ID 한 개의 MVP 등급 이력 계산. 이력은 `(시작 날짜, 등급)` 줄의 목록이고 한 등급은 다음 줄의 전날까지 이어진다.
 * 고치는 함수는 시작 날짜 오름차순의 새 배열을 돌려준다.
 */
import { shiftDateKey } from '../calendar'
import type { MvpGradeKey } from './grades'

export interface MvpGradeEntry {
  /** 등급을 달성한 날, `YYYY-MM-DD`. 아무 요일이나 된다 */
  startDate: string
  grade: MvpGradeKey
}

function sorted(history: readonly MvpGradeEntry[]): MvpGradeEntry[] {
  return [...history].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
}

/** 그 날의 등급. 첫 줄보다 앞이면 `null`. */
export function mvpGradeAt(history: readonly MvpGradeEntry[], dateKey: string): MvpGradeKey | null {
  let found: MvpGradeEntry | null = null
  for (const entry of history) {
    if (entry.startDate <= dateKey && (found === null || entry.startDate > found.startDate)) found = entry
  }
  return found?.grade ?? null
}

/** 그 날부터 새 등급을 적은 이력. 같은 날의 줄은 덮는다. */
export function setGradeFrom(history: readonly MvpGradeEntry[], startDate: string, grade: MvpGradeKey): MvpGradeEntry[] {
  const rest = history.filter((entry) => entry.startDate !== startDate)
  return sorted([...rest, { startDate, grade }])
}

/** 그 줄을 지운 이력. */
export function removeGradeEntry(history: readonly MvpGradeEntry[], startDate: string): MvpGradeEntry[] {
  return sorted(history.filter((entry) => entry.startDate !== startDate))
}

/** 한 줄을 옮기고 등급을 바꾼 이력. */
export function moveGradeEntry(
  history: readonly MvpGradeEntry[],
  from: string,
  to: string,
  grade: MvpGradeKey,
): MvpGradeEntry[] {
  return setGradeFrom(
    history.filter((entry) => entry.startDate !== from),
    to,
    grade,
  )
}

/** 기록 고치기에서 그 줄을 옮길 수 있는 날. 앞 기록 다음 날부터 다음 기록 전날까지다. */
export function editDateBounds(
  history: readonly MvpGradeEntry[],
  startDate: string,
  floorDate: string,
  today: string,
): { min: string; max: string } {
  const ordered = sorted(history)
  const index = ordered.findIndex((entry) => entry.startDate === startDate)
  const previous = ordered[index - 1]
  const next = ordered[index + 1]
  const min = previous === undefined ? floorDate : shiftDateKey(previous.startDate, 1)
  return { min: min < floorDate ? floorDate : min, max: next === undefined ? today : shiftDateKey(next.startDate, -1) }
}
