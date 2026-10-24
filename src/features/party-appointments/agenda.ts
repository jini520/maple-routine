/**
 * 보드 목록의 재료. 한 주의 회차를 약속이 있는 날로 묶고 종료 시각을 글자로 만든다.
 */
import type { PartyAppointmentOccurrence } from '../../types/party-appointment'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export interface AgendaDay {
  dateKey: string
  /** 시작 순 */
  occurrences: PartyAppointmentOccurrence[]
}

/** 약속이 있는 날만 날짜 순으로 */
export function agendaDays(occurrences: readonly PartyAppointmentOccurrence[]): AgendaDay[] {
  const sorted = [...occurrences].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const days: AgendaDay[] = []
  for (const occurrence of sorted) {
    const last = days[days.length - 1]
    if (last !== undefined && last.dateKey === occurrence.dateKey) last.occurrences.push(occurrence)
    else days.push({ dateKey: occurrence.dateKey, occurrences: [occurrence] })
  }
  return days
}

/**
 * 종료 시각 글자. 자정을 넘어도 시계 그대로 적는다(`00:30`). 시작보다 이른 종료라 다음 날로 읽힌다.
 */
export function endClockOf(occurrence: PartyAppointmentOccurrence): string {
  const [hour = 0, minute = 0] = occurrence.timeKst.split(':').map(Number)
  const duration = Math.round((occurrence.endsAt.getTime() - occurrence.startsAt.getTime()) / MINUTE_MS)
  const end = hour * 60 + minute + duration
  const clock = end % (24 * 60)
  return `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`
}

/**
 * 보는 주에서 이번 주로 돌아가는 방향. 지난 주면 앞(`≫`), 다음 주 이후면 뒤(`≪`), 이번 주면 없다.
 *
 * @param weekStart 보는 리셋 주 첫날
 * @param thisWeek 이번 리셋 주 첫날
 */
export function thisWeekJumpOf(weekStart: string, thisWeek: string): 'forward' | 'back' | 'none' {
  if (weekStart === thisWeek) return 'none'
  return weekStart < thisWeek ? 'forward' : 'back'
}

/** 시작까지 남은 시간. `n일 뒤` · `n시간 m분 뒤` · `n분 뒤` · 1분 미만은 `곧` */
export function remainingLabelOf(remainingMs: number): string {
  if (remainingMs < MINUTE_MS) return '곧'
  if (remainingMs >= DAY_MS) return `${Math.floor(remainingMs / DAY_MS)}일 뒤`
  const hours = Math.floor(remainingMs / HOUR_MS)
  const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS)
  if (hours === 0) return `${minutes}분 뒤`
  return minutes === 0 ? `${hours}시간 뒤` : `${hours}시간 ${minutes}분 뒤`
}
