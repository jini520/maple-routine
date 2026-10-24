/**
 * 시간표 카드와 보드 열 머리의 재료. 한 주의 회차를 0 ~ 24시 줄 일곱 개(목 → 수)로 나눈다.
 *
 * 축은 24시간 고정이다. 회차에 맞춰 줄이면 접었다 펼칠 때 막대가 움직인다.
 */
import { shiftDateKey } from '../../lib/calendar'
import type { PartyAppointmentOccurrence } from '../../types/party-appointment'
import { kstStartsAt } from './occurrences'

const DAY_MS = 24 * 60 * 60_000

export type TimelineTone = 'next' | 'ended' | 'normal'

export interface TimelineSegment {
  /** 회차 열쇠. 막대를 누르면 목록에서 이 회차 카드를 찾는다 */
  key: string
  /** 그 날 0시부터의 비율(0 ~ 1) */
  from: number
  to: number
  tone: TimelineTone
  occurrence: PartyAppointmentOccurrence
}

export interface TimelineDay {
  dateKey: string
  segments: TimelineSegment[]
  /** 지금 시각의 비율. 오늘 줄에만 있다. 다른 요일의 같은 시각은 지금이 아니다 */
  nowAt: number | null
}

/** 한 주 안에서 회차를 가리키는 열쇠. 반복 약속은 주마다 회차가 하나다 */
export function occurrenceKeyOf(occurrence: PartyAppointmentOccurrence): string {
  return `${occurrence.appointment.id}:${occurrence.dateKey}`
}

function toneOf(occurrence: PartyAppointmentOccurrence, nowMs: number, nextKey: string | null): TimelineTone {
  if (occurrence.endsAt.getTime() <= nowMs) return 'ended'
  return occurrenceKeyOf(occurrence) === nextKey ? 'next' : 'normal'
}

/**
 * 한 주의 시간표.
 *
 * 자정을 넘는 회차는 24시에서 자르고 남은 부분을 다음 날 줄 맨 앞에 잇는다. 수요일에서 넘는 부분은
 * 다음 주의 목요일 줄이라 그리지 않는다.
 *
 * @param weekStart 리셋 주 첫날(목요일)
 * @param nextKey 앞으로 가장 먼저 시작할 회차의 열쇠. 다른 주에 있으면 이 주에는 주황 막대가 없다
 */
export function weekTimeline(
  occurrences: readonly PartyAppointmentOccurrence[],
  weekStart: string,
  nowMs: number,
  nextKey: string | null,
): TimelineDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const dateKey = shiftDateKey(weekStart, index)
    const dayStart = kstStartsAt(dateKey, '00:00').getTime()
    const dayEnd = dayStart + DAY_MS
    const segments = [...occurrences]
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .flatMap((occurrence): TimelineSegment[] => {
        const start = Math.max(occurrence.startsAt.getTime(), dayStart)
        const end = Math.min(occurrence.endsAt.getTime(), dayEnd)
        if (end <= start) return []
        return [
          {
            key: occurrenceKeyOf(occurrence),
            from: (start - dayStart) / DAY_MS,
            to: (end - dayStart) / DAY_MS,
            tone: toneOf(occurrence, nowMs, nextKey),
            occurrence,
          },
        ]
      })
    const nowAt = nowMs >= dayStart && nowMs < dayEnd ? (nowMs - dayStart) / DAY_MS : null
    return { dateKey, segments, nowAt }
  })
}
