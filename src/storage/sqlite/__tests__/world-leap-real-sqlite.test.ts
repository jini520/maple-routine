/// <reference types="node" />
/**
 * 월드 리프로 갈린 두 ocid 를 잇고 그 기록을 정리하는 저장 연산을 진짜 SQLite 로 태우는 자리.
 *
 * 충돌 무시(`INSERT OR IGNORE ... SELECT`)와 칸별 최솟값은 엔진이 판정하는 것이라 목으로는 못 본다.
 */
import { closeBossProfitDb } from '../db'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { copyMissingBossPartySettings, getBossPartySettings, setBossPartySetting } from '../../boss-party-settings'
import {
  deleteBossProfitRecord,
  getBossProfitRecords,
  getBossProfitRecordsRevision,
  getEarliestBossProfitPeriodKeys,
  moveBossRecordsToOcid,
  upsertBossProfitRecord,
  type BossProfitRecord,
} from '../../boss-profit'
import { getCharacterWorldLeaps, linkCharacterWorldLeap } from '../../character-world-leaps'
import { getCharacterProfilesByNames, saveCharacterProfile } from '../../character-profiles'
import { getFragmentStorage, getIncomeRecordsBetween, insertIncomeRecord, moveIncomeRecordsToOcid } from '../../income'
import { getRememberedLevels, moveRememberedLevelsToOcid, rememberLevels } from '../../remembered-levels'
import { getSpendRecordsBetween, insertSpendRecord, moveSpendRecordsToOcid, type SpendRecord } from '../../spend'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

function record(overrides: Partial<BossProfitRecord>): BossProfitRecord {
  return {
    ocid: 'old',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'hard',
    cycle: 'weekly',
    periodKey: '2026-09-10',
    partySize: 1,
    priceMeso: 1_000_000,
    payoutMeso: 1_000_000,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    recordedAt: '2026-09-11T00:00:00.000Z',
    world: '챌린저스2',
    worldKey: 'challengers_2',
    ...overrides,
  }
}

describe('character_world_leaps', () => {
  it('처음 잇는 옛 ocid 면 참을 돌려주고 행을 남긴다', async () => {
    await expect(linkCharacterWorldLeap('old', 'new', '2026-09-14T00:00:00.000Z')).resolves.toBe(true)

    await expect(getCharacterWorldLeaps()).resolves.toEqual([
      { fromOcid: 'old', toOcid: 'new', linkedAt: '2026-09-14T00:00:00.000Z' },
    ])
  })

  // 설정 복사를 한 번만 하는 근거가 이 거짓이다.
  it('이미 이어진 옛 ocid 면 거짓이고 행을 안 바꾼다', async () => {
    await linkCharacterWorldLeap('old', 'new', '2026-09-14T00:00:00.000Z')

    await expect(linkCharacterWorldLeap('old', 'new', '2026-09-15T00:00:00.000Z')).resolves.toBe(false)
    await expect(getCharacterWorldLeaps()).resolves.toEqual([
      { fromOcid: 'old', toOcid: 'new', linkedAt: '2026-09-14T00:00:00.000Z' },
    ])
  })
})

describe('copyMissingBossPartySettings', () => {
  it('옛 캐릭터 설정을 전부 옮기고, 새 캐릭터에 이미 있는 설정은 안 덮는다', async () => {
    await setBossPartySetting({ ocid: 'old', bossKey: 'lotus', difficulty: 'hard', partySize: 3, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, updatedAt: '2026-09-01T00:00:00.000Z' })
    await setBossPartySetting({ ocid: 'old', bossKey: 'damien', difficulty: 'hard', partySize: 2, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, updatedAt: '2026-09-01T00:00:00.000Z' })
    await setBossPartySetting({ ocid: 'new', bossKey: 'lotus', difficulty: 'hard', partySize: 6, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, updatedAt: '2026-09-12T00:00:00.000Z' })

    await copyMissingBossPartySettings('old', 'new', '2026-09-14T00:00:00.000Z')

    const settings = await getBossPartySettings(['new'])
    expect(
      settings.map(({ bossKey, partySize }) => ({ bossKey, partySize })).sort((a, b) => a.bossKey.localeCompare(b.bossKey)),
    ).toEqual([
      { bossKey: 'damien', partySize: 2 },
      { bossKey: 'lotus', partySize: 6 },
    ])
    // 옛 캐릭터 설정은 그대로다.
    expect((await getBossPartySettings(['old'])).length).toBe(2)
  })
})

describe('getEarliestBossProfitPeriodKeys', () => {
  it('주간·월간을 따로 가장 이른 기간 키를 준다', async () => {
    await upsertBossProfitRecord(record({ ocid: 'new', periodKey: '2026-09-17' }))
    await upsertBossProfitRecord(record({ ocid: 'new', periodKey: '2026-09-10', bossKey: 'damien', boss: '데미안' }))
    await upsertBossProfitRecord(record({ ocid: 'new', cycle: 'monthly', periodKey: '2026-10', bossKey: 'black_mage', boss: '검은 마법사' }))
    await upsertBossProfitRecord(record({ ocid: 'old', periodKey: '2026-09-03' }))

    await expect(getEarliestBossProfitPeriodKeys('new')).resolves.toEqual({ weekly: '2026-09-10', monthly: '2026-10' })
  })

  it('기록이 없는 주기는 안 든다', async () => {
    await upsertBossProfitRecord(record({ ocid: 'new', periodKey: '2026-09-10' }))

    await expect(getEarliestBossProfitPeriodKeys('new')).resolves.toEqual({ weekly: '2026-09-10' })
  })
})

describe('deleteBossProfitRecord', () => {
  it('그 키의 행 하나만 지우고 기록 표의 수를 올린다', async () => {
    await upsertBossProfitRecord(record({ ocid: 'old' }))
    await upsertBossProfitRecord(record({ ocid: 'new' }))
    const before = getBossProfitRecordsRevision()

    await deleteBossProfitRecord({ ocid: 'old', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-09-10' })

    const left = await getBossProfitRecords(['old', 'new'], ['2026-09-10'])
    expect(left.map((row) => row.ocid)).toEqual(['new'])
    expect(getBossProfitRecordsRevision()).toBe(before + 1)
  })
})

describe('getCharacterProfilesByNames', () => {
  it('이름이 같은 스냅샷을 ocid 와 무관하게 전부 준다', async () => {
    const snapshot = { imageUrl: '', world: null, worldKey: null, level: 285, updatedAt: '2026-09-14T00:00:00.000Z' }
    await saveCharacterProfile({ ...snapshot, ocid: 'old', name: '지내우시', jobClass: '레테', world: '챌린저스2', worldKey: 'challengers_2' })
    await saveCharacterProfile({ ...snapshot, ocid: 'new', name: '지내우시', jobClass: '레테', world: '엘리시움', worldKey: 'elysium' })
    await saveCharacterProfile({ ...snapshot, ocid: 'other', name: '루디', jobClass: '아크메이지' })

    const profiles = await getCharacterProfilesByNames(['지내우시'])

    expect(profiles.map((profile) => profile.ocid).sort()).toEqual(['new', 'old'])
    expect(profiles.find((profile) => profile.ocid === 'old')).toMatchObject({ jobClass: '레테', world: '챌린저스2', worldKey: 'challengers_2' })
  })

  it('이름이 없으면 조회하지 않고 빈 목록이다', async () => {
    await expect(getCharacterProfilesByNames([])).resolves.toEqual([])
  })
})

// 리프를 이으면 옛 ocid 의 기록을 새 ocid 로 옮긴다. 새 ocid 에 같은 자리의 값이 있으면 새 것을 둔다.
describe('월드 리프 옮기기', () => {
  const EVEN = { crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null }

  function sorted(records: readonly BossProfitRecord[]) {
    return records
      .map(({ ocid, periodKey, worldKey }) => ({ ocid, periodKey, worldKey }))
      .sort((a, b) => `${a.ocid}${a.periodKey}`.localeCompare(`${b.ocid}${b.periodKey}`))
  }

  it('보스 기록: 새 캐릭터에 조합이 없으면 조합째 옮기고, 기간의 월드는 리프 전 월드로 둔다', async () => {
    await setBossPartySetting({ ocid: 'old', bossKey: 'lotus', difficulty: 'hard', partySize: 3, ...EVEN, updatedAt: '2026-09-01T00:00:00.000Z' })
    await upsertBossProfitRecord(record({ ocid: 'old', periodKey: '2026-09-03' }))
    await upsertBossProfitRecord(record({ ocid: 'old', periodKey: '2026-09-10' }))
    const before = getBossProfitRecordsRevision()

    await expect(moveBossRecordsToOcid('old', 'new')).resolves.toBe(2)

    expect(sorted(await getBossProfitRecords(['old', 'new'], ['2026-09-03', '2026-09-10']))).toEqual([
      { ocid: 'new', periodKey: '2026-09-03', worldKey: 'challengers_2' },
      { ocid: 'new', periodKey: '2026-09-10', worldKey: 'challengers_2' },
    ])
    expect((await getBossPartySettings(['new'])).map(({ partySize }) => partySize)).toEqual([3])
    expect(getBossProfitRecordsRevision()).toBe(before + 1)
  })

  // 새 조합에 이미 있는 기간은 리프 중복 정리가 짝짓는 기간이다. 정리 뒤에도 남았으면 짝을 모르는 것이라 건드리지 않는다.
  it('보스 기록: 새 캐릭터에 조합이 있으면 기간만 옮기고 설정은 새 것을 두며, 새 조합에 이미 있는 기간은 남긴다', async () => {
    await setBossPartySetting({ ocid: 'old', bossKey: 'lotus', difficulty: 'hard', partySize: 3, ...EVEN, updatedAt: '2026-09-01T00:00:00.000Z' })
    await setBossPartySetting({ ocid: 'new', bossKey: 'lotus', difficulty: 'hard', partySize: 6, ...EVEN, updatedAt: '2026-09-12T00:00:00.000Z' })
    await upsertBossProfitRecord(record({ ocid: 'old', periodKey: '2026-09-03' }))
    await upsertBossProfitRecord(record({ ocid: 'old', periodKey: '2026-09-10' }))
    await upsertBossProfitRecord(record({ ocid: 'new', periodKey: '2026-09-10', world: '엘리시움', worldKey: 'elysium' }))

    await expect(moveBossRecordsToOcid('old', 'new')).resolves.toBe(1)

    expect(sorted(await getBossProfitRecords(['old', 'new'], ['2026-09-03', '2026-09-10']))).toEqual([
      { ocid: 'new', periodKey: '2026-09-03', worldKey: 'challengers_2' },
      { ocid: 'new', periodKey: '2026-09-10', worldKey: 'elysium' },
      { ocid: 'old', periodKey: '2026-09-10', worldKey: 'challengers_2' },
    ])
    expect((await getBossPartySettings(['new'])).map(({ partySize }) => partySize)).toEqual([6])
  })

  it('보스 기록: 옮길 것이 없으면 0 이고 기록 표의 수를 올리지 않는다', async () => {
    const before = getBossProfitRecordsRevision()

    await expect(moveBossRecordsToOcid('old', 'new')).resolves.toBe(0)
    expect(getBossProfitRecordsRevision()).toBe(before)
  })

  it('가계부: 기록과 헥사 강화가 가져간 보관 조각의 ocid 를 바꾸고, 월드 칸은 리프 전 월드로 둔다', async () => {
    const snapshot = { name: '지내우시', imageUrl: '', level: 285, jobClass: '레테', updatedAt: '2026-09-01T00:00:00.000Z' }
    await saveCharacterProfile({ ...snapshot, ocid: 'old', world: '챌린저스2', worldKey: 'challengers_2' })
    await saveCharacterProfile({ ...snapshot, ocid: 'new', world: '엘리시움', worldKey: 'elysium' })
    await insertIncomeRecord({
      id: '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e',
      ocid: 'old',
      earnedOn: '2026-09-05',
      category: 'hunting',
      item: null,
      itemKey: null,
      mesoAmount: 100_000_000,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
      quantity: null,
      itemKind: null,
      saleFeePercent: null,
      saleFeeMeso: null,
      saleFeeAuto: false,
      hunt: { mode: 'manual', typedMeso: 100_000_000, fragments: 30, fragmentPrice: null },
      recordedAt: '2026-09-05T01:00:00.000Z',
    })
    const 헥사: SpendRecord = {
      id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
      ocid: 'old',
      spentOn: '2026-09-06',
      category: 'hexa_matrix',
      item: null,
      itemKey: 'hexa_stat_1',
      formItemKeys: null,
      itemKind: null,
      levelFrom: null,
      levelTo: null,
      quantity: null,
      mesoAmount: 0,
      tariffMeso: null,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
      hexa: {
        fragmentCount: 10,
        untradableFragmentCount: 0,
        fragmentPrice: null,
        activation: false,
        useStorage: true,
        storageAsSpend: false,
        storageUses: [{ ocid: 'old', fragments: 10 }],
      },
      recordedAt: '2026-09-06T01:00:00.000Z',
    }
    await insertSpendRecord(헥사)

    await moveIncomeRecordsToOcid('old', 'new')
    await moveSpendRecordsToOcid('old', 'new')

    expect((await getIncomeRecordsBetween('2026-09-01', '2026-09-30')).map((one) => one.ocid)).toEqual(['new'])
    const [spend] = await getSpendRecordsBetween('2026-09-01', '2026-09-30')
    expect(spend!.ocid).toBe('new')
    expect(spend!.hexa!.storageUses).toEqual([{ ocid: 'new', fragments: 10 }])
    await expect(getFragmentStorage('new', '2026-09-30')).resolves.toBe(20)
    await expect(getFragmentStorage('old', '2026-09-30')).resolves.toBe(0)
    expect(real.inspect((db) => db.prepare('SELECT DISTINCT world_key FROM cashbook_entries').all())).toEqual([
      { world_key: 'challengers_2' },
    ])
  })

  it('기억한 레벨: 새 캐릭터에 없는 대상만 옮기고 옛 줄은 지운다', async () => {
    await rememberLevels('old', 'symbol', { arcane_vanishing_journey: 20, arcane_chu_chu: 18 }, 'overwrite')
    await rememberLevels('new', 'symbol', { arcane_chu_chu: 19 }, 'overwrite')

    await moveRememberedLevelsToOcid('old', 'new')

    await expect(getRememberedLevels('new', 'symbol')).resolves.toEqual({ arcane_vanishing_journey: 20, arcane_chu_chu: 19 })
    await expect(getRememberedLevels('old', 'symbol')).resolves.toEqual({})
  })
})
