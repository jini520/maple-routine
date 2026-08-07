// 자동 기록·드롭 이관 헬퍼 직접 검증 — store.ts 에서 분리하며 비로소 가능해진 것이다([[ADR-111]]).
//
// 이 루프가 지키는 것은 전부 **데이터 무결성**이라(미완료 행을 기록하면 0메소로 영구히 굳고,
// 조회 실패를 "기록 없음"으로 읽으면 사용자가 저장한 파티원 수가 1로 덮인다) 가드 하나하나에
// 테스트를 붙인다. 전에는 스토어를 거쳐야만 이 경우들을 만들 수 있었다.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BossProfitRecord } from '../../../storage/boss-profit'
import type { BossDropRecord } from '../../../storage/boss-drops'
import type { BossProfitRow } from '../rows'

const { getBossPartySizeMock, upsertBossProfitRecordMock, migrateDropsMock } = vi.hoisted(() => ({
  getBossPartySizeMock: vi.fn(),
  upsertBossProfitRecordMock: vi.fn(),
  migrateDropsMock: vi.fn(),
}))

vi.mock('../../../storage/boss-party-settings', () => ({
  getBossPartySize: getBossPartySizeMock,
}))

vi.mock('../../../storage/boss-profit', () => ({
  upsertBossProfitRecord: upsertBossProfitRecordMock,
}))

vi.mock('../drops-loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../drops-loader')>()),
  migrateDropsToConfirmedDifficulty: migrateDropsMock,
}))

const { autoRecordRows } = await import('../auto-record')

const NOW = new Date('2026-08-08T09:00:00.000Z')

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    imageUrl: null,
    world: '스카니아',
    boss: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    periodKey: '2026-08-06',
    periodLabel: '이번 주',
    priceMeso: 10_000_000,
    maxPartySize: 6,
    partySize: null,
    payoutMeso: null,
    isComplete: true,
    ...overrides,
  }
}

const NO_DROPS: BossDropRecord[] = []
const NO_RECORDS: BossProfitRecord[] = []

beforeEach(() => {
  vi.clearAllMocks()
  getBossPartySizeMock.mockResolvedValue(null)
  upsertBossProfitRecordMock.mockResolvedValue(undefined)
  migrateDropsMock.mockResolvedValue(undefined)
})

describe('autoRecordRows', () => {
  it('기록이 없는 완료 행을 기본 파티원 수 1로 기록한다', async () => {
    const result = await autoRecordRows({
      rows: [row()],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
    })

    expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ocid: 'ocid-1',
        boss: '자쿰',
        difficulty: '카오스',
        cycle: 'weekly',
        periodKey: '2026-08-06',
        partySize: 1,
        priceMeso: 10_000_000,
        payoutMeso: 10_000_000,
        recordedAt: NOW.toISOString(),
        world: '스카니아',
      }),
    )
    expect(result[0].partySize).toBe(1)
    expect(result[0].payoutMeso).toBe(10_000_000)
  })

  // ADR-019: 파티 설정이 있으면 그 값이 기본값이고, 분배는 내림이다.
  it('파티 설정이 있으면 그 값으로 payoutMeso = floor(priceMeso / partySize)를 계산한다', async () => {
    getBossPartySizeMock.mockResolvedValue(3)

    const result = await autoRecordRows({
      rows: [row({ priceMeso: 10_000_000 })],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
    })

    expect(getBossPartySizeMock).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스')
    expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ partySize: 3, payoutMeso: 3_333_333 }),
    )
    expect(result[0].payoutMeso).toBe(3_333_333)
  })

  // ADR-067 결정 7 / ADR-111 결정 2: "출처가 지금의 사실인가" 하나가 두 작업을 함께 막는다.
  it('isSourceCurrent가 false인 행은 기록도 드롭 이관도 하지 않는다', async () => {
    const stale = row({ ocid: 'stale' })

    const result = await autoRecordRows({
      rows: [stale],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: (candidate) => candidate.ocid !== 'stale',
    })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    expect(migrateDropsMock).not.toHaveBeenCalled()
    expect(result).toEqual([stale])
  })

  // ADR-050 결정 3: 조회 실패를 "기록 없음"으로 읽으면 사용자가 저장한 파티원 수가 1로 덮인다.
  it('records가 null이면 아무 행도 기록하지 않고 드롭 이관도 하지 않는다', async () => {
    const rows = [row(), row({ boss: '스우' })]

    const result = await autoRecordRows({
      rows,
      records: null,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
    })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    expect(migrateDropsMock).not.toHaveBeenCalled()
    expect(result).toEqual(rows)
  })

  // ADR-032: 기록해버리면 나중에 실제로 완료됐을 때 0메소로 영구히 고정된다.
  it('미완료 placeholder는 기록하지 않는다', async () => {
    const pending = row({ isComplete: false })

    const result = await autoRecordRows({
      rows: [pending],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
    })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    // 미완료 행은 처치 난이도가 아직 없어 이관 대상도 아니다.
    expect(migrateDropsMock).not.toHaveBeenCalled()
    expect(result).toEqual([pending])
  })

  // ADR-069 결정 4: 이관 가드는 자동 기록 가드보다 **넓다** — 이미 기록된 조합도 난이도는 확정이다.
  it('이미 기록된 행은 기록하지 않지만 드롭 이관은 한다', async () => {
    const recorded = row({ partySize: 2, payoutMeso: 5_000_000 })

    const result = await autoRecordRows({
      rows: [recorded],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
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
    })

    expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    expect(migrateDropsMock).toHaveBeenCalledWith(unpriced, NO_DROPS, NOW)
    expect(result).toEqual([unpriced])
  })

  it('반환 배열의 순서가 입력과 같다 — 기록한 행과 건너뛴 행이 섞여도', async () => {
    const rows = [
      row({ boss: '자쿰' }),
      row({ boss: '스우', isComplete: false }),
      row({ boss: '루시드' }),
      row({ boss: '윌', partySize: 2, payoutMeso: 1 }),
    ]

    const result = await autoRecordRows({
      rows,
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
    })

    expect(result.map((r) => r.boss)).toEqual(['자쿰', '스우', '루시드', '윌'])
  })

  // upsertBossProfitRecord는 단일 공유 SQLite 커넥션에 자체 트랜잭션을 열므로 동시 실행하면
  // 트랜잭션이 겹쳐 에러가 난다 — Promise.all 로 병렬화하지 못하도록 순차 실행을 고정한다.
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
      rows: [row({ boss: '자쿰' }), row({ boss: '스우' }), row({ boss: '루시드' })],
      records: NO_RECORDS,
      dropRecords: NO_DROPS,
      now: NOW,
      isSourceCurrent: () => true,
    })

    expect(upsertBossProfitRecordMock).toHaveBeenCalledTimes(3)
    expect(maxInFlight).toBe(1)
  })
})
