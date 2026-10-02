/**
 * 약속의 보스를 캐릭터별로 묶는 순수 함수. 묶음은 캐릭터를 처음 고른 순서로 서고, 순서는 묶음 안에서만 바뀐다.
 *
 * 저장되는 `bosses` 는 묶음 순서대로 펼친 한 줄이라, 화면과 알림 문구(첫 보스)가 같은 순서를 본다.
 */
import type { PartyAppointmentBoss } from '../../types/party-appointment'
import { moveItem } from './draft'

export interface CharacterBossGroup {
  ocid: string
  bosses: PartyAppointmentBoss[]
}

/** 캐릭터를 처음 고른 순서로 묶는다 */
export function groupBossesByCharacter(bosses: readonly PartyAppointmentBoss[]): CharacterBossGroup[] {
  const groups: CharacterBossGroup[] = []
  for (const boss of bosses) {
    const group = groups.find((one) => one.ocid === boss.ocid)
    if (group === undefined) groups.push({ ocid: boss.ocid, bosses: [boss] })
    else group.bosses.push(boss)
  }
  return groups
}

/** 묶음 순서대로 펼친 한 줄 */
export function orderByCharacter(bosses: readonly PartyAppointmentBoss[]): PartyAppointmentBoss[] {
  return groupBossesByCharacter(bosses).flatMap((group) => group.bosses)
}

/**
 * 한 캐릭터 묶음 안에서 보스 하나를 옮긴 한 줄. 다른 묶음은 그대로다.
 *
 * @param from 묶음 안의 차례
 * @param to 묶음 안의 차례
 */
export function moveWithinGroup(
  bosses: readonly PartyAppointmentBoss[],
  ocid: string,
  from: number,
  to: number,
): PartyAppointmentBoss[] {
  return groupBossesByCharacter(bosses).flatMap((group) =>
    group.ocid === ocid ? moveItem(group.bosses, from, to) : group.bosses,
  )
}
