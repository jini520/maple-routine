import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import type { CharacterBasicProfile } from '../../types'
import {
  clearCachedCharacterBasic,
  getAllCachedCharacterBasicOcids,
  getCachedCharacterBasic,
  setCachedCharacterBasic,
  type CachedCharacterBasicEntry,
} from '../character-basic-cache'

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

const sampleProfile: CharacterBasicProfile = {
  name: '낟낟',
  level: 293,
  imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/abc?wmotion=W02',
  accessFlag: true,
}

const sampleEntry: CachedCharacterBasicEntry = {
  profile: sampleProfile,
  cachedAt: '2026-07-12T00:05:00.000Z',
}

beforeEach(async () => {
  vi.mocked(Preferences.get).mockClear()
  vi.mocked(Preferences.set).mockClear()
  vi.mocked(Preferences.remove).mockClear()
  await clearCachedCharacterBasic('ocid-1')
})

describe('round-trip', () => {
  it('setCachedCharacterBasic 후 getCachedCharacterBasic으로 저장한 값을 그대로 읽는다', async () => {
    await setCachedCharacterBasic('ocid-1', sampleEntry)
    await expect(getCachedCharacterBasic('ocid-1')).resolves.toEqual(sampleEntry)
  })
})

describe('저장된 값이 없는 경우', () => {
  it('캐시된 적 없는 ocid는 null을 반환한다', async () => {
    await expect(getCachedCharacterBasic('unknown-ocid')).resolves.toBeNull()
  })

  it('clearCachedCharacterBasic 이후에는 null을 반환한다', async () => {
    await setCachedCharacterBasic('ocid-1', sampleEntry)
    await clearCachedCharacterBasic('ocid-1')
    await expect(getCachedCharacterBasic('ocid-1')).resolves.toBeNull()
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 null을 반환한다', async () => {
    await Preferences.set({ key: 'characterBasicCache:ocid-broken', value: 'not-valid-json{' })
    await expect(getCachedCharacterBasic('ocid-broken')).resolves.toBeNull()
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setCachedCharacterBasic도 에러를 그대로 전파한다', async () => {
    vi.mocked(Preferences.set).mockRejectedValueOnce(new Error('disk full'))
    await expect(setCachedCharacterBasic('ocid-1', sampleEntry)).rejects.toThrow('disk full')
  })
})

describe('getAllCachedCharacterBasicOcids (ADR-017 결정 6)', () => {
  afterEach(async () => {
    await clearCachedCharacterBasic('ocid-2')
    await clearCachedCharacterBasic('ocid-3')
  })

  it('아무것도 캐싱된 적 없으면 빈 배열을 반환한다', async () => {
    await expect(getAllCachedCharacterBasicOcids()).resolves.toEqual([])
  })

  it('setCachedCharacterBasic으로 저장한 ocid들이 인덱스에 나타난다', async () => {
    await setCachedCharacterBasic('ocid-1', sampleEntry)
    await setCachedCharacterBasic('ocid-2', sampleEntry)

    const ocids = await getAllCachedCharacterBasicOcids()
    expect(ocids.sort()).toEqual(['ocid-1', 'ocid-2'])
  })

  it('같은 ocid를 여러 번 저장해도 인덱스에 중복으로 쌓이지 않는다', async () => {
    await setCachedCharacterBasic('ocid-1', sampleEntry)
    await setCachedCharacterBasic('ocid-1', { ...sampleEntry, cachedAt: '2026-07-12T01:00:00.000Z' })

    const ocids = await getAllCachedCharacterBasicOcids()
    expect(ocids.filter((ocid) => ocid === 'ocid-1')).toHaveLength(1)
  })

  it('clearCachedCharacterBasic으로 지운 ocid는 인덱스에서도 빠진다', async () => {
    await setCachedCharacterBasic('ocid-1', sampleEntry)
    await setCachedCharacterBasic('ocid-2', sampleEntry)
    await clearCachedCharacterBasic('ocid-1')

    const ocids = await getAllCachedCharacterBasicOcids()
    expect(ocids).toEqual(['ocid-2'])
  })
})
