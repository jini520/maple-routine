import type { NexonCredential } from '../../types/auth'
import type {
  CharacterBasicProfile,
  MapleAccount,
  NexonCharacterBasicResponse,
  NexonCharacterListResponse,
  NexonDatedCharacterBasicResponse,
} from '../../types'
import { NexonBadRequestError, NexonNoCharacterError } from '../errors'
import { requestJson } from '../http'
import { normalizeCharacterBasic, normalizeCharacterList } from './normalize'

/** ocid 없이 API 키만으로 부를 수 있는 유일한 경로. 키 단계 프로브도 이것을 쓴다. */
export const CHARACTER_LIST_PATH = '/maplestory/v1/character/list'

/**
 * @param worldKeyOf API 월드 이름에서 월드 key. 앱은 `lib/world/worlds` 의 `worldKeyOfApiName` 을 넘긴다
 */
export async function fetchCharacterList(
  credential: NexonCredential,
  worldKeyOf: (apiName: string) => string | null,
): Promise<MapleAccount[]> {
  const wire = await requestJson<NexonCharacterListResponse>(CHARACTER_LIST_PATH, credential)
  return normalizeCharacterList(wire, worldKeyOf)
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

export async function fetchCharacterBasic(
  credential: NexonCredential,
  ocid: string,
  worldKeyOf: (apiName: string) => string | null,
): Promise<CharacterBasicProfile> {
  const wire = await requestJson<NexonCharacterBasicResponse>(
    `/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}`,
    credential,
  )
  if (!hasCharacter(wire)) {
    throw new NexonNoCharacterError('이 ocid 에는 더 이상 캐릭터가 없습니다')
  }
  return normalizeCharacterBasic(wire, worldKeyOf)
}

/** 그날의 이름 · 월드 · 만든 날. 그날 그 ocid 에 값이 없으면 셋 다 `null` 이다. */
export interface DatedCharacterBasic {
  name: string | null
  /** 월드 이름 원문 */
  worldName: string | null
  /** 만든 날의 KST `YYYY-MM-DD` */
  createdDate: string | null
}

const NO_VALUE: DatedCharacterBasic = { name: null, worldName: null, createdDate: null }

/**
 * 그날의 `character/basic`. 강화 줄의 이름을 그날 그 이름이었던 캐릭터에 붙일 때 쓴다.
 *
 * 리프 전 ocid(400 `OPENAPI00003`)와 조회할 수 없는 날짜(400 `OPENAPI00004`)는 그날 값이 없는 것과 같게 돌려준다. 던지면
 * 부르는 쪽이 다시 받을 실패로 여겨 같은 날을 끝없이 다시 부른다.
 *
 * @param dateKey KST `YYYY-MM-DD`. 오늘은 안 된다. 오늘의 이름은 `character/list` 가 준다
 */
export async function fetchCharacterBasicOn(
  credential: NexonCredential,
  ocid: string,
  dateKey: string,
): Promise<DatedCharacterBasic> {
  let wire: NexonDatedCharacterBasicResponse
  try {
    wire = await requestJson<NexonDatedCharacterBasicResponse>(
      `/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}&date=${dateKey}`,
      credential,
    )
  } catch (error) {
    if (error instanceof NexonBadRequestError && (error.code === 'OPENAPI00003' || error.code === 'OPENAPI00004')) {
      return NO_VALUE
    }
    throw error
  }
  if (wire.character_name === null || wire.character_name === undefined) return NO_VALUE
  return {
    name: wire.character_name,
    worldName: wire.world_name ?? null,
    // `+09:00` 이 붙은 시각이라 앞 열 자가 곧 KST 날짜다.
    createdDate: typeof wire.character_date_create === 'string' ? wire.character_date_create.slice(0, 10) : null,
  }
}
