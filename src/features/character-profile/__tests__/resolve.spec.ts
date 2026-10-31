import type { CachedCharacterBasicEntry } from '../../../storage/character-basic-cache'
import type { CharacterBasicProfile } from '../../../types'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'

jest.mock('../../../storage/character-profiles', () => ({
  getCharacterProfiles: jest.fn(),
  saveCharacterProfile: jest.fn().mockResolvedValue(undefined),
}))
const { getCharacterProfiles: getCharacterProfilesMock, saveCharacterProfile: saveCharacterProfileMock } =
  jest.requireMock('../../../storage/character-profiles') as Record<string, jest.Mock>

jest.mock('../../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: jest.fn(),
  clearCachedCharacterBasic: jest.fn().mockResolvedValue(undefined),
}))
const { getCachedCharacterBasic: getLegacyBasicMock, clearCachedCharacterBasic: clearLegacyBasicMock } =
  jest.requireMock('../../../storage/character-basic-cache') as Record<string, jest.Mock>

import { resolveDisplayProfiles } from '../resolve'

const NOW = '2026-09-05T00:00:00.000Z'

function basic(overrides: Partial<CharacterBasicProfile> = {}): CharacterBasicProfile {
  return { name: '루디', level: 285, imageUrl: 'https://example.test/a.png', accessFlag: true, ...overrides }
}

/** 쿼리 캐시 `characterBasic(ocid)` 에 심는다. 화면 밖 코드도 같은 캐시를 읽는다. */
function seedCache(ocid: string, entry: CachedCharacterBasicEntry): void {
  queryClient.setQueryData<CachedCharacterBasicEntry>(queryKeys.characterBasic(ocid), entry)
}

beforeEach(() => {
  queryClient.clear()
  getCharacterProfilesMock.mockReset().mockResolvedValue(new Map())
  saveCharacterProfileMock.mockClear().mockResolvedValue(undefined)
  getLegacyBasicMock.mockReset().mockResolvedValue(null)
  clearLegacyBasicMock.mockClear().mockResolvedValue(undefined)
})

it('표에 있는 것은 표에서 읽는다. 캐시를 안 본다', async () => {
  getCharacterProfilesMock.mockResolvedValue(
    new Map([
      ['ocid-1', { ocid: 'ocid-1', name: '루디', imageUrl: 'https://example.test/a.png', world: '스카니아', worldKey: 'scania', level: 285, updatedAt: NOW }],
    ]),
  )

  const profiles = await resolveDisplayProfiles(['ocid-1'])

  expect(profiles.get('ocid-1')).toEqual({
    name: '루디',
    imageUrl: 'https://example.test/a.png',
    world: '스카니아',
    worldKey: 'scania',
    level: 285,
  })
  expect(saveCharacterProfileMock).not.toHaveBeenCalled()
})

// 이 표가 생기기 전 설치본은 표가 비어 있고 캐시만 차 있다. 읽을 때 옮기는 것이 곧
// 마이그레이션이다. 별도 이관 단계를 두면 그때 이미 해제한 캐릭터는 훑을 목록에 없어 영영 안
// 옮겨진다.
it('표에 없으면 캐시에서 가져오고, 그 값을 표에 심는다', async () => {
  seedCache('ocid-2', {
    profile: basic({ name: '옛캐릭', world: '루나', worldKey: 'luna' }),
    cachedAt: NOW,
  })

  const profiles = await resolveDisplayProfiles(['ocid-2'])

  expect(profiles.get('ocid-2')).toEqual({
    name: '옛캐릭',
    imageUrl: 'https://example.test/a.png',
    world: '루나',
    worldKey: 'luna',
    level: 285,
  })
  expect(saveCharacterProfileMock).toHaveBeenCalledWith({
    ocid: 'ocid-2',
    name: '옛캐릭',
    imageUrl: 'https://example.test/a.png',
    world: '루나',
    worldKey: 'luna',
    level: 285,
    // 캐시가 직업을 모르면 `null` 이다. 표의 UPSERT 가 COALESCE 라 이미 박아 둔 값을 안 지운다.
    jobClass: null,
    updatedAt: NOW,
  })
})

// 직업은 월드 이전 판정이 읽는 값이다. 캐시가 들고 있으면 그 이관 길로 표까지 따라가야, 이미
// 조회할 수 없게 된 캐릭터도 판정 재료를 갖는다.
it('캐시가 직업을 알면 표에도 함께 심는다', async () => {
  seedCache('ocid-4', {
    profile: { ...basic({ name: '레테캐릭', world: '챌린저스2', worldKey: 'challengers_2' }), jobClass: '레테' },
    cachedAt: NOW,
  })

  await resolveDisplayProfiles(['ocid-4'])

  expect(saveCharacterProfileMock).toHaveBeenCalledWith(
    expect.objectContaining({ ocid: 'ocid-4', jobClass: '레테' }),
  )
})

it('표에도 캐시에도 없으면 결과에 안 든다. 이름 없는 행을 만들지 않는다', async () => {
  const profiles = await resolveDisplayProfiles(['ocid-3'])

  expect(profiles.has('ocid-3')).toBe(false)
  expect(saveCharacterProfileMock).not.toHaveBeenCalled()
})

it('표에 없는 것만 캐시를 읽는다', async () => {
  getCharacterProfilesMock.mockResolvedValue(
    new Map([
      ['ocid-1', { ocid: 'ocid-1', name: '루디', imageUrl: 'https://example.test/a.png', world: null, worldKey: null, level: null, updatedAt: NOW }],
    ]),
  )
  seedCache('ocid-2', { profile: basic({ name: '둘' }), cachedAt: NOW })

  await resolveDisplayProfiles(['ocid-1', 'ocid-2'])

  expect(saveCharacterProfileMock).toHaveBeenCalledTimes(1)
  expect(saveCharacterProfileMock.mock.calls[0][0].ocid).toBe('ocid-2')
})

it('같은 ocid 를 두 번 넘겨도 한 번만 찾는다', async () => {
  await resolveDisplayProfiles(['ocid-1', 'ocid-1'])

  expect(getCharacterProfilesMock).toHaveBeenCalledWith(['ocid-1'])
})

it('빈 목록이면 아무것도 조회하지 않는다', async () => {
  expect((await resolveDisplayProfiles([])).size).toBe(0)
  expect(getCharacterProfilesMock).not.toHaveBeenCalled()
})

// 표 조회가 죽어도 화면이 서야 한다. 그때는 캐시가 아는 만큼 그린다.
it('표 조회가 실패하면 캐시로 떨어진다', async () => {
  getCharacterProfilesMock.mockRejectedValue(new Error('sqlite down'))
  seedCache('ocid-2', { profile: basic({ name: '캐시만' }), cachedAt: NOW })

  const profiles = await resolveDisplayProfiles(['ocid-2'])

  expect(profiles.get('ocid-2')?.name).toBe('캐시만')
})

// 첫 실행 이관은 추적 중인 캐릭터만 옮긴다. 그 전에 추적을 뺀 캐릭터는 이 키가 값이 남은 유일한 자리다.
it('표와 쿼리 캐시에 없으면 옛 키에서 찾아 표에 심고 그 키를 지운다', async () => {
  getLegacyBasicMock.mockResolvedValue({ profile: basic({ name: '옛추적', world: '루나', worldKey: 'luna' }), cachedAt: NOW })

  const profiles = await resolveDisplayProfiles(['ocid-legacy'])

  expect(profiles.get('ocid-legacy')?.name).toBe('옛추적')
  expect(saveCharacterProfileMock).toHaveBeenCalledWith(
    expect.objectContaining({ ocid: 'ocid-legacy', name: '옛추적', worldKey: 'luna', updatedAt: NOW }),
  )
  expect(clearLegacyBasicMock).toHaveBeenCalledWith('ocid-legacy')
})

it('옛 키를 지우는 것은 표에 심은 뒤다', async () => {
  const order: string[] = []
  getLegacyBasicMock.mockResolvedValue({ profile: basic(), cachedAt: NOW })
  saveCharacterProfileMock.mockImplementation(async () => void order.push('save'))
  clearLegacyBasicMock.mockImplementation(async () => void order.push('clear'))

  await resolveDisplayProfiles(['ocid-legacy'])

  expect(order).toEqual(['save', 'clear'])
})

// 키를 지웠는데 표에 못 심었으면 이름이 어디에도 안 남는다. 남겨 두면 다음 조회가 다시 옮긴다.
it('표에 못 심으면 이름은 내고 옛 키는 남긴다', async () => {
  getLegacyBasicMock.mockResolvedValue({ profile: basic({ name: '남는키' }), cachedAt: NOW })
  saveCharacterProfileMock.mockRejectedValue(new Error('표 쓰기 실패'))

  const profiles = await resolveDisplayProfiles(['ocid-legacy'])

  expect(profiles.get('ocid-legacy')?.name).toBe('남는키')
  expect(clearLegacyBasicMock).not.toHaveBeenCalled()
})

it('쿼리 캐시에서 찾으면 옛 키를 읽지도 지우지도 않는다', async () => {
  seedCache('ocid-2', { profile: basic(), cachedAt: NOW })

  await resolveDisplayProfiles(['ocid-2'])

  expect(getLegacyBasicMock).not.toHaveBeenCalled()
  expect(clearLegacyBasicMock).not.toHaveBeenCalled()
})

it('옛 키 읽기가 던져도 화면은 선다', async () => {
  getLegacyBasicMock.mockRejectedValue(new Error('읽기 실패'))

  const profiles = await resolveDisplayProfiles(['ocid-legacy'])

  expect(profiles.has('ocid-legacy')).toBe(false)
})
