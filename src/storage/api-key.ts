// @capacitor/preferences는 평문 저장이며 Keychain/Keystore 수준 암호화를 보장하지 않는다 — 강화된 보안 저장 도입은 이후 별도 task로 미룬다 (ADR-007).
import { Preferences } from '@capacitor/preferences'
import type { NexonAuthConfig } from '@core/types'
import { STORAGE_KEYS } from './keys'

export async function getAuthConfig(): Promise<NexonAuthConfig | null> {
  const { value: apiKey } = await Preferences.get({ key: STORAGE_KEYS.apiKey })
  if (apiKey === null) {
    return null
  }

  const { value: selectedAccountId } = await Preferences.get({
    key: STORAGE_KEYS.selectedAccountId,
  })

  return { apiKey, selectedAccountId }
}

export async function setApiKey(apiKey: string): Promise<void> {
  await Preferences.set({ key: STORAGE_KEYS.apiKey, value: apiKey })
}

export async function setSelectedAccountId(accountId: string | null): Promise<void> {
  if (accountId === null) {
    await Preferences.remove({ key: STORAGE_KEYS.selectedAccountId })
    return
  }
  await Preferences.set({ key: STORAGE_KEYS.selectedAccountId, value: accountId })
}

// ADR-115 결정 3: 키 무효화(401/403) 전용 — apiKey **하나만** 지운다. selectedAccountId는
// 남겨야 키 재입력 후의 재개(결정 4)가 그 값을 읽을 수 있다. 아래 clearAuthConfig로 갈아끼우지
// 마라 — 그쪽은 연결 해제용이라 계정 선택까지 지워서 재개가 조용히 깨진다.
export async function removeApiKey(): Promise<void> {
  await Preferences.remove({ key: STORAGE_KEYS.apiKey })
}

// 연결 해제 전용 — 저장된 인증 정보를 통째로 버린다(위 removeApiKey와 목적이 다르다).
export async function clearAuthConfig(): Promise<void> {
  await Preferences.remove({ key: STORAGE_KEYS.apiKey })
  await Preferences.remove({ key: STORAGE_KEYS.selectedAccountId })
}
