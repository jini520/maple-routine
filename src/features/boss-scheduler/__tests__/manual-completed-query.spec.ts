jest.mock('../../../storage/boss-profit', () => ({ getManualBossProfitRecordKeys: jest.fn() }))
jest.mock('../../schedule-sync/schedule-query', () => ({ readTrackedOcids: jest.fn(async () => ['a', 'b']) }))

import { getCurrentBossProfitPeriod } from '../../../lib/boss/boss-profit-period'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import { manualCompletedOptions, readManualCompleted } from '../manual-completed-query'

const { getManualBossProfitRecordKeys: recordsMock } = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>

const NOW = new Date('2026-10-31T05:00:00.000Z')

beforeEach(() => {
  queryClient.clear()
  recordsMock.mockReset().mockResolvedValue([
    { ocid: 'a', bossKey: 'lotus', difficulty: 'hard' },
    { ocid: 'a', bossKey: 'damien', difficulty: 'hard' },
    { ocid: 'b', bossKey: 'lucid', difficulty: 'normal' },
  ])
})

it('이번 주 · 이번 달 기간 키가 열쇠이고, 보스 기록 판과 추적 목록에 매여 무효화된다', () => {
  const options = manualCompletedOptions(NOW)
  expect(options.queryKey).toEqual(
    queryKeys.manualCompleted(
      getCurrentBossProfitPeriod('weekly', NOW).periodKey,
      getCurrentBossProfitPeriod('monthly', NOW).periodKey,
    ),
  )
  expect(options.meta).toEqual({ tables: ['boss_profit_records'], dependsOn: ['tracked-ocids'] })
})

it('추적 캐릭터의 두 기간 기록을 캐릭터별 열쇠(`bossKey|difficulty`)로 묶는다', async () => {
  const data = await queryClient.fetchQuery(manualCompletedOptions(NOW))

  expect(recordsMock).toHaveBeenCalledWith(
    ['a', 'b'],
    [getCurrentBossProfitPeriod('weekly', NOW).periodKey, getCurrentBossProfitPeriod('monthly', NOW).periodKey],
  )
  expect(data).toEqual({ a: ['lotus|hard', 'damien|hard'], b: ['lucid|normal'] })
})

// 여기서 던지면 스케줄러 화면 전체가 못 선다. 카드가 넥슨이 준 그대로 서고 다음 회차가 다시 읽는다.
it('읽기가 실패하거나 추적이 없으면 빈 표다', async () => {
  recordsMock.mockRejectedValue(new Error('sqlite'))
  expect(await readManualCompleted(['a'], ['w', 'm'])).toEqual({})
  expect(await readManualCompleted([], ['w', 'm'])).toEqual({})
  expect(recordsMock).toHaveBeenCalledTimes(1)
})
