jest.mock('../../../storage/boss-profit', () => ({
  getAllBossProfitRecordKeys: jest.fn(),
  findAdjacentPeriodKeyWithRecords: jest.fn(),
  getMonthlyDefeatDates: jest.fn(),
}))
const {
  findAdjacentPeriodKeyWithRecords: findAdjacentMock,
  getMonthlyDefeatDates: getMonthlyDefeatDatesMock,
} = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>

beforeEach(() => {
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
