/**
 * today 빠른 이동의 구성(JSON 한 칸). 사용자가 고른 것이라 데이터 삭제가 지우지 않는다.
 *
 * 저장은 서버 칸과 같은 이름(`{ rowCount, keys }`)이고 화면은 `{ rows, ids }` 를 든다.
 */
import type { QuickLinksConfig } from '../types/quick-links'
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import { whenRecordsReleased } from './record-hold'
import { enqueueChangedSetting } from './server-sync-queue'

/** 저장된 값을 화면이 드는 칸 이름으로. 없거나 JSON 이 깨졌으면 `null`. 모양 검사는 스토어가 한다 */
export async function getQuickLinks(): Promise<unknown> {
  await whenRecordsReleased()
  const raw = await preferences.get(STORAGE_KEYS.quickLinks)
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return value
    const { rowCount, keys } = value as { rowCount?: unknown; keys?: unknown }
    return { rows: rowCount, ids: keys }
  } catch {
    return null
  }
}

/** 서버 칸 둘(줄 수 · 화면 목록)마다 견주어 바뀐 칸을 대기 표에 넣는다. */
export async function setQuickLinks(config: QuickLinksConfig): Promise<void> {
  await whenRecordsReleased()
  const before = (await getQuickLinks()) as { rows?: unknown; ids?: unknown } | null
  await preferences.set(STORAGE_KEYS.quickLinks, JSON.stringify({ rowCount: config.rows, keys: config.ids }))
  await enqueueChangedSetting('quickLinkRowCount', before?.rows, config.rows)
  await enqueueChangedSetting('quickLinkKeys', before?.ids, config.ids)
}
