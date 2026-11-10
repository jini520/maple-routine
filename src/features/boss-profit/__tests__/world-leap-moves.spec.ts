// 월드 리프로 이어진 옛 ocid 의 기록을 새 ocid 로 옮기는 회차. 기록마다 옮기는 규칙은 저장소 테스트가 보고, 여기서는 연결마다
// 여덟 기록을 다 부르는지와 실패가 서로를 막지 않는지를 본다.

jest.mock('../../../storage/character-world-leaps', () => ({ getCharacterWorldLeaps: jest.fn() }))
jest.mock('../../../storage/boss-profit', () => ({ moveBossRecordsToOcid: jest.fn() }))
jest.mock('../../../storage/income', () => ({ moveIncomeRecordsToOcid: jest.fn() }))
jest.mock('../../../storage/spend', () => ({ moveSpendRecordsToOcid: jest.fn() }))
jest.mock('../../../storage/remembered-levels', () => ({ moveRememberedLevelsToOcid: jest.fn() }))
jest.mock('../../../storage/manual-tracked-content', () => ({ moveManualTrackedContentToOcid: jest.fn() }))
jest.mock('../../../storage/last-hunts', () => ({ moveLastHuntToOcid: jest.fn() }))
jest.mock('../../../storage/boss-profit-calculator-records', () => ({ moveBossProfitCalculatorRecordsToOcid: jest.fn() }))
jest.mock('../../../storage/party-appointments', () => ({ movePartyAppointmentsToOcid: jest.fn() }))
jest.mock('../../../storage/character-profiles', () => ({ getCharacterProfiles: jest.fn() }))
jest.mock('../../query/client', () => ({ queryClient: { invalidateQueries: jest.fn() } }))
jest.mock('../../../lib/boss/bosses', () => ({ isSeasonBoss: (key: string) => key === 'season_boss' }))
jest.mock('../../../lib/world/worlds', () => ({ isChallengersWorld: (key: string | null | undefined) => key === 'challengers' }))

import { queryKeys } from '../../query/keys'
import { moveWorldLeapRecords } from '../world-leap-moves'

function mockOf(path: string, name: string): jest.Mock {
  return (jest.requireMock(path) as Record<string, jest.Mock>)[name]!
}

const leaps = mockOf('../../../storage/character-world-leaps', 'getCharacterWorldLeaps')
const boss = mockOf('../../../storage/boss-profit', 'moveBossRecordsToOcid')
const party = mockOf('../../../storage/party-appointments', 'movePartyAppointmentsToOcid')
const calculator = mockOf('../../../storage/boss-profit-calculator-records', 'moveBossProfitCalculatorRecordsToOcid')
const profiles = mockOf('../../../storage/character-profiles', 'getCharacterProfiles')
const invalidate = (jest.requireMock('../../query/client') as { queryClient: { invalidateQueries: jest.Mock } }).queryClient
  .invalidateQueries

const PREFERENCE_AND_CASHBOOK_MOVES: ReadonlyArray<readonly [string, string]> = [
  ['../../../storage/income', 'moveIncomeRecordsToOcid'],
  ['../../../storage/spend', 'moveSpendRecordsToOcid'],
  ['../../../storage/remembered-levels', 'moveRememberedLevelsToOcid'],
  ['../../../storage/manual-tracked-content', 'moveManualTrackedContentToOcid'],
  ['../../../storage/last-hunts', 'moveLastHuntToOcid'],
]

beforeEach(() => {
  jest.clearAllMocks()
  leaps.mockResolvedValue([
    { fromOcid: 'old-1', toOcid: 'new-1', linkedAt: '2026-09-14T00:00:00.000Z' },
    { fromOcid: 'old-2', toOcid: 'new-2', linkedAt: '2026-10-01T00:00:00.000Z' },
  ])
  boss.mockResolvedValue(0)
  party.mockResolvedValue(false)
  calculator.mockResolvedValue(undefined)
  profiles.mockResolvedValue(new Map())
  for (const [path, name] of PREFERENCE_AND_CASHBOOK_MOVES) mockOf(path, name).mockResolvedValue(undefined)
})

/** 계산기 옮기기에 넘긴 고르기 함수로 그 보스 줄을 넘기는지. */
function keepsBoss(call: number, bossKey: string): boolean {
  const keepBoss = calculator.mock.calls[call]![2] as (boss: { bossKey: string }) => boolean
  return keepBoss({ bossKey })
}

it('연결마다 여덟 기록을 옛 ocid 에서 새 ocid 로 옮기고, 옮긴 보스 기간 수를 돌려준다', async () => {
  boss.mockResolvedValueOnce(2).mockResolvedValueOnce(1)

  await expect(moveWorldLeapRecords()).resolves.toBe(3)

  for (const move of [boss, party, ...PREFERENCE_AND_CASHBOOK_MOVES.map(([path, name]) => mockOf(path, name))]) {
    expect(move.mock.calls).toEqual([
      ['old-1', 'new-1'],
      ['old-2', 'new-2'],
    ])
  }
  expect(calculator.mock.calls.map(([from, to]) => [from, to])).toEqual([
    ['old-1', 'new-1'],
    ['old-2', 'new-2'],
  ])
})

// 시즌 보스는 챌린저스 월드 캐릭터만 잡는다. 일반 월드로 리프한 캐릭터의 계산기 기록에 남기면 못 잡는 보스가 수입에 든다.
it('계산기 기록은 새 캐릭터가 챌린저스 월드가 아니면 시즌 보스 줄을 빼고 옮긴다', async () => {
  profiles.mockImplementation(async (ocids: string[]) =>
    new Map(ocids.map((ocid) => [ocid, { ocid, worldKey: ocid === 'new-2' ? 'challengers' : 'elysium' }])),
  )

  await moveWorldLeapRecords()

  expect(keepsBoss(0, 'season_boss')).toBe(false)
  expect(keepsBoss(0, 'lotus')).toBe(true)
  expect(keepsBoss(1, 'season_boss')).toBe(true)
})

// 보스 선택도 월드를 모르면 시즌 보스 칸을 세우지 않는다. 같은 캐릭터를 두 곳이 다르게 보면 안 된다.
it('새 캐릭터의 월드를 모르면 시즌 보스를 못 잡는 캐릭터로 본다', async () => {
  await moveWorldLeapRecords()

  expect(keepsBoss(0, 'season_boss')).toBe(false)
})

// 프로필을 못 읽은 것을 일반 월드로 읽으면 챌린저스 캐릭터의 시즌 보스를 지운다. 다음 회차가 다시 옮긴다.
it('새 캐릭터 프로필을 못 읽으면 그 회차에는 계산기 기록을 옮기지 않는다', async () => {
  profiles.mockRejectedValue(new Error('db'))

  await moveWorldLeapRecords()

  expect(calculator).not.toHaveBeenCalled()
  expect(party).toHaveBeenCalledTimes(2)
})

// 다음 회차가 마저 옮긴다. 한 기록이나 한 연결이 막히면 나머지 기록이 두 ocid 로 갈린 채 남는다.
it('한 기록이 실패해도 다른 기록과 다른 연결을 옮긴다', async () => {
  boss.mockRejectedValueOnce(new Error('db')).mockResolvedValueOnce(1)
  mockOf('../../../storage/income', 'moveIncomeRecordsToOcid').mockRejectedValue(new Error('db'))

  await expect(moveWorldLeapRecords()).resolves.toBe(1)

  expect(mockOf('../../../storage/spend', 'moveSpendRecordsToOcid')).toHaveBeenCalledTimes(2)
  expect(party).toHaveBeenCalledTimes(2)
})

it('연결을 못 읽으면 아무것도 옮기지 않고 0 이다', async () => {
  leaps.mockRejectedValue(new Error('db'))

  await expect(moveWorldLeapRecords()).resolves.toBe(0)
  expect(boss).not.toHaveBeenCalled()
})

// 약속 화면은 캐시만 그리고 다시 읽을 계기가 없다. 낡은 캐시를 저장하면 옮긴 ocid 가 옛 ocid 로 돌아간다.
it('파티 약속을 바꿨을 때만 약속 쿼리를 무효화한다', async () => {
  party.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

  await moveWorldLeapRecords()

  expect(invalidate).toHaveBeenCalledTimes(1)
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.partyAppointments() })
})
