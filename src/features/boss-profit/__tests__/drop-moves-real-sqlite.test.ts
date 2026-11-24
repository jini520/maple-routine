/// <reference types="node" />
/**
 * 드롭을 다른 수익 건으로 옮기는 흐름을 진짜 SQLite 로 태운다. 처치 난이도가 확정되거나 직접 완료의 난이도를
 * 고치면, 드롭이 자기 식별자를 들고 새 난이도의 수익 건으로 옮겨 가고 옛 수익 건은 지워져야 한다.
 */
import { findItemById } from '../../../lib/item-catalog'
import type { RecordedDrop } from '../../../types/drops'
import { loadDropsByRowKey, migrateDropsToConfirmedDifficulty } from '../drops-loader'
import type { BossProfitRow } from '../rows'
import { cancelManualCompletion, saveManualCompletion, type ManualCompletionInput } from '../../manual-completion/record'
import { getBossPartyPeriodOverrides } from '../../../storage/boss-party-period-overrides'
import { getBossProfitRecords, upsertBossProfitRecord } from '../../../storage/boss-profit'
import { NO_WORLD, getAllBossDropRecords, replaceBossDropRecords } from '../../../storage/boss-drops'
import { applyPulledSqliteRecord } from '../../../storage/server-sync-pull'
import { __resetStoragePortsForTest, setSqlitePort } from '../../../storage/ports'
import { closeBossProfitDb } from '../../../storage/sqlite/db'
import { createRealSqlite, type RealSqlite } from '../../../storage/sqlite/__tests__/node-sqlite-port'

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
const NOW = new Date('2026-10-05T00:00:00.000Z')

/** 대기 표의 줄. 넣은 차례(rowid)다. 올리기가 이 차례로 보낸다. */
const queue = (): [string, string][] =>
  real.inspect((db) =>
    (db.prepare('SELECT record_type, record_id FROM server_sync_queue ORDER BY rowid').all() as Record<string, string>[]).map(
      (row) => [row.record_type!, row.record_id!],
    ),
  )
/** 대기 표를 비운다. 그때까지 쓴 기록을 올린 뒤다. */
const clearQueue = () => real.inspect((db) => db.exec('DELETE FROM server_sync_queue'))
/** 수익 건마다 [id, 처치했는지]. */
const entries = (): [string, boolean][] =>
  (real.inspect((db) => db.prepare('SELECT id, clear_recorded_by FROM boss_profit_entries ORDER BY rowid').all()) as Record<string, unknown>[]).map(
    (row) => [row.id as string, row.clear_recorded_by !== null],
  )

describe('난이도 확정 이관', () => {
  // 처치 기록이 없어 대기 표로 올리는 이관이다. 옛 수익 건의 지우기가 드롭보다 먼저 서버에 닿지 않게 옛 수익 건은 남긴다.
  it('드롭이 식별자와 가격을 들고 확정 난이도로 옮겨 가고, 옛 수익 건은 비어도 남는다', async () => {
    await replaceBossDropRecords('o', 'lucid', 'hard', '2026-10-01', [
      {
        dropRecordId: null, category: 'equipment', itemKey: 'twilight_mark', itemName: '', quantity: 1,
        priceState: 'entered', priceMeso: 5_000, priceSplitMode: 'even', pricePartySize: 2,
      },
    ], AT, { name: '엘리시움', key: 'elysium' })
    const before = await getAllBossDropRecords(['o'])

    await migrateDropsToConfirmedDifficulty({ ocid: 'o', bossKey: 'lucid', difficulty: 'normal', periodKey: '2026-10-01' }, before, NOW)

    const after = await getAllBossDropRecords(['o'])
    expect(after.map((row) => [row.difficulty, row.dropRecordId, row.priceMeso])).toEqual([
      ['normal', before[0].dropRecordId, 5_000],
    ])
    expect(entries().map(([, cleared]) => cleared)).toEqual([false, false])
  })

  it('확정 난이도에서 못 얻는 드롭은 옮기지 않고 지운다', async () => {
    await replaceBossDropRecords('o', 'lucid', 'hard', '2026-10-01', [
      { dropRecordId: null, category: 'equipment', itemKey: 'dreamy_belt', itemName: '', quantity: 1 },
    ], AT, NO_WORLD)
    const before = await getAllBossDropRecords(['o'])

    await migrateDropsToConfirmedDifficulty({ ocid: 'o', bossKey: 'lucid', difficulty: 'normal', periodKey: '2026-10-01' }, before, NOW)

    expect(await getAllBossDropRecords(['o'])).toEqual([])
    expect(real.inspect((db) => db.prepare('SELECT count(*) AS n FROM boss_profit_entries').get())).toEqual({ n: 0 })
  })
})

describe('직접 완료', () => {
  const input: ManualCompletionInput = {
    ocid: 'o',
    bossKey: 'lucid',
    bossName: '루시드',
    cycle: 'weekly',
    periodKey: '2026-10-01',
    difficulty: 'hard',
    partySize: 1,
    shares: { myShare: null, sharesTotal: null, splitFeePercent: null },
    defeatedOn: '2026-10-03',
    world: null,
    worldKey: null,
  }

  async function seedDrop(difficulty: string): Promise<string> {
    const [id] = await replaceBossDropRecords('o', 'lucid', difficulty, '2026-10-01', [
      { dropRecordId: null, category: 'equipment', itemKey: 'twilight_mark', itemName: '', quantity: 1 },
    ], AT, NO_WORLD)
    return id
  }

  const entryRows = (records: [string, string][]) => records.filter(([type]) => type === 'bossProfitEntries').map(([, id]) => id)

  // 새 처치가 서버에 먼저 닿으면 옛 처치와 같은 기간 · 보스의 처치라 거절되고 앱이 새 기록을 지운다. 옛 기록을 먼저 지우면 그
  // 지우기가 서버가 아직 옮기지 않은 드롭을 함께 지운다.
  it('난이도를 고치면 옛 수익 건의 처치를 걷는 대기 줄이 새 처치 앞에 서고, 옛 수익 건은 지우지 않으며 드롭만 새 수익 건으로 옮긴다', async () => {
    await saveManualCompletion(input, NOW)
    const id = await seedDrop('hard')
    const [[hard]] = entries()
    clearQueue()

    await saveManualCompletion({ ...input, difficulty: 'normal', previousDifficulty: 'hard' }, NOW)

    expect((await getBossProfitRecords(['o'], ['2026-10-01'])).map((row) => [row.difficulty, row.defeatedOn])).toEqual([
      ['normal', '2026-10-03'],
    ])
    expect((await getAllBossDropRecords(['o'])).map((row) => [row.difficulty, row.dropRecordId])).toEqual([['normal', id]])
    const normal = entries().find(([entryId]) => entryId !== hard)![0]
    expect(entries()).toEqual([
      [hard, false],
      [normal, true],
    ])
    expect(queue()).toEqual([
      ['bossProfitEntries', hard],
      ['bossProfitEntries', normal],
    ])
    // 빈 옛 수익 건은 서버가 지운 결과를 받을 때까지 남지만, 처치 · 그 기간 값 · 드롭을 읽는 어느 곳에도 나오지 않는다.
    expect(await getBossPartyPeriodOverrides(['o'], ['2026-10-01'])).toEqual([])
  })

  it('옛 처치를 아직 올리지 않았어도 옛 수익 건의 대기 줄이 새 처치 앞에 선다', async () => {
    await saveManualCompletion(input, NOW)
    await seedDrop('hard')
    const [[hard]] = entries()

    await saveManualCompletion({ ...input, difficulty: 'normal', previousDifficulty: 'hard' }, NOW)

    const normal = entries().find(([entryId]) => entryId !== hard)![0]
    expect(entryRows(queue())).toEqual([hard, normal])
    expect(entries()).toEqual([
      [hard, false],
      [normal, true],
    ])
  })

  // 올리기는 넣은 차례(rowid)로 보낸다. 이미 있던 대기 줄은 넣은 시각만 고쳐져 차례가 그대로라, 그대로 두면 새 처치가 먼저 간다.
  it('새 수익 건의 대기 줄이 옛 수익 건보다 앞에 있었으면 그 뒤로 옮긴다', async () => {
    await saveManualCompletion(input, NOW)
    const [[hard]] = entries()
    clearQueue()
    await seedDrop('normal')
    const normal = entries().find(([entryId]) => entryId !== hard)![0]
    expect(entryRows(queue())).toEqual([normal])

    await saveManualCompletion({ ...input, difficulty: 'normal', previousDifficulty: 'hard' }, NOW)

    expect(entryRows(queue())).toEqual([hard, normal])
  })

  it('취소하면 처치와 드롭이 사라지고 수익 건도 남지 않는다', async () => {
    await saveManualCompletion(input, NOW)
    await seedDrop('hard')

    await cancelManualCompletion({ ocid: 'o', bossKey: 'lucid', difficulty: 'hard', periodKey: '2026-10-01' }, NOW)

    expect(await getBossProfitRecords(['o'], ['2026-10-01'])).toEqual([])
    expect(await getAllBossDropRecords(['o'])).toEqual([])
    expect(real.inspect((db) => db.prepare('SELECT count(*) AS n FROM boss_profit_entries').get())).toEqual({ n: 0 })
  })
})

// 서버 sync/push.repository.spec.ts 의 처치 난이도 묶음과 같은 예다. 서버가 같은 규칙으로 모으므로 처치한 수익 건이 있으면 기기는
// 이 쓰기를 올리지 않고 받기로 서버의 결과를 맞춘다.
describe('처치한 수익 건으로 모으기', () => {
  const PERIOD = '2026-11-19'
  const WRITTEN = '2026-11-20T00:00:00.000Z'
  const SETTLED = new Date('2026-11-21T00:00:00.000Z')
  const ring = (itemKey: string, boxOriginKey: string): RecordedDrop => ({
    dropRecordId: null,
    category: 'consumable',
    itemKey,
    itemName: '',
    boxOriginKey,
    ringLevel: 4,
    quantity: 1,
  })
  const whetstone: RecordedDrop = {
    dropRecordId: null,
    category: 'consumable',
    itemKey: 'life_whetstone',
    itemName: '',
    quantity: 1,
    priceState: 'entered',
    priceMeso: 7_000,
    priceSplitMode: 'even',
    pricePartySize: 1,
  }
  const confirmed = (bossKey: string, difficulty: 'chaos' | 'hard') => ({ ocid: 'o', bossKey, difficulty, periodKey: PERIOD })

  async function clear(bossKey: string, difficulty: string): Promise<void> {
    await upsertBossProfitRecord({
      ocid: 'o',
      bossKey,
      boss: '',
      difficulty,
      cycle: 'weekly',
      periodKey: PERIOD,
      partySize: 1,
      priceMeso: 100,
      payoutMeso: 100,
      crystalMyShare: null,
      crystalSharesTotal: null,
      splitFeePercent: null,
      recordedAt: WRITTEN,
      world: null,
      worldKey: null,
    })
  }
  /** 드롭마다 [보스, 난이도, 드롭 id, 아이템 줄 key, 판매가]. 보스 · 난이도 차례다. */
  async function drops(): Promise<unknown[][]> {
    return (await getAllBossDropRecords(['o']))
      .map((row) => [row.bossKey, row.difficulty, row.dropRecordId, findItemById(row.itemId)?.key, row.priceMeso])
      .sort((a, b) => `${a[0]}${a[1]}`.localeCompare(`${b[0]}${b[1]}`))
  }
  /** 처치 기록이 없는 수익 건의 id */
  const unclearedEntryIds = (): string[] =>
    (real.inspect((db) => db.prepare('SELECT id FROM boss_profit_entries WHERE clear_recorded_by IS NULL').all()) as { id: string }[]).map(
      (row) => row.id,
    )

  it('처치 기록이 있으면 결정의 세 예대로 옮기고 지우고 바꾸며, 그 쓰기는 대기 표에 넣지 않고 대기 줄이 남은 비운 수익 건은 지우지 않는다', async () => {
    const [restraint] = await replaceBossDropRecords(
      'o',
      'guardian_kalos',
      'normal',
      PERIOD,
      [ring('restraint_ring', 'white_boss_ring_box'), ring('ultimatum_ring', 'white_boss_ring_box')],
      WRITTEN,
      NO_WORLD,
    )
    const [stone] = await replaceBossDropRecords('o', 'bellona', 'normal', PERIOD, [whetstone], WRITTEN, NO_WORLD)
    await clear('guardian_kalos', 'chaos')
    await clear('bellona', 'hard')
    const before = await getAllBossDropRecords(['o'])
    const pending = queue()
    const emptied = unclearedEntryIds()

    await migrateDropsToConfirmedDifficulty(confirmed('guardian_kalos', 'chaos'), before, SETTLED)
    await migrateDropsToConfirmedDifficulty(confirmed('bellona', 'hard'), before, SETTLED)

    expect(await drops()).toEqual([
      ['bellona', 'hard', stone, 'life_whetstone_from_box', 7_000],
      ['guardian_kalos', 'chaos', restraint, 'restraint_ring_lv4', null],
    ])
    // 비운 수익 건은 대기 줄이 남아 있어 지우지 않는다. 대기 줄은 다음 올리기에서 기기가 고친 값으로 간다.
    expect(emptied).toHaveLength(2)
    expect(entries().filter(([, cleared]) => !cleared).map(([id]) => id)).toEqual(emptied)
    expect(queue()).toEqual(pending)
  })

  it('이미 올린 기록이면 옮기고 지우고 바꾸는 쓰기와 비운 수익 건을 지우는 쓰기가 대기 표에 들어가지 않는다', async () => {
    await replaceBossDropRecords('o', 'guardian_kalos', 'normal', PERIOD, [ring('restraint_ring', 'white_boss_ring_box')], WRITTEN, NO_WORLD)
    await replaceBossDropRecords('o', 'bellona', 'normal', PERIOD, [whetstone], WRITTEN, NO_WORLD)
    await clear('guardian_kalos', 'chaos')
    await clear('bellona', 'hard')
    clearQueue()
    const before = await getAllBossDropRecords(['o'])

    await migrateDropsToConfirmedDifficulty(confirmed('guardian_kalos', 'chaos'), before, SETTLED)
    await migrateDropsToConfirmedDifficulty(confirmed('bellona', 'hard'), before, SETTLED)

    expect((await drops()).map((row) => row.slice(0, 2))).toEqual([
      ['bellona', 'hard'],
      ['guardian_kalos', 'chaos'],
    ])
    expect(entries().map(([, cleared]) => cleared)).toEqual([true, true])
    expect(queue()).toEqual([])
  })

  // 처치한 수익 건이 없으면 서버는 옮기지 않는다. 기기가 옮긴 것을 올려야 서버도 같은 수익 건에 드롭을 둔다. 수익 건은 드롭보다
  // 먼저 올라가서, 비운 수익 건의 지우기가 먼저 닿으면 서버가 드롭을 함께 지우고 뒤에 온 드롭의 옮기기를 거절한다.
  it('처치 기록이 없으면 정해진 난이도의 수익 건으로 옮기고 그 쓰기를 대기 표로 올리며, 드롭을 옮겨 비운 수익 건은 지우지 않는다', async () => {
    const [restraint, ultimatum] = await replaceBossDropRecords(
      'o',
      'guardian_kalos',
      'normal',
      PERIOD,
      [ring('restraint_ring', 'white_boss_ring_box'), ring('ultimatum_ring', 'white_boss_ring_box')],
      WRITTEN,
      NO_WORLD,
    )
    const [[normal]] = entries()
    clearQueue()

    await migrateDropsToConfirmedDifficulty(confirmed('guardian_kalos', 'chaos'), await getAllBossDropRecords(['o']), SETTLED)

    expect(await drops()).toEqual([['guardian_kalos', 'chaos', restraint, 'restraint_ring_lv4', null]])
    const chaos = entries().find(([id]) => id !== normal)![0]
    expect(entries()).toEqual([
      [normal, false],
      [chaos, false],
    ])
    expect(queue().sort()).toEqual(
      [
        ['bossDrops', restraint],
        ['bossDrops', ultimatum],
        ['bossProfitEntries', chaos],
      ].sort(),
    )
  })

  // 기간을 읽는 행은 낡은 캐시에서 나왔을 수 있다. 다른 난이도 수익 건의 드롭은 처치 기록을 적은 뒤의 이관이 옮긴다.
  it('기간을 읽을 때는 완료 행의 수익 건에 있는 드롭만 가리고 다른 수익 건의 드롭은 그대로 둔다', async () => {
    await replaceBossDropRecords(
      'o',
      'guardian_kalos',
      'chaos',
      PERIOD,
      [ring('restraint_ring', 'life_boss_ring_box'), ring('ultimatum_ring', 'white_boss_ring_box')],
      WRITTEN,
      NO_WORLD,
    )
    const [elsewhere] = await replaceBossDropRecords('o', 'guardian_kalos', 'normal', PERIOD, [ring('continuous_ring', 'white_boss_ring_box')], WRITTEN, NO_WORLD)
    await clear('guardian_kalos', 'chaos')
    clearQueue()
    const row = { ocid: 'o', bossKey: 'guardian_kalos', difficulty: 'chaos', periodKey: PERIOD, isComplete: true } as BossProfitRow

    const map = await loadDropsByRowKey(['o'], [row], SETTLED)

    expect(map[`o|guardian_kalos|chaos|${PERIOD}`]?.map((drop) => drop.itemKey)).toEqual(['restraint_ring'])
    expect((await drops()).map((one) => one.slice(1, 4))).toEqual([
      ['chaos', expect.any(String), 'restraint_ring_lv4'],
      ['normal', elsewhere, 'continuous_ring_lv4'],
    ])
    expect(queue()).toEqual([])
  })

  // 받기는 대기 줄이 있는 기록을 건너뛴다. 기기가 같은 규칙으로 먼저 고쳤으므로 그 값이 다음 올리기에서 서버에 간다.
  it('대기 줄이 있는 드롭은 받기가 건너뛰어 기기가 먼저 고친 값이 남고, 대기 줄이 빠지면 서버의 값을 넣는다', async () => {
    const [stone] = await replaceBossDropRecords('o', 'bellona', 'normal', PERIOD, [whetstone], WRITTEN, NO_WORLD)
    await clear('bellona', 'hard')
    await migrateDropsToConfirmedDifficulty(confirmed('bellona', 'hard'), await getAllBossDropRecords(['o']), SETTLED)
    const mine = real.inspect((db) => db.prepare('SELECT * FROM boss_drops WHERE id = ?').get(stone)) as Record<string, unknown>
    // 다른 기기가 그 사이에 기록 안 함으로 고친 값이다.
    const skipped = { price_status: 'skipped', sale_price_meso: null, sale_received_meso: null, priced_at: null, split_type: null, party_size: null }
    const fromServer = { table: 'bossDrops' as const, id: stone!, deleted: false, row: { ...mine, ...skipped } }

    expect(queue()).toContainEqual(['bossDrops', stone])
    expect(await applyPulledSqliteRecord(fromServer)).toBe(false)
    expect((await drops())[0]).toEqual(['bellona', 'hard', stone, 'life_whetstone_from_box', 7_000])

    real.inspect((db) => db.prepare('DELETE FROM server_sync_queue WHERE record_id = ?').run(stone))
    expect(await applyPulledSqliteRecord(fromServer)).toBe(true)
    expect((await drops())[0]).toEqual(['bellona', 'hard', stone, 'life_whetstone_from_box', null])
  })
})
