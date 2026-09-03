import { installFakePreferences } from './fake-preferences'
import {
  clearScheduleProbeLedger,
  getScheduleProbeLedger,
  markScheduleProbeUnavailable,
  recordScheduleProbe,
  type ProbeSectionPresence,
} from '../schedule-probe-ledger'

// KST 2026-08-03 12:00 → 윈도우는 2026-07-21 ~ 2026-08-03
const NOW = new Date('2026-08-03T03:00:00.000Z')

const ALL_PRESENT: ProbeSectionPresence = {
  daily: true,
  weekly: true,
  weeklyBoss: true,
  monthlyBoss: true,
}

const NONE_PRESENT: ProbeSectionPresence = {
  daily: false,
  weekly: false,
  weeklyBoss: false,
  monthlyBoss: false,
}

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await clearScheduleProbeLedger('ocid-1')
})

describe('빈 원장', () => {
  it('기록이 없으면 조회 불가 아님 + 날짜 0건을 반환한다', async () => {
    await expect(getScheduleProbeLedger('ocid-1', NOW)).resolves.toEqual({
      unavailable: false,
      dates: {},
    })
  })

  it('손상된 JSON이면 예외 없이 빈 원장을 반환한다', async () => {
    await prefs.set('scheduleProbe:ocid-broken', 'not-json{')
    await expect(getScheduleProbeLedger('ocid-broken', NOW)).resolves.toEqual({
      unavailable: false,
      dates: {},
    })
  })
})

describe('관측 기록', () => {
  it('기록한 날짜를 그대로 되읽는다', async () => {
    await recordScheduleProbe('ocid-1', '2026-08-01', {
      kind: 'observed',
      hasCompletion: true,
      sections: ALL_PRESENT,
    })

    const ledger = await getScheduleProbeLedger('ocid-1', NOW)
    expect(ledger.dates['2026-08-01']).toEqual({
      kind: 'observed',
      hasCompletion: true,
      sections: ALL_PRESENT,
    })
  })

  it('여러 날짜를 동시에 기록해도 유실되지 않는다', async () => {
    const dateKeys = ['2026-07-25', '2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29']
    await Promise.all(
      dateKeys.map((dateKey) =>
        recordScheduleProbe('ocid-1', dateKey, {
          kind: 'observed',
          hasCompletion: false,
          sections: NONE_PRESENT,
        }),
      ),
    )

    const ledger = await getScheduleProbeLedger('ocid-1', NOW)
    expect(Object.keys(ledger.dates).sort()).toEqual(dateKeys)
  })

  it('같은 날짜를 다시 기록하면 덮어쓴다', async () => {
    await recordScheduleProbe('ocid-1', '2026-08-01', {
      kind: 'observed',
      hasCompletion: false,
      sections: NONE_PRESENT,
    })
    await recordScheduleProbe('ocid-1', '2026-08-01', {
      kind: 'observed',
      hasCompletion: true,
      sections: ALL_PRESENT,
    })

    const ledger = await getScheduleProbeLedger('ocid-1', NOW)
    expect(ledger.dates['2026-08-01']).toMatchObject({ hasCompletion: true })
  })

  it('조회 가능 구간 밖(OPENAPI00004)도 기록해 재조회를 막는다', async () => {
    await recordScheduleProbe('ocid-1', '2026-07-25', { kind: 'outOfRange' })

    const ledger = await getScheduleProbeLedger('ocid-1', NOW)
    expect(ledger.dates['2026-07-25']).toEqual({ kind: 'outOfRange' })
  })
})

describe('캐릭터 단위 조회 불가 (OPENAPI00003)', () => {
  it('markScheduleProbeUnavailable 이후 unavailable이 true다', async () => {
    await markScheduleProbeUnavailable('ocid-1')
    await expect(getScheduleProbeLedger('ocid-1', NOW)).resolves.toMatchObject({ unavailable: true })
  })

  it('이미 기록된 날짜는 그대로 보존한다', async () => {
    await recordScheduleProbe('ocid-1', '2026-08-01', {
      kind: 'observed',
      hasCompletion: true,
      sections: ALL_PRESENT,
    })
    await markScheduleProbeUnavailable('ocid-1')

    const ledger = await getScheduleProbeLedger('ocid-1', NOW)
    expect(ledger.unavailable).toBe(true)
    expect(ledger.dates['2026-08-01']).toBeDefined()
  })
})

describe('14일 윈도우 prune', () => {
  it('윈도우 안(오늘−13)의 날짜는 남는다', async () => {
    await recordScheduleProbe('ocid-1', '2026-07-21', { kind: 'outOfRange' })
    const ledger = await getScheduleProbeLedger('ocid-1', NOW)
    expect(ledger.dates['2026-07-21']).toBeDefined()
  })

  it('윈도우 밖(오늘−14)의 날짜는 읽을 때 사라진다', async () => {
    await recordScheduleProbe('ocid-1', '2026-07-20', { kind: 'outOfRange' })
    const ledger = await getScheduleProbeLedger('ocid-1', NOW)
    expect(ledger.dates['2026-07-20']).toBeUndefined()
  })

  it('오늘보다 미래 날짜도 사라진다', async () => {
    await recordScheduleProbe('ocid-1', '2026-08-04', { kind: 'outOfRange' })
    const ledger = await getScheduleProbeLedger('ocid-1', NOW)
    expect(ledger.dates['2026-08-04']).toBeUndefined()
  })

  it('오늘 날짜는 남는다', async () => {
    await recordScheduleProbe('ocid-1', '2026-08-03', {
      kind: 'observed',
      hasCompletion: true,
      sections: ALL_PRESENT,
    })
    const ledger = await getScheduleProbeLedger('ocid-1', NOW)
    expect(ledger.dates['2026-08-03']).toBeDefined()
  })
})

describe('삭제', () => {
  it('clearScheduleProbeLedger 이후에는 빈 원장이다', async () => {
    await markScheduleProbeUnavailable('ocid-1')
    await recordScheduleProbe('ocid-1', '2026-08-01', { kind: 'outOfRange' })
    await clearScheduleProbeLedger('ocid-1')

    await expect(getScheduleProbeLedger('ocid-1', NOW)).resolves.toEqual({
      unavailable: false,
      dates: {},
    })
  })
})
