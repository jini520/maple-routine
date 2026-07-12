import type { NexonSchedulerCharacterStateWire, SchedulerCharacterState } from '../../types'
import { NexonAuthError, NexonRateLimitError } from '../errors'
import { requestJson } from '../http'
import { normalizeSchedulerCharacterState } from './normalize'

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
