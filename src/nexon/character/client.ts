import type {
  CharacterBasicProfile,
  MapleAccount,
  NexonCharacterBasicResponse,
  NexonCharacterListResponse,
} from '../../types'
import { NexonNoCharacterError } from '../errors'
import { requestJson } from '../http'
import { normalizeCharacterBasic, normalizeCharacterList } from './normalize'

/** ocid 없이 API 키만으로 부를 수 있는 유일한 경로. 키 단계 프로브도 이것을 쓴다. */
export const CHARACTER_LIST_PATH = '/maplestory/v1/character/list'

export async function fetchCharacterList(apiKey: string): Promise<MapleAccount[]> {
  const wire = await requestJson<NexonCharacterListResponse>(CHARACTER_LIST_PATH, apiKey)
  return normalizeCharacterList(wire)
}

/**
 * **정규화보다 먼저 서는 문.** 이 응답에 캐릭터가 있는가.
 *
 * 판정을 `normalizeCharacterBasic` 에 두지 않는 이유는 자리가 다르기 때문이다. 정규화는 값을
 * 옮기는 일이고 **이 응답은 캐릭터가 아니다** 는 에러 어휘의 일이다. 그리고 순서가 뒤집히면
 * `normalizeExpRate(null)` 이 `null.trim()` 에서 TypeError 를 내는데, 그 예외는
 * `toScheduleSyncError` 가 `network`(재시도하면 풀린다)로 접어 영영 안 풀릴 실패를 재시도로
 * 만든다.
 *
 * `character_name` 하나만 본다. 남겨진 ocid 는 전 필드가 `null` 이라 어느 것으로 봐도 같고,
 * 이름은 이 프로필의 존재 이유이자 없으면 캐시에 심을 수도 없는 값이다
 * (`saveCharacterProfile` 이 빈 이름을 거른다).
 */
function hasCharacter(wire: NexonCharacterBasicResponse): boolean {
  return wire.character_name !== null && wire.character_name !== undefined
}

export async function fetchCharacterBasic(apiKey: string, ocid: string): Promise<CharacterBasicProfile> {
  const wire = await requestJson<NexonCharacterBasicResponse>(
    `/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}`,
    apiKey,
  )
  if (!hasCharacter(wire)) {
    throw new NexonNoCharacterError('이 ocid 에는 더 이상 캐릭터가 없습니다')
  }
  return normalizeCharacterBasic(wire)
}
