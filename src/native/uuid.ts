import { getUuidPort } from './ports'

/**
 * 새 기록의 id 로 쓰는 uuid(v4).
 *
 * @example const record = { id: randomUuid(), savedAt: now.toISOString(), characters }
 */
export function randomUuid(): string {
  return getUuidPort().random()
}
