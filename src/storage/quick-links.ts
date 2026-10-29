/**
 * today 빠른 이동의 구성(JSON 한 칸). 사용자가 고른 것이라 데이터 삭제가 지우지 않는다.
 */
import type { QuickLinksConfig } from '../types/quick-links'
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/** 저장된 값을 JSON 으로 읽은 그대로. 없거나 JSON 이 깨졌으면 `null`. 모양 검사는 스토어가 한다 */
export async function getQuickLinks(): Promise<unknown> {
  const raw = await preferences.get(STORAGE_KEYS.quickLinks)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export async function setQuickLinks(config: QuickLinksConfig): Promise<void> {
  await preferences.set(STORAGE_KEYS.quickLinks, JSON.stringify(config))
}
