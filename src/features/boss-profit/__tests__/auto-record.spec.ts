// 자동 기록·드롭 이관 헬퍼 직접 검증. store.ts 에서 분리하며 비로소 가능해진 것이다.
//
// 이 루프가 지키는 것은 전부 **데이터 무결성**이라(미완료 행을 기록하면 0메소로 영구히 굳고,
// 조회 실패를 "기록 없음"으로 읽으면 사용자가 저장한 파티원 수가 1로 덮인다) 가드 하나하나에
// 테스트를 붙인다. 전에는 스토어를 거쳐야만 이 경우들을 만들 수 있었다.
import type { BossProfitRecord } from '../../../storage/boss-profit'
import type { BossDropRecord } from '../../../storage/boss-drops'
import type { BossProfitRow } from '../rows'

jest.mock('../../../storage/boss-party-settings', () => ({
  getBossPartySetting: jest.fn(),
}))
const { getBossPartySetting: getBossPartySettingMock } = jest.requireMock('../../../storage/boss-party-settings') as Record<string, jest.Mock>

jest.mock('../../../storage/boss-profit', () => ({
  upsertBossProfitRecord: jest.fn(),
  markBossProfitRecordAuto: jest.fn(),
}))
const {
  upsertBossProfitRecord: upsertBossProfitRecordMock,
  markBossProfitRecordAuto: markAutoMock,
} = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>

jest.mock('../drops-loader', () => ({
  ...jest.requireActual<typeof import('../drops-loader')>('../drops-loader'),
  migrateDropsToConfirmedDifficulty: jest.fn(),
}))
const { migrateDropsToConfirmedDifficulty: migrateDropsMock } = jest.requireMock('../drops-loader') as Record<string, jest.Mock>

jest.mock('../../mvp-grade/fee-context', () => ({ loadFeeContext: jest.fn() }))
const { loadFeeContext: loadFeeContextMock } = jest.requireMock('../../mvp-grade/fee-context') as Record<string, jest.Mock>

// 판 알림을 모으는 반복. 쓰기가 그 안에서 도는지 깊이로 본다.
jest.mock('../../../storage/record-revision-batch', () => ({
  batchRecordWrites: async (write: () => Promise<unknown>) => {
    mockBatchDepth += 1
    try {
      return await write()
    } finally {
      mockBatchDepth -= 1
    }
  },
}))
var mockBatchDepth = 0

const { autoRecordRows } = require('../auto-record') as typeof import('../auto-record')

const NOW = new Date('2026-08-08T09:00:00.000Z')

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    imageUrl: null,
    world: '스카니아',
    worldKey: 'scania',
    bossKey: 'zakum',
    bossName: '자쿰',
    difficulty: 'chaos',
    cycle: 'weekly',
    periodKey: '2026-08-06',
    periodLabel: '이번 주',
    priceMeso: 10_000_000,
    maxPartySize: 6,
    partySize: null,
    payoutMeso: null,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    isComplete: true,
    defeatedOn: null,
    source: 'auto',
    ...overrides,
  }
}

const NO_DROPS: BossDropRecord[] = []
const NO_RECORDS: BossProfitRecord[] = []
// 넥슨 완료 목록은 직접 기록의 표식을 걷을지만 가른다. 그것을 보지 않는 테스트는 빈 목록을 준다.
const 넥슨완료: ReadonlySet<string> = new Set()

beforeEach(() => {
  jest.clearAllMocks()
  getBossPartySettingMock.mockResolvedValue(null)
  upsertBossProfitRecordMock.mockResolvedValue(undefined)
  markAutoMock.mockResolvedValue(undefined)
  migrateDropsMock.mockResolvedValue(undefined)
})


/** 파티 설정 한 줄. 비율을 안 쓰는 파티라 칸 다섯이 전부 null 이다. */
function partySetting(partySize: number, shares: Partial<Record<string, number>> = {}) {
  return {
    ocid: 'ocid-1',
    bossKey: 'zakum',
    difficulty: 'chaos',
    partySize,
    crystalMyShare: null,
    crystalSharesTotal: null,
    dropMyShare: null,
    dropSharesTotal: null,
    splitFeePercent: null,
    updatedAt: '2026-09-12T00:00:00.000Z',
    ...shares,
  }
}

describe('autoRecordRows', () => {
  // 한 회차가 수십 건을 적는다. 쓰기마다 알리면 판을 구독하는 화면이 그만큼 다시 그려진다.
  it('행마다 적는 반복은 판 알림을 모으는 반복 안에서 돈다', async () => {
    const depths: number[] = []
    upsertBossProfitRecordMock.mockImplementation(async () => {
      depths.push(mockBatchDepth)
    })

    await autoRecordRows({
      rows: [row(), row({ bossKey: 'lucid', bossName: '루시드' })],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    expect(depths).toEqual([1, 1])
  })

  it('기록이 없는 완료 행을 기본 파티원 수 1로 기록한다', async () => {
    const result = await autoRecordRows({
      rows: [row()],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ocid: 'ocid-1',
        bossKey: 'zakum',
        boss: '자쿰',
        difficulty: 'chaos',
        cycle: 'weekly',
        periodKey: '2026-08-06',
        partySize: 1,
        priceMeso: 10_000_000,
        payoutMeso: 10_000_000,
        crystalMyShare: null,
        crystalSharesTotal: null,
        splitFeePercent: null,
        recordedAt: NOW.toISOString(),
        world: '스카니아',
        worldKey: 'scania',
      }),
    )
    expect(result[0].partySize).toBe(1)
    expect(result[0].payoutMeso).toBe(10_000_000)
  })

  // 파티 설정이 있으면 그 값이 기본값이고, 분배는 내림이다.
  it('파티 설정이 있으면 그 값으로 payoutMeso = floor(priceMeso / partySize)를 계산한다', async () => {
    getBossPartySettingMock.mockResolvedValue(partySetting(3))

    const result = await autoRecordRows({
      rows: [row({ priceMeso: 10_000_000 })],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    expect(getBossPartySettingMock).toHaveBeenCalledWith('ocid-1', 'zakum', 'chaos')
    expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ partySize: 3, payoutMeso: 3_333_333 }),
    )
    expect(result[0].payoutMeso).toBe(3_333_333)
  })

  // 송금 수수료가 자동인 설정은 그 기간 첫날의 등급 요율로 적고 기록도 자동이다. 등급 기록이 바뀌면 다시 센다.
  it('파티 설정의 송금 수수료가 자동이면 그 기간의 등급 요율로 적는다', async () => {
    getBossPartySettingMock.mockResolvedValue(
      { ...partySetting(2, { crystalMyShare: 2, crystalSharesTotal: 3 }), splitFeeAuto: true },
    )
    loadFeeContextMock.mockResolvedValue({
      histories: new Map([['A', [{ startDate: '2026-08-06', grade: 'silver' }]]]),
      sightings: [{ ocid: 'ocid-1', name: '낟낟', accountId: 'A', firstSeenOn: '2026-08-01', lastSeenOn: '2026-08-08' }],
      fallbackOcid: 'ocid-1',
    })

    await autoRecordRows({
      rows: [row({ priceMeso: 1_000_000 })],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    // 500,000 × (200 − 3) × 2 / (300 − 3)
    expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ splitFeePercent: 3, splitFeeAuto: true, payoutMeso: 663_299 }),
    )
  })

  // 출처가 지금의 사실인가 하나가 두 작업을 함께 막는다.
  it('isSourceCurrent가 false인 행은 기록도 드롭 이관도 하지 않는다', async () => {
    const stale = row({ ocid: 'stale' })

    const result = await autoRecordRows({
      rows: [stale],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: (candidate) => candidate.ocid !== 'stale',
      nexonCompleted: 넥슨완료,
    })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    expect(migrateDropsMock).not.toHaveBeenCalled()
    expect(result).toEqual([stale])
  })

  // 조회 실패를 "기록 없음"으로 읽으면 사용자가 저장한 파티원 수가 1로 덮인다.
  it('records가 null이면 아무 행도 기록하지 않고 드롭 이관도 하지 않는다', async () => {
    const rows = [row(), row({ bossKey: 'lotus', bossName: '스우' })]

    const result = await autoRecordRows({
      rows,
      records: null,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    expect(migrateDropsMock).not.toHaveBeenCalled()
    expect(result).toEqual(rows)
  })

  // 기록해버리면 나중에 실제로 완료됐을 때 0메소로 영구히 고정된다.
  it('미완료 placeholder는 기록하지 않는다', async () => {
    const pending = row({ isComplete: false })

    const result = await autoRecordRows({
      rows: [pending],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    // 미완료 행은 처치 난이도가 아직 없어 이관 대상도 아니다.
    expect(migrateDropsMock).not.toHaveBeenCalled()
    expect(result).toEqual([pending])
  })

  // 이관 가드는 자동 기록 가드보다 **넓다**. 이미 기록된 조합도 난이도는 확정이다.
  it('이미 기록된 행은 기록하지 않지만 드롭 이관은 한다', async () => {
    const recorded = row({ partySize: 2, payoutMeso: 5_000_000 })

    const result = await autoRecordRows({
      rows: [recorded],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    expect(migrateDropsMock).toHaveBeenCalledWith(recorded, NO_DROPS, NOW)
    expect(result).toEqual([recorded])
  })

  it('가격 미확정(priceMeso === null) 행은 기록하지 않지만 드롭 이관은 한다', async () => {
    const unpriced = row({ priceMeso: null })

    const result = await autoRecordRows({
      rows: [unpriced],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    expect(migrateDropsMock).toHaveBeenCalledWith(unpriced, NO_DROPS, NOW)
    expect(result).toEqual([unpriced])
  })

  it('반환 배열의 순서가 입력과 같다. 기록한 행과 건너뛴 행이 섞여도', async () => {
    const rows = [
      row({ bossKey: 'zakum', bossName: '자쿰' }),
      row({ bossKey: 'lotus', bossName: '스우', isComplete: false }),
      row({ bossKey: 'lucid', bossName: '루시드' }),
      row({ bossKey: 'will', bossName: '윌', partySize: 2, payoutMeso: 1 }),
    ]

    const result = await autoRecordRows({
      rows,
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    expect(result.map((r) => r.bossName)).toEqual(['자쿰', '스우', '루시드', '윌'])
  })

  // upsertBossProfitRecord는 단일 공유 SQLite 커넥션에 자체 트랜잭션을 열므로 동시 실행하면
  // 트랜잭션이 겹쳐 에러가 난다. Promise.all 로 병렬화하지 못하도록 순차 실행을 고정한다.
  it('여러 행을 순차로 기록한다(트랜잭션이 겹치지 않는다)', async () => {
    let inFlight = 0
    let maxInFlight = 0
    upsertBossProfitRecordMock.mockImplementation(async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await Promise.resolve()
      inFlight -= 1
    })

    await autoRecordRows({
      rows: [row({ bossKey: 'zakum', bossName: '자쿰' }), row({ bossKey: 'lotus', bossName: '스우' }), row({ bossKey: 'lucid', bossName: '루시드' })],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    expect(upsertBossProfitRecordMock).toHaveBeenCalledTimes(3)
    expect(maxInFlight).toBe(1)
  })
})

// 한 주에 한 보스를 두 난이도로 잡을 수 없다(게임 규칙, 사용자 확인). 난이도만 다른 기록을 한 줄 더
// 쓰면 같은 처치가 두 번 세어진다. 사용자가 직접 적은 완료 위에 넥슨의 다른 난이도가 얹히는 경로가
// 바로 이것이다.
describe('같은 보스 · 같은 기간에 기록이 있으면', () => {
  const 사용자기록: BossProfitRecord = {
    ocid: 'ocid-1',
    bossKey: 'zakum',
    boss: '자쿰',
    difficulty: 'normal',
    cycle: 'weekly',
    periodKey: '2026-08-06',
    partySize: 2,
    priceMeso: 8_000_000,
    payoutMeso: 4_000_000,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    recordedAt: '2026-08-07T00:00:00.000Z',
    world: '스카니아',
    worldKey: 'scania',
    source: 'manual',
  }

  it('난이도가 달라도 새로 안 쓴다', async () => {
    await autoRecordRows({
      rows: [row({ difficulty: 'chaos' })],
      records: [사용자기록],
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
  })

  it('넥슨이 같은 난이도 완료를 주면 사용자 기록을 자동 기록으로 내린다', async () => {
    await autoRecordRows({
      rows: [row({ difficulty: 'normal', partySize: 2, payoutMeso: 4_000_000 })],
      records: [사용자기록],
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      // 넥슨 응답이 그 난이도를 완료로 줬다.
      nexonCompleted: new Set(['ocid-1|zakum|normal']),
    })

    expect(markAutoMock).toHaveBeenCalledWith({
      ocid: 'ocid-1',
      bossKey: 'zakum',
      difficulty: 'normal',
      periodKey: '2026-08-06',
    })
    // 값은 한 칸도 안 건드린다. 사용자가 적은 파티원 수와 날짜가 더 정확하다.
    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
  })

  it('다른 캐릭터 · 다른 기간의 기록은 안 막는다', async () => {
    await autoRecordRows({
      rows: [row()],
      records: [{ ...사용자기록, periodKey: '2026-07-30' }],
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      nexonCompleted: 넥슨완료,
    })

    expect(upsertBossProfitRecordMock).toHaveBeenCalledTimes(1)
  })

  /**
   * **행이 완료인 것과 넥슨이 완료를 준 것은 다른 사실이다.**
   *
   * 직접 적은 기록이 있으면 그 행은 완료로 그려진다. 그것을 넥슨이 준 완료로 읽으면 방금 적은
   * 표식을 저절로 걷어, 사용자는 수정·취소로 가는 문을 잃는다(실기기에서 그렇게 잃었다).
   */
  it('넥슨이 안 준 완료는 표식을 안 걷는다', async () => {
    await autoRecordRows({
      rows: [row({ difficulty: 'normal', partySize: 2, payoutMeso: 4_000_000 })],
      records: [사용자기록],
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
      // 넥슨은 이 보스를 미완료로 주고 있다. 그래서 목록이 비어 있다.
      nexonCompleted: new Set(),
    })

    expect(markAutoMock).not.toHaveBeenCalled()
  })
})
