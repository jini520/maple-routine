import { Preferences } from '@capacitor/preferences'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NexonBadRequestError, NexonRateLimitError } from '../../../nexon/errors'
import {
  getAllCachedCharacterBasicOcids,
  getCachedCharacterBasic,
  setCachedCharacterBasic,
} from '../../../storage/character-basic-cache'
import type { CharacterBasicProfile } from '../../../types'
import { CHARACTER_BASIC_TTL_MS, fetchCharacterBasicCached } from '../character-basic-fetch'

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
      clear: vi.fn(async () => {
        store.clear()
      }),
    },
  }
})

const { fetchCharacterBasicMock } = vi.hoisted(() => ({
  fetchCharacterBasicMock: vi.fn(),
}))

vi.mock('../../../nexon/character', () => ({
  fetchCharacterBasic: fetchCharacterBasicMock,
}))

const NOW = new Date('2026-08-08T05:00:00.000Z')
const ACCOUNT = 'account-1'
const OCID = 'ocid-1'

function profile(overrides: Partial<CharacterBasicProfile> = {}): CharacterBasicProfile {
  return {
    name: '낟낟',
    level: 293,
    imageUrl: 'https://example.com/1.png',
    accessFlag: true,
    ...overrides,
  }
}

/** `now` 기준으로 `elapsedMs` 만큼 전에 캐시된 엔트리를 심는다. */
async function seedCache(elapsedMs: number, cached: CharacterBasicProfile): Promise<void> {
  await setCachedCharacterBasic(ACCOUNT, OCID, {
    profile: cached,
    cachedAt: new Date(NOW.getTime() - elapsedMs).toISOString(),
  })
}

beforeEach(async () => {
  fetchCharacterBasicMock.mockReset()
  await Preferences.clear()
})

describe('캐시가 없으면 네트워크로 받고 그 결과를 캐시에 쓴다', () => {
  it('fetchCharacterBasic 을 부르고 그 profile 을 돌려준다', async () => {
    const fresh = profile({ name: '새로받음' })
    fetchCharacterBasicMock.mockResolvedValue(fresh)

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).resolves.toEqual(fresh)
    expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(1)
    expect(fetchCharacterBasicMock).toHaveBeenCalledWith('key', OCID)
    await expect(getCachedCharacterBasic(OCID)).resolves.toEqual({
      profile: fresh,
      cachedAt: NOW.toISOString(),
    })
  })

  it('새 엔트리의 cachedAt 은 인자로 받은 now 다 — 함수 안에서 시계를 다시 읽지 않는다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile())

    await fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)

    const entry = await getCachedCharacterBasic(OCID)
    expect(entry?.cachedAt).toBe(NOW.toISOString())
  })

  it('캐시 쓰기는 인자로 받은 accountId 로 이뤄진다 — 다른 계정 인덱스를 오염시키지 않는다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile())

    await fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)

    await expect(getAllCachedCharacterBasicOcids(ACCOUNT)).resolves.toEqual([OCID])
    await expect(getAllCachedCharacterBasicOcids('account-2')).resolves.toEqual([])
  })
})

describe('5분 TTL 가드 (ADR-113 결정 1)', () => {
  it('TTL 안이면 네트워크를 부르지 않고 캐시 profile 을 돌려준다', async () => {
    const cached = profile({ name: '캐시값' })
    await seedCache(CHARACTER_BASIC_TTL_MS - 1, cached)

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).resolves.toEqual(cached)
    expect(fetchCharacterBasicMock).not.toHaveBeenCalled()
  })

  it('TTL 밖이면 다시 부르고 캐시를 갱신한다', async () => {
    await seedCache(CHARACTER_BASIC_TTL_MS + 1, profile({ name: '캐시값' }))
    const fresh = profile({ name: '새로받음', level: 294 })
    fetchCharacterBasicMock.mockResolvedValue(fresh)

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).resolves.toEqual(fresh)
    expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(1)
    await expect(getCachedCharacterBasic(OCID)).resolves.toEqual({
      profile: fresh,
      cachedAt: NOW.toISOString(),
    })
  })

  it('경계는 배타적이다 — 경과가 정확히 5분이면 만료로 보고 다시 부른다', async () => {
    await seedCache(CHARACTER_BASIC_TTL_MS, profile({ name: '캐시값' }))
    fetchCharacterBasicMock.mockResolvedValue(profile({ name: '새로받음' }))

    await fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)

    expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(1)
  })
})

describe('신뢰할 수 없는 cachedAt 은 만료로 취급한다', () => {
  it('파싱 불가 문자열이면 다시 부른다', async () => {
    await setCachedCharacterBasic(ACCOUNT, OCID, {
      profile: profile({ name: '캐시값' }),
      cachedAt: '그런 시각 없음',
    })
    const fresh = profile({ name: '새로받음' })
    fetchCharacterBasicMock.mockResolvedValue(fresh)

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).resolves.toEqual(fresh)
    expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(1)
  })

  it('미래 시각(기기 시계 되감기)이면 다시 부른다 — 캐시가 영구히 신선해지지 않는다', async () => {
    await seedCache(-60_000, profile({ name: '캐시값' }))
    const fresh = profile({ name: '새로받음' })
    fetchCharacterBasicMock.mockResolvedValue(fresh)

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).resolves.toEqual(fresh)
    expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(1)
  })
})

describe('실패는 캐시로 폴백하지 않고 그대로 전파한다', () => {
  it('400 OPENAPI00003(조회 불가)이 그대로 던져진다 — 호출부의 characterUnavailable 분기가 산다', async () => {
    const error = new NexonBadRequestError('unavailable', 'OPENAPI00003')
    fetchCharacterBasicMock.mockRejectedValue(error)

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).rejects.toBe(error)
    await expect(getCachedCharacterBasic(OCID)).resolves.toBeNull()
  })

  it('429 도 그대로 던져진다 — 전역 실패 분기가 산다', async () => {
    const error = new NexonRateLimitError('rate limited')
    fetchCharacterBasicMock.mockRejectedValue(error)

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).rejects.toBe(error)
  })

  it('만료된 캐시가 있어도 실패를 그 값으로 덮지 않는다', async () => {
    const stale = profile({ name: '만료된값' })
    await seedCache(CHARACTER_BASIC_TTL_MS + 1, stale)
    const error = new NexonRateLimitError('rate limited')
    fetchCharacterBasicMock.mockRejectedValue(error)

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).rejects.toBe(error)
    // 캐시는 실패 전 값 그대로다 — 새로 쓰지 않았다.
    const entry = await getCachedCharacterBasic(OCID)
    expect(entry?.profile).toEqual(stale)
    expect(entry?.cachedAt).not.toBe(NOW.toISOString())
  })
})
