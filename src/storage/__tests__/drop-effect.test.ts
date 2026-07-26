import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import { getDropEffectEnabled, setDropEffectEnabled } from '../drop-effect'

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
  await Preferences.remove({ key: 'dropEffect' })
})

describe('drop-effect 저장', () => {
  it('저장된 값이 없으면 기본은 연출 표시(true)', async () => {
    await expect(getDropEffectEnabled()).resolves.toBe(true)
  })

  it('false 저장 후에는 false를 읽는다', async () => {
    await setDropEffectEnabled(false)
    await expect(getDropEffectEnabled()).resolves.toBe(false)
  })

  it('다시 true로 되돌리면 true를 읽는다', async () => {
    await setDropEffectEnabled(false)
    await setDropEffectEnabled(true)
    await expect(getDropEffectEnabled()).resolves.toBe(true)
  })

  it('Preferences.set이 reject되면 에러를 그대로 전파한다', async () => {
    vi.mocked(Preferences.set).mockRejectedValueOnce(new Error('disk full'))
    await expect(setDropEffectEnabled(false)).rejects.toThrow('disk full')
  })
})
