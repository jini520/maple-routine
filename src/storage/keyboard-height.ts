/**
 * 이 기기에서 본 OS 키보드 높이. 입력 카드가 자체 숫자 판을 쓸지 정할 때 읽는다.
 *
 * 저장값이 없으면 `null` 이고 호출부가 첫 실행 기본값을 쓴다.
 */
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

export async function getKeyboardHeight(): Promise<number | null> {
  const raw = await preferences.get(STORAGE_KEYS.keyboardHeight)
  if (raw === null) return null
  const parsed = Number(raw)
  // 0 이 판정에 들어가면 어느 화면이든 키보드를 받칠 수 있다고 읽어 카드가 다시 잘린다.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function setKeyboardHeight(heightPx: number): Promise<void> {
  if (!Number.isFinite(heightPx) || heightPx <= 0) return
  await preferences.set(STORAGE_KEYS.keyboardHeight, String(heightPx))
}
