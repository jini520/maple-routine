jest.mock('../../../storage/character-profiles', () => ({
  getCharacterProfiles: jest.fn().mockResolvedValue(
    new Map([['a', { ocid: 'a', name: '낟낟', imageUrl: 'https://img/a.png' }]]),
  ),
}))

jest.mock('../../cashbook/records', () => ({
  loadMonthDays: jest.fn().mockResolvedValue({ '2026-09-24': [] }),
  cashbookDataRevision: jest.fn().mockReturnValue(10),
}))
jest.mock('../../../storage/enhancement-history', () => ({ getEnhancementHistoryRevision: jest.fn().mockReturnValue(2) }))
jest.mock('../../../storage/spend', () => ({ getSpendRecordsRevision: jest.fn().mockReturnValue(3) }))

import { loadMonthDays } from '../../cashbook/records'
import { historyFloorDateKey } from '../../cashbook/range'
import { loadStatsDays, loadStatsImages, statsDataRevision } from '../load'

describe('loadStatsDays', () => {
  // 누적 카드가 기록의 처음부터 더하므로, 앱이 조회할 수 있는 가장 이른 날부터 오늘까지 한 번에 읽는다.
  it('가장 이른 조회일부터 오늘까지 가계부의 날짜별 줄을 한 번 읽는다', async () => {
    const days = await loadStatsDays('2026-09-29')

    expect(loadMonthDays).toHaveBeenCalledTimes(1)
    expect(loadMonthDays).toHaveBeenCalledWith(historyFloorDateKey('2026-09-29'), '2026-09-29')
    expect(days).toEqual({ '2026-09-24': [] })
  })
})

describe('loadStatsImages', () => {
  it('ocid 마다 캐릭터 전신 그림 주소를 낸다', async () => {
    const images = await loadStatsImages(['a', 'b'])

    expect(images.get('a')).toBe('https://img/a.png')
    expect(images.has('b')).toBe(false)
  })
})

describe('statsDataRevision', () => {
  // 통계가 읽는 표 넷(보스 · 드롭 · 수입은 가계부 판) 과 강화 · 지출의 판을 더한다. 어느 쪽이 올라도 합이 달라진다.
  it('가계부 판과 강화 · 지출 판의 합이다', () => {
    expect(statsDataRevision()).toBe(15)
  })
})
