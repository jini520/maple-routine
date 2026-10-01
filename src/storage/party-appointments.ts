/**
 * 파티 약속 목록. Preferences 의 JSON 한 칸.
 *
 * 깨진 JSON 은 빈 목록으로 읽고, 모양이 틀린 항목은 그 항목만 버린다. 한 항목 때문에 목록 전체를
 * 잃으면 사용자가 적은 약속이 한꺼번에 사라진다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import type {
  PartyAppointment,
  PartyAppointmentBoss,
  PartyAppointmentException,
  PartyMember,
} from '../types/party-appointment'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMember(value: unknown): value is PartyMember {
  if (!isRecord(value)) return false
  if (value.type === 'text') return typeof value.name === 'string'
  if (value.type === 'character') return typeof value.ocid === 'string'
  return false
}

function isException(value: unknown): value is PartyAppointmentException {
  return (
    isRecord(value) &&
    value.type === 'override' &&
    typeof value.dateKey === 'string' &&
    typeof value.timeKst === 'string' &&
    isDuration(value.durationMinutes) &&
    isBossList(value.bosses) &&
    (value.leadMinutes === null || typeof value.leadMinutes === 'number')
  )
}

function isBossList(value: unknown): value is PartyAppointmentBoss[] {
  return Array.isArray(value) && value.length > 0 && value.every(isBoss)
}

function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function isBoss(value: unknown): value is PartyAppointmentBoss {
  return (
    isRecord(value) &&
    typeof value.bossKey === 'string' &&
    typeof value.difficulty === 'string' &&
    typeof value.ocid === 'string'
  )
}

function isSchedule(value: unknown): value is PartyAppointment['schedule'] {
  if (!isRecord(value)) return false
  if (value.type === 'once') return typeof value.dateKey === 'string'
  return (
    value.type === 'weekly' &&
    typeof value.weekday === 'number' &&
    typeof value.fromWeek === 'string' &&
    (value.untilWeek === null || typeof value.untilWeek === 'string')
  )
}

function isAppointment(value: unknown): value is PartyAppointment {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isBossList(value.bosses) &&
    Array.isArray(value.members) &&
    value.members.every(isMember) &&
    typeof value.timeKst === 'string' &&
    isDuration(value.durationMinutes) &&
    (value.leadMinutes === null || typeof value.leadMinutes === 'number') &&
    isSchedule(value.schedule) &&
    isRecord(value.exceptions) &&
    Object.values(value.exceptions).every(isException)
  )
}

export async function getPartyAppointments(): Promise<PartyAppointment[]> {
  const raw = await preferences.get(STORAGE_KEYS.partyAppointments)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isAppointment) : []
  } catch {
    return []
  }
}

export async function setPartyAppointments(appointments: readonly PartyAppointment[]): Promise<void> {
  await preferences.set(STORAGE_KEYS.partyAppointments, JSON.stringify(appointments))
}
