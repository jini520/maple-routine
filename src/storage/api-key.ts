// @capacitor/preferences는 평문 저장이며 Keychain/Keystore 수준 암호화를 보장하지 않는다 — 강화된 보안 저장 도입은 이후 별도 task로 미룬다 (ADR-007).
import { Preferences } from '@capacitor/preferences'
import type { NexonAuthConfig } from '../types'
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

export async function clearAuthConfig(): Promise<void> {
  await Preferences.remove({ key: STORAGE_KEYS.apiKey })
  await Preferences.remove({ key: STORAGE_KEYS.selectedAccountId })
}
