import type { NexonSchedulerCharacterStateWire, SchedulerCharacterState } from '../../types'
import { requestJson } from '../http'
import { normalizeSchedulerCharacterState } from './normalize'

export async function fetchSchedulerCharacterState(
  apiKey: string,
  ocid: string,
  date?: string,
): Promise<SchedulerCharacterState> {
  const dateParam = date ? `&date=${encodeURIComponent(date)}` : ''
  const path = `/maplestory/v1/scheduler/character-state?ocid=${encodeURIComponent(ocid)}${dateParam}`
  const wire = await requestJson<NexonSchedulerCharacterStateWire>(path, apiKey)
  return normalizeSchedulerCharacterState(wire)
}
