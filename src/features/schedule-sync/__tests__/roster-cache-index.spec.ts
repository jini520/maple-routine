// 캐릭터 관리 후보 목록의 캐시 인덱스를 `character/list` 에 맞추는 회귀 가드.
//
// 인덱스를 붙이기만 하면 목록에서 빠진 캐릭터(월드 리프로 남은 옛 ocid)가 영영 남는다. 그러면 화면을
// 열 때마다 stub 단계가 그 캐릭터를 그렸다가 목록 응답 뒤의 방출이 지운다. 넥슨 계층과 SQLite 만
// 목으로 두고 캐시 인덱스·조회 원장·추적 목록은 실물을 쓴다. 인덱스가 다음 회차의 stub 단계에
// 실제로 닿는지가 이 파일이 볼 것이라서다.
import { waitFor } from '../../../__tests__/wait-for'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import {
  getAllCachedCharacterBasicOcids,
  getCachedCharacterBasic,
  setCachedCharacterBasic,
} from '../../../storage/character-basic-cache'
import { NexonBadRequestError, NexonNetworkError } from '../../../nexon/errors'
import type { CharacterBasicProfile, CharacterPickerEntry, MapleCharacter } from '../../../types'

jest.mock('../../../nexon/character', () => ({
  fetchCharacterList: jest.fn(),
  fetchCharacterBasic: jest.fn(),
}))
const { fetchCharacterList: fetchCharacterListMock, fetchCharacterBasic: fetchCharacterBasicMock } =
  jest.requireMock('../../../nexon/character') as Record<string, jest.Mock>
jest.mock('../../../nexon/schedule', () => ({ fetchSchedulerCharacterState: jest.fn() }))
jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
const { getAuthConfig: getAuthConfigMock } = jest.requireMock('../../../storage/api-key') as Record<
  string,
  jest.Mock
>
jest.mock('../../../storage/character-profiles', () => ({
  getCharacterProfiles: jest.fn(),
  saveCharacterProfile: jest.fn(),
}))
const {
  getCharacterProfiles: getCharacterProfilesMock,
  saveCharacterProfile: saveCharacterProfileMock,
} = jest.requireMock('../../../storage/character-profiles') as Record<string, jest.Mock>

import { getCharacterPickerRoster } from '../character-roster'

const ACCOUNT = 'acc-1'
/** 5분 TTL 을 넘긴 시각. 목록 캐릭터의 `character/basic` 이 실제로 나간다. */
const STALE_CACHED_AT = '2026-01-01T00:00:00.000Z'

function profile(name: string): CharacterBasicProfile {
  return { name, level: 250, imageUrl: `https://example.test/${name}.png`, accessFlag: true }
}

function character(ocid: string): MapleCharacter {
  return { ocid, name: `캐릭-${ocid}`, world: '엘리시움', jobClass: '렌', level: 250 }
}

function ocidsOf(entries: CharacterPickerEntry[]): string[] {
  return entries.map((entry) => entry.ocid).sort()
}

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1' })
  getCharacterProfilesMock.mockResolvedValue(new Map())
  saveCharacterProfileMock.mockResolvedValue(undefined)
  fetchCharacterBasicMock.mockReset()
  fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => profile(ocid))
  fetchCharacterListMock.mockReset()
  fetchCharacterListMock.mockResolvedValue([{ accountId: ACCOUNT, characters: [character('listed')] }])

  // 목록에 있는 캐릭터 하나와, 목록에서 빠졌지만 인덱스에 남은 캐릭터 하나.
  await setCachedCharacterBasic(ACCOUNT, 'listed', { profile: profile('listed'), cachedAt: STALE_CACHED_AT })
  await setCachedCharacterBasic(ACCOUNT, 'gone', { profile: profile('gone'), cachedAt: STALE_CACHED_AT })
})

describe('getCharacterPickerRoster 가 캐시 인덱스를 character/list 에 맞춘다', () => {
  it('목록 밖 ocid 는 인덱스에서 빠지고 캐시 항목은 남는다', async () => {
    await getCharacterPickerRoster(jest.fn(), { accountId: ACCOUNT })

    await expect(getAllCachedCharacterBasicOcids(ACCOUNT)).resolves.toEqual(['listed'])
    await expect(getCachedCharacterBasic('gone')).resolves.not.toBeNull()
  })

  it('다음 호출의 stub 단계가 그 캐릭터를 방출하지 않는다', async () => {
    const first = jest.fn()
    await getCharacterPickerRoster(first, { accountId: ACCOUNT })
    // 맞추기 전의 인덱스로 그린 stub 에는 섰다. 이 파일이 막는 증상이 이것이다.
    expect(ocidsOf(first.mock.calls[0][0] as CharacterPickerEntry[])).toEqual(['gone', 'listed'])

    // 다음 회차는 목록 응답이 오기 전의 stub 방출만 본다.
    fetchCharacterListMock.mockImplementation(() => new Promise(() => {}))
    const second = jest.fn()
    void getCharacterPickerRoster(second, { accountId: ACCOUNT })

    await waitFor(() => expect(second).toHaveBeenCalled())
    expect(ocidsOf(second.mock.calls[0][0] as CharacterPickerEntry[])).toEqual(['listed'])
  })

  it('character/list 가 실패하면 인덱스가 그대로다', async () => {
    fetchCharacterListMock.mockRejectedValue(new NexonNetworkError('offline'))

    await expect(getCharacterPickerRoster(jest.fn(), { accountId: ACCOUNT })).rejects.toThrow()

    const ocids = await getAllCachedCharacterBasicOcids(ACCOUNT)
    expect(ocids.sort()).toEqual(['gone', 'listed'])
  })

  it('지정한 계정을 응답에서 못 찾으면 인덱스가 그대로다', async () => {
    fetchCharacterListMock.mockResolvedValue([{ accountId: 'acc-other', characters: [character('x')] }])

    await expect(getCharacterPickerRoster(jest.fn(), { accountId: ACCOUNT })).rejects.toThrow()

    const ocids = await getAllCachedCharacterBasicOcids(ACCOUNT)
    expect(ocids.sort()).toEqual(['gone', 'listed'])
  })

  it('character/basic 이 조회 불가여도 목록에 있으면 인덱스에 남는다', async () => {
    fetchCharacterBasicMock.mockRejectedValue(new NexonBadRequestError('조회할 수 없는 ocid', 'OPENAPI00003'))

    await getCharacterPickerRoster(jest.fn(), { accountId: ACCOUNT })

    await expect(getAllCachedCharacterBasicOcids(ACCOUNT)).resolves.toEqual(['listed'])
  })

  // 목록에 돌아온 캐릭터의 캐시가 5분 TTL 안이면 `character/basic` 이 안 나가 캐시도 다시 안 쓰인다.
  it('5분 TTL 안의 캐시로 목록에 돌아온 캐릭터를 인덱스에 다시 붙인다', async () => {
    await getCharacterPickerRoster(jest.fn(), { accountId: ACCOUNT })
    await expect(getAllCachedCharacterBasicOcids(ACCOUNT)).resolves.toEqual(['listed'])

    await prefs.set(
      'characterBasicCache:gone',
      JSON.stringify({ profile: profile('gone'), cachedAt: new Date().toISOString() }),
    )
    fetchCharacterListMock.mockResolvedValue([
      { accountId: ACCOUNT, characters: [character('listed'), character('gone')] },
    ])
    fetchCharacterBasicMock.mockClear()

    await getCharacterPickerRoster(jest.fn(), { accountId: ACCOUNT })

    expect(fetchCharacterBasicMock).not.toHaveBeenCalledWith('key-1', 'gone')
    const ocids = await getAllCachedCharacterBasicOcids(ACCOUNT)
    expect(ocids.sort()).toEqual(['gone', 'listed'])
  })
})
