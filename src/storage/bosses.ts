/**
 * 보스 표의 기기 사본. 서버 응답을 통째로 든다.
 *
 * 번들 사본보다 새것이라 앱을 켜면 이것으로 표를 세운다. 깨진 값은 없는 것으로 읽는다. 그러면
 * 번들 사본이 서고 다음 조회가 다시 채운다.
 */
import { parseBossCatalog } from '../lib/boss/catalog'
import type { BossCatalog } from '../types/boss-catalog'
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/** 저장된 사본. 없거나 깨졌으면 `null`. */
export async function getBossCatalogCopy(): Promise<BossCatalog | null> {
  const raw = await preferences.get(STORAGE_KEYS.bossCatalog)
  if (raw === null) return null

  try {
    return parseBossCatalog(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

/** @param catalog 서버가 준 표 */
export async function setBossCatalogCopy(catalog: BossCatalog): Promise<void> {
  await preferences.set(STORAGE_KEYS.bossCatalog, JSON.stringify(catalog))
}
