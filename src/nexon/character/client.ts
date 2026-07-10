import type { MapleAccount, NexonCharacterListResponse } from '../../types'
import { requestJson } from '../http'
import { normalizeCharacterList } from './normalize'

export async function fetchCharacterList(apiKey: string): Promise<MapleAccount[]> {
  const wire = await requestJson<NexonCharacterListResponse>('/maplestory/v1/character/list', apiKey)
  return normalizeCharacterList(wire)
}
