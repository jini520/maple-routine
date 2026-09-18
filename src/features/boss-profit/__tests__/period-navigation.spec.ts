// 증감 칩의 비교 기준. 결정석만 본다.
//
// 아이템 판매가는 주마다 들쭉날쭉해서 섞으면 증감이 이번 주 보스를 얼마나 돌았나 가 아니라
// 비싼 게 떴나 를 말하게 된다. 화면도 같은 잣대로 이번 기간의 결정석 합만 넘긴다.

jest.mock('../../../storage/boss-profit', () => ({
  getBossProfitRecords: jest.fn(),
  getAllBossProfitRecordKeys: jest.fn(),
  findAdjacentPeriodKeyWithRecords: jest.fn(),
  getMonthlyDefeatDates: jest.fn(),
}))
const {
  getBossProfitRecords: getBossProfitRecordsMock,
  findAdjacentPeriodKeyWithRecords: findAdjacentMock,
  getMonthlyDefeatDates: getMonthlyDefeatDatesMock,
} = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
jest.mock('../../../storage/boss-drops', () => ({
  getBossDropRecords: jest.fn(),
}))
const { getBossDropRecords: getBossDropRecordsMock } = jest.requireMock('../../../storage/boss-drops') as Record<string, jest.Mock>

beforeEach(() => {
  getBossProfitRecordsMock.mockReset().mockResolvedValue([])
  getBossDropRecordsMock.mockReset().mockResolvedValue([])
  findAdjacentMock.mockReset().mockResolvedValue(null)
  getMonthlyDefeatDatesMock.mockReset().mockResolvedValue([])
})

// 월간 보스는 잡은 주에 선다. 그 기록의 `period_key` 는 달이라 주간 화살표의 조회에 안 걸리는데,
// 그러면 **화살표가 못 여는 주에 금액이 갇힌다.** 달 경계 주(9/1~9/2 를 품은 8/27 주)가 특히
// 그렇다 - 그 주에 주간 처치가 없으면 9월 보스 수익에 닿을 길이 사라진다.
describe('월간 처치가 선 주도 화살표가 연다', () => {
  it('이전: 주간 기록이 없어도 월간 처치일이 든 주로 간다', async () => {
    getMonthlyDefeatDatesMock.mockResolvedValue(['2026-09-02'])
    const { resolvePreviousPeriodKey } =
      require('../period-navigation') as typeof import('../period-navigation')

    // 8/27 주(8/27~9/2)에 선다.
    await expect(resolvePreviousPeriodKey('weekly', '2026-09-03', ['o1'])).resolves.toBe('2026-08-27')
  })

  it('이전: 주간 기록이 더 가까우면 그쪽으로 간다', async () => {
    findAdjacentMock.mockResolvedValue('2026-09-03')
    getMonthlyDefeatDatesMock.mockResolvedValue(['2026-08-05'])
    const { resolvePreviousPeriodKey } =
      require('../period-navigation') as typeof import('../period-navigation')

    await expect(resolvePreviousPeriodKey('weekly', '2026-09-10', ['o1'])).resolves.toBe('2026-09-03')
  })

  it('다음: 앞쪽 월간 처치가 선 주로 간다', async () => {
    getMonthlyDefeatDatesMock.mockResolvedValue(['2026-09-02'])
    const { resolveNextPeriodKey } =
      require('../period-navigation') as typeof import('../period-navigation')

    await expect(
      resolveNextPeriodKey('weekly', '2026-08-20', ['o1'], new Date('2026-09-25T12:00:00+09:00')),
    ).resolves.toBe('2026-08-27')
  })

  // 월간 탭은 달 키로 이미 걸린다. 여기서 또 보면 같은 기록을 두 축으로 세는 셈이다.
  it('월간 탭에서는 안 본다', async () => {
    const { resolvePreviousPeriodKey } =
      require('../period-navigation') as typeof import('../period-navigation')

    await resolvePreviousPeriodKey('monthly', '2026-09', ['o1'])

    expect(getMonthlyDefeatDatesMock).not.toHaveBeenCalled()
  })
})

// 스케줄러 API 가 최근 14일만 주므로 오래 쉬었다 돌아오면 그 사이가 전부 조회 불가다. 한 칸씩
// 걸으면 2월 기록에 닿는 데 서른 번이 든다(사용자 지정).
describe('건너뛰는 기간 이동', () => {
  const NOW = new Date('2026-09-07T12:00:00+09:00')

  describe('이전', () => {
    it('기록이 있는 가장 가까운 기간으로 간다', async () => {
      findAdjacentMock.mockResolvedValue('2026-07-09')
      const { resolvePreviousPeriodKey } =
        require('../period-navigation') as typeof import('../period-navigation')

      await expect(resolvePreviousPeriodKey('weekly', '2026-09-03', ['o1'])).resolves.toBe(
        '2026-07-09',
      )
      expect(findAdjacentMock).toHaveBeenCalledWith(['o1'], 'weekly', '2026-09-03', 'prev')
    })

    it('월간도 같다', async () => {
      findAdjacentMock.mockResolvedValue('2026-07')
      const { resolvePreviousPeriodKey } =
        require('../period-navigation') as typeof import('../period-navigation')

      await expect(resolvePreviousPeriodKey('monthly', '2026-09', ['o1'])).resolves.toBe(
        '2026-07',
      )
    })

    // 갈 곳이 없으면 안 움직인다. 화살표도 같은 판정으로 죽어 있다.
    it('더 과거에 기록이 없으면 null 이다', async () => {
      const { resolvePreviousPeriodKey } =
        require('../period-navigation') as typeof import('../period-navigation')

      await expect(
        resolvePreviousPeriodKey('weekly', '2026-09-03', ['o1']),
      ).resolves.toBeNull()
    })
  })

  describe('다음', () => {
    it('기록이 있는 가장 가까운 기간으로 간다', async () => {
      findAdjacentMock.mockResolvedValue('2026-05-14')
      const { resolveNextPeriodKey } =
        require('../period-navigation') as typeof import('../period-navigation')

      await expect(resolveNextPeriodKey('weekly', '2026-07-09', ['o1'], NOW)).resolves.toBe(
        '2026-05-14',
      )
      expect(findAdjacentMock).toHaveBeenCalledWith(['o1'], 'weekly', '2026-07-09', 'next')
    })

    // 이번 주에 아직 안 잡았어도 돌아올 길이 막히면 안 된다.
    it('앞에 기록이 없으면 지금 기간으로 온다', async () => {
      const { resolveNextPeriodKey } =
        require('../period-navigation') as typeof import('../period-navigation')

      await expect(resolveNextPeriodKey('weekly', '2026-07-09', ['o1'], NOW)).resolves.toBe(
        '2026-09-03',
      )
      await expect(resolveNextPeriodKey('monthly', '2026-07', ['o1'], NOW)).resolves.toBe('2026-09')
    })

    // 지금 기간이 하한이다. 그보다 뒤는 미래라 갈 자리가 아니다.
    it('지금 기간에서는 안 움직인다', async () => {
      const { resolveNextPeriodKey } =
        require('../period-navigation') as typeof import('../period-navigation')

      await expect(resolveNextPeriodKey('weekly', '2026-09-03', ['o1'], NOW)).resolves.toBeNull()
    })
  })

  // 조회 가능성을 안 본다. 건너뛰기가 그것을 안 쓰므로 남은 기준은 기록뿐이다.
  describe('이전 화살표', () => {
    it('더 과거에 기록이 있으면 산다', async () => {
      findAdjacentMock.mockResolvedValue('2026-07-09')
      const { canReachPreviousPeriod } =
        require('../period-navigation') as typeof import('../period-navigation')

      await expect(canReachPreviousPeriod('weekly', '2026-09-03', ['o1'])).resolves.toBe(true)
    })

    it('없으면 죽는다', async () => {
      const { canReachPreviousPeriod } =
        require('../period-navigation') as typeof import('../period-navigation')

      await expect(canReachPreviousPeriod('weekly', '2026-09-03', ['o1'])).resolves.toBe(false)
    })
  })
})

describe('loadPreviousPeriodTotal: 결정석만 (정정)', () => {
  it('결정석 기록 합만 낸다. 그 기간에 아이템을 팔았어도 더하지 않는다', async () => {
    getBossProfitRecordsMock.mockResolvedValue([{ payoutMeso: 6_800_000_000 }])
    getBossDropRecordsMock.mockResolvedValue([
      { priceState: 'entered', priceMeso: 15_000_000_000, priceShare: 3 },
    ])
    const { loadPreviousPeriodTotal } = require('../period-navigation') as typeof import('../period-navigation')

    await expect(loadPreviousPeriodTotal(['ocid-1'], 'weekly', '2026-08-13')).resolves.toBe(
      6_800_000_000,
    )
  })

  it('드롭 테이블을 아예 읽지 않는다. 쓰지 않을 값을 조회하지 않는다', async () => {
    getBossProfitRecordsMock.mockResolvedValue([{ payoutMeso: 1 }])
    const { loadPreviousPeriodTotal } = require('../period-navigation') as typeof import('../period-navigation')

    await loadPreviousPeriodTotal(['ocid-1'], 'weekly', '2026-08-13')

    expect(getBossDropRecordsMock).not.toHaveBeenCalled()
  })

  it('ocid 가 없으면 조회하지 않는다', async () => {
    const { loadPreviousPeriodTotal } = require('../period-navigation') as typeof import('../period-navigation')

    await expect(loadPreviousPeriodTotal([], 'weekly', '2026-08-13')).resolves.toBe(0)
    expect(getBossProfitRecordsMock).not.toHaveBeenCalled()
  })
})
