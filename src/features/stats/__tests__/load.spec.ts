jest.mock('../../cashbook/records', () => ({
  loadMonthDays: jest.fn().mockResolvedValue({ '2026-09-24': [] }),
}))

import { loadMonthDays } from '../../cashbook/records'
import { historyFloorDateKey } from '../../cashbook/range'
import { loadStatsDays } from '../load'

describe('loadStatsDays', () => {
  // 누적 카드가 기록의 처음부터 더하므로, 앱이 조회할 수 있는 가장 이른 날부터 오늘까지 한 번에 읽는다.
  it('가장 이른 조회일부터 오늘까지 가계부의 날짜별 줄을 한 번 읽는다', async () => {
    const days = await loadStatsDays('2026-09-29')

    expect(loadMonthDays).toHaveBeenCalledTimes(1)
    expect(loadMonthDays).toHaveBeenCalledWith(historyFloorDateKey('2026-09-29'), '2026-09-29')
    expect(days).toEqual({ '2026-09-24': [] })
  })
})
