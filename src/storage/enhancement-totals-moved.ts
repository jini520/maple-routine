/**
 * 옛 강화 원본 표를 합계로 옮겼는지. Preferences 의 `'1'` 한 칸이다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export async function isEnhancementTotalsMoved(): Promise<boolean> {
  return (await preferences.get(STORAGE_KEYS.enhancementTotalsMoved)) === '1'
}

export async function markEnhancementTotalsMoved(): Promise<void> {
  await preferences.set(STORAGE_KEYS.enhancementTotalsMoved, '1')
}
