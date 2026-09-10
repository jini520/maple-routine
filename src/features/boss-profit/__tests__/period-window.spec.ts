// 미리 들 기간 목록. 이 화면의 화살표는 한 칸이 아니라 기록이 있는 가장 가까운 기간으로
// 건너뛰므로, 창의 재료가 달력의 이웃이 아니라 그 착지점이다.

jest.mock('../../../storage/boss-profit', () => ({
  findAdjacentPeriodKeyWithRecords: jest.fn(),
  getBossProfitRecords: jest.fn(),
}))
const { findAdjacentPeriodKeyWithRecords: findAdjacentMock } = jest.requireMock(
  '../../../storage/boss-profit',
) as Record<string, jest.Mock>

beforeEach(() => {
  findAdjacentMock.mockReset().mockResolvedValue(null)
})

/** 목요일 04:00(KST) 리셋 뒤. 이번 주는 2026-09-10, 이번 달은 2026-09. */
const NOW = new Date('2026-09-11T12:00:00+09:00')

function load(): typeof import('../period-window') {
  return require('../period-window') as typeof import('../period-window')
}

describe('resolvePeriodWindow', () => {
  it('보는 기간이 맨 앞이다. 그것이 늦게 오면 옮긴 화면이 빈 채로 남는다', async () => {
    const { resolvePeriodWindow } = load()

    const window = await resolvePeriodWindow('weekly', '2026-09-10', ['o1'], NOW)

    expect(window[0]).toEqual({ tab: 'weekly', periodKey: '2026-09-10' })
  })

  it('오늘의 주간·월간이 보는 기간 바로 뒤에 든다. 창 밖이어도 항상', async () => {
    const { resolvePeriodWindow } = load()

    const window = await resolvePeriodWindow('weekly', '2026-07-02', ['o1'], NOW)

    expect(window.slice(0, 3)).toEqual([
      { tab: 'weekly', periodKey: '2026-07-02' },
      { tab: 'weekly', periodKey: '2026-09-10' },
      { tab: 'monthly', periodKey: '2026-09' },
    ])
  })

  // 한 칸씩 걷지 않는다. 착지점을 따라간다.
  it('이전·다음을 두 번씩 따라간 곳이 창이다', async () => {
    findAdjacentMock.mockImplementation(
      async (_ocids: string[], _tab: string, periodKey: string, direction: string) => {
        const prev: Record<string, string> = { '2026-08-06': '2026-07-16', '2026-07-16': '2026-07-02' }
        const next: Record<string, string> = { '2026-08-06': '2026-08-27', '2026-08-27': '2026-09-03' }
        return (direction === 'prev' ? prev[periodKey] : next[periodKey]) ?? null
      },
    )
    const { resolvePeriodWindow } = load()

    const window = await resolvePeriodWindow('weekly', '2026-08-06', ['o1'], NOW)

    expect(window.map((entry) => entry.periodKey)).toEqual([
      '2026-08-06',
      '2026-09-10',
      '2026-09',
      '2026-07-16',
      '2026-08-27',
      '2026-07-02',
      '2026-09-03',
    ])
  })

  // 갈 곳이 없으면 그쪽으로 안 걷는다. 없는 기간을 표에 넣으면 영영 안 채워지는 줄이 된다.
  it('착지점이 없으면 그 방향은 창에서 빠진다', async () => {
    const { resolvePeriodWindow } = load()

    const window = await resolvePeriodWindow('monthly', '2026-08', ['o1'], NOW)

    expect(window).toEqual([
      { tab: 'monthly', periodKey: '2026-08' },
      { tab: 'weekly', periodKey: '2026-09-10' },
      { tab: 'monthly', periodKey: '2026-09' },
    ])
  })

  it('같은 기간이 두 번 들지 않는다', async () => {
    const { resolvePeriodWindow } = load()

    const window = await resolvePeriodWindow('weekly', '2026-09-10', ['o1'], NOW)

    expect(window).toEqual([
      { tab: 'weekly', periodKey: '2026-09-10' },
      { tab: 'monthly', periodKey: '2026-09' },
    ])
  })

  // 추적도 기록도 없는 첫 진입. 조회를 걸 대상이 없다.
  it('ocid 가 없으면 오늘 둘만 든다', async () => {
    const { resolvePeriodWindow } = load()

    const window = await resolvePeriodWindow('weekly', '2026-08-06', [], NOW)

    expect(window).toEqual([
      { tab: 'weekly', periodKey: '2026-08-06' },
      { tab: 'weekly', periodKey: '2026-09-10' },
      { tab: 'monthly', periodKey: '2026-09' },
    ])
  })
})

// 가격 화면의 화살표는 한 칸씩 걷는다(`getAdjacentPeriodKey`). 건너뛰지 않으므로 여기서는
// 달력의 이웃이 곧 갈 수 있는 곳이다.
describe('dropWindowPeriodKeys', () => {
  it('보는 달이 먼저고 그다음 가까운 순이다', () => {
    const { dropWindowPeriodKeys } = load()

    // 2026-07 아래는 화살표가 죽어 있다(`MIN_SCHEDULER_DATE` = 2026-07-01). 앞으로는 이번 달까지.
    expect(dropWindowPeriodKeys('monthly', '2026-07', NOW)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ])
  })

  it('이번 기간을 안 넘는다. 그 뒤는 화살표가 죽어 있다', () => {
    const { dropWindowPeriodKeys } = load()

    expect(dropWindowPeriodKeys('monthly', '2026-09', NOW)).toEqual([
      '2026-09',
      '2026-08',
      '2026-07',
    ])
  })

  it('주간은 앞뒤 두 달치 리셋 주다. 갈 수 없는 곳은 안 넣는다', () => {
    const { dropWindowPeriodKeys } = load()

    const keys = dropWindowPeriodKeys('weekly', '2026-08-06', NOW)

    expect(keys[0]).toBe('2026-08-06')
    // 뒤로는 화살표가 죽는 자리(`MIN_SCHEDULER_DATE`)까지, 앞으로는 이번 주에서 멈춘다.
    expect(keys).toContain('2026-06-25')
    expect(keys).not.toContain('2026-06-18')
    expect(keys).toContain('2026-09-10')
    expect(keys).not.toContain('2026-09-17')
    expect(new Set(keys).size).toBe(keys.length)
  })

  // 가까운 것부터 채워야 화살표 한 번이 표에 닿는다.
  it('보는 기간에서 가까운 순이다', () => {
    const { dropWindowPeriodKeys } = load()

    expect(dropWindowPeriodKeys('weekly', '2026-08-06', NOW).slice(0, 5)).toEqual([
      '2026-08-06',
      '2026-07-30',
      '2026-08-13',
      '2026-07-23',
      '2026-08-20',
    ])
  })
})
