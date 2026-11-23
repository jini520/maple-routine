/**
 * 하단바 순서(JSON 한 칸). 사용자가 고른 것이라 데이터 삭제가 지우지 않는다.
 *
 * 저장은 서버 칸과 같은 이름(`{ groupKeys, subPageKeys }`)이고 바는 `{ groups, subs }` 를 든다.
 */
import type { BarOrder } from '../navigation/bar-groups'
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import { enqueueChangedPreferenceRecords, enqueueChangedSetting, preferenceRecordIdOf } from './server-sync-queue'

/**
 * 저장된 값을 바가 드는 칸 이름으로. 없거나 JSON 이 깨졌으면 `null`. 모양 검사는 스토어가 한다.
 *
 * 기기 변환을 기다리지 않고 옛 이름(`{ groups, subs }`)도 읽는다. 셸이 변환보다 먼저 읽어 바를 그린다.
 */
export async function getBarOrder(): Promise<unknown> {
  const raw = await preferences.get(STORAGE_KEYS.barOrder)
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return value
    const stored = value as { groupKeys?: unknown; subPageKeys?: unknown; groups?: unknown; subs?: unknown }
    if (!('groupKeys' in stored) && !('subPageKeys' in stored)) return value
    return { groups: stored.groupKeys, subs: stored.subPageKeys }
  } catch {
    return null
  }
}

/** 그룹마다 하위 페이지 차례의 대기 줄 하나. */
function subPageRecordsOf(subs: unknown): Map<string, unknown> {
  if (typeof subs !== 'object' || subs === null) return new Map()
  return new Map(Object.entries(subs).map(([group, pages]) => [preferenceRecordIdOf('bottomBarSubPageOrders', [group]), pages]))
}

/** 서버는 그룹 목록 칸과 하위 페이지 차례의 그룹마다 고친다. 그래서 그 칸과 그룹마다 견주어 바뀐 것을 대기 표에 넣는다. */
export async function setBarOrder(order: BarOrder): Promise<void> {
  const before = (await getBarOrder()) as { groups?: unknown; subs?: unknown } | null
  await preferences.set(STORAGE_KEYS.barOrder, JSON.stringify({ groupKeys: order.groups, subPageKeys: order.subs }))
  await enqueueChangedSetting('barGroupKeys', before?.groups, order.groups)
  await enqueueChangedPreferenceRecords('bottomBarSubPageOrders', subPageRecordsOf(before?.subs), subPageRecordsOf(order.subs))
}
