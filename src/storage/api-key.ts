// PreferencesPort는 평문 저장이며 Keychain/Keystore 수준 암호화를 보장하지 않는다. 강화된 보안 저장 도입은 이후 별도 task로 미룬다.
import { preferences } from './ports'
import type { NexonAuthConfig } from '../types'
import { STORAGE_KEYS } from './keys'

export async function getAuthConfig(): Promise<NexonAuthConfig | null> {
  const apiKey = await preferences.get(STORAGE_KEYS.apiKey)
  if (apiKey === null) {
    return null
  }

  return { apiKey }
}

export async function setApiKey(apiKey: string): Promise<void> {
  await preferences.set(STORAGE_KEYS.apiKey, apiKey)
}

// 키 무효화(400 OPENAPI00005 · 401/403) 전용 — apiKey **하나만** 지운다. 아래
// clearAuthConfig 로 갈아끼우지 마라(그쪽은 연결 해제용이라 지우는 범위가 넓다).
// 키 재입력 후의 재개(결정 4)는 남아 있는 trackingMode·trackedCharacters 에서 파생된다.
export async function removeApiKey(): Promise<void> {
  await preferences.remove(STORAGE_KEYS.apiKey)
}

// 연결 해제 전용 — 저장된 인증 정보를 통째로 버린다(위 removeApiKey와 목적이 다르다).
// `selectedAccountId` 는 **레거시 키**다(로 계정 선택이 사라졌다). 아무도
// 쓰지 않지만 캐패시터 시절을 거친 설치본에는 값이 남아 있어, 연결 해제에서 함께 치운다.
export async function clearAuthConfig(): Promise<void> {
  await preferences.remove(STORAGE_KEYS.apiKey)
  await preferences.remove(STORAGE_KEYS.legacySelectedAccountId)
}
