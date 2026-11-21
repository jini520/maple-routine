/// <reference types="node" />
/**
 * 보스 관리 설정 저장을 진짜 SQLite 로 태운다. 설정은 `boss_split_settings` 의 줄이고 분배를 정한 줄만 있다. 처치나
 * 드롭만 있는 조합은 설정 줄이 없어 설정이 없는 것으로 읽혀야 한다.
 */
import {
  type BossPartySetting,
  copyMissingBossPartySettings,
  getBossPartySetting,
  getBossPartySettings,
  getBossPartySize,
  setBossPartySetting,
} from '../boss-party-settings'
import { upsertBossProfitRecord } from '../boss-profit'
import { __resetStoragePortsForTest, setSqlitePort } from '../ports'
import { closeBossProfitDb } from '../sqlite/db'
import { createRealSqlite, type RealSqlite } from '../sqlite/__tests__/node-sqlite-port'

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

const AT = '2026-10-03T00:00:00.000Z'

function setting(over: Partial<BossPartySetting> = {}): BossPartySetting {
  return {
    ocid: 'ocid-1',
    bossKey: 'lucid',
    difficulty: 'hard',
    partySize: 2,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    updatedAt: AT,
    ...over,
  }
}

/** 설정 없이 처치만 적는다. 설정 표에는 줄이 생기지 않는다. */
async function recordOnly(ocid: string): Promise<void> {
  await upsertBossProfitRecord({
    ocid, bossKey: 'lucid', boss: '', difficulty: 'hard', cycle: 'weekly', periodKey: '2026-10-01',
    partySize: 3, priceMeso: 10, payoutMeso: 5, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null,
    recordedAt: AT, world: null, worldKey: null,
  })
}

describe('setBossPartySetting', () => {
  it('같은 조합을 다시 쓰면 덮는다', async () => {
    await setBossPartySetting(setting())
    await setBossPartySetting(setting({ partySize: 4 }))

    expect(await getBossPartySize('ocid-1', 'lucid', 'hard')).toBe(4)
    expect(await getBossPartySettings(['ocid-1'])).toHaveLength(1)
  })

  // 내 몫은 % 에 1000 을 곱한 정수 한 칸이다. 자동인 설정은 처치를 적을 때 그 날 요율을 구해서 요율을 비운다.
  it('비율을 % 의 1000 배로 쓰고 자동이면 요율을 비우며, 균등으로 되돌리면 비율이 빈다', async () => {
    await setBossPartySetting(setting({ crystalMyShare: 2, crystalSharesTotal: 5, splitFeePercent: 5, splitFeeAuto: true }))
    expect(await getBossPartySetting('ocid-1', 'lucid', 'hard')).toMatchObject({
      partySize: 2, crystalMyShare: 40_000, crystalSharesTotal: 100_000, splitFeePercent: null, splitFeeAuto: true,
    })

    await setBossPartySetting(setting({ splitFeePercent: 3, splitFeeAuto: false }))
    expect(await getBossPartySetting('ocid-1', 'lucid', 'hard')).toMatchObject({
      crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: 3, splitFeeAuto: false,
    })
  })

  // 손으로 고른 적이 없는 빈 요율은 등급을 따른다. 빈 값을 3% 로 읽던 규칙을 걷었다.
  it('요율이 빈 설정은 등급을 따르는 것으로 쓴다', async () => {
    await setBossPartySetting(setting({ splitFeePercent: null, splitFeeAuto: false }))

    expect(await getBossPartySetting('ocid-1', 'lucid', 'hard')).toMatchObject({ splitFeePercent: null, splitFeeAuto: true })
  })

  it('처치만 있는 조합에도 설정을 쓸 수 있다', async () => {
    await recordOnly('ocid-1')
    await setBossPartySetting(setting({ partySize: 4 }))

    expect(await getBossPartySize('ocid-1', 'lucid', 'hard')).toBe(4)
  })
})

describe('설정이 없는 조합', () => {
  it('행이 없으면 null 이다', async () => {
    expect(await getBossPartySize('ocid-1', 'lucid', 'hard')).toBeNull()
    expect(await getBossPartySetting('ocid-1', 'lucid', 'hard')).toBeNull()
  })

  it('처치만 있는 조합은 설정이 없는 것으로 읽는다', async () => {
    await recordOnly('ocid-1')

    expect(await getBossPartySize('ocid-1', 'lucid', 'hard')).toBeNull()
    expect(await getBossPartySetting('ocid-1', 'lucid', 'hard')).toBeNull()
    expect(await getBossPartySettings(['ocid-1'])).toEqual([])
  })

  it('getBossPartySettings 는 빈 목록이면 조회하지 않는다', async () => {
    expect(await getBossPartySettings([])).toEqual([])
  })
})

describe('copyMissingBossPartySettings', () => {
  it('새 캐릭터에 없는 설정만 옮긴다. 이미 정한 값은 안 덮는다', async () => {
    await setBossPartySetting(setting({ ocid: 'old', bossKey: 'lucid', partySize: 3, crystalMyShare: 1, crystalSharesTotal: 3 }))
    await setBossPartySetting(setting({ ocid: 'old', bossKey: 'will', partySize: 2 }))
    await setBossPartySetting(setting({ ocid: 'new', bossKey: 'will', partySize: 6 }))

    await copyMissingBossPartySettings('old', 'new', '2026-10-10T00:00:00.000Z')

    const copied = Object.fromEntries((await getBossPartySettings(['new'])).map((row) => [row.bossKey, row]))
    expect(copied.lucid).toMatchObject({ partySize: 3, crystalMyShare: 33_333, crystalSharesTotal: 100_000, updatedAt: '2026-10-10T00:00:00.000Z' })
    expect(copied.will).toMatchObject({ partySize: 6 })
  })

  it('처치만 있는 새 캐릭터에도 설정을 옮긴다', async () => {
    await setBossPartySetting(setting({ ocid: 'old', partySize: 3 }))
    await recordOnly('new')

    await copyMissingBossPartySettings('old', 'new', AT)

    expect(await getBossPartySize('new', 'lucid', 'hard')).toBe(3)
  })

  it('옛 캐릭터에 처치만 있으면 옮길 설정이 없다', async () => {
    await recordOnly('old')

    await copyMissingBossPartySettings('old', 'new', AT)

    expect(real.inspect((db) => db.prepare(`SELECT count(*) AS n FROM boss_split_settings WHERE ocid = 'new'`).get())).toEqual({ n: 0 })
  })
})

describe('분배 방식 `제외`', () => {
  // `제외` 를 고르면 그 전의 분배를 지우고, 인원이 없어 솔로로 다룬다. 다시 `기본` 이나 `비율` 을 고르면 새로 정한다.
  it('`제외` 를 쓰면 인원 · 비율 · 요율을 버리고 다시 읽을 때 솔로인 `제외` 로 읽는다', async () => {
    await setBossPartySetting(setting({ partySize: 2, crystalMyShare: 2, crystalSharesTotal: 3, splitFeePercent: 3, crystalExcluded: true }))

    expect(await getBossPartySetting('ocid-1', 'lucid', 'hard')).toMatchObject({
      partySize: 1,
      crystalMyShare: null,
      crystalSharesTotal: null,
      splitFeePercent: null,
      crystalExcluded: true,
    })
  })

  it('`기본` 으로 되돌리면 `제외` 가 풀린다', async () => {
    await setBossPartySetting(setting({ crystalExcluded: true }))
    await setBossPartySetting(setting({ crystalExcluded: false }))

    expect((await getBossPartySetting('ocid-1', 'lucid', 'hard'))?.crystalExcluded).toBe(false)
  })

  it('리프한 새 캐릭터로 설정을 옮길 때 `제외` 도 함께 간다', async () => {
    await setBossPartySetting(setting({ crystalExcluded: true }))
    await copyMissingBossPartySettings('ocid-1', 'ocid-2', AT)

    expect((await getBossPartySetting('ocid-2', 'lucid', 'hard'))?.crystalExcluded).toBe(true)
  })
})
