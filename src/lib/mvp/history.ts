/**
 * 메이플 ID 한 개의 MVP 등급 이력 계산. 이력은 `(시작 주의 목요일, 등급)` 줄의 목록이고,
 * 고치는 함수는 시작 날짜 오름차순의 새 배열을 돌려준다.
 */
import { formatDayLabel, formatMonthDay, resetWeekStartOf, shiftDateKey } from '../calendar'
import { findMvpGrade, type MvpGradeKey } from './grades'

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

/** 한 줄을 옮기고 등급을 바꾼 이력. 지우고 다시 적으면 맨 앞 등급 없음 줄이 중간에 떨어져 나가 한 번에 바꾼다. */
export function moveGradeEntry(
  history: readonly MvpGradeEntry[],
  from: string,
  to: string,
  grade: MvpGradeKey | null,
): MvpGradeEntry[] {
  return setGradeFrom(
    history.filter((entry) => entry.startDate !== from),
    to,
    grade,
  )
}

/** 기록 고치기에서 그 줄을 옮길 수 있는 주. 앞뒤 기록을 넘지 않는다. */
export function editWeekBounds(
  history: readonly MvpGradeEntry[],
  startDate: string,
  floorWeek: string,
  thisWeek: string,
): { min: string; max: string } {
  const ordered = sorted(history)
  const index = ordered.findIndex((entry) => entry.startDate === startDate)
  const previous = ordered[index - 1]
  const next = ordered[index + 1]
  const min = previous === undefined ? floorWeek : shiftDateKey(previous.startDate, 7)
  return { min: min < floorWeek ? floorWeek : min, max: next === undefined ? thisWeek : shiftDateKey(next.startDate, -7) }
}

/** 등급 변경의 가장 이른 주. 지금 기록이 시작된 주이고, 가장 이른 주보다 앞으로 가지 않는다. */
export function changeWeekMin(history: readonly MvpGradeEntry[], floorWeek: string): string {
  const last = sorted(history).at(-1)
  return last === undefined || last.startDate < floorWeek ? floorWeek : last.startDate
}

/** 기간 추가의 시작 주로 고를 수 있나. 가장 이른 주부터 지난주까지이고 기록이 있는 주는 뺀다. */
export function insertStartSelectable(
  history: readonly MvpGradeEntry[],
  week: string,
  floorWeek: string,
  thisWeek: string,
): boolean {
  return week >= floorWeek && week < thisWeek && !history.some((entry) => entry.startDate === week)
}

function hasFinalConsonant(word: string): boolean {
  const code = word.charCodeAt(word.length - 1)
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0
}

/** `레드로` · `블랙으로`. ㄹ 받침은 `로` 다(`일반` 은 ㄴ 이라 `으로`). */
function withRo(word: string): string {
  const code = word.charCodeAt(word.length - 1)
  const rieul = (code - 0xac00) % 28 === 8
  return `${word}${hasFinalConsonant(word) && !rieul ? '으로' : '로'}`
}

/**
 * 기간 추가 시트의 뜻 한 줄. 적용 기간과 종료 주 다음 주부터 이어지는 등급을 말한다.
 *
 * @example insertPeriodText(history, '2026-07-02', '2026-07-09', 'red')
 * // 7월 2일 (목)부터 7월 15일 (수)까지 레드로 계산해요. 7월 16일부터는 다시 실버예요.
 */
export function insertPeriodText(
  history: readonly MvpGradeEntry[],
  startWeek: string,
  endWeek: string,
  grade: MvpGradeKey,
): string {
  const resumeWeek = shiftDateKey(endWeek, 7)
  const at = history.find((entry) => entry.startDate === resumeWeek)
  // 그 주에 기록이 있으면 그 기록이 시작되는 것이고, 없으면 감싸던 등급이 다시 이어진다.
  const again = at === undefined ? '다시 ' : ''
  const resumeGrade = at === undefined ? mvpGradeAt(history, resumeWeek) : at.grade
  const resumeName = findMvpGrade(resumeGrade)?.name ?? null
  const resume =
    resumeName === null
      ? `${again}등급이 없어요.`
      : `${again}${resumeName}${hasFinalConsonant(resumeName) ? '이에요' : '예요'}.`
  return (
    `${formatDayLabel(startWeek)}부터 ${formatDayLabel(shiftDateKey(endWeek, 6))}까지 ` +
    `${withRo(findMvpGrade(grade)?.name ?? '')} 계산해요. ${formatMonthDay(resumeWeek)}부터는 ${resume}`
  )
}
