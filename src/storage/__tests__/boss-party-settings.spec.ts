/// <reference types="node" />
/**
 * 보스 관리 설정 저장을 진짜 SQLite 로 태운다. 설정은 `boss_parties` 의 분배 칸이다. 처치나 드롭이 먼저
 * 생겨 만들어진 조합 행은 분배 칸이 비어 있고, 그 행은 설정이 없는 것으로 읽혀야 한다(솔로).
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

/** 설정 없이 처치만 적어 분배 칸이 빈 조합 행을 만든다. */
async function recordOnly(ocid: string): Promise<void> {
  await upsertBossProfitRecord({
    ocid, bossKey: 'lucid', boss: '', difficulty: 'hard', cycle: 'weekly', periodKey: '2026-10-02',
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

  it('비율과 수수료를 함께 쓰고, 균등으로 되돌리면 비율이 빈다', async () => {
    await setBossPartySetting(setting({ crystalMyShare: 2, crystalSharesTotal: 5, splitFeePercent: 5, splitFeeAuto: true }))
    expect(await getBossPartySetting('ocid-1', 'lucid', 'hard')).toMatchObject({
      partySize: 2, crystalMyShare: 2, crystalSharesTotal: 5, splitFeePercent: 5, splitFeeAuto: true,
    })

    await setBossPartySetting(setting())
    expect(await getBossPartySetting('ocid-1', 'lucid', 'hard')).toMatchObject({ crystalMyShare: null, crystalSharesTotal: null, splitFeeAuto: false })
  })

  it('처치가 먼저 만든 조합 행에도 설정을 쓸 수 있다', async () => {
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

  it('처치나 드롭이 만든 분배 칸 빈 조합 행도 설정이 없는 것으로 읽는다', async () => {
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
    expect(copied.lucid).toMatchObject({ partySize: 3, crystalMyShare: 1, crystalSharesTotal: 3, updatedAt: '2026-10-10T00:00:00.000Z' })
    expect(copied.will).toMatchObject({ partySize: 6 })
  })

  it('처치가 먼저 만든 분배 칸 빈 조합 행은 채운다', async () => {
    await setBossPartySetting(setting({ ocid: 'old', partySize: 3 }))
    await recordOnly('new')

    await copyMissingBossPartySettings('old', 'new', AT)

    expect(await getBossPartySize('new', 'lucid', 'hard')).toBe(3)
  })

  it('옛 캐릭터의 분배 칸 빈 조합 행은 옮기지 않는다', async () => {
    await recordOnly('old')

    await copyMissingBossPartySettings('old', 'new', AT)

    expect(real.inspect((db) => db.prepare(`SELECT count(*) AS n FROM boss_parties WHERE ocid = 'new'`).get())).toEqual({ n: 0 })
  })
})
