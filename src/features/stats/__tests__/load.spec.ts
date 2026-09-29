jest.mock('../../../storage/character-profiles', () => ({
  getCharacterProfiles: jest.fn().mockResolvedValue(
    new Map([['a', { ocid: 'a', name: '낟낟', imageUrl: 'https://img/a.png' }]]),
  ),
  getCharacterProfilesByNames: jest.fn().mockResolvedValue([
    { ocid: 'old', name: '단풍라떼', world: '스카니아', imageUrl: 'https://img/old.png', updatedAt: '2026-08-01T00:00:00Z' },
    { ocid: 'new', name: '단풍라떼', world: '베라', imageUrl: 'https://img/new.png', updatedAt: '2026-09-20T00:00:00Z' },
  ]),
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
  // 과거 주는 보스 기록이 날짜를 몰라 빠지면 이름만 든 강화 줄이 남는다. 그 줄도 이름으로 그림을 찾는다.
  it('ocid 가 있는 줄은 ocid 로, 이름만 있는 줄은 이름으로 찾고 모르면 뺀다', async () => {
    const images = await loadStatsImages([
      { key: 'ocid:a', ocid: 'a', name: '낟낟' },
      { key: 'ocid:b', ocid: 'b', name: '낟넘' },
      { key: 'name:단풍라떼', ocid: null, name: '단풍라떼' },
      { key: 'name:젓눈', ocid: null, name: '젓눈' },
    ])

    expect(images.get('ocid:a')).toBe('https://img/a.png')
    expect(images.has('ocid:b')).toBe(false)
    // 같은 이름이 여럿이면 가장 최근에 본 캐릭터다.
    expect(images.get('name:단풍라떼')).toBe('https://img/new.png')
    expect(images.has('name:젓눈')).toBe(false)
  })
})

describe('statsDataRevision', () => {
  // 통계가 읽는 표 넷(보스 · 드롭 · 수입은 가계부 판) 과 강화 · 지출의 판을 더한다. 어느 쪽이 올라도 합이 달라진다.
  it('가계부 판과 강화 · 지출 판의 합이다', () => {
    expect(statsDataRevision()).toBe(15)
  })
})
