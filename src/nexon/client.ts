import type {
  MapleAccount,
  NexonCharacterListResponse,
  NexonSchedulerCharacterStateWire,
  SchedulerCharacterState,
} from '../types'
import { NexonAuthError, NexonNetworkError, NexonRateLimitError } from './errors'
import { normalizeCharacterList, normalizeSchedulerCharacterState } from './normalize'

const API_BASE_URL = 'https://open.api.nexon.com'
const REQUEST_TIMEOUT_MS = 10_000

async function requestJson<T>(path: string, apiKey: string): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'x-nxopen-api-key': apiKey },
      signal: controller.signal,
    })
  } catch (error) {
    throw new NexonNetworkError('Nexon API 요청에 실패했습니다', { cause: error })
  } finally {
    clearTimeout(timeoutId)
  }

  if (response.status === 401 || response.status === 403) {
    throw new NexonAuthError('Nexon API 키가 유효하지 않습니다')
  }
  if (response.status === 429) {
    throw new NexonRateLimitError('Nexon API 호출 한도를 초과했습니다 (OPENAPI00007)')
  }
  if (!response.ok) {
    throw new NexonNetworkError(`Nexon API가 오류 응답을 반환했습니다 (status: ${response.status})`)
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new NexonNetworkError('Nexon API 응답을 JSON으로 파싱하지 못했습니다', { cause: error })
  }
}

export async function fetchCharacterList(apiKey: string): Promise<MapleAccount[]> {
  const wire = await requestJson<NexonCharacterListResponse>('/maplestory/v1/character/list', apiKey)
  return normalizeCharacterList(wire)
}

export async function fetchSchedulerCharacterState(
  apiKey: string,
  ocid: string,
): Promise<SchedulerCharacterState> {
  const path = `/maplestory/v1/scheduler/character-state?ocid=${encodeURIComponent(ocid)}`
  const wire = await requestJson<NexonSchedulerCharacterStateWire>(path, apiKey)
  return normalizeSchedulerCharacterState(wire)
}

// ADR-008: 초당 호출 제한 때문에 여러 캐릭터를 병렬이 아니라 순차 호출해야 한다.
// 키 무효(401/403)·rate limit(429)은 모든 캐릭터에 동일하게 적용되는 전역 실패라 즉시 전파해 나머지 호출을 중단하고,
// 그 외 실패(네트워크 등)는 해당 캐릭터만 결과에서 제외하고 나머지 캐릭터 조회를 계속한다.
export async function fetchSchedulerStatesForCharacters(
  apiKey: string,
  ocids: string[],
): Promise<SchedulerCharacterState[]> {
  const results: SchedulerCharacterState[] = []

  for (const ocid of ocids) {
    try {
      results.push(await fetchSchedulerCharacterState(apiKey, ocid))
    } catch (error) {
      if (error instanceof NexonAuthError || error instanceof NexonRateLimitError) {
        throw error
      }
    }
  }

  return results
}
