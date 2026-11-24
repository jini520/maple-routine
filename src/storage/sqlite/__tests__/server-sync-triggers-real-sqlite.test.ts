/// <reference types="node" />
/**
 * 기록 표의 트리거가 대기 표에 넣는 줄을 진짜 SQLite 로 본다.
 *
 * 기록을 쓰는 곳마다 대기 표에 넣게 하면 한 곳을 빠뜨려도 그 기록이 조용히 올라가지 않는다. 그래서 트리거가 넣고, 여러 줄을 한
 * 번에 고치는 쓰기와 외래키를 따라 지워지는 줄도 빠짐없이 들어가는지를 엔진에서 본다.
 */
import { __resetStoragePortsForTest, setSqlitePort, type SqliteDbConnection } from '../../ports'
import { holdRecordsUntil } from '../../record-hold'
import { withServerSyncPaused } from '../../server-sync-queue'
import { closeBossProfitDb, getBossProfitDb, getBossProfitDbUngated } from '../db'
import { runDeviceConversion } from '../device-conversion'
import { __setMigrationCeilingForTest, DB_VERSION } from '../migrations'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite
let db: SqliteDbConnection

beforeEach(async () => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  db = await getBossProfitDb()
})

afterEach(async () => {
  __setMigrationCeilingForTest(null)
  holdRecordsUntil(Promise.resolve())
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const AT = '2026-11-23T00:00:00.000Z'

/** 대기 표의 줄. 넣은 차례(rowid)대로다. */
function queue(): [string, string][] {
  return real.inspect((file) =>
    (file.prepare('SELECT record_type, record_id FROM server_sync_queue ORDER BY rowid').all() as Record<string, string>[]).map(
      (row) => [row.record_type!, row.record_id!],
    ),
  )
}

function clearQueue(): void {
  real.inspect((file) => file.exec('DELETE FROM server_sync_queue'))
}

function triggerNames(): string[] {
  return real.inspect((file) =>
    (file.prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name`).all() as { name: string }[]).map(
      (row) => row.name,
    ),
  )
}

async function insertEntry(id: string, ocid = 'ocid-1', period = 'W202647'): Promise<void> {
  await db.run(
    `INSERT INTO boss_profit_entries (id, ocid, boss_difficulty_id, period_code, split_fee_follows_mvp_grade, created_at, updated_at)
     VALUES (?, ?, 'difficulty-1', ?, 1, ?, ?)`,
    [id, ocid, period, AT, AT],
  )
}

async function insertDrop(id: string, entryId: string): Promise<void> {
  await db.run(
    `INSERT INTO boss_drops (id, profit_entry_id, item_id, category, price_status, sale_fee_follows_mvp_grade,
                             split_fee_follows_mvp_grade, created_at, updated_at)
     VALUES (?, ?, ?, 'fixed', 'pending', 1, 1, ?, ?)`,
    [id, entryId, `item-${id}`, AT, AT],
  )
}

async function insertCashbookEntry(id: string): Promise<void> {
  await db.run(
    `INSERT INTO cashbook_entries (id, ocid, category_id, date, recorded_at, updated_at) VALUES (?, 'ocid-1', 'category-1', '2026-11-20', ?, ?)`,
    [id, AT, AT],
  )
}

describe('한 줄의 쓰기', () => {
  it('넣고 고치고 지우면 서버 표 이름과 기록 id 가 한 줄만 들어간다', async () => {
    await insertEntry('entry-1')
    await db.run(`UPDATE boss_profit_entries SET world_id = 'world-1' WHERE id = 'entry-1'`)
    await db.run(`DELETE FROM boss_profit_entries WHERE id = 'entry-1'`)

    expect(queue()).toEqual([['bossProfitEntries', 'entry-1']])
  })

  // 넣은 시각이 처음 올리기를 가른다. 처음 올리기의 줄을 사용자가 고친 뒤에도 옛 시각이면 처음 동기화의 받기가 그 입력을 덮는다.
  it('대기 줄이 이미 있는 기록이 또 바뀌면 넣은 시각만 지금으로 고치고, 횟수와 차례는 둔다', async () => {
    const OLD = '2026-01-01T00:00:00.000Z'
    await insertEntry('entry-1')
    await insertEntry('entry-2', 'ocid-1', 'W202646')
    real.inspect((file) => file.exec(`UPDATE server_sync_queue SET created_at = '${OLD}', attempts = 2`))

    await db.run(`UPDATE boss_profit_entries SET world_id = 'world-1' WHERE id = 'entry-1'`)
    await withServerSyncPaused((paused) => paused.run(`UPDATE boss_profit_entries SET world_id = 'world-1' WHERE id = 'entry-2'`))

    const rows = real.inspect(
      (file) => file.prepare('SELECT record_id, attempts, created_at FROM server_sync_queue ORDER BY rowid').all() as Record<string, unknown>[],
    )
    expect(rows).toEqual([
      { record_id: 'entry-1', attempts: 2, created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
      { record_id: 'entry-2', attempts: 2, created_at: OLD },
    ])
    expect(rows[0]!.created_at).not.toBe(OLD)
  })

  // 같은 값으로 덮는 쓰기와 기기만 쓰는 칸의 쓰기를 넣으면 같은 값이 올라가 번호만 오르고, 모든 기기가 그 줄을 다시 받는다.
  it('기기만 쓰는 칸이나 같은 값만 다시 적은 쓰기는 넣지 않는다', async () => {
    await insertEntry('entry-1')
    await db.run(
      `INSERT INTO enhancement_totals (ocid, history_date, category, item_name, attempt_count, attempt_cost_meso,
                                       destroy_defence_cost_meso, updated_at)
       VALUES ('ocid-1', '2026-11-20', 'starforce', '아케인셰이드 투핸드소드', 3, 100, 0, ?)`,
      [AT],
    )
    clearQueue()

    await db.run(`UPDATE boss_profit_entries SET over_crystal_sale_limit = 1, updated_at = ? WHERE id = 'entry-1'`, ['later'])
    await db.run(`UPDATE enhancement_totals SET attempt_count = 3, attempt_cost_meso = 100, updated_at = 'later'`)

    expect(queue()).toEqual([])
  })

  it('표마다 서버 표 이름으로 넣는다', async () => {
    await insertEntry('entry-1')
    await insertDrop('drop-1', 'entry-1')
    await db.run(
      `INSERT INTO boss_split_settings (id, ocid, boss_difficulty_id, split_type, party_size, split_fee_follows_mvp_grade, created_at, updated_at)
       VALUES ('split-1', 'ocid-1', 'difficulty-1', 'even', 2, 1, ?, ?)`,
      [AT, AT],
    )
    await insertCashbookEntry('cash-1')
    await db.run(
      `INSERT INTO inventory_items (id, account_id, world_id, item_id, cashbook_item_type_id, added_quantity, created_at, updated_at)
       VALUES ('inv-1', 'maple-1', 'world-1', 'item-1', 'type-1', 1, ?, ?)`,
      [AT, AT],
    )
    await db.run(
      `INSERT INTO enhancement_totals (id, ocid, history_date, category, item_name, attempt_count, attempt_cost_meso,
                                       destroy_defence_cost_meso, updated_at)
       VALUES ('total-1', 'ocid-1', '2026-11-20', 'starforce', '장비', 1, 1, 0, ?)`,
      [AT],
    )
    await db.run(
      `INSERT INTO remembered_levels (id, ocid, type, target_id, level, updated_at) VALUES ('level-1', 'ocid-1', 'symbol', 'symbol-1', 3, ?)`,
      [AT],
    )
    await db.run(
      `INSERT INTO mvp_grade_history (id, account_id, from_date, grade_id, updated_at) VALUES ('mvp-1', 'maple-1', '2026-11-01', 'gold', ?)`,
      [AT],
    )
    await db.run(`INSERT INTO character_world_leaps (id, previous_ocid, ocid) VALUES ('leap-1', 'ocid-old', 'ocid-1')`)

    expect(queue()).toEqual([
      ['bossProfitEntries', 'entry-1'],
      ['bossDrops', 'drop-1'],
      ['bossSplitSettings', 'split-1'],
      ['cashbookEntries', 'cash-1'],
      ['inventoryItems', 'inv-1'],
      ['enhancementTotals', 'total-1'],
      ['rememberedLevels', 'level-1'],
      ['mvpGradeHistory', 'mvp-1'],
      ['characterWorldLeaps', 'leap-1'],
    ])
  })
})

// 딸린 줄은 기록과 함께 올라가고 서버가 받을 때마다 갈아 끼운다. 그래서 딸린 줄만 바뀌어도 기록을 올린다.
describe('가계부의 딸린 줄', () => {
  it('딸린 줄을 넣고 고치고 지우면 기록의 id 를 넣는다', async () => {
    await insertCashbookEntry('cash-1')
    await insertCashbookEntry('cash-2')
    clearQueue()

    await db.run(`INSERT INTO cashbook_entry_items (id, entry_id, item_name, amount_meso) VALUES ('item-1', 'cash-1', '물건', 100)`)
    await db.run(`INSERT INTO cashbook_entry_hunt_inputs (id, entry_id, typed_meso) VALUES ('hunt-1', 'cash-2', 100)`)
    expect(queue()).toEqual([
      ['cashbookEntries', 'cash-1'],
      ['cashbookEntries', 'cash-2'],
    ])

    clearQueue()
    await db.run(`DELETE FROM cashbook_entry_hunt_inputs WHERE id = 'hunt-1'`)
    expect(queue()).toEqual([['cashbookEntries', 'cash-2']])

    clearQueue()
    await db.run(`UPDATE cashbook_entry_items SET entry_id = 'cash-2' WHERE id = 'item-1'`)
    expect(queue()).toEqual([
      ['cashbookEntries', 'cash-2'],
      ['cashbookEntries', 'cash-1'],
    ])
  })

  // 인벤토리 줄을 지우면 판 품목의 가리키는 칸이 비워진다. 그 품목은 서버에도 비워져야 한다.
  it('인벤토리 줄을 지워 품목의 가리키는 칸이 비면 그 기록도 넣는다', async () => {
    await insertCashbookEntry('cash-1')
    await db.run(
      `INSERT INTO inventory_items (id, account_id, world_id, item_id, cashbook_item_type_id, added_quantity, created_at, updated_at)
       VALUES ('inv-1', 'maple-1', 'world-1', 'item-1', 'type-1', 1, ?, ?)`,
      [AT, AT],
    )
    await db.run(
      `INSERT INTO cashbook_entry_items (id, entry_id, item_name, amount_meso, inventory_item_id) VALUES ('item-1', 'cash-1', '물건', 1, 'inv-1')`,
    )
    clearQueue()

    await db.run(`DELETE FROM inventory_items WHERE id = 'inv-1'`)

    expect(queue().sort()).toEqual([
      ['cashbookEntries', 'cash-1'],
      ['inventoryItems', 'inv-1'],
    ])
  })
})

describe('여러 줄을 한 번에 고치는 쓰기', () => {
  it('리프로 옛 ocid 의 줄을 옮기면 옮긴 줄마다 넣는다', async () => {
    await insertEntry('entry-1', 'ocid-old', 'W202646')
    await insertEntry('entry-2', 'ocid-old', 'W202647')
    await insertEntry('entry-3', 'ocid-other', 'W202647')
    clearQueue()

    await db.run(`UPDATE boss_profit_entries SET ocid = 'ocid-new' WHERE ocid = 'ocid-old'`)

    expect(queue()).toEqual([
      ['bossProfitEntries', 'entry-1'],
      ['bossProfitEntries', 'entry-2'],
    ])
  })

  it('빈 수익 건을 한 번에 지우면 지운 줄마다 넣고, 수익 건과 함께 지워진 드롭도 넣는다', async () => {
    await insertEntry('entry-1', 'ocid-1', 'W202646')
    await insertEntry('entry-2', 'ocid-1', 'W202647')
    await insertDrop('drop-1', 'entry-2')
    clearQueue()

    await db.run(`DELETE FROM boss_profit_entries WHERE clear_recorded_by IS NULL AND split_type IS NULL`)

    expect(queue().sort()).toEqual([
      ['bossDrops', 'drop-1'],
      ['bossProfitEntries', 'entry-1'],
      ['bossProfitEntries', 'entry-2'],
    ])
  })
})

// 서버에는 굳은 날만 있다. 굳지 않은 날의 커서 · 조회 시각은 그 기기가 넥슨을 어디까지 불렀는지라 올리지 않는다.
describe('강화 조회 기록', () => {
  it('굳은 날이 된 줄만 `enhancementSettledDays` 로 넣고, 커서 · 조회 시각만 고치거나 지우면 넣지 않는다', async () => {
    await db.run(
      `INSERT INTO enhancement_history_checks (id, nexon_account_id, enhancement_type, history_date, settled, checked_at)
       VALUES ('check-1', 'account-1', 'starforce', '2026-11-20', 0, ?)`,
      [AT],
    )
    await db.run(`UPDATE enhancement_history_checks SET next_cursor = 'c', checked_at = 'later' WHERE id = 'check-1'`)
    expect(queue()).toEqual([])

    await db.run(`UPDATE enhancement_history_checks SET settled = 1 WHERE id = 'check-1'`)
    await db.run(
      `INSERT INTO enhancement_history_checks (id, nexon_account_id, enhancement_type, history_date, settled, checked_at)
       VALUES ('check-2', 'account-1', 'cube', '2026-11-19', 1, ?)`,
      [AT],
    )
    expect(queue()).toEqual([
      ['enhancementSettledDays', 'check-1'],
      ['enhancementSettledDays', 'check-2'],
    ])

    clearQueue()
    await db.run(`UPDATE enhancement_history_checks SET checked_at = 'again' WHERE id = 'check-1'`)
    await db.run(`DELETE FROM enhancement_history_checks`)
    expect(queue()).toEqual([])
  })
})

// 받은 줄을 넣는 동안 넣으면 받은 줄을 다시 올린다.
describe('넣지 않는 동안', () => {
  it('`withServerSyncPaused` 안의 쓰기는 넣지 않고, 끝나면 다시 넣는다', async () => {
    await withServerSyncPaused(async (paused) => {
      await insertEntry('entry-1')
      await paused.run(`UPDATE boss_profit_entries SET world_id = 'world-1' WHERE id = 'entry-1'`)
    })
    expect(queue()).toEqual([])
    expect(real.inspect((file) => file.prepare('SELECT * FROM server_sync_pause').all())).toEqual([])

    await db.run(`UPDATE boss_profit_entries SET world_id = 'world-2' WHERE id = 'entry-1'`)
    expect(queue()).toEqual([['bossProfitEntries', 'entry-1']])
  })

  it('안에서 던지면 쓴 것과 함께 되돌리고 다시 넣는 상태로 돌아온다', async () => {
    await expect(
      withServerSyncPaused(async () => {
        await insertEntry('entry-1')
        throw new Error('실패')
      }),
    ).rejects.toThrow('실패')

    expect(real.inspect((file) => file.prepare('SELECT id FROM boss_profit_entries').all())).toEqual([])
    await insertEntry('entry-2')
    expect(queue()).toEqual([['bossProfitEntries', 'entry-2']])
  })
})

describe('트리거를 거는 때', () => {
  it('다시 열 때 정의가 그대로면 트리거를 다시 만들지 않고, 빠지거나 바뀐 것만 다시 만든다', async () => {
    const names = triggerNames()
    expect(names.length).toBeGreaterThan(30)
    expect(names.every((name) => name.startsWith('server_sync_'))).toBe(true)

    await closeBossProfitDb()
    real.statements.length = 0
    db = await getBossProfitDb()
    expect(real.statements.filter((statement) => /^(CREATE|DROP) TRIGGER/.test(statement))).toEqual([])

    real.inspect((file) => file.exec('DROP TRIGGER server_sync_boss_drops_insert'))
    await closeBossProfitDb()
    real.statements.length = 0
    db = await getBossProfitDb()
    expect(real.statements.filter((statement) => /^(CREATE|DROP) TRIGGER/.test(statement))).toEqual([
      expect.stringMatching(/^CREATE TRIGGER server_sync_boss_drops_insert /),
    ])
    expect(triggerNames()).toEqual(names)
  })

  // 변환이 옮긴 줄은 처음 동기화가 넣는다. 변환 전 표는 칸이 서버와 달라 트리거를 걸 수 없다.
  it('변환 전 DB 에는 트리거가 없고, 변환이 끝나면 걸리며 변환의 쓰기는 넣지 않는다', async () => {
    await closeBossProfitDb()
    __resetStoragePortsForTest()
    real.dispose()
    real = createRealSqlite()
    setSqlitePort(real.port)
    __setMigrationCeilingForTest(DB_VERSION)
    const unconverted = await getBossProfitDbUngated()
    expect(triggerNames()).toEqual([])

    await runDeviceConversion(unconverted)

    expect(triggerNames().length).toBeGreaterThan(30)
    expect(queue()).toEqual([])
    db = unconverted
    await insertEntry('entry-1')
    expect(queue()).toEqual([['bossProfitEntries', 'entry-1']])
  })
})
