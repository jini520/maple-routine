import type {
  CharacterBasicProfile,
  MapleAccount,
  NexonCharacterBasicResponse,
  NexonCharacterListResponse,
} from '../../types'
import { requestJson } from '../http'
import { normalizeCharacterBasic, normalizeCharacterList } from './normalize'

export async function fetchCharacterList(apiKey: string): Promise<MapleAccount[]> {
  const wire = await requestJson<NexonCharacterListResponse>('/maplestory/v1/character/list', apiKey)
  return normalizeCharacterList(wire)
}

export async function fetchCharacterBasic(apiKey: string, ocid: string): Promise<CharacterBasicProfile> {
  const wire = await requestJson<NexonCharacterBasicResponse>(
    `/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}`,
    apiKey,
  )
  return normalizeCharacterBasic(wire)
}
