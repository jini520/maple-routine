/**
 * 보스 추가 화면이 늘어놓는 보스와 고르기 규칙.
 *
 * 한 캐릭터의 보스를 `파티` · `스케줄러` · `모든 보스` 셋으로 나눈다. 파티는 스케줄러에 등록된 보스 중
 * 파티 인원이 둘 이상이거나 분배 비율을 적어 둔 것이다. 같은 캐릭터 · 같은 보스는 한 번만 고르고,
 * 같은 보스라도 다른 캐릭터로는 따로 고른다.
 */
import { BOSS_ENTRIES } from '../../lib/boss/bosses'
import type { BossPartyShareColumns } from '../../storage/boss-party-settings'
import type { PartyAppointmentBoss } from '../../types/party-appointment'
import { partySizeKey } from '../boss-scheduler/store'

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
}

export function bossPickerSections(input: BossPickerInput): BossPickerSections {
  const isParty = (tile: PickerTile): boolean => {
    const key = partySizeKey(input.ocid, tile.bossKey, tile.difficulty)
    return (input.partySizes[key] ?? 1) >= 2 || input.partyShares[key]?.crystalMyShare != null
  }
  const registeredDifficulty = new Map(input.registered.map((tile) => [tile.bossKey, tile.difficulty]))
  // 시즌 보스와 출시 전 보스는 뺀다. 등록돼 있으면 위 두 묶음에 이미 선다.
  const all = BOSS_ENTRIES.filter((entry) => entry.section !== 'eventWeekly' && entry.status !== 'unreleased').map(
    (entry): PickerTile => ({
      bossKey: entry.key,
      // 표의 난이도는 낮은 것부터라 끝이 가장 높다.
      difficulty: registeredDifficulty.get(entry.key) ?? entry.difficulties[entry.difficulties.length - 1] ?? '',
    }),
  )
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
