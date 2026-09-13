// 캐릭터 관리 후보 목록의 캐시 인덱스가 목록에 맞춰져도 선택된 캐릭터 목록은 그대로 선다.
//
// 추적 중인 조회 불가 캐릭터(월드 리프로 남은 옛 ocid)도 인덱스에서 빠진다. 선택된 캐릭터 목록은
// 인덱스가 아니라 캐시 항목과 조회 원장으로 그리므로 서야 한다. 넥슨 계층과 SQLite 만 목으로 두고
// 로스터 조회부터 이 훅까지 실물로 잇는다.
import { renderHook, waitFor } from '@testing-library/react-native'

import { getCharacterPickerRoster } from '../../features/schedule-sync/schedule-sync'
import { buildSelectedCharacterViews } from '../../features/character-manage/derivations'
import { installFakePreferences } from '../../storage/__tests__/fake-preferences'
import {
  getAllCachedCharacterBasicOcids,
  setCachedCharacterBasic,
} from '../../storage/character-basic-cache'
import { setTrackedCharacterOcids } from '../../storage/character-selection'
import { markScheduleProbeUnavailable } from '../../storage/schedule-probe-ledger'
import type { CharacterBasicProfile, CharacterPickerEntry } from '../../types'
import { useKnownProfiles } from '../useKnownProfiles'

jest.mock('../../nexon/character', () => ({
  fetchCharacterList: jest.fn(),
  fetchCharacterBasic: jest.fn(),
}))
const { fetchCharacterList: fetchCharacterListMock, fetchCharacterBasic: fetchCharacterBasicMock } =
  jest.requireMock('../../nexon/character') as Record<string, jest.Mock>
jest.mock('../../nexon/schedule', () => ({ fetchSchedulerCharacterState: jest.fn() }))
jest.mock('../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
const { getAuthConfig: getAuthConfigMock } = jest.requireMock('../../storage/api-key') as Record<
  string,
  jest.Mock
>
jest.mock('../../storage/character-profiles', () => ({
  getCharacterProfiles: jest.fn(),
  saveCharacterProfile: jest.fn(),
}))
const {
  getCharacterProfiles: getCharacterProfilesMock,
  saveCharacterProfile: saveCharacterProfileMock,
} = jest.requireMock('../../storage/character-profiles') as Record<string, jest.Mock>

const ACCOUNT = 'acc-1'

function profile(name: string): CharacterBasicProfile {
  return { name, level: 285, imageUrl: `https://example.test/${name}.png`, accessFlag: true }
}

beforeEach(() => {
  installFakePreferences()
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1' })
  getCharacterProfilesMock.mockResolvedValue(new Map())
  saveCharacterProfileMock.mockResolvedValue(undefined)
  fetchCharacterBasicMock.mockImplementation(async (_apiKey: string, ocid: string) => profile(ocid))
})

it('추적 중인 목록 밖 ocid 는 인덱스에서 빠져도 선택된 캐릭터 목록에 그대로 선다', async () => {
  await setTrackedCharacterOcids(['stranded'])
  await setCachedCharacterBasic(ACCOUNT, 'stranded', {
    profile: profile('지내우시'),
    cachedAt: '2026-01-01T00:00:00.000Z',
  })
  await markScheduleProbeUnavailable('stranded')
  fetchCharacterListMock.mockResolvedValue([
    { accountId: ACCOUNT, characters: [{ ocid: 'listed', name: '낟낟', world: '엘리시움', level: 290 }] },
  ])

  let entries: CharacterPickerEntry[] = []
  await getCharacterPickerRoster(
    (next) => {
      entries = next
    },
    { accountId: ACCOUNT },
  )
  await expect(getAllCachedCharacterBasicOcids(ACCOUNT)).resolves.not.toContain('stranded')

  const { result } = await renderHook(() =>
    useKnownProfiles({ ocids: ['stranded'], fallbackEntries: entries }),
  )

  await waitFor(() => expect(result.current.unavailableOcids.has('stranded')).toBe(true))
  const [view] = buildSelectedCharacterViews(
    ['stranded'],
    result.current.knownProfiles,
    result.current.unavailableOcids,
  )
  expect(view).toMatchObject({ ocid: 'stranded', name: '지내우시', level: 285, unavailable: true })
})
