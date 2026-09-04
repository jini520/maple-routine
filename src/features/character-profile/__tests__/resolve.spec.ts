import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { setCachedCharacterBasic } from '../../../storage/character-basic-cache'
import type { CharacterBasicProfile } from '../../../types'

jest.mock('../../../storage/character-profiles', () => ({
  getCharacterProfiles: jest.fn(),
  saveCharacterProfile: jest.fn().mockResolvedValue(undefined),
}))
const { getCharacterProfiles: getCharacterProfilesMock, saveCharacterProfile: saveCharacterProfileMock } =
  jest.requireMock('../../../storage/character-profiles') as Record<string, jest.Mock>

import { resolveDisplayProfiles } from '../resolve'

const NOW = '2026-09-05T00:00:00.000Z'

function basic(overrides: Partial<CharacterBasicProfile> = {}): CharacterBasicProfile {
  return { name: '루디', level: 285, imageUrl: 'https://example.test/a.png', accessFlag: true, ...overrides }
}

beforeEach(() => {
  installFakePreferences()
  getCharacterProfilesMock.mockReset().mockResolvedValue(new Map())
  saveCharacterProfileMock.mockClear().mockResolvedValue(undefined)
})

it('표에 있는 것은 표에서 읽는다. 캐시를 안 본다', async () => {
  getCharacterProfilesMock.mockResolvedValue(
    new Map([
      ['ocid-1', { ocid: 'ocid-1', name: '루디', imageUrl: 'https://example.test/a.png', world: '스카니아', level: 285, updatedAt: NOW }],
    ]),
  )

  const profiles = await resolveDisplayProfiles(['ocid-1'])

  expect(profiles.get('ocid-1')).toEqual({
    name: '루디',
    imageUrl: 'https://example.test/a.png',
    world: '스카니아',
    level: 285,
  })
  expect(saveCharacterProfileMock).not.toHaveBeenCalled()
})

// 이 표가 생기기 전 설치본은 표가 비어 있고 캐시만 차 있다. 읽을 때 옮기는 것이 곧
// 마이그레이션이다. 별도 이관 단계를 두면 그때 이미 해제한 캐릭터는 훑을 목록에 없어 영영 안
// 옮겨진다.
it('표에 없으면 캐시에서 가져오고, 그 값을 표에 심는다', async () => {
  await setCachedCharacterBasic('account-1', 'ocid-2', {
    profile: basic({ name: '옛캐릭', world: '루나' }),
    cachedAt: NOW,
  })

  const profiles = await resolveDisplayProfiles(['ocid-2'])

  expect(profiles.get('ocid-2')).toEqual({
    name: '옛캐릭',
    imageUrl: 'https://example.test/a.png',
    world: '루나',
    level: 285,
  })
  expect(saveCharacterProfileMock).toHaveBeenCalledWith({
    ocid: 'ocid-2',
    name: '옛캐릭',
    imageUrl: 'https://example.test/a.png',
    world: '루나',
    level: 285,
    updatedAt: NOW,
  })
})

it('표에도 캐시에도 없으면 결과에 안 든다. 이름 없는 행을 만들지 않는다', async () => {
  const profiles = await resolveDisplayProfiles(['ocid-3'])

  expect(profiles.has('ocid-3')).toBe(false)
  expect(saveCharacterProfileMock).not.toHaveBeenCalled()
})

it('표에 없는 것만 캐시를 읽는다', async () => {
  getCharacterProfilesMock.mockResolvedValue(
    new Map([
      ['ocid-1', { ocid: 'ocid-1', name: '루디', imageUrl: 'https://example.test/a.png', world: null, level: null, updatedAt: NOW }],
    ]),
  )
  await setCachedCharacterBasic('account-1', 'ocid-2', { profile: basic({ name: '둘' }), cachedAt: NOW })

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
  await setCachedCharacterBasic('account-1', 'ocid-2', { profile: basic({ name: '캐시만' }), cachedAt: NOW })

  const profiles = await resolveDisplayProfiles(['ocid-2'])

  expect(profiles.get('ocid-2')?.name).toBe('캐시만')
})
