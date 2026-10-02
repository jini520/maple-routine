/**
 * 등록 시트가 들고 있는 저장 전 약속과 그것을 다루는 순수 함수.
 *
 * 날짜는 시작 날짜 하나만 든다. 약속은 하루를 넘겨 길어지지 않아, 종료가 시작보다 이르면 다음 날이다.
 * 저장할 때 종료를 시작부터의 분(`durationMinutes`)으로 접는다.
 */
import { resetWeekStartOf, shiftDateKey } from '../../lib/calendar'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import type { PartyAppointment, PartyAppointmentBoss } from '../../types/party-appointment'

export interface AppointmentDraft {
  startDateKey: string
  /** 그 날 0시부터의 분 */
  startMinutes: number
  /** 그 날 0시부터의 분. 시작보다 이르면 다음 날 */
  endMinutes: number
  /** 도는 차례대로 */
  bosses: PartyAppointmentBoss[]
  alarmOn: boolean
  /** 알림을 꺼도 고른 값을 들고 있어, 다시 켜면 그 값으로 돌아온다 */
  leadMinutes: number
  repeats: boolean
}

/** 시각 휠 · 알림 휠의 분 단위 */
export const MINUTE_STEP = 5
export const DEFAULT_DURATION_MINUTES = 30
export const DEFAULT_LEAD_MINUTES = 10
/** 알약으로 고르는 알림 분. 그 밖의 값은 `직접` 이다 */
export const LEAD_PRESETS: readonly number[] = [0, 10, 30, 60]

const DAY_MINUTES = 24 * 60
const MINUTE_MS = 60_000
const KST_OFFSET_MINUTES = 9 * 60

/**
 * 날짜 · 분에 분을 더한 자리. 하루를 넘거나 모자라면 날짜를 옮긴다.
 *
 * @example shiftMinutes('2026-10-01', 23 * 60 + 30, 60) // { dateKey: '2026-10-02', minutes: 30 }
 */
export function shiftMinutes(
  dateKey: string,
  minutes: number,
  delta: number,
): { dateKey: string; minutes: number } {
  const total = minutes + delta
  const days = Math.floor(total / DAY_MINUTES)
  return { dateKey: shiftDateKey(dateKey, days), minutes: total - days * DAY_MINUTES }
}

/** 반복 약속의 요일 세그먼트 순서. 리셋 주(목 → 수)라 보드 · 기간 스테퍼와 같다 */
export const RESET_WEEKDAYS: readonly number[] = [4, 5, 6, 0, 1, 2, 3]

/** 날짜의 요일(0 = 일) */
export function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay()
}

/**
 * 그 요일 · 시각의 다음 회차 날짜(KST). 반복 약속 추가는 이 날짜의 리셋 주부터 선다.
 *
 * 오늘이 그 요일이어도 시작 시각이 지금 이하면 다음 주다.
 */
export function nextOccurrenceDateKey(weekday: number, startMinutes: number, now: Date): string {
  const todayKey = getCurrentKstDateKey(now)
  const nowMinutes = Math.floor((now.getTime() / MINUTE_MS + KST_OFFSET_MINUTES) % DAY_MINUTES)
  const ahead = (weekday - weekdayOf(todayKey) + 7) % 7
  return shiftDateKey(todayKey, ahead === 0 && startMinutes <= nowMinutes ? 7 : ahead)
}

/**
 * 리셋 주 안의 그 요일 날짜. 반복 약속의 앞으로 모두 수정이 그 주부터 바뀌도록 쓴다.
 *
 * @param weekStart 리셋 주 첫날(목요일)
 */
export function dateInWeek(weekStart: string, weekday: number): string {
  return shiftDateKey(weekStart, RESET_WEEKDAYS.indexOf(weekday))
}

/**
 * 시트를 처음 열 때. 시작은 지금에서 가장 가까운 다음 정각(지금이 정각이면 그 시각), 종료는 그 30분 뒤
 *
 * @param repeats ＋ 에서 고른 갈래. 매주 반복이면 true
 */
export function initialDraft(now: Date, repeats = false): AppointmentDraft {
  const todayKey = getCurrentKstDateKey(now)
  const kstMinutes = Math.floor((now.getTime() / MINUTE_MS + KST_OFFSET_MINUTES) % DAY_MINUTES)
  const nextHour = Math.ceil(kstMinutes / 60) * 60
  const start = shiftMinutes(todayKey, 0, nextHour)
  return {
    startDateKey: start.dateKey,
    startMinutes: start.minutes,
    endMinutes: endAfter(start.minutes),
    bosses: [],
    alarmOn: false,
    leadMinutes: DEFAULT_LEAD_MINUTES,
    repeats,
  }
}

/** 시작의 기본 길이 뒤 종료. 하루를 넘으면 다음 날 시각이다 */
function endAfter(startMinutes: number): number {
  return (startMinutes + DEFAULT_DURATION_MINUTES) % DAY_MINUTES
}

/** 시작을 바꾼 약속. 종료는 고른 값이 있어도 늘 시작 + 30분으로 다시 선다 */
export function withStart(draft: AppointmentDraft, startDateKey: string, startMinutes: number): AppointmentDraft {
  return { ...draft, startDateKey, startMinutes, endMinutes: endAfter(startMinutes) }
}

/** 시작부터 종료까지의 분. 종료가 시작보다 이르면 다음 날로 세고, 같으면 0 이다 */
export function durationOf(draft: AppointmentDraft): number {
  return (draft.endMinutes - draft.startMinutes + DAY_MINUTES) % DAY_MINUTES
}

/** 종료가 다음 날인가. 시작보다 이른 종료다 */
export function endsNextDay(draft: AppointmentDraft): boolean {
  return draft.endMinutes < draft.startMinutes
}

export function canSave(draft: AppointmentDraft): boolean {
  return draft.bosses.length > 0 && durationOf(draft) > 0
}

export function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** `정각` · `10분 전` · `1시간 전` · `1시간 15분 전` */
export function formatLead(leadMinutes: number): string {
  if (leadMinutes === 0) return '정각'
  const hours = Math.floor(leadMinutes / 60)
  const minutes = leadMinutes % 60
  const parts = [hours > 0 ? `${hours}시간` : '', minutes > 0 ? `${minutes}분` : ''].filter(Boolean)
  return `${parts.join(' ')} 전`
}

export function toAppointment(draft: AppointmentDraft, id: string): PartyAppointment {
  return {
    id,
    bosses: draft.bosses,
    members: [],
    timeKst: formatClock(draft.startMinutes),
    durationMinutes: durationOf(draft),
    leadMinutes: draft.alarmOn ? draft.leadMinutes : null,
    schedule: draft.repeats
      ? {
          type: 'weekly',
          weekday: new Date(`${draft.startDateKey}T00:00:00Z`).getUTCDay(),
          fromWeek: resetWeekStartOf(draft.startDateKey),
          untilWeek: null,
        }
      : { type: 'once', dateKey: draft.startDateKey },
    exceptions: {},
  }
}

/** `from` 자리의 칸을 `to` 자리로 옮긴 새 목록 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}

/**
 * 새 약속의 id. `crypto.randomUUID` 는 Hermes 에 없다. 기기 안에서만 겹치지 않으면 되는 키라
 * 시각과 난수로 충분하다.
 */
export function newAppointmentId(now: Date): string {
  return `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
