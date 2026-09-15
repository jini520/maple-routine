import type { NexonSchedulerCharacterStateWire, SchedulerCharacterState } from '../../types'
import { requestJson } from '../http'
import { normalizeSchedulerCharacterState, type BossKeyResolver } from './normalize'

/** @param resolveBossKey API 보스 이름에서 보스 key. `lib/boss/bosses` 의 `bossKeyOfApiName` 을 넘긴다 */
export async function fetchSchedulerCharacterState(
  apiKey: string,
  ocid: string,
  resolveBossKey: BossKeyResolver,
  date?: string,
): Promise<SchedulerCharacterState> {
  const dateParam = date ? `&date=${encodeURIComponent(date)}` : ''
  const path = `/maplestory/v1/scheduler/character-state?ocid=${encodeURIComponent(ocid)}${dateParam}`
  const wire = await requestJson<NexonSchedulerCharacterStateWire>(path, apiKey)
  return normalizeSchedulerCharacterState(wire, resolveBossKey)
}
