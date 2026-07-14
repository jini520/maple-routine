import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import { getTheme, setTheme } from '../theme'

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
  await Preferences.remove({ key: 'theme' })
})

describe('저장된 값이 없는 경우', () => {
  it('저장 전 getTheme()은 null을 반환한다', async () => {
    await expect(getTheme()).resolves.toBeNull()
  })
})

describe('round-trip', () => {
  it('setTheme(레테) 후 getTheme()은 레테를 반환한다', async () => {
    await setTheme('레테')
    await expect(getTheme()).resolves.toBe('레테')
  })

  it('setTheme(렌) 후 getTheme()은 렌을 반환한다', async () => {
    await setTheme('렌')
    await expect(getTheme()).resolves.toBe('렌')
  })

  it('setTheme(머쉬맘) 후 getTheme()은 머쉬맘을 반환한다', async () => {
    await setTheme('머쉬맘')
    await expect(getTheme()).resolves.toBe('머쉬맘')
  })

  it('setTheme(혼테일) 후 getTheme()은 혼테일을 반환한다', async () => {
    await setTheme('혼테일')
    await expect(getTheme()).resolves.toBe('혼테일')
  })
})

describe('손상되거나 알 수 없는 값', () => {
  it('레테/렌이 아닌 임의의 문자열이 저장되어 있으면 null을 반환한다', async () => {
    await Preferences.set({ key: 'theme', value: 'not-a-theme' })
    await expect(getTheme()).resolves.toBeNull()
  })
})
