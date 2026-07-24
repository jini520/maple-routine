import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import { getTrackingMode, setTrackingMode } from '../tracking-mode'

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
  await Preferences.remove({ key: 'trackingMode' })
})

describe('기본값', () => {
  it('저장된 값이 없으면 auto를 반환한다', async () => {
    await expect(getTrackingMode()).resolves.toBe('auto')
  })
})

describe('round-trip', () => {
  it('setTrackingMode(manual) 후 getTrackingMode는 manual을 반환한다', async () => {
    await setTrackingMode('manual')
    await expect(getTrackingMode()).resolves.toBe('manual')
  })

  it('manual에서 auto로 되돌릴 수 있다', async () => {
    await setTrackingMode('manual')
    await setTrackingMode('auto')
    await expect(getTrackingMode()).resolves.toBe('auto')
  })
})

describe('손상된 값', () => {
  it('저장된 값이 알 수 없는 문자열이면 auto로 폴백한다', async () => {
    await Preferences.set({ key: 'trackingMode', value: 'something-else' })
    await expect(getTrackingMode()).resolves.toBe('auto')
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setTrackingMode도 에러를 그대로 전파한다', async () => {
    vi.mocked(Preferences.set).mockRejectedValueOnce(new Error('disk full'))
    await expect(setTrackingMode('manual')).rejects.toThrow('disk full')
  })
})
