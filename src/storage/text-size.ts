import { isTextSize } from '../lib/text-size'
import type { TextSize } from '../types/text-size'
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

/** 저장된 값이 없거나 모르는 값이면 `null`. 기본 단계로 바꾸는 일은 스토어가 한다. */
export async function getTextSize(): Promise<TextSize | null> {
  const value = await preferences.get(STORAGE_KEYS.textSize)
  return value !== null && isTextSize(value) ? value : null
}

export async function setTextSize(size: TextSize): Promise<void> {
  await preferences.set(STORAGE_KEYS.textSize, size)
}
