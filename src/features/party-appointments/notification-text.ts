/**
 * 파티 약속 알림의 제목 · 본문.
 *
 * 제목은 누가 가는지만 말하고, 본문이 언제 · 무엇을 · 얼마 남았는지를 말한다. 보스가 여럿이면 첫 보스만 적고
 * 나머지는 `외 n마리` 로 접는다(알림 한 줄에 다 안 들어간다).
 */
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { bossAliasOf } from '../../lib/boss/bosses'
import type { BossDifficulty } from '../../types'
import type { PartyAppointmentOccurrence } from '../../types/party-appointment'
import { formatLead } from './draft'

/**
 * 회차 하나의 문구. 이 주만 바꾼 회차는 그 주의 시각 · 보스 · 알림으로 적는다.
 *
 * @param names 추적 중인 캐릭터의 `ocid → 이름`
 * @example notificationText(occurrence, names) // { title: '낟낟 파티 보스 스케줄이 곧 시작해요', body: '21:00 낟낟 하드 림보 외 2마리 파티 10분 전이에요' }
 */
export function notificationText(
  occurrence: PartyAppointmentOccurrence,
  names: ReadonlyMap<string, string>,
): { title: string; body: string } {
  const { timeKst } = occurrence
  const [first, ...rest] = occurrence.bosses
  const characters = [...new Set(occurrence.bosses.map((boss) => boss.ocid))]
  const firstName = names.get(characters[0] ?? '') ?? ''
  const otherCharacters = characters.length - 1
  const title = `${firstName}${otherCharacters > 0 ? ` 외 ${otherCharacters}캐릭터` : ''} 파티 보스 스케줄이 곧 시작해요`

  const boss =
    first === undefined
      ? ''
      : `${names.get(first.ocid) ?? ''} ${DIFFICULTY_NAME[first.difficulty as BossDifficulty] ?? first.difficulty} ${bossAliasOf(first.bossKey, first.bossKey)}`
  const more = rest.length > 0 ? ` 외 ${rest.length}마리` : ''
  const lead = occurrence.leadMinutes ?? 0
  const when = lead === 0 ? '파티가 지금 시작해요' : `파티 ${formatLead(lead)}이에요`
  return { title, body: `${timeKst} ${boss}${more} ${when}` }
}
