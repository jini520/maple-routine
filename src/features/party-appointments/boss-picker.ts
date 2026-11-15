/**
 * 보스 추가 화면이 늘어놓는 보스와 고르기 규칙.
 *
 * 한 캐릭터의 보스를 `파티` · `스케줄러` · `모든 보스` 셋으로 나눈다. 파티는 스케줄러에 등록된 보스 중
 * 파티 인원이 둘 이상이거나 분배 비율을 적어 둔 것이다. 같은 캐릭터 · 같은 보스는 한 번만 고르고,
 * 같은 보스라도 다른 캐릭터로는 따로 고른다.
 */
import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import { BOSS_ENTRIES, activeDifficultiesOf, bossCycleOf } from '../../lib/boss/bosses'
import { resetWeekStartOf, shiftDateKey } from '../../lib/calendar'
import type { BossPartyShareColumns } from '../../storage/boss-party-settings'
import type { PartyAppointment, PartyAppointmentBoss } from '../../types/party-appointment'
import { partySizeKey } from '../boss-scheduler/store'
import { occurrencesInWeek } from './occurrences'

/** 고르기 전 타일 하나. 고르면 이 난이도로 들어간다 */
export interface PickerTile {
  bossKey: string
  difficulty: string
}

export interface BossPickerSections {
  party: PickerTile[]
  scheduler: PickerTile[]
  all: PickerTile[]
}

export interface BossPickerInput {
  ocid: string
  /** 그 캐릭터의 스케줄러 등록 보스. 스케줄러 화면이 세우는 차례 그대로 */
  registered: readonly PickerTile[]
  partySizes: Readonly<Record<string, number>>
  partyShares: Readonly<Record<string, BossPartyShareColumns>>
  /** 유효 기간 판정의 시계. 없으면 지금이다. */
  now?: Date
}

export function bossPickerSections(input: BossPickerInput): BossPickerSections {
  const isParty = (tile: PickerTile): boolean => {
    const key = partySizeKey(input.ocid, tile.bossKey, tile.difficulty)
    return (input.partySizes[key] ?? 1) >= 2 || input.partyShares[key]?.crystalMyShare != null
  }
  const registeredDifficulty = new Map(input.registered.map((tile) => [tile.bossKey, tile.difficulty]))
  // 시즌 보스는 뺀다. 등록돼 있으면 위 두 묶음에 이미 선다. 유효 기간이 끝난 보스도 뺀다.
  const now = input.now ?? new Date()
  const all = BOSS_ENTRIES.flatMap((entry): PickerTile[] => {
    if (entry.section === 'eventWeekly') return []
    const difficulties = activeDifficultiesOf(entry.key, getCurrentBossProfitPeriod(entry.cycle, now).periodKey, now)
    if (difficulties.length === 0) return []
    // 표의 난이도는 낮은 것부터라 끝이 가장 높다.
    return [{ bossKey: entry.key, difficulty: registeredDifficulty.get(entry.key) ?? difficulties[difficulties.length - 1] ?? '' }]
  })
  return {
    party: input.registered.filter(isParty),
    scheduler: input.registered.filter((tile) => !isParty(tile)),
    all,
  }
}

export function isPicked(picked: readonly PartyAppointmentBoss[], ocid: string, bossKey: string): boolean {
  return picked.some((boss) => boss.ocid === ocid && boss.bossKey === bossKey)
}

/** 안 고른 보스는 그 캐릭터로 뒤에 붙이고, 고른 보스는 뺀다 */
export function togglePick(
  picked: readonly PartyAppointmentBoss[],
  ocid: string,
  tile: PickerTile,
): PartyAppointmentBoss[] {
  if (isPicked(picked, ocid, tile.bossKey)) {
    return picked.filter((boss) => !(boss.ocid === ocid && boss.bossKey === tile.bossKey))
  }
  return [...picked, { bossKey: tile.bossKey, difficulty: tile.difficulty, ocid }]
}

export interface ScheduledBossInput {
  appointments: readonly PartyAppointment[]
  ocid: string
  /** 시트의 시작 날짜. 주간 보스는 이 날짜가 든 리셋 주, 월간 보스는 이 날짜가 든 달을 본다 */
  dateKey: string
  /** 고치는 약속. 빼지 않으면 원래 들어 있던 보스가 모두 등록됨이 된다 */
  excludeId?: string
}

/**
 * 그 캐릭터로 같은 기간의 다른 약속에 이미 든 보스. 보스 추가 타일의 `등록됨` 이 쓴다.
 *
 * @example scheduledBossKeys({ appointments, ocid, dateKey: draft.startDateKey, excludeId: editing?.id })
 */
export function scheduledBossKeys(input: ScheduledBossInput): Set<string> {
  const others = input.appointments.filter((appointment) => appointment.id !== input.excludeId)
  const result = new Set<string>()
  const collect = (bosses: readonly PartyAppointmentBoss[], monthly: boolean): void => {
    for (const boss of bosses) {
      if (boss.ocid === input.ocid && (bossCycleOf(boss.bossKey) === 'monthly') === monthly) result.add(boss.bossKey)
    }
  }

  for (const occurrence of occurrencesInWeek(others, resetWeekStartOf(input.dateKey))) {
    collect(occurrence.bosses, false)
  }
  // 월간 보스는 그 달에 걸친 주를 모두 펼친 뒤 날짜가 그 달인 회차만 센다. 리셋 주는 두 달에 걸칠 수 있다.
  const month = input.dateKey.slice(0, 7)
  for (let week = resetWeekStartOf(`${month}-01`); week <= `${month}-31`; week = shiftDateKey(week, 7)) {
    for (const occurrence of occurrencesInWeek(others, week)) {
      if (occurrence.dateKey.startsWith(month)) collect(occurrence.bosses, true)
    }
  }
  return result
}
