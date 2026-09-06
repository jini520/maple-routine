// 처치 날짜 캐기. 이 파일이 지키는 것 넷.
//
// ① **뒤집힌 날**이 처치일이다. 완료로 보이는 첫 날이고, 리셋 당일이면 그날이다.
// ② **구멍이 있으면 확정하지 않는다**. 시작일부터 끊김 없이 봐야 **그 앞엔 없었다** 를 말한다.
// ③ **오늘은 소거법**이다. `date=오늘` 은 400 이라 조회로는 영영 못 본다.
// ④ **캘 수 없는 날만 건너뛴다**. 창에 하루라도 걸치는 기간은 부르고, 창 하한보다
//    앞선 날만 안 본다(정정 6). 건너뛴 뒤 첫 관측이 이미 완료면 그때만 포기한다.

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../storage/boss-profit', () => ({
  getUndatedBossProfitRecords: jest.fn(),
  setBossProfitDefeatedOn: jest.fn(),
}))
jest.mock('../../../storage/schedule-probe-ledger', () => ({
  getScheduleProbeLedger: jest.fn(),
  markScheduleProbeUnavailable: jest.fn(),
  recordScheduleProbe: jest.fn(),
}))
jest.mock('../../../nexon/schedule', () => ({ fetchSchedulerCharacterState: jest.fn() }))

import { resolveDefeatDates, resolveDefeatedOn } from '../defeat-dates'

const { getAuthConfig: getAuthConfigMock } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const {
  getUndatedBossProfitRecords: getUndatedMock,
  setBossProfitDefeatedOn: setDefeatedOnMock,
} = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
const {
  getScheduleProbeLedger: getLedgerMock,
  recordScheduleProbe: recordProbeMock,
} = jest.requireMock('../../../storage/schedule-probe-ledger') as Record<string, jest.Mock>
const { fetchSchedulerCharacterState: fetchStateMock } = jest.requireMock('../../../nexon/schedule') as Record<string, jest.Mock>

beforeEach(() => {
  getAuthConfigMock.mockReset().mockResolvedValue({ apiKey: 'key' })
  getUndatedMock.mockReset().mockResolvedValue([])
  setDefeatedOnMock.mockReset().mockResolvedValue(undefined)
  getLedgerMock.mockReset().mockResolvedValue({ unavailable: false, dates: {} })
  recordProbeMock.mockReset().mockResolvedValue(undefined)
  fetchStateMock.mockReset()
})

function observed(entries: Record<string, string[]>): Map<string, ReadonlySet<string>> {
  return new Map(Object.entries(entries).map(([day, keys]) => [day, new Set(keys)]))
}

const WEEK = [
  '2026-08-20',
  '2026-08-21',
  '2026-08-22',
  '2026-08-23',
  '2026-08-24',
  '2026-08-25',
  '2026-08-26',
]

describe('resolveDefeatedOn: 뒤집힌 날 (결정 2)', () => {
  it('미완료 → 완료로 바뀐 날이 처치일이다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({
          '2026-08-20': [],
          '2026-08-21': [],
          '2026-08-22': ['스우|하드'],
          '2026-08-23': ['스우|하드'],
        }),
        todayDateKey: '2026-08-24',
        bossKey: '스우|하드',
      }),
    ).toBe('2026-08-22')
  })

  it('리셋 당일에 이미 완료면 그날이다. 그 앞이 없다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-20': ['스우|하드'] }),
        todayDateKey: '2026-08-24',
        bossKey: '스우|하드',
      }),
    ).toBe('2026-08-20')
  })

  it('다른 보스의 완료는 안 센다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-20': ['데미안|하드'], '2026-08-21': ['데미안|하드'] }),
        todayDateKey: '2026-08-21',
        bossKey: '스우|하드',
      }),
    ).toBeNull()
  })

  it('난이도가 다르면 다른 보스다. 키에 난이도가 들어 있다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-20': ['스우|이지'], '2026-08-21': ['스우|이지'] }),
        todayDateKey: '2026-08-21',
        bossKey: '스우|하드',
      }),
    ).toBeNull()
  })
})

describe('resolveDefeatedOn: 구멍 (결정 2)', () => {
  it('시작일을 못 봤으면 확정하지 않는다. 그 앞을 모른다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-21': ['스우|하드'], '2026-08-22': ['스우|하드'] }),
        todayDateKey: '2026-08-24',
        bossKey: '스우|하드',
      }),
    ).toBeNull()
  })

  it('중간에 못 본 날이 있으면 그 뒤의 완료를 못 믿는다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-20': [], '2026-08-22': ['스우|하드'] }),
        todayDateKey: '2026-08-24',
        bossKey: '스우|하드',
      }),
    ).toBeNull()
  })

  it('구멍이 처치일 뒤에 있으면 답이 안 바뀐다. 이미 확정한 뒤다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-20': ['스우|하드'] }),
        todayDateKey: '2026-08-26',
        bossKey: '스우|하드',
      }),
    ).toBe('2026-08-20')
  })
})

describe('resolveDefeatedOn: 창 하한 앞은 건너뛴다 (정정 6)', () => {
  // 8/20 주인데 창이 8/22 부터인 상황. 실제 데이터가 그랬다(9/4 백필, 창 하한 8/22).
  it('창 안에서 뒤집혔으면 앞에 못 본 날이 있어도 확정한다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-22': [], '2026-08-23': ['스우|하드'] }),
        todayDateKey: '2026-09-04',
        bossKey: '스우|하드',
        queryFloorDateKey: '2026-08-22',
      }),
    ).toBe('2026-08-23')
  })

  it('건너뛴 뒤 첫 관측에 이미 완료면 확정하지 않는다. 그 앞이 답일 수 있다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-22': ['스우|하드'], '2026-08-23': ['스우|하드'] }),
        todayDateKey: '2026-09-04',
        bossKey: '스우|하드',
        queryFloorDateKey: '2026-08-22',
      }),
    ).toBeNull()
  })

  it('창 안의 구멍은 그대로 구멍이다. 건너뛰는 것은 하한 앞뿐', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-22': [], '2026-08-24': ['스우|하드'] }),
        todayDateKey: '2026-09-04',
        bossKey: '스우|하드',
        queryFloorDateKey: '2026-08-22',
      }),
    ).toBeNull()
  })

  // 하한 앞을 못 본 채로 오늘을 만나면 소거법이 안 선다. 그 못 본 날에 잡았을 수 있다.
  it('하한 앞을 건너뛴 채 오늘에 닿으면 소거법을 쓰지 않는다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: new Map(),
        todayDateKey: '2026-08-22',
        bossKey: '스우|하드',
        queryFloorDateKey: '2026-08-22',
      }),
    ).toBeNull()
  })

  it('미완료를 본 뒤라면 소거법이 다시 선다. 앞의 구멍이 무효가 됐다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-22': [], '2026-08-23': [] }),
        todayDateKey: '2026-08-24',
        bossKey: '스우|하드',
        queryFloorDateKey: '2026-08-22',
      }),
    ).toBe('2026-08-24')
  })
})

// 창 밖이라 뒤집힘을 못 본 기록에 **조회 가능한 가장 빠른 날**을 준다(사용자 지정).
//
// `그 날이거나 그 앞` 을 `그 날` 로 단정하는 것이다. 그 대가를 지는 이유는 창을 매일 채우면 이
// 경우가 앱이 알기 전에 지나간 기록에만 남고, 그 금액이 화면에서 통째로 사라지는 것보다 낫기
// 때문이다.
describe('resolveDefeatedOn: 못 캐면 가장 빠른 조회 가능일', () => {
  it('건너뛴 뒤 첫 관측에 이미 완료면 그 날을 처치일로 쓴다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-23': ['스우|하드'] }),
        todayDateKey: '2026-09-05',
        bossKey: '스우|하드',
        queryFloorDateKey: '2026-08-23',
        fallbackToEarliestQueryable: true,
      }),
    ).toBe('2026-08-23')
  })

  it('뒤집힘을 봤으면 그쪽이 이긴다. 폴백은 못 봤을 때만이다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-23': [], '2026-08-24': [], '2026-08-25': ['스우|하드'] }),
        todayDateKey: '2026-09-05',
        bossKey: '스우|하드',
        queryFloorDateKey: '2026-08-23',
        fallbackToEarliestQueryable: true,
      }),
    ).toBe('2026-08-25')
  })

  // 그 기간에 조회 가능한 날이 하나도 없으면 줄 날짜가 없다.
  it('기간 전체가 창 밖이면 그대로 null 이다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: new Map(),
        todayDateKey: '2026-09-20',
        bossKey: '스우|하드',
        queryFloorDateKey: '2026-09-07',
        fallbackToEarliestQueryable: true,
      }),
    ).toBeNull()
  })

  // 창 안인데 조회가 실패한 구멍은 폴백이 안 메운다. 그 날짜는 다음에 다시 부른다.
  it('창 안의 구멍은 폴백이 메우지 않는다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-24': ['스우|하드'] }),
        todayDateKey: '2026-09-05',
        bossKey: '스우|하드',
        queryFloorDateKey: '2026-08-23',
        fallbackToEarliestQueryable: true,
      }),
    ).toBeNull()
  })

  it('끄면 전과 같이 null 이다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-23': ['스우|하드'] }),
        todayDateKey: '2026-09-05',
        bossKey: '스우|하드',
        queryFloorDateKey: '2026-08-23',
      }),
    ).toBeNull()
  })
})

describe('resolveDefeatedOn: 오늘은 소거법 (결정 3)', () => {
  it('어제까지 전부 미완료인데 기록이 있으면 오늘이다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-20': [], '2026-08-21': [], '2026-08-22': [] }),
        todayDateKey: '2026-08-23',
        bossKey: '스우|하드',
      }),
    ).toBe('2026-08-23')
  })

  it('오늘이 리셋 당일이면 조회 없이 오늘이다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: new Map(),
        todayDateKey: '2026-08-20',
        bossKey: '스우|하드',
      }),
    ).toBe('2026-08-20')
  })

  it('기간이 이미 닫혔으면 소거법이 안 선다. 오늘이 그 안에 없다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({
          '2026-08-20': [],
          '2026-08-21': [],
          '2026-08-22': [],
          '2026-08-23': [],
          '2026-08-24': [],
          '2026-08-25': [],
          '2026-08-26': [],
        }),
        todayDateKey: '2026-09-02',
        bossKey: '스우|하드',
      }),
    ).toBeNull()
  })

  it('오늘 뒤의 날짜는 안 본다. 아직 오지 않은 날에 잡을 수 없다', () => {
    expect(
      resolveDefeatedOn({
        periodDays: WEEK,
        observed: observed({ '2026-08-20': [], '2026-08-26': ['스우|하드'] }),
        todayDateKey: '2026-08-21',
        bossKey: '스우|하드',
      }),
    ).toBe('2026-08-21')
  })
})

// 캐내기 전체
// 시각은 KST 2026-08-24(월) 낮으로 고정한다. 그 주의 리셋은 8/20(목)이고 조회 창은
// 8/11(오늘−13) ~ 8/23(오늘−1)이다.
const NOW = new Date('2026-08-24T05:00:00.000Z')

function schedulerState(bosses: { name: string; difficulty: string }[]): unknown {
  return {
    asOf: '2026-08-21',
    characterName: '루디',
    world: '스카니아',
    level: 290,
    jobClass: '아크메이지',
    dailyContents: [],
    weeklyContents: [],
    bossContents: bosses.map((boss) => ({
      name: boss.name,
      difficulty: boss.difficulty,
      cycle: 'weekly',
      isRegistered: true,
      isComplete: true,
      ownComplete: true,
    })),
    isDailyStale: false,
    isWeeklyStale: false,
    isWeeklyBossStale: false,
    isMonthlyBossStale: false,
  }
}

const 미확정_스우 = {
  ocid: 'ocid-1',
  boss: '스우',
  difficulty: '하드',
  cycle: 'weekly' as const,
  periodKey: '2026-08-20',
}

describe('resolveDefeatDates: 안 부르는 길 (결정 4)', () => {
  it('캐릭터가 없으면 아무것도 안 한다', async () => {
    await expect(resolveDefeatDates([], NOW)).resolves.toBe(0)
    expect(getUndatedMock).not.toHaveBeenCalled()
    expect(fetchStateMock).not.toHaveBeenCalled()
  })

  it('미확정 기록이 없으면 API 를 안 부른다. 정상 상태의 재진입이 공짜다', async () => {
    await expect(resolveDefeatDates(['ocid-1'], NOW)).resolves.toBe(0)
    expect(fetchStateMock).not.toHaveBeenCalled()
    expect(getAuthConfigMock).not.toHaveBeenCalled()
  })

  it('키가 없으면 조회하지 않는다', async () => {
    getUndatedMock.mockResolvedValue([미확정_스우])
    getAuthConfigMock.mockResolvedValue(null)

    await expect(resolveDefeatDates(['ocid-1'], NOW)).resolves.toBe(0)
    expect(fetchStateMock).not.toHaveBeenCalled()
  })

  it('창에 하루라도 걸치는 기간은 묻는다 (정정 6)', async () => {
    await resolveDefeatDates(['ocid-1'], NOW)

    const [, periodKeys] = getUndatedMock.mock.calls[0]
    // 창은 8/11~8/23. 8/6 주는 시작일이 밖이지만 8/11~8/12 가 창 안이라 답이 나올 수 있다.
    expect(periodKeys).toContain('2026-08-20')
    expect(periodKeys).toContain('2026-08-13')
    expect(periodKeys).toContain('2026-08-06')
    // 이번 달도 8/11 부터는 볼 수 있다. 달의 앞쪽에 잡은 건은 그대로 NULL 로 남는다.
    expect(periodKeys).toContain('2026-08')
    // 7/30 주는 마지막 날이 8/5 라 창에 한 뼘도 안 걸린다.
    expect(periodKeys).not.toContain('2026-07-30')
  })
})

describe('resolveDefeatDates: 원장이 겹침을 막는다 (결정 5)', () => {
  it('이미 bosses 를 들고 있는 날짜는 다시 안 부른다', async () => {
    getUndatedMock.mockResolvedValue([미확정_스우])
    getLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: {
        '2026-08-20': { kind: 'observed', hasCompletion: false, sections: {}, bosses: [] },
        '2026-08-21': { kind: 'observed', hasCompletion: true, sections: {}, bosses: ['스우|하드'] },
      },
    })

    await expect(resolveDefeatDates(['ocid-1'], NOW)).resolves.toBe(1)

    const asked = fetchStateMock.mock.calls.map(([, , dateKey]) => dateKey)
    expect(asked).not.toContain('2026-08-20')
    expect(asked).not.toContain('2026-08-21')
    expect(setDefeatedOnMock).toHaveBeenCalledWith(미확정_스우, '2026-08-21')
  })

  it('bosses 가 없는 옛 관측은 미조회로 친다. 빈 배열과 섞으면 관측을 잃는다', async () => {
    getUndatedMock.mockResolvedValue([미확정_스우])
    getLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: { '2026-08-20': { kind: 'observed', hasCompletion: false, sections: {} } },
    })
    fetchStateMock.mockResolvedValue(schedulerState([]))

    await resolveDefeatDates(['ocid-1'], NOW)

    const asked = fetchStateMock.mock.calls.map(([, , dateKey]) => dateKey)
    expect(asked).toContain('2026-08-20')
  })

  it('outOfRange 로 굳은 날짜는 다시 안 부른다', async () => {
    getUndatedMock.mockResolvedValue([미확정_스우])
    getLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: { '2026-08-20': { kind: 'outOfRange' } },
    })
    fetchStateMock.mockResolvedValue(schedulerState([]))

    await resolveDefeatDates(['ocid-1'], NOW)

    const asked = fetchStateMock.mock.calls.map(([, , dateKey]) => dateKey)
    expect(asked).not.toContain('2026-08-20')
    // 구멍이 시작일이라 확정도 안 한다.
    expect(setDefeatedOnMock).not.toHaveBeenCalled()
  })
})

describe('resolveDefeatDates: 캐낸 값을 박는다', () => {
  it('창 안의 날짜만 묻고, 뒤집힌 날을 저장한다', async () => {
    getUndatedMock.mockResolvedValue([미확정_스우])
    fetchStateMock.mockImplementation(async (_key: string, _ocid: string, dateKey: string) =>
      dateKey >= '2026-08-22' ? schedulerState([{ name: '스우', difficulty: '하드' }]) : schedulerState([]),
    )

    await expect(resolveDefeatDates(['ocid-1'], NOW)).resolves.toBe(1)

    const asked = fetchStateMock.mock.calls.map(([, , dateKey]) => dateKey).sort()
    // 이번 주(8/20~8/26) 중 창 안은 8/20~8/23 뿐이다. 8/24 는 오늘이라 400 이다.
    expect(asked).toEqual(['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'])
    expect(setDefeatedOnMock).toHaveBeenCalledWith(미확정_스우, '2026-08-22')
    expect(recordProbeMock).toHaveBeenCalledTimes(4)
  })

  // 창에 걸친 경계 주. 창 하한 앞(8/6~8/10)은 안 묻고 8/11~8/12 만 물어 답을 낸다.
  it('시작일이 창 밖인 주도 걸친 날들만 물어 날짜를 낸다 (정정 6)', async () => {
    const 경계주_스우 = { ...미확정_스우, periodKey: '2026-08-06' }
    getUndatedMock.mockResolvedValue([경계주_스우])
    fetchStateMock.mockImplementation(async (_key: string, _ocid: string, dateKey: string) =>
      dateKey >= '2026-08-12' ? schedulerState([{ name: '스우', difficulty: '하드' }]) : schedulerState([]),
    )

    await expect(resolveDefeatDates(['ocid-1'], NOW)).resolves.toBe(1)

    const asked = fetchStateMock.mock.calls.map(([, , dateKey]) => dateKey).sort()
    expect(asked).toEqual(['2026-08-11', '2026-08-12'])
    expect(setDefeatedOnMock).toHaveBeenCalledWith(경계주_스우, '2026-08-12')
  })

  it('창 안이 전부 미완료면 오늘로 박는다. 소거법 (결정 3)', async () => {
    getUndatedMock.mockResolvedValue([미확정_스우])
    fetchStateMock.mockResolvedValue(schedulerState([]))

    await expect(resolveDefeatDates(['ocid-1'], NOW)).resolves.toBe(1)

    expect(setDefeatedOnMock).toHaveBeenCalledWith(미확정_스우, '2026-08-24')
  })

  it('조회가 실패한 날은 구멍이라 확정하지 않는다', async () => {
    getUndatedMock.mockResolvedValue([미확정_스우])
    fetchStateMock.mockRejectedValue(new Error('network'))

    await expect(resolveDefeatDates(['ocid-1'], NOW)).resolves.toBe(0)
    expect(setDefeatedOnMock).not.toHaveBeenCalled()
    // 모르는 실패는 원장에 안 남는다. 다음에 다시 시도한다.
    expect(recordProbeMock).not.toHaveBeenCalled()
  })
})

describe('resolveDefeatDates: 두 화면이 같이 불러도 한 번만 돈다 (결정 9)', () => {
  it('겹친 호출은 같은 약속을 나눠 쓴다', async () => {
    getUndatedMock.mockResolvedValue([미확정_스우])
    fetchStateMock.mockResolvedValue(schedulerState([]))

    const [first, second] = await Promise.all([
      resolveDefeatDates(['ocid-1'], NOW),
      resolveDefeatDates(['ocid-1'], NOW),
    ])

    expect(first).toBe(second)
    expect(getUndatedMock).toHaveBeenCalledTimes(1)
  })
})

/**
 * **키가 없어도 오늘 건은 채운다**.
 *
 * 소거법과 리셋 당일은 **조회가 필요 없다**. 관측이 하나도 없어도 답이 나온다. 그런데 키 검사가
 * 함수 맨 앞에 있어 조회할 것이 없는 경우까지 0 으로 나가고 있었다: 키를 지운 기기에서는 오늘 잡은
 * 보스가 영영 캘린더에 안 찍힌다.
 */
describe('키가 없을 때', () => {
  it('조회가 필요 없는 건은 그대로 채운다. 리셋 당일', async () => {
    getAuthConfigMock.mockResolvedValue(null)
    getUndatedMock.mockResolvedValue([
      { ocid: 'o1', boss: '스우', difficulty: '하드', cycle: 'weekly', periodKey: '2026-08-27' },
    ])

    const dated = await resolveDefeatDates(['o1'], new Date('2026-08-27T01:00:00.000Z'))

    expect(dated).toBe(1)
    expect(setDefeatedOnMock).toHaveBeenCalledWith(expect.objectContaining({ boss: '스우' }), '2026-08-27')
    expect(fetchStateMock).not.toHaveBeenCalled()
  })

  // 조회가 있어야 풀리는 건은 **그대로 NULL** 이다. 키가 없으면 부를 수가 없다.
  it('조회가 있어야 풀리는 건은 안 건드린다', async () => {
    getAuthConfigMock.mockResolvedValue(null)
    getUndatedMock.mockResolvedValue([
      { ocid: 'o1', boss: '스우', difficulty: '하드', cycle: 'weekly', periodKey: '2026-08-20' },
    ])

    const dated = await resolveDefeatDates(['o1'], new Date('2026-08-27T01:00:00.000Z'))

    expect(dated).toBe(0)
    expect(fetchStateMock).not.toHaveBeenCalled()
  })
})
