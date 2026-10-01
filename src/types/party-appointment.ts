/** 파티원 한 칸. 다른 사용자의 캐릭터는 앱이 모르므로 이름 글자이고, 내 캐릭터는 `ocid` 로 가리킨다. */
export type PartyMember = { type: 'text'; name: string } | { type: 'character'; ocid: string }

/**
 * 반복 약속에서 `이 주만 적용하기` 로 그 주 회차만 바꾼 것. 키는 그 주의 목요일 dateKey.
 *
 * 수정 시트에서 보스 · 알림도 고칠 수 있어 그 주의 약속 전체를 담는다.
 */
export interface PartyAppointmentException {
  type: 'override'
  dateKey: string
  timeKst: string
  durationMinutes: number
  bosses: PartyAppointmentBoss[]
  leadMinutes: number | null
}

export type PartyAppointmentSchedule =
  | { type: 'once'; dateKey: string }
  /** `weekday` 는 0(일)~6(토). `untilWeek` 는 그 주를 포함하지 않는다 */
  | { type: 'weekly'; weekday: number; fromWeek: string; untilWeek: string | null }

/** 약속이 도는 보스 한 판. 캐릭터 · 보스 · 난이도는 판마다 다를 수 있다 */
export interface PartyAppointmentBoss {
  bossKey: string
  difficulty: string
  /** 이 판에 가는 내 캐릭터 */
  ocid: string
}

export interface PartyAppointment {
  id: string
  /** 1개 이상. 도는 차례대로 */
  bosses: PartyAppointmentBoss[]
  members: PartyMember[]
  /** 시작. KST `HH:mm` */
  timeKst: string
  /** 시작부터 종료까지의 분. 1 이상이라 종료가 다음 날이어도 더하기만 하면 된다 */
  durationMinutes: number
  /** 몇 분 전에 알릴지. `null` 은 알림 없음, 0 은 정각 */
  leadMinutes: number | null
  schedule: PartyAppointmentSchedule
  exceptions: Record<string, PartyAppointmentException>
}

/** 한 주에 펼친 약속 하나 */
export interface PartyAppointmentOccurrence {
  appointment: PartyAppointment
  /** KST 날짜 `YYYY-MM-DD` */
  dateKey: string
  timeKst: string
  startsAt: Date
  endsAt: Date
  /** 이 회차가 도는 보스와 알림. 이 주만 바꾼 회차는 약속과 다르다 */
  bosses: PartyAppointmentBoss[]
  leadMinutes: number | null
  /** 이 주만 바꾼 회차 */
  overridden: boolean
}
