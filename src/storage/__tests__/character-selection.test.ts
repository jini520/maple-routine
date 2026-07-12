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
  await clearTrackedCharacterOcids('content')
  await clearTrackedCharacterOcids('boss')
  await Preferences.remove({ key: 'trackedCharacters:daily' })
  await Preferences.remove({ key: 'trackedCharacters:weekly' })
})

describe('round-trip', () => {
  it('setTrackedCharacterOcids 후 getTrackedCharacterOcids로 저장한 값을 그대로 읽는다', async () => {
    await setTrackedCharacterOcids('content', ['ocid-1', 'ocid-2'])
    await expect(getTrackedCharacterOcids('content')).resolves.toEqual(['ocid-1', 'ocid-2'])
  })
})

describe('content/boss 독립성', () => {
  it('content를 설정해도 boss는 영향받지 않는다', async () => {
    await setTrackedCharacterOcids('content', ['ocid-1'])
    await expect(getTrackedCharacterOcids('boss')).resolves.toBeNull()
  })

  it('content와 boss는 서로 다른 값을 독립적으로 저장한다', async () => {
    await setTrackedCharacterOcids('content', ['ocid-1'])
    await setTrackedCharacterOcids('boss', ['ocid-2', 'ocid-3'])
    await expect(getTrackedCharacterOcids('content')).resolves.toEqual(['ocid-1'])
    await expect(getTrackedCharacterOcids('boss')).resolves.toEqual(['ocid-2', 'ocid-3'])
  })
})

describe('저장된 값이 없는 경우', () => {
  it('한 번도 설정한 적 없으면 null을 반환한다', async () => {
    await expect(getTrackedCharacterOcids('content')).resolves.toBeNull()
  })
})

describe('빈 배열과 null의 구분', () => {
  it('사용자가 명시적으로 전부 해제하면 null이 아니라 빈 배열을 반환한다', async () => {
    await setTrackedCharacterOcids('content', [])
    await expect(getTrackedCharacterOcids('content')).resolves.toEqual([])
  })
})

describe('clearTrackedCharacterOcids', () => {
  it('clear 이후에는 다시 null을 반환한다', async () => {
    await setTrackedCharacterOcids('content', ['ocid-1'])
    await clearTrackedCharacterOcids('content')
    await expect(getTrackedCharacterOcids('content')).resolves.toBeNull()
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 null을 반환한다', async () => {
    await Preferences.set({ key: 'trackedCharacters:content', value: 'not-valid-json{' })
    await expect(getTrackedCharacterOcids('content')).resolves.toBeNull()
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setTrackedCharacterOcids도 에러를 그대로 전파한다', async () => {
    vi.mocked(Preferences.set).mockRejectedValueOnce(new Error('disk full'))
    await expect(setTrackedCharacterOcids('content', ['ocid-1'])).rejects.toThrow('disk full')
  })
})

describe('레거시 daily/weekly 마이그레이션', () => {
  it('레거시 daily/weekly 둘 다 없으면 content/boss 둘 다 null이다', async () => {
    await expect(getTrackedCharacterOcids('content')).resolves.toBeNull()
    await expect(getTrackedCharacterOcids('boss')).resolves.toBeNull()
  })

  it('레거시 daily만 있으면 content로 옮겨지고 boss는 null이다', async () => {
    await Preferences.set({ key: 'trackedCharacters:daily', value: JSON.stringify(['a', 'b']) })
    await expect(getTrackedCharacterOcids('content')).resolves.toEqual(['a', 'b'])
    await expect(getTrackedCharacterOcids('boss')).resolves.toBeNull()
  })

  it('레거시 weekly만 있으면 content와 boss 양쪽으로 복사된다', async () => {
    await Preferences.set({ key: 'trackedCharacters:weekly', value: JSON.stringify(['b', 'c']) })
    await expect(getTrackedCharacterOcids('content')).resolves.toEqual(['b', 'c'])
    await expect(getTrackedCharacterOcids('boss')).resolves.toEqual(['b', 'c'])
  })

  it('레거시 daily·weekly 둘 다 있으면 content는 중복 제거된 합집합(daily 우선 순서), boss는 weekly 그대로다', async () => {
    await Preferences.set({ key: 'trackedCharacters:daily', value: JSON.stringify(['a', 'b']) })
    await Preferences.set({ key: 'trackedCharacters:weekly', value: JSON.stringify(['b', 'c']) })
    await expect(getTrackedCharacterOcids('content')).resolves.toEqual(['a', 'b', 'c'])
    await expect(getTrackedCharacterOcids('boss')).resolves.toEqual(['b', 'c'])
  })

  it('레거시 daily가 빈 배열(명시적 전부 해제)이면 content도 빈 배열로 옮겨지고 boss는 null이다', async () => {
    await Preferences.set({ key: 'trackedCharacters:daily', value: JSON.stringify([]) })
    await expect(getTrackedCharacterOcids('content')).resolves.toEqual([])
    await expect(getTrackedCharacterOcids('boss')).resolves.toBeNull()
  })

  it('마이그레이션 후 레거시 키는 삭제된다', async () => {
    await Preferences.set({ key: 'trackedCharacters:daily', value: JSON.stringify(['a']) })
    await Preferences.set({ key: 'trackedCharacters:weekly', value: JSON.stringify(['b']) })
    await getTrackedCharacterOcids('content')
    await expect(Preferences.get({ key: 'trackedCharacters:daily' })).resolves.toEqual({ value: null })
    await expect(Preferences.get({ key: 'trackedCharacters:weekly' })).resolves.toEqual({ value: null })
  })

  it('마이그레이션은 1회만 실행되어 이후 명시적 저장을 덮어쓰지 않는다', async () => {
    await Preferences.set({ key: 'trackedCharacters:daily', value: JSON.stringify(['a', 'b']) })
    await getTrackedCharacterOcids('content')
    await setTrackedCharacterOcids('content', [])
    await expect(getTrackedCharacterOcids('content')).resolves.toEqual([])
  })
})
