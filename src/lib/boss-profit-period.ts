import type { BossCycle } from '../types'
import { getMostRecentWeeklyResetKst } from './reset-clock'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 스케줄러 API(`date` 파라미터)로 조회 가능한 최소 날짜(사용자 실측, 2026-07-14, ADR-023).
 * 이 API 자체가 신규 도입돼 그 이전 데이터가 존재하지 않는 고정 하한선이다 — 오늘 날짜 기준으로
 * 매일 밀려나는 롤링 윈도우가 아니므로, 시간이 지나도 이 값을 다시 계산할 필요가 없다.
 */
export const MIN_SCHEDULER_DATE = '2026-06-25'

export interface BossProfitPeriod {
  periodKey: string // 저장/조회 시 unique key로 쓰이는 안정적인 문자열
  label: string // 화면 표시용 ("이번 주" | "이번 달")
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toKstWallClock(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS)
}

/**
 * 보스 수익 기록의 unique key(ocid+boss+difficulty+기간)에 쓰이는 기간을 계산한다.
 *
 * - weekly: 가장 최근 주간 리셋(KST 목요일 00:00, lib/reset-clock)의 KST 날짜를 periodKey로 쓴다.
 * - monthly: 월간 보스(검은마법사)의 실제 Nexon 서버 리셋 시각은 아직 실측 확인되지 않았다
 *   (PRD.md "확인이 필요한 사항" #36). 확정 전까지는 KST 기준 매월 1일 00:00을 리셋 경계로
 *   "가정"한다 — 실측 결과가 다르게 나오면 이 monthly 분기만 수정하면 되도록 격리해뒀다.
 */
export function getCurrentBossProfitPeriod(cycle: BossCycle, now: Date): BossProfitPeriod {
  if (cycle === 'weekly') {
    const resetKst = toKstWallClock(getMostRecentWeeklyResetKst(now))
    const periodKey = `${resetKst.getUTCFullYear()}-${pad(resetKst.getUTCMonth() + 1)}-${pad(resetKst.getUTCDate())}`
    return { periodKey, label: '이번 주' }
  }

  const nowKst = toKstWallClock(now)
  const periodKey = `${nowKst.getUTCFullYear()}-${pad(nowKst.getUTCMonth() + 1)}`
  return { periodKey, label: '이번 달' }
}

function parseWeeklyPeriodKey(periodKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = periodKey.split('-').map(Number)
  return { year, month, day }
}

function parseMonthlyPeriodKey(periodKey: string): { year: number; month: number } {
  const [year, month] = periodKey.split('-').map(Number)
  return { year, month }
}

function formatWeeklyPeriodKey(utcMs: number): string {
  const date = new Date(utcMs)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function formatMonthlyPeriodKey(year: number, month: number): string {
  return `${year}-${pad(month)}`
}

/** periodKey를 한 칸 이동한다. weekly는 ±7일, monthly는 ±1개월. */
export function getAdjacentPeriodKey(
  cycle: BossCycle,
  periodKey: string,
  direction: 'prev' | 'next',
): string {
  const sign = direction === 'next' ? 1 : -1

  if (cycle === 'weekly') {
    const { year, month, day } = parseWeeklyPeriodKey(periodKey)
    const shiftedMs = Date.UTC(year, month - 1, day) + sign * 7 * 24 * 60 * 60 * 1000
    return formatWeeklyPeriodKey(shiftedMs)
  }

  const { year, month } = parseMonthlyPeriodKey(periodKey)
  const zeroBasedMonth = month - 1 + sign
  const shiftedYear = year + Math.floor(zeroBasedMonth / 12)
  const shiftedMonth = ((zeroBasedMonth % 12) + 12) % 12
  return formatMonthlyPeriodKey(shiftedYear, shiftedMonth + 1)
}

/**
 * periodKey가 now 기준 "현재" 기간(getCurrentBossProfitPeriod의 periodKey)보다 미래가 아닌지 확인한다.
 * true면 이 기간에서 next 방향 네비게이션 버튼을 비활성화해야 한다.
 */
export function isLatestPeriod(cycle: BossCycle, periodKey: string, now: Date): boolean {
  const currentPeriodKey = getCurrentBossProfitPeriod(cycle, now).periodKey
  return periodKey >= currentPeriodKey
}

export interface BossProfitPeriodLabel {
  primary: string // "이번 주" | "지난 주" | "이번 달" | "지난 달" | "{M}월 {N}주차" | "{YYYY}년 {M}월"
  secondary: string // weekly: "{M}월 {D}일 ~ {M}월 {D}일" (그 주의 시작~끝 날짜), monthly: "{YYYY}년 {M}월" — primary와 무관하게 항상 정확한 날짜를 담는다
}

/**
 * monthPeriodKey(형식 "YYYY-MM")가 속한 달 안에 리셋(목요일)이 있는 weekly periodKey 목록을 오름차순으로 반환한다.
 * "주가 두 달에 걸치면 그 주가 시작하는 목요일이 속한 달 기준"이라는 규칙은 이미 weekly periodKey 정의(리셋 목요일의
 * KST 날짜) 자체에 반영되어 있으므로, 이 함수는 단순히 그 달의 모든 목요일 날짜를 나열하면 된다.
 */
export function getWeeklyPeriodKeysInMonth(monthPeriodKey: string): string[] {
  const { year, month } = parseMonthlyPeriodKey(monthPeriodKey)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const result: string[] = []
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
    if (dayOfWeek === 4) {
      result.push(formatWeeklyPeriodKey(Date.UTC(year, month - 1, day)))
    }
  }
  return result
}

/** 기간 라벨을 계산한다. now 기준 최근 2개 기간(이번/지난)만 상대 표현을 쓰고, 그 이전은 절대 표현을 쓴다. */
export function formatBossProfitPeriodLabel(
  cycle: BossCycle,
  periodKey: string,
  now: Date,
): BossProfitPeriodLabel {
  const currentPeriodKey = getCurrentBossProfitPeriod(cycle, now).periodKey

  if (cycle === 'weekly') {
    const { year, month, day } = parseWeeklyPeriodKey(periodKey)
    const startMs = Date.UTC(year, month - 1, day)
    const endMs = startMs + 6 * 24 * 60 * 60 * 1000
    const end = new Date(endMs)
    const secondary = `${month}월 ${day}일 ~ ${end.getUTCMonth() + 1}월 ${end.getUTCDate()}일`

    const prevPeriodKey = getAdjacentPeriodKey('weekly', currentPeriodKey, 'prev')
    if (periodKey === currentPeriodKey) {
      return { primary: '이번 주', secondary }
    }
    if (periodKey === prevPeriodKey) {
      return { primary: '지난 주', secondary }
    }

    const weekKeysInMonth = getWeeklyPeriodKeysInMonth(`${year}-${pad(month)}`)
    const weekIndex = weekKeysInMonth.indexOf(periodKey)
    return { primary: `${month}월 ${weekIndex + 1}주차`, secondary }
  }

  const { year, month } = parseMonthlyPeriodKey(periodKey)
  const secondary = `${year}년 ${month}월`

  const prevPeriodKey = getAdjacentPeriodKey('monthly', currentPeriodKey, 'prev')
  if (periodKey === currentPeriodKey) {
    return { primary: '이번 달', secondary }
  }
  if (periodKey === prevPeriodKey) {
    return { primary: '지난 달', secondary }
  }

  return { primary: secondary, secondary }
}

/**
 * 과거 기간 백필(스케줄러 API의 date 파라미터 조회) 시 사용할 조회 날짜(YYYY-MM-DD)를 계산한다.
 * 그 기간의 완료 현황이 가장 온전히 반영되는 시점 — 다음 리셋 직전(그 기간의 마지막 날) — 을 쓴다.
 * weekly: periodKey(리셋 목요일) + 6일. monthly: periodKey가 속한 달의 마지막 날.
 */
export function getBackfillQueryDate(cycle: BossCycle, periodKey: string): string {
  if (cycle === 'weekly') {
    const { year, month, day } = parseWeeklyPeriodKey(periodKey)
    const endMs = Date.UTC(year, month - 1, day) + 6 * 24 * 60 * 60 * 1000
    return formatWeeklyPeriodKey(endMs)
  }

  const { year, month } = parseMonthlyPeriodKey(periodKey)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${pad(month)}-${pad(lastDay)}`
}

/**
 * periodKey에서 한 단계 더 과거로 이동하면 MIN_SCHEDULER_DATE 이전이라 백필 자체가 불가능한
 * 기간에 도달하는지 확인한다. true면 이 기간에서 prev 방향 네비게이션 버튼을 비활성화해야 한다.
 * (weekly에 적용하면 2026-06-25 이전 주로 이동을 막고, monthly에 적용하면 그 달이 통째로
 * MIN_SCHEDULER_DATE 이전인 달 — 2026-05 이전 — 로 이동을 막는다. 이미 진입한 기간 자체가
 * 부분적으로만 조회 불가능한 경우(예: 2026-06월, 1~3주차만 데이터 없음)는 막지 않는다.)
 */
export function isEarliestNavigablePeriod(cycle: BossCycle, periodKey: string): boolean {
  const prevPeriodKey = getAdjacentPeriodKey(cycle, periodKey, 'prev')
  return getBackfillQueryDate(cycle, prevPeriodKey) < MIN_SCHEDULER_DATE
}
