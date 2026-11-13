/** today 공유 컨텐츠 위젯에서 마지막에 고른 메이플 ID. 고를 목록에 없으면 화면이 첫 메이플 ID 를 보인다. */
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

export async function getTodaySharedMapleId(): Promise<string | null> {
  const raw = await preferences.get(STORAGE_KEYS.todaySharedMapleId)
  return raw === null || raw === '' ? null : raw
}

export async function setTodaySharedMapleId(mapleId: string): Promise<void> {
  await preferences.set(STORAGE_KEYS.todaySharedMapleId, mapleId)
}
