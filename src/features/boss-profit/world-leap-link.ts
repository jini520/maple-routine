/**
 * 월드 리프로 갈린 두 ocid 를 **잇는 순간**의 일.
 *
 * 연결은 리프한 기간에 같은 처치가 두 ocid 로 한 번씩 선 기록을 짝짓는 데 쓰인다. 이어지는 순간
 * 옛 캐릭터의 보스별 파티원 수 설정을 한 번 복사한다. 짝이 없는 캐릭터도 다음 주부터 새 캐릭터
 * 기록이 옛 설정을 읽어야 해서다.
 *
 * 저장소만 부른다. 리프 모달 스토어가 이 파일을 불러도 모듈 순환이 안 생긴다.
 */
import { copyMissingBossPartySettings } from '../../storage/boss-party-settings'
import { getCharacterProfilesByNames } from '../../storage/character-profiles'
import { linkCharacterWorldLeap } from '../../storage/character-world-leaps'
import type { MapleCharacter } from '../../types'

/** 옛 ocid 를 새 ocid 에 잇고, 처음 이을 때만 옛 캐릭터 설정을 새 캐릭터로 복사한다. */
export async function linkWorldLeap(fromOcid: string, toOcid: string, now: Date): Promise<void> {
  const linkedAt = now.toISOString()
  if (await linkCharacterWorldLeap(fromOcid, toOcid, linkedAt)) {
    await copyMissingBossPartySettings(fromOcid, toOcid, linkedAt)
  }
}

/**
 * 모달을 안 거친 리프를 **이름·직업**으로 잇는다. `character/list` 응답을 받은 자리에서 부른다.
 *
 * 캐릭터 이름은 게임 전체에서 하나라 이름·직업 말고는 조건을 안 건다. 방향은 목록이 정한다. 목록에 없는
 * 스냅샷이 옛 캐릭터이고, 목록의 같은 이름·직업이 새 캐릭터다. 둘 다 목록에 있으면 판단할 근거가 없어
 * 안 잇는다. 옛 캐릭터 후보가 추적 목록이 아닌 것은 사용자가 옛 캐릭터를 `✕` 로 뺀 장면이 겨냥이라서다.
 *
 * @param roster `character/list` 가 준 전 계정 캐릭터
 */
export async function linkWorldLeapsByNameAndJob(roster: readonly MapleCharacter[], now: Date): Promise<void> {
  const names = [...new Set(roster.map((character) => character.name))]
  if (names.length === 0) {
    return
  }

  const listed = new Set(roster.map((character) => character.ocid))
  for (const profile of await getCharacterProfilesByNames(names)) {
    if (listed.has(profile.ocid) || profile.jobClass === null) continue

    const matches = roster.filter(
      (character) => character.name === profile.name && character.jobClass === profile.jobClass,
    )
    if (matches.length !== 1) continue

    await linkWorldLeap(profile.ocid, matches[0]!.ocid, now)
  }
}
