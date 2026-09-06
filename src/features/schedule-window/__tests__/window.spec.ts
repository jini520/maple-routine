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

import { NexonBadRequestError } from '../../../nexon/errors'
import { fillScheduleWindow } from '../window'

const { getAuthConfig: getAuthConfigMock } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
const {
  getScheduleProbeLedger: getLedgerMock,
  markScheduleProbeUnavailable: markUnavailableMock,
  recordScheduleProbe: recordProbeMock,
} = jest.requireMock('../../../storage/schedule-probe-ledger') as Record<string, jest.Mock>
const { fetchSchedulerCharacterState: fetchStateMock } = jest.requireMock('../../../nexon/schedule') as Record<string, jest.Mock>

// KST 2026-09-05(토) 낮. 창은 8/23(오늘−13) ~ 9/4(오늘−1)이고 오늘은 9/5 다.
const NOW = new Date('2026-09-05T03:00:00.000Z')

function schedulerState(): unknown {
  return {
    asOf: '2026-09-04',
    characterName: '루디',
    world: '스카니아',
    level: 290,
    jobClass: '아크메이지',
    dailyContents: [],
    weeklyContents: [],
    bossContents: [
      { name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true, isComplete: true, ownComplete: true },
    ],
    isDailyStale: false,
    isWeeklyStale: false,
    isWeeklyBossStale: false,
    isMonthlyBossStale: false,
  }
}

const asked = (): string[] => fetchStateMock.mock.calls.map(([, , dateKey]) => dateKey).sort()

beforeEach(() => {
  getAuthConfigMock.mockReset().mockResolvedValue({ apiKey: 'key' })
  getLedgerMock.mockReset().mockResolvedValue({ unavailable: false, dates: {} })
  markUnavailableMock.mockReset().mockResolvedValue(undefined)
  recordProbeMock.mockReset().mockResolvedValue(undefined)
  fetchStateMock.mockReset().mockResolvedValue(schedulerState())
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
      expect.objectContaining({ kind: 'observed', bosses: ['스우|하드'] }),
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
  it('캐릭터가 없으면 아무것도 안 한다', async () => {
    await fillScheduleWindow([], NOW)

    expect(getAuthConfigMock).not.toHaveBeenCalled()
    expect(fetchStateMock).not.toHaveBeenCalled()
  })

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
