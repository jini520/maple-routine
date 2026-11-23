/**
 * 파티 약속 목록. Preferences 의 JSON 한 칸.
 *
 * 저장은 서버 `party_appointments` 와 같은 칸 이름이다. 시각은 `time`, 알림은 `alarmMinutesBefore`, 주는 주차 값(`W202647`),
 * 보스는 난이도 줄 id 다. 화면은 지금 칸 이름과 목요일 날짜 · 보스 key 를 들어서, 그 사이를 여기서 바꾼다.
 *
 * 깨진 JSON 은 빈 목록으로 읽고, 모양이 틀린 항목은 그 항목만 버린다. 한 항목 때문에 목록 전체를
 * 잃으면 사용자가 적은 약속이 한꺼번에 사라진다.
 */
import { bossDifficultyIdOf, bossDifficultyOfId } from '../lib/boss/bosses'
import { periodCodeOf, periodKeyOfCode } from '../lib/boss/period-code'
import { randomUuid } from '../native/uuid'
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import { whenRecordsReleased } from './record-hold'
import { enqueueChangedPreferenceRecords } from './server-sync-queue'
import type {
  PartyAppointment,
  PartyAppointmentBoss,
  PartyAppointmentException,
  PartyAppointmentSchedule,
} from '../types/party-appointment'

/** 저장된 보스 한 판. 캐릭터는 ocid 다(서버는 캐릭터 줄 id). */
export interface StoredPartyAppointmentBoss {
  bossDifficultyId: string
  ocid: string
}

/** 저장된 주별 예외. 열쇠는 그 주의 주차 값이다. */
export interface StoredPartyAppointmentException {
  date: string
  time: string
  durationMinutes: number
  bosses: StoredPartyAppointmentBoss[]
  alarmMinutesBefore: number | null
}

export type StoredPartyAppointmentSchedule =
  | { type: 'once'; date: string }
  | { type: 'weekly'; weekday: number; fromWeekCode: string; untilWeekCode: string | null }

/** 저장된 약속 하나. */
export interface StoredPartyAppointment {
  id: string
  bosses: StoredPartyAppointmentBoss[]
  time: string
  durationMinutes: number
  alarmMinutesBefore: number | null
  schedule: StoredPartyAppointmentSchedule
  exceptions: Record<string, StoredPartyAppointmentException>
  memo?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function isAlarm(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

function isStoredBoss(value: unknown): value is StoredPartyAppointmentBoss {
  return isRecord(value) && typeof value.bossDifficultyId === 'string' && typeof value.ocid === 'string'
}

function isStoredBossList(value: unknown): value is StoredPartyAppointmentBoss[] {
  return Array.isArray(value) && value.length > 0 && value.every(isStoredBoss)
}

function isStoredException(value: unknown): value is StoredPartyAppointmentException {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    typeof value.time === 'string' &&
    isDuration(value.durationMinutes) &&
    isStoredBossList(value.bosses) &&
    isAlarm(value.alarmMinutesBefore)
  )
}

function isStoredSchedule(value: unknown): value is StoredPartyAppointmentSchedule {
  if (!isRecord(value)) return false
  if (value.type === 'once') return typeof value.date === 'string'
  return (
    value.type === 'weekly' &&
    typeof value.weekday === 'number' &&
    typeof value.fromWeekCode === 'string' &&
    (value.untilWeekCode === null || typeof value.untilWeekCode === 'string')
  )
}

function isStoredAppointment(value: unknown): value is StoredPartyAppointment {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isStoredBossList(value.bosses) &&
    typeof value.time === 'string' &&
    isDuration(value.durationMinutes) &&
    isAlarm(value.alarmMinutesBefore) &&
    isStoredSchedule(value.schedule) &&
    isRecord(value.exceptions) &&
    Object.values(value.exceptions).every(isStoredException) &&
    (value.memo === undefined || typeof value.memo === 'string')
  )
}

/** 게임 데이터에 없는 난이도 줄 id 의 판은 빠진다. */
function toBosses(stored: readonly StoredPartyAppointmentBoss[]): PartyAppointmentBoss[] {
  return stored.flatMap((boss) => {
    const owner = bossDifficultyOfId(boss.bossDifficultyId)
    return owner === null ? [] : [{ bossKey: owner.bossKey, difficulty: owner.difficulty, ocid: boss.ocid }]
  })
}

function toSchedule(stored: StoredPartyAppointmentSchedule): PartyAppointmentSchedule | null {
  if (stored.type === 'once') return { type: 'once', dateKey: stored.date }
  const fromWeek = periodKeyOfCode(stored.fromWeekCode)
  const untilWeek = stored.untilWeekCode === null ? null : periodKeyOfCode(stored.untilWeekCode)
  if (fromWeek === null || (stored.untilWeekCode !== null && untilWeek === null)) return null
  return { type: 'weekly', weekday: stored.weekday, fromWeek, untilWeek }
}

/**
 * 저장된 약속을 화면이 드는 모양으로. 남은 보스가 없거나 주차 값의 꼴이 다르면 `null` 이다. 보스가 다 빠진 예외는 그 예외만
 * 빠지고, 그 주는 약속의 보스로 돈다.
 */
function toAppointment(stored: StoredPartyAppointment): PartyAppointment | null {
  const bosses = toBosses(stored.bosses)
  const schedule = toSchedule(stored.schedule)
  if (bosses.length === 0 || schedule === null) return null
  const exceptions: Record<string, PartyAppointmentException> = {}
  for (const [weekCode, exception] of Object.entries(stored.exceptions)) {
    const weekStart = periodKeyOfCode(weekCode)
    const exceptionBosses = toBosses(exception.bosses)
    if (weekStart === null || exceptionBosses.length === 0) continue
    exceptions[weekStart] = {
      dateKey: exception.date,
      timeKst: exception.time,
      durationMinutes: exception.durationMinutes,
      bosses: exceptionBosses,
      leadMinutes: exception.alarmMinutesBefore,
    }
  }
  return {
    id: stored.id,
    bosses,
    timeKst: stored.time,
    durationMinutes: stored.durationMinutes,
    leadMinutes: stored.alarmMinutesBefore,
    schedule,
    exceptions,
    ...(stored.memo === undefined ? {} : { memo: stored.memo }),
  }
}

/** 게임 데이터에 없는 보스 · 난이도는 적을 수 없어 던진다. */
function storedBossesOf(bosses: readonly PartyAppointmentBoss[]): StoredPartyAppointmentBoss[] {
  return bosses.map((boss) => {
    const bossDifficultyId = bossDifficultyIdOf(boss.bossKey, boss.difficulty)
    if (bossDifficultyId === null) throw new Error(`게임 데이터에 없는 보스 난이도다: ${boss.bossKey} ${boss.difficulty}`)
    return { bossDifficultyId, ocid: boss.ocid }
  })
}

/** 목요일이 아닌 주는 주차 값으로 적을 수 없어 던진다. */
function weekCodeFor(weekStart: string): string {
  const code = periodCodeOf(weekStart)
  if (code === null || !code.startsWith('W')) throw new Error(`주의 시작이 목요일이 아니다: ${weekStart}`)
  return code
}

/**
 * 화면이 든 약속을 저장하는 모양으로.
 *
 * @param appointment 화면이 든 약속
 */
export function storedPartyAppointmentOf(appointment: PartyAppointment): StoredPartyAppointment {
  const { schedule } = appointment
  return {
    id: appointment.id,
    bosses: storedBossesOf(appointment.bosses),
    time: appointment.timeKst,
    durationMinutes: appointment.durationMinutes,
    alarmMinutesBefore: appointment.leadMinutes,
    schedule:
      schedule.type === 'once'
        ? { type: 'once', date: schedule.dateKey }
        : {
            type: 'weekly',
            weekday: schedule.weekday,
            fromWeekCode: weekCodeFor(schedule.fromWeek),
            untilWeekCode: schedule.untilWeek === null ? null : weekCodeFor(schedule.untilWeek),
          },
    exceptions: Object.fromEntries(
      Object.entries(appointment.exceptions).map(([weekStart, exception]) => [
        weekCodeFor(weekStart),
        {
          date: exception.dateKey,
          time: exception.timeKst,
          durationMinutes: exception.durationMinutes,
          bosses: storedBossesOf(exception.bosses),
          alarmMinutesBefore: exception.leadMinutes,
        },
      ]),
    ),
    ...(appointment.memo === undefined ? {} : { memo: appointment.memo }),
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * 약속 목록. 옛 설치본의 `시각 + 난수` id 는 uuid 로 바꿔 한 번 다시 저장한다.
 *
 * 예약해 둔 알림은 약속 id 로 만든 id 라, 다음 재조정이 옛 알림을 취소하고 새 id 로 다시 예약한다.
 */
export async function getPartyAppointments(): Promise<PartyAppointment[]> {
  await whenRecordsReleased()
  const raw = await preferences.get(STORAGE_KEYS.partyAppointments)
  if (raw === null) return []
  let appointments: PartyAppointment[]
  try {
    const parsed: unknown = JSON.parse(raw)
    appointments = Array.isArray(parsed)
      ? parsed.flatMap((stored) => (isStoredAppointment(stored) ? (toAppointment(stored) ?? []) : []))
      : []
  } catch {
    return []
  }
  if (appointments.every((one) => UUID.test(one.id))) return appointments
  const upgraded = appointments.map((one) => (UUID.test(one.id) ? one : { ...one, id: randomUuid() }))
  await setPartyAppointments(upgraded)
  return upgraded
}

/**
 * 약속마다 대기 줄 하나. uuid 인 id 만 넣는다. 서버 줄 id 는 uuid 라서, 옛 설치본의 id 를 올리면 거절만 다섯 번 받는다. 옛 id 는
 * 읽을 때 uuid 로 바뀐다.
 */
function recordsOf(stored: readonly unknown[]): Map<string, unknown> {
  return new Map(
    stored.flatMap((one) => (isRecord(one) && typeof one.id === 'string' && UUID.test(one.id) ? [[one.id, one] as const] : [])),
  )
}

/** 저장된 그대로의 목록. 없거나 깨졌으면 빈 목록이다. */
async function readStored(): Promise<unknown[]> {
  const raw = await preferences.get(STORAGE_KEYS.partyAppointments)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 더하거나 고치거나 지운 약속을 대기 표에 넣는다. */
export async function setPartyAppointments(appointments: readonly PartyAppointment[]): Promise<void> {
  await whenRecordsReleased()
  const before = await readStored()
  const stored = appointments.map(storedPartyAppointmentOf)
  await preferences.set(STORAGE_KEYS.partyAppointments, JSON.stringify(stored))
  await enqueueChangedPreferenceRecords('partyAppointments', recordsOf(before), recordsOf(stored))
}

/**
 * 월드 리프한 캐릭터가 가는 보스 판을 새 ocid 로 바꾸는 함수. 이 주만 바꾼 회차도 바꾼다. 바꾼 것이 있으면 참이다.
 */
export async function movePartyAppointmentsToOcid(fromOcid: string, toOcid: string): Promise<boolean> {
  const appointments = await getPartyAppointments()
  let changed = false
  const moveBosses = (bosses: PartyAppointmentBoss[]): PartyAppointmentBoss[] =>
    bosses.map((boss) => {
      if (boss.ocid !== fromOcid) return boss
      changed = true
      return { ...boss, ocid: toOcid }
    })
  const next = appointments.map((appointment) => ({
    ...appointment,
    bosses: moveBosses(appointment.bosses),
    exceptions: Object.fromEntries(
      Object.entries(appointment.exceptions).map(([dateKey, exception]) => [
        dateKey,
        { ...exception, bosses: moveBosses(exception.bosses) },
      ]),
    ),
  }))
  if (!changed) return false
  await setPartyAppointments(next)
  return true
}
