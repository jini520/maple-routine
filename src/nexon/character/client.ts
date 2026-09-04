import type {
  CharacterBasicProfile,
  MapleAccount,
  NexonCharacterBasicResponse,
  NexonCharacterListResponse,
} from '../../types'
import { requestJson } from '../http'
import { normalizeCharacterBasic, normalizeCharacterList } from './normalize'

/** ocid 없이 API 키만으로 부를 수 있는 유일한 경로. 키 단계 프로브도 이것을 쓴다. */
export const CHARACTER_LIST_PATH = '/maplestory/v1/character/list'

export async function fetchCharacterList(apiKey: string): Promise<MapleAccount[]> {
  const wire = await requestJson<NexonCharacterListResponse>(CHARACTER_LIST_PATH, apiKey)
  return normalizeCharacterList(wire)
}

export async function fetchCharacterBasic(apiKey: string, ocid: string): Promise<CharacterBasicProfile> {
  const wire = await requestJson<NexonCharacterBasicResponse>(
    `/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}`,
    apiKey,
  )
  return normalizeCharacterBasic(wire)
}
