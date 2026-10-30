jest.mock('../../../storage/character-profiles', () => ({
  getCharacterProfiles: jest.fn().mockResolvedValue(
    new Map([['a', { ocid: 'a', name: '낟낟', imageUrl: 'https://img/a.png' }]]),
  ),
  getCharacterProfilesByNames: jest.fn().mockResolvedValue([
    { ocid: 'old', name: '단풍라떼', world: '스카니아', imageUrl: 'https://img/old.png', updatedAt: '2026-08-01T00:00:00Z' },
    { ocid: 'new', name: '단풍라떼', world: '베라', imageUrl: 'https://img/new.png', updatedAt: '2026-09-20T00:00:00Z' },
  ]),
}))

jest.mock('../../../storage/stats-cumulative-start', () => ({
  getStatsCumulativeStart: jest.fn().mockRejectedValue(new Error('읽기 실패')),
  setStatsCumulativeStart: jest.fn().mockResolvedValue(undefined),
}))

import { loadCumulativeStart, loadStatsImages } from '../load'

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

describe('loadCumulativeStart', () => {
  // 못 읽으면 처음부터 더한다. 통계 화면이 설정 하나 때문에 죽을 일은 아니다.
  it('읽기에 실패하면 null 이다', async () => {
    expect(await loadCumulativeStart()).toBeNull()
  })
})
