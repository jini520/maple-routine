import { Preferences } from '@capacitor/preferences'
import { STORAGE_KEYS } from './keys'

// 고가 아이템 드롭 연출 표시 여부(ADR-040 결정 6). 전역 취향이라 Preferences로 영구 저장한다.
// 저장된 값이 없으면 기본은 true(연출 표시) — 명시적으로 'off'를 저장했을 때만 끈다.

export async function getDropEffectEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.dropEffect })
  return value === 'off' ? false : true
}

export async function setDropEffectEnabled(enabled: boolean): Promise<void> {
  await Preferences.set({ key: STORAGE_KEYS.dropEffect, value: enabled ? 'on' : 'off' })
}
