// 월드 리프로 두 ocid 가 이어지는 순간. 연결을 남기고, 처음 이을 때만 보스별 파티원 수 설정을 복사한다.

jest.mock('../../../storage/character-world-leaps', () => ({ linkCharacterWorldLeap: jest.fn() }))
jest.mock('../../../storage/boss-party-settings', () => ({ copyMissingBossPartySettings: jest.fn() }))
jest.mock('../../../storage/character-profiles', () => ({ getCharacterProfilesByNames: jest.fn() }))

import type { MapleCharacter } from '../../../types'
import { linkWorldLeap, linkWorldLeapsByNameAndJob } from '../world-leap-link'

const { linkCharacterWorldLeap: linkMock } = jest.requireMock('../../../storage/character-world-leaps') as Record<
  string,
  jest.Mock
>
const { copyMissingBossPartySettings: copyMock } = jest.requireMock('../../../storage/boss-party-settings') as Record<
  string,
  jest.Mock
>

const { getCharacterProfilesByNames: profilesByNamesMock } = jest.requireMock('../../../storage/character-profiles') as Record<
  string,
  jest.Mock
>

const NOW = new Date('2026-09-14T03:00:00.000Z')

beforeEach(() => {
  linkMock.mockReset().mockResolvedValue(true)
  copyMock.mockReset().mockResolvedValue(undefined)
  profilesByNamesMock.mockReset().mockResolvedValue([])
})

it('연결을 남기고 옛 캐릭터 설정을 새 캐릭터로 복사한다', async () => {
  await linkWorldLeap('old', 'new', NOW)

  expect(linkMock).toHaveBeenCalledWith('old', 'new', NOW.toISOString())
  expect(copyMock).toHaveBeenCalledWith('old', 'new', NOW.toISOString())
})

// 설정 복사는 이어지는 순간 한 번이다. 그 뒤 옛 캐릭터 기록을 고쳐도 새 캐릭터 설정이 흔들리면 안 된다.
it('이미 이어진 옛 ocid 면 복사하지 않는다', async () => {
  linkMock.mockResolvedValue(false)

  await linkWorldLeap('old', 'new', NOW)

  expect(copyMock).not.toHaveBeenCalled()
})

// 모달을 안 거친 리프(새 캐릭터 직접 추가 + 옛 캐릭터 ✕)를 잇는다. 캐릭터 이름은 게임 전체에서 하나라
// 이름·직업 말고는 조건을 안 건다. 방향은 `character/list` 응답에 있는가가 정한다.
describe('linkWorldLeapsByNameAndJob', () => {
  const 새캐릭터: MapleCharacter = { ocid: 'new', name: '지내우시', world: '엘리시움', worldKey: 'elysium', jobClass: '레테', level: 286 }

  function profile(ocid: string, overrides: { name?: string; jobClass?: string | null; createdDate?: string | null } = {}) {
    return {
      ocid,
      name: '지내우시',
      imageUrl: '',
      world: '챌린저스2',
      worldKey: 'challengers_2',
      level: 285,
      jobClass: '레테',
      updatedAt: '2026-09-10T00:00:00.000Z',
      ...overrides,
    }
  }

  it('목록에 없는 스냅샷을 옛 캐릭터로, 목록의 같은 이름·직업을 새 캐릭터로 잇는다', async () => {
    profilesByNamesMock.mockResolvedValue([profile('old'), profile('new')])

    await linkWorldLeapsByNameAndJob([새캐릭터, { ...새캐릭터, ocid: 'x', name: '루디' }], NOW)

    expect(profilesByNamesMock).toHaveBeenCalledWith(['지내우시', '루디'])
    expect(linkMock).toHaveBeenCalledTimes(1)
    expect(linkMock).toHaveBeenCalledWith('old', 'new', NOW.toISOString())
    expect(copyMock).toHaveBeenCalledWith('old', 'new', NOW.toISOString())
  })

  it('직업이 다르면 잇지 않는다', async () => {
    profilesByNamesMock.mockResolvedValue([profile('old', { jobClass: '아크메이지' })])

    await linkWorldLeapsByNameAndJob([새캐릭터], NOW)

    expect(linkMock).not.toHaveBeenCalled()
  })

  it('옛 직업을 모르면 잇지 않는다', async () => {
    profilesByNamesMock.mockResolvedValue([profile('old', { jobClass: null })])

    await linkWorldLeapsByNameAndJob([새캐릭터], NOW)

    expect(linkMock).not.toHaveBeenCalled()
  })

  // 둘 다 목록에 있으면 판단할 근거가 없다. 이름이 게임 전체에서 하나라 원래 생기지 않는 모양이다.
  it('같은 이름·직업이 둘 다 목록에 있으면 잇지 않는다', async () => {
    profilesByNamesMock.mockResolvedValue([profile('old'), profile('new')])

    await linkWorldLeapsByNameAndJob([새캐릭터, { ...새캐릭터, ocid: 'old' }], NOW)

    expect(linkMock).not.toHaveBeenCalled()
  })

  // 이름은 옛 캐릭터가 내준 뒤 다른 캐릭터가 쓸 수 있다. 만든 날은 리프 뒤에도 그대로라 두 캐릭터를 가른다.
  it('두 캐릭터의 만든 날이 다르면 잇지 않는다', async () => {
    profilesByNamesMock.mockResolvedValue([
      profile('old', { createdDate: '2025-06-19' }),
      profile('new', { createdDate: '2026-09-01' }),
    ])

    await linkWorldLeapsByNameAndJob([새캐릭터], NOW)

    expect(linkMock).not.toHaveBeenCalled()
  })

  it('만든 날이 같으면 잇는다', async () => {
    profilesByNamesMock.mockResolvedValue([
      profile('old', { createdDate: '2025-06-19' }),
      profile('new', { createdDate: '2025-06-19' }),
    ])

    await linkWorldLeapsByNameAndJob([새캐릭터], NOW)

    expect(linkMock).toHaveBeenCalledWith('old', 'new', NOW.toISOString())
  })

  // 이 기능 전에 리프한 옛 캐릭터는 다시 부를 수 없어 만든 날을 영영 모른다. 모름을 다름으로 읽으면 그 리프를 못 잇는다.
  it('한쪽이라도 만든 날을 모르면 이름 · 직업으로 잇는다', async () => {
    profilesByNamesMock.mockResolvedValue([profile('old', { createdDate: null }), profile('new', { createdDate: '2025-06-19' })])
    await linkWorldLeapsByNameAndJob([새캐릭터], NOW)

    profilesByNamesMock.mockResolvedValue([profile('old', { createdDate: '2025-06-19' })])
    await linkWorldLeapsByNameAndJob([새캐릭터], NOW)

    expect(linkMock).toHaveBeenCalledTimes(2)
  })

  it('목록이 비었으면 스냅샷을 안 읽는다', async () => {
    await linkWorldLeapsByNameAndJob([], NOW)

    expect(profilesByNamesMock).not.toHaveBeenCalled()
  })
})
