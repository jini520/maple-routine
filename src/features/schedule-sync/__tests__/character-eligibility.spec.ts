import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { NexonBadRequestError, NexonNetworkError } from '../../../nexon/errors'
import { clearScheduleProbeLedger, getScheduleProbeLedger } from '../../../storage/schedule-probe-ledger'
import type { SchedulerCharacterState } from '../../../types'
import { resolveCharacterEligibility } from '../character-eligibility'

jest.mock('../../../nexon/schedule', () => ({
  fetchSchedulerCharacterState: jest.fn(),
}))
const { fetchSchedulerCharacterState: fetchSchedulerCharacterStateMock } = jest.requireMock('../../../nexon/schedule') as Record<string, jest.Mock>

// KST 2026-08-03 12:00 → 백필 날짜는 2026-08-02 … 2026-07-21 (13일)
const NOW = new Date('2026-08-03T03:00:00.000Z')

function state(overrides: Partial<SchedulerCharacterState> = {}): SchedulerCharacterState {
  return {
    asOf: '2026-08-02T00:00+09:00',
    characterName: '내옆에최성일',
    world: '엘리시움',
    level: 200,
    jobClass: '렌',
    dailyContents: [],
    weeklyContents: [],
    bossContents: [],
    isDailyStale: true,
    isWeeklyStale: true,
    isWeeklyBossStale: true,
    isMonthlyBossStale: true,
    ...overrides,
  }
}

const COMPLETED = state({
  dailyContents: [
    {
      name: '[일일 퀘스트] 레헬른의 평온한 밤',
      kind: 'quest',
      isRegistered: true,
      nowCount: 0,
      maxCount: 0,
      questState: 2,
    },
  ],
  isDailyStale: false,
})

beforeEach(async () => {
  installFakePreferences()
  fetchSchedulerCharacterStateMock.mockReset()
  await clearScheduleProbeLedger('ocid-1')
})

/**
 * 마이크로태스크를 충분히 흘린다. 가짜 Preferences 가 전부 마이크로태스크 프로미스라
 * (`fake-preferences`) 이것만으로 원장 읽기까지 통과하고, 그 시점에 **아직 어떤 날짜 응답도
 * resolve 되지 않았다**는 것이 아래 병렬 단언의 핵심이다.
 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve()
  }
}

describe('access_flag는 배제 게이트가 아니라 충분조건이다', () => {
  it('access_flag: true면 API를 부르지 않고 곧바로 자격 O다', async () => {
    await expect(resolveCharacterEligibility('key', 'ocid-1', true, NOW)).resolves.toBe('eligible')
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
  })

  it('access_flag: false여도 과거에 완료 기록이 있으면 자격 O다', async () => {
    fetchSchedulerCharacterStateMock.mockResolvedValue(COMPLETED)
    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('eligible')
  })
})

describe('과거 날짜 스윕 — 13일을 한꺼번에 태운다', () => {
  it('앞 날짜 응답을 기다리지 않는다 — 어떤 응답도 오기 전에 13일이 모두 발사돼 있다', async () => {
    const pending: Array<(value: SchedulerCharacterState) => void> = []
    fetchSchedulerCharacterStateMock.mockImplementation(
      () => new Promise<SchedulerCharacterState>((resolve) => pending.push(resolve)),
    )

    const promise = resolveCharacterEligibility('key', 'ocid-1', false, NOW)
    await flushMicrotasks()

    // 직렬이던 시절에는 여기서 1이었다. 첫 응답이 와야 둘째가 나갔다.
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(13)

    pending.forEach((resolve) => {
      resolve(state())
    })
    await expect(promise).resolves.toBe('ineligible')
  })

  it('발사 순서는 최신 날짜부터다 — 원장 필터가 날짜를 거른 뒤의 순서를 그대로 쓴다', async () => {
    fetchSchedulerCharacterStateMock.mockResolvedValue(state())

    await resolveCharacterEligibility('key', 'ocid-1', false, NOW)

    expect(fetchSchedulerCharacterStateMock).toHaveBeenNthCalledWith(1, 'key', 'ocid-1', '2026-08-02')
    expect(fetchSchedulerCharacterStateMock).toHaveBeenNthCalledWith(13, 'key', 'ocid-1', '2026-07-21')
  })

  it('완료를 찾아도 13일이 다 나간다 — 조기 종료를 포기한 대가다', async () => {
    fetchSchedulerCharacterStateMock.mockResolvedValue(COMPLETED)

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('eligible')
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(13)
  })

  it('완료가 가장 오래된 날짜 하나뿐이어도 자격 O다 — 결과는 모아서 판정한다', async () => {
    fetchSchedulerCharacterStateMock.mockImplementation(
      async (_apiKey: string, _ocid: string, dateKey: string) =>
        dateKey === '2026-07-21' ? COMPLETED : state(),
    )

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('eligible')
  })

  it('14일 내내 완료가 없으면 자격 X이고 13일을 모두 조회한다', async () => {
    fetchSchedulerCharacterStateMock.mockResolvedValue(state())

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('ineligible')
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(13)
  })

  it('오늘 응답을 이미 손에 쥔 호출부가 넘기면 그 완료만으로 통과한다 (호출 0회)', async () => {
    await expect(
      resolveCharacterEligibility('key', 'ocid-1', false, NOW, COMPLETED),
    ).resolves.toBe('eligible')
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
  })
})

describe('같은 날짜를 두 번 조회하지 않는다 (= 이슈 #87 문제 1)', () => {
  it('두 번째 판정은 원장에 없는 날짜만 조회한다 — 스윕 전체가 반복되지 않는다', async () => {
    fetchSchedulerCharacterStateMock.mockResolvedValue(state())
    await resolveCharacterEligibility('key', 'ocid-1', false, NOW)
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(13)

    fetchSchedulerCharacterStateMock.mockClear()
    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('ineligible')
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
  })

  it('하루가 지나면 새로 윈도우에 들어온 날짜 1개만 조회한다', async () => {
    fetchSchedulerCharacterStateMock.mockResolvedValue(state())
    await resolveCharacterEligibility('key', 'ocid-1', false, NOW)

    fetchSchedulerCharacterStateMock.mockClear()
    const tomorrow = new Date('2026-08-04T03:00:00.000Z')
    await expect(resolveCharacterEligibility('key', 'ocid-1', false, tomorrow)).resolves.toBe(
      'ineligible',
    )
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(1)
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledWith('key', 'ocid-1', '2026-08-03')
  })
})

describe('실패 종류별 기록 정책', () => {
  it('400 OPENAPI00003이면 조회 불가로 확정한다 — 13일이 이미 나간 뒤라 호출은 안 아낀다', async () => {
    fetchSchedulerCharacterStateMock.mockRejectedValue(
      new NexonBadRequestError('unavailable', 'OPENAPI00003'),
    )

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('unavailable')
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(13)
    await expect(getScheduleProbeLedger('ocid-1', NOW)).resolves.toMatchObject({ unavailable: true })
  })

  // 원장을 읽는 judgeFromLedger 가 unavailable 을 먼저 보므로, 이번 회차의 답도
  // 같은 순서를 따라야 다음 회차와 갈리지 않는다.
  it('한 날짜라도 OPENAPI00003이면 다른 날짜에 완료가 있어도 unavailable이 이긴다', async () => {
    fetchSchedulerCharacterStateMock.mockImplementation(
      async (_apiKey: string, _ocid: string, dateKey: string) => {
        if (dateKey === '2026-07-21') {
          throw new NexonBadRequestError('unavailable', 'OPENAPI00003')
        }
        return COMPLETED
      },
    )

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('unavailable')

    // 다음 회차가 같은 답을 낸다. 원장이 그렇게 적혔기 때문이다.
    fetchSchedulerCharacterStateMock.mockClear()
    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('unavailable')
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
  })

  it('조회 불가로 확정된 캐릭터는 다음 판정에서 API를 아예 부르지 않는다', async () => {
    fetchSchedulerCharacterStateMock.mockRejectedValue(
      new NexonBadRequestError('unavailable', 'OPENAPI00003'),
    )
    await resolveCharacterEligibility('key', 'ocid-1', false, NOW)

    fetchSchedulerCharacterStateMock.mockClear()
    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('unavailable')
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
  })

  it('400 OPENAPI00004(구간 밖)는 그 날짜만 영구 기록하고 나머지 날짜의 판정을 막지 않는다', async () => {
    fetchSchedulerCharacterStateMock
      .mockRejectedValueOnce(new NexonBadRequestError('out of range', 'OPENAPI00004'))
      .mockResolvedValue(COMPLETED)

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('eligible')

    const ledger = await getScheduleProbeLedger('ocid-1', NOW)
    expect(ledger.dates['2026-08-02']).toEqual({ kind: 'outOfRange' })
  })

  it('400 OPENAPI00009(집계 전)는 기록하지 않는다 — 나중에 다시 시도한다', async () => {
    fetchSchedulerCharacterStateMock.mockRejectedValue(
      new NexonBadRequestError('not collected', 'OPENAPI00009'),
    )

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('ineligible')
    await expect(getScheduleProbeLedger('ocid-1', NOW)).resolves.toEqual({
      unavailable: false,
      dates: {},
    })
  })

  it('네트워크 실패도 기록하지 않는다 — 모르는 실패를 확정으로 굳히지 않는다', async () => {
    fetchSchedulerCharacterStateMock.mockRejectedValue(new NexonNetworkError('offline'))

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('ineligible')
    await expect(getScheduleProbeLedger('ocid-1', NOW)).resolves.toEqual({
      unavailable: false,
      dates: {},
    })
  })
})
