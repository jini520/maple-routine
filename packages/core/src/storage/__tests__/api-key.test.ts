import { beforeEach, describe, expect, it } from 'vitest'
import { installFakePreferences } from './fake-preferences'
import {
  clearAuthConfig,
  getAuthConfig,
  removeApiKey,
  setApiKey,
  setSelectedAccountId,
} from '../api-key'
import { STORAGE_KEYS } from '../keys'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await clearAuthConfig()
})

describe('round-trip', () => {
  it('setApiKey 후 getAuthConfig로 저장한 apiKey를 그대로 읽는다', async () => {
    await setApiKey('test-api-key')
    await expect(getAuthConfig()).resolves.toEqual({
      apiKey: 'test-api-key',
      selectedAccountId: null,
    })
  })

  it('setSelectedAccountId까지 설정하면 함께 반영된다', async () => {
    await setApiKey('test-api-key')
    await setSelectedAccountId('account-1')
    await expect(getAuthConfig()).resolves.toEqual({
      apiKey: 'test-api-key',
      selectedAccountId: 'account-1',
    })
  })

  it('setSelectedAccountId(null)로 선택을 해제하면 다시 null이 된다', async () => {
    await setApiKey('test-api-key')
    await setSelectedAccountId('account-1')
    await setSelectedAccountId(null)
    await expect(getAuthConfig()).resolves.toEqual({
      apiKey: 'test-api-key',
      selectedAccountId: null,
    })
  })
})

describe('저장된 값이 없는 경우', () => {
  it('아무 것도 저장하지 않았으면 getAuthConfig는 null을 반환한다', async () => {
    await expect(getAuthConfig()).resolves.toBeNull()
  })

  it('clearAuthConfig 이후에는 getAuthConfig가 null을 반환한다', async () => {
    await setApiKey('test-api-key')
    await setSelectedAccountId('account-1')
    await clearAuthConfig()
    await expect(getAuthConfig()).resolves.toBeNull()
  })
})

// ADR-115 결정 3: 키 무효화(401/403)는 apiKey 하나만 지운다. clearAuthConfig(연결 해제)와
// 섞이면 재입력 후의 재개(결정 4)가 읽을 값이 사라져 조용히 깨진다.
describe('removeApiKey', () => {
  it('apiKey를 제거한다', async () => {
    await setApiKey('test-api-key')

    await removeApiKey()

    expect(prefs.remove).toHaveBeenCalledWith(STORAGE_KEYS.apiKey)
    await expect(prefs.get(STORAGE_KEYS.apiKey)).resolves.toBeNull()
  })

  it('selectedAccountId는 저장소에 그대로 남는다 — 키 재입력 후의 재개가 그 값을 쓴다', async () => {
    await setApiKey('test-api-key')
    await setSelectedAccountId('account-1')

    await removeApiKey()

    await expect(prefs.get(STORAGE_KEYS.selectedAccountId)).resolves.toBe('account-1')
  })

  it('그 뒤 getAuthConfig는 null을 반환한다 — apiKey가 없으면 나머지를 읽지 않는다', async () => {
    await setApiKey('test-api-key')
    await setSelectedAccountId('account-1')

    await removeApiKey()

    await expect(getAuthConfig()).resolves.toBeNull()
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setApiKey도 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setApiKey('test-api-key')).rejects.toThrow('disk full')
  })

  it('Preferences.set이 reject되면 setSelectedAccountId도 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setSelectedAccountId('account-1')).rejects.toThrow('disk full')
  })
})
