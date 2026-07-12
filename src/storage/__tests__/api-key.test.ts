import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import { clearAuthConfig, getAuthConfig, setApiKey, setSelectedAccountId } from '../api-key'

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>()
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({
        value: store.has(key) ? (store.get(key) as string) : null,
      })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        store.set(key, value)
      }),
      remove: vi.fn(async ({ key }: { key: string }) => {
        store.delete(key)
      }),
    },
  }
})

beforeEach(async () => {
  vi.mocked(Preferences.get).mockClear()
  vi.mocked(Preferences.set).mockClear()
  vi.mocked(Preferences.remove).mockClear()
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

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setApiKey도 에러를 그대로 전파한다', async () => {
    vi.mocked(Preferences.set).mockRejectedValueOnce(new Error('disk full'))
    await expect(setApiKey('test-api-key')).rejects.toThrow('disk full')
  })

  it('Preferences.set이 reject되면 setSelectedAccountId도 에러를 그대로 전파한다', async () => {
    vi.mocked(Preferences.set).mockRejectedValueOnce(new Error('disk full'))
    await expect(setSelectedAccountId('account-1')).rejects.toThrow('disk full')
  })
})
