/// <reference types="node" />
/**
 * 올리기가 기기 줄을 읽고 고치는 저장 함수를 진짜 SQLite 로 본다.
 *
 * 서버가 돌려준 id 로 기기 줄을 바꿀 때 외래키가 켜져 있어 가리키는 줄이 걸리고, 거절된 기록을 지울 때 트리거가 그 지우기를 다시
 * 대기 표에 넣으면 서버에 지우기가 올라간다. 둘 다 엔진에서만 드러난다.
 */
import { contentIdOf } from '../../../lib/scheduler/contents'
import { installFakePreferences, type FakePreferences } from '../../__tests__/fake-preferences'
import { recordCharacterAccounts } from '../../character-accounts'
import { __resetStoragePortsForTest, setSqlitePort, type SqliteDbConnection } from '../../ports'
import { preferenceRecordIdOf } from '../../server-sync-queue'
import {
  deleteServerSyncRecord,
  mapleIdOfOcid,
  readServerSyncSource,
  replaceServerSyncRecordId,
} from '../../server-sync-records'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite
let prefs: FakePreferences
let db: SqliteDbConnection

beforeEach(async () => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  prefs = installFakePreferences()
  db = await getBossProfitDb()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const AT = '2026-11-23T00:00:00.000Z'

function queue(): string[] {
  return real.inspect((file) =>
    (file.prepare('SELECT record_id FROM server_sync_queue ORDER BY rowid').all() as { record_id: string }[]).map(
      (row) => row.record_id,
    ),
  )
}

function clearQueue(): void {
  real.inspect((file) => file.exec('DELETE FROM server_sync_queue'))
}

function rows(sql: string): Record<string, unknown>[] {
  return real.inspect((file) => file.prepare(sql).all() as Record<string, unknown>[])
}

async function insertEntry(id: string): Promise<void> {
  await db.run(
    `INSERT INTO boss_profit_entries (id, ocid, boss_difficulty_id, period_code, split_fee_follows_mvp_grade, created_at, updated_at)
     VALUES (?, 'ocid-1', 'difficulty-1', 'W202647', 1, ?, ?)`,
    [id, AT, AT],
  )
}

async function insertDrop(id: string, entryId: string): Promise<void> {
  await db.run(
    `INSERT INTO boss_drops (id, profit_entry_id, item_id, category, price_status, sale_fee_follows_mvp_grade,
                             split_fee_follows_mvp_grade, created_at, updated_at)
     VALUES (?, ?, 'item-1', 'fixed', 'pending', 1, 1, ?, ?)`,
    [id, entryId, AT, AT],
  )
}

describe('원본 읽기', () => {
  it('가계부 기록은 딸린 줄 다섯을 넣은 차례로 함께 읽는다', async () => {
    await db.run(
      `INSERT INTO cashbook_entries (id, ocid, category_id, date, recorded_at, updated_at) VALUES ('cash-1', 'ocid-1', 'category-1', '2026-11-20', ?, ?)`,
      [AT, AT],
    )
    await db.run(`INSERT INTO cashbook_entry_items (id, entry_id, item_name, amount_meso) VALUES ('item-b', 'cash-1', '둘째', 2)`)
    await db.run(`INSERT INTO cashbook_entry_items (id, entry_id, item_name, amount_meso) VALUES ('item-a', 'cash-1', '첫째', 1)`)
    await db.run(`INSERT INTO cashbook_entry_hunt_inputs (id, entry_id, typed_meso) VALUES ('hunt-1', 'cash-1', 100)`)
    await db.run(
      `INSERT INTO cashbook_entry_fragment_uses (id, entry_id, fragment_source, ocid, fragment_quantity) VALUES ('use-1', 'cash-1', 'hunt', 'ocid-2', 3)`,
    )

    const source = await readServerSyncSource('cashbookEntries', 'cash-1')

    expect(source).toMatchObject({ id: 'cash-1', ocid: 'ocid-1', category_id: 'category-1' })
    expect((source!.items as Record<string, unknown>[]).map((item) => item.item_name)).toEqual(['둘째', '첫째'])
    expect(source!.hunt_input).toMatchObject({ typed_meso: 100 })
    expect(source!.transfer_input).toBeNull()
    expect(source!.exchange_input).toBeNull()
    expect(source!.fragment_uses).toEqual([expect.objectContaining({ fragment_source: 'hunt', ocid: 'ocid-2', fragment_quantity: 3 })])
  })

  it('지운 줄과 굳지 않은 날은 원본이 없다', async () => {
    await db.run(
      `INSERT INTO enhancement_history_checks (id, nexon_account_id, enhancement_type, history_date, settled, checked_at)
       VALUES ('check-1', 'account-1', 'starforce', '2026-11-20', 0, ?)`,
      [AT],
    )

    await expect(readServerSyncSource('bossProfitEntries', 'none')).resolves.toBeNull()
    await expect(readServerSyncSource('enhancementSettledDays', 'check-1')).resolves.toBeNull()
    await db.run(`UPDATE enhancement_history_checks SET settled = 1`)
    await expect(readServerSyncSource('enhancementSettledDays', 'check-1')).resolves.toMatchObject({
      nexon_account_id: 'account-1',
      enhancement_type: 'starforce',
      history_date: '2026-11-20',
    })
  })

  it('Preferences 기록은 대기 줄 id 가 가리키는 항목을 읽는다', async () => {
    const dojo = contentIdOf('mu_lung_dojo')!
    await prefs.set('manualTrackedContent:ocid-1', JSON.stringify([{ type: 'weekly', targetId: dojo }]))
    await prefs.set('isMvpWeeklyCheckOff', 'true')
    await prefs.set('barOrder', JSON.stringify({ groupKeys: ['today'], subPageKeys: { schedule: ['Boss', 'Content'] } }))

    await expect(
      readServerSyncSource('manualTrackedItems', preferenceRecordIdOf('manualTrackedItems', ['ocid-1', 'weekly', dojo])),
    ).resolves.toEqual({ ocid: 'ocid-1', type: 'weekly', targetId: dojo })
    await expect(
      readServerSyncSource('manualTrackedItems', preferenceRecordIdOf('manualTrackedItems', ['ocid-1', 'daily', dojo])),
    ).resolves.toBeNull()
    await expect(
      readServerSyncSource('accountSettings', preferenceRecordIdOf('accountSettings', ['isMvpWeeklyCheckOff'])),
    ).resolves.toEqual({ column: 'isMvpWeeklyCheckOff', value: true })
    await expect(
      readServerSyncSource('accountSettings', preferenceRecordIdOf('accountSettings', ['mvpLastCheckedWeekCode'])),
    ).resolves.toEqual({ column: 'mvpLastCheckedWeekCode', value: null })
    await expect(
      readServerSyncSource('bottomBarSubPageOrders', preferenceRecordIdOf('bottomBarSubPageOrders', ['schedule'])),
    ).resolves.toEqual({ groupKey: 'schedule', subPageKeys: ['Boss', 'Content'] })
  })

  // 이름을 바꾼 캐릭터는 소속 줄이 여럿이다. 메이플 ID 는 같지만 가장 늦게 본 줄을 고른다.
  it('ocid 의 메이플 ID 는 가장 늦게 본 소속에서 찾고, 본 적이 없으면 모른다', async () => {
    const list = (accountId: string, name: string) => [
      { accountId, characters: [{ ocid: 'ocid-1', name, world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 }] },
    ]
    await recordCharacterAccounts(list('maple-old', '옛이름'), '2026-10-01', 'account-1')
    await recordCharacterAccounts(list('maple-new', '새이름'), '2026-11-01', 'account-1')

    await expect(mapleIdOfOcid('ocid-1')).resolves.toBe('maple-new')
    await expect(mapleIdOfOcid('ocid-없음')).resolves.toBeNull()
  })
})

// 서버가 유일 기준이 같은 다른 줄로 합쳐 다른 id 를 돌려주면, 기기 줄과 그 줄을 가리키는 줄을 그 id 로 바꾼다.
describe('서버 id 로 바꾸기', () => {
  it('수익 건을 바꾸면 드롭이 가리키는 칸과 대기 줄도 바꾸고, 대기 표에 새로 넣지 않는다', async () => {
    await insertEntry('entry-a')
    await insertDrop('drop-1', 'entry-a')
    clearQueue()
    real.inspect((file) =>
      file.exec(`INSERT INTO server_sync_queue (id, record_type, record_id, created_at) VALUES ('q', 'bossProfitEntries', 'entry-a', 't')`),
    )

    await replaceServerSyncRecordId('bossProfitEntries', 'entry-a', 'entry-b')

    expect(rows('SELECT id FROM boss_profit_entries')).toEqual([{ id: 'entry-b' }])
    expect(rows('SELECT profit_entry_id FROM boss_drops')).toEqual([{ profit_entry_id: 'entry-b' }])
    expect(queue()).toEqual(['entry-b'])
  })

  it('인벤토리 줄을 바꾸면 가계부 품목이 가리키는 칸도 바꾼다', async () => {
    await db.run(
      `INSERT INTO inventory_items (id, account_id, world_id, item_id, cashbook_item_type_id, added_quantity, created_at, updated_at)
       VALUES ('inv-a', 'maple-1', 'world-1', 'item-1', 'type-1', 1, ?, ?)`,
      [AT, AT],
    )
    await db.run(
      `INSERT INTO cashbook_entries (id, ocid, category_id, date, recorded_at, updated_at) VALUES ('cash-1', 'ocid-1', 'category-1', '2026-11-20', ?, ?)`,
      [AT, AT],
    )
    await db.run(
      `INSERT INTO cashbook_entry_items (id, entry_id, item_name, amount_meso, inventory_item_id) VALUES ('item-1', 'cash-1', '물건', 1, 'inv-a')`,
    )
    clearQueue()

    await replaceServerSyncRecordId('inventoryItems', 'inv-a', 'inv-b')

    expect(rows('SELECT id FROM inventory_items')).toEqual([{ id: 'inv-b' }])
    expect(rows('SELECT inventory_item_id FROM cashbook_entry_items')).toEqual([{ inventory_item_id: 'inv-b' }])
    expect(queue()).toEqual([])
  })
})

// 거절된 기록은 서버가 지웠거나 다른 줄이 이미 있다. 지우기를 다시 대기 표에 넣으면 서버의 줄까지 지운다.
describe('거절된 기록 지우기', () => {
  it('수익 건을 드롭과 함께 지우고 대기 줄을 빼며, 대기 표에 넣지 않는다', async () => {
    await insertEntry('entry-a')
    await insertDrop('drop-1', 'entry-a')

    await deleteServerSyncRecord('bossProfitEntries', 'entry-a')

    expect(rows('SELECT id FROM boss_profit_entries')).toEqual([])
    expect(rows('SELECT id FROM boss_drops')).toEqual([])
    expect(queue()).toEqual(['drop-1'])
  })

  it('약속은 Preferences 의 목록에서 뺀다', async () => {
    const keep = { id: '11111111-1111-4111-8111-111111111111' }
    const gone = { id: '22222222-2222-4222-8222-222222222222' }
    await prefs.set('partyAppointments', JSON.stringify([keep, gone]))
    real.inspect((file) =>
      file.exec(`INSERT INTO server_sync_queue (id, record_type, record_id, created_at) VALUES ('q', 'partyAppointments', '${gone.id}', 't')`),
    )

    await deleteServerSyncRecord('partyAppointments', gone.id)

    expect(JSON.parse((await prefs.get('partyAppointments'))!)).toEqual([keep])
    expect(queue()).toEqual([])
  })
})
