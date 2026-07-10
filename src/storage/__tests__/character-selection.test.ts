import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import {
  clearTrackedCharacterOcids,
  getTrackedCharacterOcids,
  setTrackedCharacterOcids,
} from '../character-selection'

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
  await clearTrackedCharacterOcids('daily')
  await clearTrackedCharacterOcids('weekly')
})

describe('round-trip', () => {
  it('setTrackedCharacterOcids 후 getTrackedCharacterOcids로 저장한 값을 그대로 읽는다', async () => {
    await setTrackedCharacterOcids('daily', ['ocid-1', 'ocid-2'])
    await expect(getTrackedCharacterOcids('daily')).resolves.toEqual(['ocid-1', 'ocid-2'])
  })
})

describe('daily/weekly 독립성', () => {
  it('daily를 설정해도 weekly는 영향받지 않는다', async () => {
    await setTrackedCharacterOcids('daily', ['ocid-1'])
    await expect(getTrackedCharacterOcids('weekly')).resolves.toBeNull()
  })

  it('daily와 weekly는 서로 다른 값을 독립적으로 저장한다', async () => {
    await setTrackedCharacterOcids('daily', ['ocid-1'])
    await setTrackedCharacterOcids('weekly', ['ocid-2', 'ocid-3'])
    await expect(getTrackedCharacterOcids('daily')).resolves.toEqual(['ocid-1'])
    await expect(getTrackedCharacterOcids('weekly')).resolves.toEqual(['ocid-2', 'ocid-3'])
  })
})

describe('저장된 값이 없는 경우', () => {
  it('한 번도 설정한 적 없으면 null을 반환한다', async () => {
    await expect(getTrackedCharacterOcids('daily')).resolves.toBeNull()
  })
})

describe('빈 배열과 null의 구분', () => {
  it('사용자가 명시적으로 전부 해제하면 null이 아니라 빈 배열을 반환한다', async () => {
    await setTrackedCharacterOcids('daily', [])
    await expect(getTrackedCharacterOcids('daily')).resolves.toEqual([])
  })
})

describe('clearTrackedCharacterOcids', () => {
  it('clear 이후에는 다시 null을 반환한다', async () => {
    await setTrackedCharacterOcids('daily', ['ocid-1'])
    await clearTrackedCharacterOcids('daily')
    await expect(getTrackedCharacterOcids('daily')).resolves.toBeNull()
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 null을 반환한다', async () => {
    await Preferences.set({ key: 'trackedCharacters:daily', value: 'not-valid-json{' })
    await expect(getTrackedCharacterOcids('daily')).resolves.toBeNull()
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setTrackedCharacterOcids도 에러를 그대로 전파한다', async () => {
    vi.mocked(Preferences.set).mockRejectedValueOnce(new Error('disk full'))
    await expect(setTrackedCharacterOcids('daily', ['ocid-1'])).rejects.toThrow('disk full')
  })
})
