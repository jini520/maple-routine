// 창 하나를 채운다. 탭과 무관하게 관리 캐릭터마다 오늘 + 과거 13일이다.
//
// 이 파일이 지키는 것 넷.
// ① **원장이 중복을 막는다.** 이미 확정으로 본 날짜는 다시 안 부른다.
// ② **오늘은 부르지 않는다.** `date=오늘` 은 400 이라 라이브 동기화가 맡는다.
// ③ **잠정은 날이 바뀌면 다시 부른다.** 어제가 된 오늘 관측은 미조회다.
// ④ **모르는 실패는 원장에 안 남는다.** 다음에 다시 온다.

jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../storage/schedule-probe-ledger', () => {
  const actual = jest.requireActual<typeof import('../../../storage/schedule-probe-ledger')>(
    '../../../storage/schedule-probe-ledger',
  )
  return {
    isSettledProbe: actual.isSettledProbe,
    PROBE_WINDOW_DAYS: actual.PROBE_WINDOW_DAYS,
    getScheduleProbeLedger: jest.fn(),
    markScheduleProbeUnavailable: jest.fn(),
    recordScheduleProbe: jest.fn(),
  }
})
jest.mock('../../../nexon/schedule', () => ({ fetchSchedulerCharacterState: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ getNexonAccountIdsOfOcids: jest.fn() }))
jest.mock('../../settlement/store', () => ({ refreshSettlement: jest.fn() }))
const { refreshSettlement: refreshSettlementMock } = jest.requireMock('../../settlement/store') as Record<string, jest.Mock>


import { NexonBadRequestError } from '../../../nexon/errors'
import { fillScheduleWindow } from '../window'

const { getAuthConfig: getAuthConfigMock } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const {
  getScheduleProbeLedger: getLedgerMock,
  markScheduleProbeUnavailable: markUnavailableMock,
  recordScheduleProbe: recordProbeMock,
} = jest.requireMock('../../../storage/schedule-probe-ledger') as Record<string, jest.Mock>
const { fetchSchedulerCharacterState: fetchStateMock } = jest.requireMock('../../../nexon/schedule') as Record<string, jest.Mock>
const { getNexonAccountIdsOfOcids } = jest.requireMock('../../../storage/character-accounts') as Record<string, jest.Mock>

// KST 2026-09-05(토) 낮. 창은 8/23(오늘−13) ~ 9/4(오늘−1)이고 오늘은 9/5 다.
const NOW = new Date('2026-09-05T03:00:00.000Z')

function schedulerState(): unknown {
  return {
    asOf: '2026-09-04',
    characterName: '루디',
    world: '스카니아',
    worldKey: 'scania',
    level: 290,
    jobClass: '아크메이지',
    dailyContents: [],
    weeklyContents: [],
    bossContents: [
      { bossKey: 'lotus', apiName: '스우', difficulty: 'hard', cycle: 'weekly', isRegistered: true, isComplete: true, ownComplete: true },
    ],
    isDailyStale: false,
    isWeeklyStale: false,
    isWeeklyBossStale: false,
    isMonthlyBossStale: false,
  }
}

const asked = (): string[] => fetchStateMock.mock.calls.map(([, , , dateKey]) => dateKey).sort()

beforeEach(() => {
  getAuthConfigMock.mockReset().mockResolvedValue({ login: null, mainKeyId: 'account-key', apiKeys: [{ type: 'key', id: 'account-key', label: '', value: 'key', loginId: null }] })
  getLedgerMock.mockReset().mockResolvedValue({ unavailable: false, dates: {} })
  markUnavailableMock.mockReset().mockResolvedValue(undefined)
  recordProbeMock.mockReset().mockResolvedValue(undefined)
  fetchStateMock.mockReset().mockResolvedValue(schedulerState())
  refreshSettlementMock.mockReset().mockResolvedValue(undefined)
  getNexonAccountIdsOfOcids.mockReset().mockResolvedValue(new Map())
})

describe('창을 채운다', () => {
  it('창 안의 과거 13일을 부르고 오늘은 안 부른다', async () => {
    await fillScheduleWindow(['o1'], NOW)

    expect(asked()).toEqual([
      '2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27',
      '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31',
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
    ])
    expect(asked()).not.toContain('2026-09-05')
  })

  it('캐릭터마다 자기 창을 채운다', async () => {
    await fillScheduleWindow(['o1', 'o2'], NOW)

    expect(fetchStateMock).toHaveBeenCalledTimes(26)
  })

  it('본 날짜의 관측을 원장에 적는다', async () => {
    await fillScheduleWindow(['o1'], NOW)

    expect(recordProbeMock).toHaveBeenCalledWith(
      'o1',
      '2026-09-04',
      expect.objectContaining({ kind: 'observed', bosses: ['lotus|hard'] }),
    )
  })
})

describe('원장이 중복을 막는다', () => {
  it('이미 확정으로 본 날짜는 다시 안 부른다', async () => {
    getLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: {
        '2026-08-23': { kind: 'observed', hasCompletion: false, sections: {}, bosses: [] },
        '2026-09-04': { kind: 'outOfRange' },
      },
    })

    await fillScheduleWindow(['o1'], NOW)

    expect(asked()).not.toContain('2026-08-23')
    expect(asked()).not.toContain('2026-09-04')
    expect(asked()).toHaveLength(11)
  })

  it('어제가 된 잠정 관측은 다시 부른다', async () => {
    getLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: {
        '2026-09-04': { kind: 'observed', hasCompletion: true, sections: {}, bosses: [], provisional: true },
      },
    })

    await fillScheduleWindow(['o1'], NOW)

    expect(asked()).toContain('2026-09-04')
  })

  it('조회할 수 없는 캐릭터는 한 번도 안 부른다', async () => {
    getLedgerMock.mockResolvedValue({ unavailable: true, dates: {} })

    await fillScheduleWindow(['o1'], NOW)

    expect(fetchStateMock).not.toHaveBeenCalled()
  })
})

describe('안 부르는 길', () => {
  it('키가 없으면 조회하지 않는다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await fillScheduleWindow(['o1'], NOW)

    expect(fetchStateMock).not.toHaveBeenCalled()
  })
})

describe('실패를 가른다', () => {
  it('그 캐릭터를 어느 날짜로도 못 부르면 표시하고 멈춘다', async () => {
    fetchStateMock.mockRejectedValue(new NexonBadRequestError('조회할 수 없다', 'OPENAPI00003'))

    await fillScheduleWindow(['o1'], NOW)

    expect(markUnavailableMock).toHaveBeenCalledWith('o1')
  })

  it('모르는 실패는 원장에 안 남는다. 다음에 다시 온다', async () => {
    fetchStateMock.mockRejectedValue(new Error('network'))

    await fillScheduleWindow(['o1'], NOW)

    expect(recordProbeMock).not.toHaveBeenCalled()
  })
})

// 진행률의 재료. 분모는 **한 콜도 나가기 전에** 확정되고 도는 중에 안 늘어난다.
describe('진행을 알린다', () => {
  it('부를 날짜 수를 먼저 알리고, 하나씩 끝날 때마다 올린다', async () => {
    const seen: { done: number; total: number }[] = []

    await fillScheduleWindow(['o1'], NOW, (done, total) => seen.push({ done, total }))

    expect(seen[0]).toEqual({ done: 0, total: 13 })
    expect(seen.at(-1)).toEqual({ done: 13, total: 13 })
    // 분모는 처음부터 끝까지 같다.
    expect(new Set(seen.map((entry) => entry.total))).toEqual(new Set([13]))
  })

  it('부를 것이 없으면 0 으로 알린다', async () => {
    getLedgerMock.mockResolvedValue({ unavailable: true, dates: {} })
    const seen: { done: number; total: number }[] = []

    await fillScheduleWindow(['o1'], NOW, (done, total) => seen.push({ done, total }))

    expect(seen).toEqual([{ done: 0, total: 0 }])
  })
})

// 스케줄러 데이터를 갱신하는 자리는 결산 여부도 함께 갱신한다. 값이 바뀌면 today 에 바로 선다.
describe('결산 여부도 갱신한다', () => {
  it('창을 채우면 결산도 다시 묻는다', async () => {
    await fillScheduleWindow(['o1'], NOW)

    expect(refreshSettlementMock).toHaveBeenCalled()
  })

  it('키가 없어 아무것도 안 부르면 결산도 안 묻는다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await fillScheduleWindow(['o1'], NOW)

    expect(refreshSettlementMock).not.toHaveBeenCalled()
  })
})

// 동시 6건은 API 키가 넥슨을 직접 부를 때의 한도다. 로그인 조회는 서버 스트림이 요청 하나로 묶고 넥슨을 부르는 속도도
// 서버가 정하므로, 6건씩 넘기면 작은 요청이 잦아질 뿐이다.
describe('자격마다 동시에 부르는 수', () => {
  function 동시최대(): () => number {
    let inFlight = 0
    let max = 0
    fetchStateMock.mockImplementation(async () => {
      inFlight += 1
      max = Math.max(max, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 0))
      inFlight -= 1
      return schedulerState()
    })
    return () => max
  }

  it('API 키는 한 번에 6건까지 부른다', async () => {
    const max = 동시최대()

    await fillScheduleWindow(['o1', 'o2'], NOW)

    expect(max()).toBe(6)
  })

  // 스케줄러는 캐릭터가 속한 넥슨 계정의 자격으로만 받는다. 상한도 그 계정의 자격마다 따로다.
  it('캐릭터마다 그 계정의 자격으로 부르고, 키의 6건 상한은 키마다 따로 센다', async () => {
    getAuthConfigMock.mockResolvedValue({
      login: { type: 'login', id: 'account-login', session: '세션' },
      mainKeyId: null,
      apiKeys: [
        { type: 'key', id: 'account-부1', label: '', value: '부-키1', loginId: 'account-login' },
        { type: 'key', id: 'account-부2', label: '', value: '부-키2', loginId: 'account-login' },
      ],
    })
    getNexonAccountIdsOfOcids.mockResolvedValue(
      new Map([['o-부1', 'account-부1'], ['o-부2', 'account-부2'], ['o-지운', 'account-지운-키']]),
    )
    const inFlight = new Map<string, number>()
    const max = new Map<string, number>()
    const accountsByOcid = new Map<string, string>()
    fetchStateMock.mockImplementation(async (credential: { accountId: string }, ocid: string) => {
      accountsByOcid.set(ocid, credential.accountId)
      inFlight.set(credential.accountId, (inFlight.get(credential.accountId) ?? 0) + 1)
      max.set(credential.accountId, Math.max(max.get(credential.accountId) ?? 0, inFlight.get(credential.accountId) ?? 0))
      await new Promise((resolve) => setTimeout(resolve, 0))
      inFlight.set(credential.accountId, (inFlight.get(credential.accountId) ?? 0) - 1)
      return schedulerState()
    })

    await fillScheduleWindow(['o-메인', 'o-부1', 'o-부2', 'o-지운'], NOW)

    expect(accountsByOcid).toEqual(
      new Map([['o-메인', 'account-login'], ['o-부1', 'account-부1'], ['o-부2', 'account-부2']]),
    )
    expect(max).toEqual(new Map([['account-login', 13], ['account-부1', 6], ['account-부2', 6]]))
  })

  it('로그인은 창 전부를 한꺼번에 부른다', async () => {
    getAuthConfigMock.mockResolvedValue({ login: { type: 'login', id: 'account-login', session: '세션' }, mainKeyId: null, apiKeys: [] })
    const max = 동시최대()

    await fillScheduleWindow(['o1', 'o2'], NOW)

    expect(max()).toBe(26)
  })
})
