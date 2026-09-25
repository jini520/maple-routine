import type { NexonCredential } from '../../types/auth'
import type { NexonSchedulerCharacterStateWire, SchedulerCharacterState } from '../../types'
import { requestJson } from '../http'
import { normalizeSchedulerCharacterState, type ScheduleNameResolvers } from './normalize'

/** @param resolvers API 이름에서 보스 key · 컨텐츠 key. `SCHEDULE_NAME_RESOLVERS` 를 넘긴다 */
export async function fetchSchedulerCharacterState(
  credential: NexonCredential,
  ocid: string,
  resolvers: ScheduleNameResolvers,
  date?: string,
): Promise<SchedulerCharacterState> {
  const dateParam = date ? `&date=${encodeURIComponent(date)}` : ''
  const path = `/maplestory/v1/scheduler/character-state?ocid=${encodeURIComponent(ocid)}${dateParam}`
  const wire = await requestJson<NexonSchedulerCharacterStateWire>(path, credential)
  return normalizeSchedulerCharacterState(wire, resolvers)
}
