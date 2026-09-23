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
  upsertBossProfitRecord,
  type BossProfitRecord,
} from '../../boss-profit'
import { getCharacterWorldLeaps, linkCharacterWorldLeap } from '../../character-world-leaps'
import { getCharacterProfilesByNames, saveCharacterProfile } from '../../character-profiles'
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
