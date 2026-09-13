// 월드 리프로 두 ocid 가 이어지는 순간. 연결을 남기고, 처음 이을 때만 보스별 파티원 수 설정을 복사한다.

jest.mock('../../../storage/character-world-leaps', () => ({ linkCharacterWorldLeap: jest.fn() }))
jest.mock('../../../storage/boss-party-settings', () => ({ copyMissingBossPartySettings: jest.fn() }))

import { linkWorldLeap } from '../world-leap-link'

const { linkCharacterWorldLeap: linkMock } = jest.requireMock('../../../storage/character-world-leaps') as Record<
  string,
  jest.Mock
>
const { copyMissingBossPartySettings: copyMock } = jest.requireMock('../../../storage/boss-party-settings') as Record<
  string,
  jest.Mock
>

const NOW = new Date('2026-09-14T03:00:00.000Z')

beforeEach(() => {
  linkMock.mockReset().mockResolvedValue(true)
  copyMock.mockReset().mockResolvedValue(undefined)
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
