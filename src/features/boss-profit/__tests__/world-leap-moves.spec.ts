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
jest.mock('../../query/client', () => ({ queryClient: { invalidateQueries: jest.fn() } }))

import { queryKeys } from '../../query/keys'
import { moveWorldLeapRecords } from '../world-leap-moves'

function mockOf(path: string, name: string): jest.Mock {
  return (jest.requireMock(path) as Record<string, jest.Mock>)[name]!
}

const leaps = mockOf('../../../storage/character-world-leaps', 'getCharacterWorldLeaps')
const boss = mockOf('../../../storage/boss-profit', 'moveBossRecordsToOcid')
const party = mockOf('../../../storage/party-appointments', 'movePartyAppointmentsToOcid')
const invalidate = (jest.requireMock('../../query/client') as { queryClient: { invalidateQueries: jest.Mock } }).queryClient
  .invalidateQueries

const PREFERENCE_AND_CASHBOOK_MOVES: ReadonlyArray<readonly [string, string]> = [
  ['../../../storage/income', 'moveIncomeRecordsToOcid'],
  ['../../../storage/spend', 'moveSpendRecordsToOcid'],
  ['../../../storage/remembered-levels', 'moveRememberedLevelsToOcid'],
  ['../../../storage/manual-tracked-content', 'moveManualTrackedContentToOcid'],
  ['../../../storage/last-hunts', 'moveLastHuntToOcid'],
  ['../../../storage/boss-profit-calculator-records', 'moveBossProfitCalculatorRecordsToOcid'],
]

beforeEach(() => {
  jest.clearAllMocks()
  leaps.mockResolvedValue([
    { fromOcid: 'old-1', toOcid: 'new-1', linkedAt: '2026-09-14T00:00:00.000Z' },
    { fromOcid: 'old-2', toOcid: 'new-2', linkedAt: '2026-10-01T00:00:00.000Z' },
  ])
  boss.mockResolvedValue(0)
  party.mockResolvedValue(false)
  for (const [path, name] of PREFERENCE_AND_CASHBOOK_MOVES) mockOf(path, name).mockResolvedValue(undefined)
})

it('연결마다 여덟 기록을 옛 ocid 에서 새 ocid 로 옮기고, 옮긴 보스 기간 수를 돌려준다', async () => {
  boss.mockResolvedValueOnce(2).mockResolvedValueOnce(1)

  await expect(moveWorldLeapRecords()).resolves.toBe(3)

  for (const move of [boss, party, ...PREFERENCE_AND_CASHBOOK_MOVES.map(([path, name]) => mockOf(path, name))]) {
    expect(move.mock.calls).toEqual([
      ['old-1', 'new-1'],
      ['old-2', 'new-2'],
    ])
  }
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
