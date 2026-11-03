/**
 * 하단바 순서(JSON 한 칸). 사용자가 고른 것이라 데이터 삭제가 지우지 않는다.
 */
import type { BarOrder } from '../navigation/bar-groups'
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/** 저장된 값을 JSON 으로 읽은 그대로. 없거나 JSON 이 깨졌으면 `null`. 모양 검사는 스토어가 한다 */
export async function getBarOrder(): Promise<unknown> {
  const raw = await preferences.get(STORAGE_KEYS.barOrder)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export async function setBarOrder(order: BarOrder): Promise<void> {
  await preferences.set(STORAGE_KEYS.barOrder, JSON.stringify(order))
}
