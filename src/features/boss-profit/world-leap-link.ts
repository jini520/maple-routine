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
import { linkCharacterWorldLeap } from '../../storage/character-world-leaps'

/** 옛 ocid 를 새 ocid 에 잇고, 처음 이을 때만 옛 캐릭터 설정을 새 캐릭터로 복사한다. */
export async function linkWorldLeap(fromOcid: string, toOcid: string, now: Date): Promise<void> {
  const linkedAt = now.toISOString()
  if (await linkCharacterWorldLeap(fromOcid, toOcid, linkedAt)) {
    await copyMissingBossPartySettings(fromOcid, toOcid, linkedAt)
  }
}
