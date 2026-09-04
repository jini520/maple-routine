import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { NexonBadRequestError, NexonRateLimitError } from '../../../nexon/errors'
import {
  getAllCachedCharacterBasicOcids,
  getCachedCharacterBasic,
  setCachedCharacterBasic,
} from '../../../storage/character-basic-cache'
import type { CharacterBasicProfile } from '../../../types'
import { CHARACTER_BASIC_TTL_MS, fetchCharacterBasicCached } from '../character-basic-fetch'

jest.mock('../../../nexon/character', () => ({
  fetchCharacterBasic: jest.fn(),
}))
const { fetchCharacterBasic: fetchCharacterBasicMock } = jest.requireMock('../../../nexon/character') as Record<string, jest.Mock>

jest.mock('../../../storage/character-profiles', () => ({
  saveCharacterProfile: jest.fn().mockResolvedValue(undefined),
}))
const { saveCharacterProfile: saveCharacterProfileMock } = jest.requireMock('../../../storage/character-profiles') as Record<string, jest.Mock>

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

/** `now` 기준으로 `elapsedMs` 만큼 전에 캐시된 엔트리를 심는 도우미. */
async function seedCache(elapsedMs: number, cached: CharacterBasicProfile): Promise<void> {
  await setCachedCharacterBasic(ACCOUNT, OCID, {
    profile: cached,
    cachedAt: new Date(NOW.getTime() - elapsedMs).toISOString(),
  })
}

beforeEach(async () => {
  installFakePreferences()
  fetchCharacterBasicMock.mockReset()
  saveCharacterProfileMock.mockClear()
})

// 이 함수가 앱 전체의 `character/basic` 통과 지점이라, 여기 한 줄이면 한 번이라도 조회된
// 캐릭터는 추적을 해제해도 이름과 얼굴을 갖는다. 캐시는 5분 TTL 이고 캐시 비우기가 지운다.
describe('받은 프로필은 지워지지 않는 스냅샷에도 함께 쓴다', () => {
  it('네트워크로 받으면 스냅샷을 쓴다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(
      profile({ name: '낟낟', level: 293, imageUrl: 'https://example.com/1.png', world: '스카니아' }),
    )

    await fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)

    expect(saveCharacterProfileMock).toHaveBeenCalledTimes(1)
    expect(saveCharacterProfileMock).toHaveBeenCalledWith({
      ocid: OCID,
      name: '낟낟',
      imageUrl: 'https://example.com/1.png',
      world: '스카니아',
      level: 293,
      updatedAt: NOW.toISOString(),
    })
  })

  // 월드는 옛 응답에 없을 수 있다. undefined 를 그대로 넘기면 SQLite 바인딩이 갈라진다.
  it('월드를 모르면 null 로 넘긴다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile({ world: undefined }))

    await fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)

    expect(saveCharacterProfileMock.mock.calls[0][0].world).toBeNull()
  })

  // 스냅샷 쓰기가 실패해도 프로필은 돌려줘야 한다. 이 저장은 화면의 목적이 아니라 뒷정리다.
  it('스냅샷 쓰기가 실패해도 프로필을 돌려준다', async () => {
    const fresh = profile()
    fetchCharacterBasicMock.mockResolvedValue(fresh)
    saveCharacterProfileMock.mockRejectedValueOnce(new Error('sqlite down'))

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).resolves.toEqual(fresh)
  })

  // TTL 안이면 네트워크를 안 타므로 새로 알게 된 것이 없다. 같은 값을 다시 쓸 이유가 없다.
  it('캐시가 신선하면 스냅샷도 안 쓴다', async () => {
    const cached = profile({ name: '캐시' })
    await seedCache(60_000, cached)

    await fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)

    expect(saveCharacterProfileMock).not.toHaveBeenCalled()
  })
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

  it('새 엔트리의 cachedAt 은 인자로 받은 now 다. 함수 안에서 시계를 다시 읽지 않는다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile())

    await fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)

    const entry = await getCachedCharacterBasic(OCID)
    expect(entry?.cachedAt).toBe(NOW.toISOString())
  })

  it('캐시 쓰기는 인자로 받은 accountId 로 이뤄진다. 다른 계정 인덱스를 오염시키지 않는다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile())

    await fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)

    await expect(getAllCachedCharacterBasicOcids(ACCOUNT)).resolves.toEqual([OCID])
    await expect(getAllCachedCharacterBasicOcids('account-2')).resolves.toEqual([])
  })
})

describe('5분 TTL 가드', () => {
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

  it('경계는 배타적이다. 경과가 정확히 5분이면 만료로 보고 다시 부른다', async () => {
    await seedCache(CHARACTER_BASIC_TTL_MS, profile({ name: '캐시값' }))
    fetchCharacterBasicMock.mockResolvedValue(profile({ name: '새로받음' }))

    await fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)

    expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(1)
  })
})

// today 의 대표 캐릭터만 이 문을 연다. 그 화면이 EXP 를 그리는 캐릭터가 하나뿐이라, 5분 안에
// 새로고침을 눌러도 숫자가 안 움직이는 것을 여기서 푼다.
describe('force: 대표 캐릭터가 TTL 을 건너뛰는 문', () => {
  it('TTL 안이어도 다시 부르고 캐시를 갱신한다', async () => {
    await seedCache(CHARACTER_BASIC_TTL_MS - 1, profile({ name: '캐시값', level: 293 }))
    const fresh = profile({ name: '새로받음', level: 294 })
    fetchCharacterBasicMock.mockResolvedValue(fresh)

    await expect(
      fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW, undefined, { force: true }),
    ).resolves.toEqual(fresh)
    expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(1)
    await expect(getCachedCharacterBasic(OCID)).resolves.toEqual({
      profile: fresh,
      cachedAt: NOW.toISOString(),
    })
  })

  // 문을 여는 것은 `force` 뿐이다. 안 주면 지금까지의 규칙 그대로다.
  it('force 가 없으면 TTL 안의 캐시를 그대로 돌려준다', async () => {
    const cached = profile({ name: '캐시값' })
    await seedCache(CHARACTER_BASIC_TTL_MS - 1, cached)

    await expect(
      fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW, undefined, {}),
    ).resolves.toEqual(cached)
    expect(fetchCharacterBasicMock).not.toHaveBeenCalled()
  })

  // 강제해도 jobClass 규칙은 안 바뀐다. 모르면 안 넘기고, 그때는 캐시에 있던 값을 유지한다.
  it('강제로 받아도 캐시에 있던 jobClass 를 잃지 않는다', async () => {
    await seedCache(0, profile({ name: '캐시값', jobClass: '렌' }))
    fetchCharacterBasicMock.mockResolvedValue(profile({ name: '새로받음', level: 294 }))

    const result = await fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW, undefined, {
      force: true,
    })

    expect(result.jobClass).toBe('렌')
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

  it('미래 시각(기기 시계 되감기)이면 다시 부른다. 캐시가 영구히 신선해지지 않는다', async () => {
    await seedCache(-60_000, profile({ name: '캐시값' }))
    const fresh = profile({ name: '새로받음' })
    fetchCharacterBasicMock.mockResolvedValue(fresh)

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).resolves.toEqual(fresh)
    expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(1)
  })
})

// 직업은 character/basic 이 아니라 character/list 가 준다. 저장 경로가 이 함수
// 하나뿐이므로 값을 손에 든 호출부가 여기로 함께 넘긴다.
describe('jobClass: character/list 가 준 값을 엔트리에 함께 싣는다', () => {
  it('넘긴 값이 profile 에 실려 캐시에 쓰이고 그대로 반환된다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile())

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW, '렌')).resolves.toEqual(
      profile({ jobClass: '렌' }),
    )
    await expect(getCachedCharacterBasic(OCID)).resolves.toEqual({
      profile: profile({ jobClass: '렌' }),
      cachedAt: NOW.toISOString(),
    })
  })

  it('넘기지 않으면 캐시에 있던 값을 유지한다. 아는 값을 undefined 로 덮으면 화면에서 직업이 사라진다', async () => {
    await seedCache(CHARACTER_BASIC_TTL_MS + 1, profile({ jobClass: '비숍' }))
    fetchCharacterBasicMock.mockResolvedValue(profile({ name: '새로받음' }))

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).resolves.toEqual(
      profile({ name: '새로받음', jobClass: '비숍' }),
    )
  })

  it('넘긴 값은 캐시된 값을 덮는다. 전직하면 그 자리에서 바뀐다', async () => {
    await seedCache(CHARACTER_BASIC_TTL_MS + 1, profile({ jobClass: '비숍' }))
    fetchCharacterBasicMock.mockResolvedValue(profile())

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW, '렌')).resolves.toEqual(
      profile({ jobClass: '렌' }),
    )
  })

  it('캐시도 없고 넘기지도 않으면 키 자체가 없다. 없는 값을 지어내지 않는다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile())

    const result = await fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)

    expect('jobClass' in result).toBe(false)
  })
})

describe('실패는 캐시로 폴백하지 않고 그대로 전파한다', () => {
  it('400 OPENAPI00003(조회 불가)이 그대로 던져진다. 호출부의 characterUnavailable 분기가 산다', async () => {
    const error = new NexonBadRequestError('unavailable', 'OPENAPI00003')
    fetchCharacterBasicMock.mockRejectedValue(error)

    await expect(fetchCharacterBasicCached('key', ACCOUNT, OCID, NOW)).rejects.toBe(error)
    await expect(getCachedCharacterBasic(OCID)).resolves.toBeNull()
  })

  it('429 도 그대로 던져진다. 전역 실패 분기가 산다', async () => {
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
    // 캐시는 실패 전 값 그대로다. 새로 쓰지 않았다.
    const entry = await getCachedCharacterBasic(OCID)
    expect(entry?.profile).toEqual(stale)
    expect(entry?.cachedAt).not.toBe(NOW.toISOString())
  })
})
