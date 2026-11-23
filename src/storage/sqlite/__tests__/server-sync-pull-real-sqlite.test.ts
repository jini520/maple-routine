/// <reference types="node" />
/**
 * 받은 줄을 SQLite 기록 표에 넣는 저장 함수를 진짜 SQLite 로 본다.
 *
 * 받은 줄이 트리거로 대기 표에 들어가면 서버로 되돌아가고, 외래키가 켜져 있어 id 를 바꾸는 차례가 틀리면 드롭이 걸린다. 둘 다 엔진에서만
 * 드러난다.
 */
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import type { MapleAccount } from '../../../types'
import { installFakePreferences, type FakePreferences } from '../../__tests__/fake-preferences'
import { recordCharacterAccounts } from '../../character-accounts'
import { __resetStoragePortsForTest, setSqlitePort, type SqliteDbConnection } from '../../ports'
import {
  applyPulledSettledDay,
  applyPulledSqliteRecord,
  clearServerSyncOwners,
  loadNexonIdLookup,
  type PulledSqliteRecord,
} from '../../server-sync-pull'
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

/** 넥슨 목록에서 본 메이플 ID 하나와 그 캐릭터 하나. */
function account(accountId: string, ocid: string, name: string): MapleAccount[] {
  return [{ accountId, characters: [{ ocid, name, world: '스카니아', worldKey: 'scania', level: 1, jobClass: '히어로' }] } as unknown as MapleAccount]
}

function rows(sql: string): Record<string, unknown>[] {
  return real.inspect((file) => file.prepare(sql).all() as Record<string, unknown>[])
}

function queue(): string[] {
  return rows('SELECT record_id FROM server_sync_queue ORDER BY rowid').map((row) => row.record_id as string)
}

function clearQueue(): void {
  real.inspect((file) => file.exec('DELETE FROM server_sync_queue'))
}

function entry(id: string, patch: Record<string, unknown> = {}, deleted = false): PulledSqliteRecord {
  return {
    table: 'bossProfitEntries',
    id,
    deleted,
    row: {
      id,
      ocid: 'ocid-1',
      boss_difficulty_id: 'difficulty-1',
      period_code: 'W202647',
      world_id: null,
      crystal_price_meso: null,
      crystal_received_meso: null,
      split_type: null,
      party_size: null,
      split_share_millipercent: null,
      split_fee_percent: null,
      split_fee_follows_mvp_grade: 1,
      cleared_date: null,
      clear_recorded_by: null,
      created_at: AT,
      updated_at: AT,
      ...patch,
    },
  }
}

function drop(id: string, entryId: string, itemId = 'item-1', deleted = false): PulledSqliteRecord {
  return {
    table: 'bossDrops',
    id,
    deleted,
    row: {
      id,
      profit_entry_id: entryId,
      item_id: itemId,
      category: 'fixed',
      price_status: 'pending',
      sale_price_meso: null,
      sale_received_meso: null,
      priced_at: null,
      sale_fee_percent: null,
      sale_fee_follows_mvp_grade: 1,
      split_type: null,
      party_size: null,
      split_share_millipercent: null,
      split_fee_percent: null,
      split_fee_follows_mvp_grade: 1,
      created_at: AT,
      updated_at: AT,
    },
  }
}

async function insertDeviceEntry(id: string, difficulty = 'difficulty-1'): Promise<void> {
  await db.run(
    `INSERT INTO boss_profit_entries (id, ocid, boss_difficulty_id, period_code, split_fee_follows_mvp_grade, over_crystal_sale_limit, created_at, updated_at)
     VALUES (?, 'ocid-1', ?, 'W202647', 1, 1, ?, ?)`,
    [id, difficulty, AT, AT],
  )
}

async function insertDeviceDrop(id: string, entryId: string, itemId = 'item-1'): Promise<void> {
  await db.run(
    `INSERT INTO boss_drops (id, profit_entry_id, item_id, category, price_status, sale_fee_follows_mvp_grade,
                             split_fee_follows_mvp_grade, created_at, updated_at)
     VALUES (?, ?, ?, 'fixed', 'pending', 1, 1, ?, ?)`,
    [id, entryId, itemId, AT, AT],
  )
}

describe('넣기', () => {
  it('받은 줄을 넣고 대기 표에 넣지 않는다. 같은 줄을 두 번 넣어도 하나다', async () => {
    await expect(applyPulledSqliteRecord(entry('entry-1'))).resolves.toBe(true)
    await expect(applyPulledSqliteRecord(entry('entry-1', { world_id: 'world-1' }))).resolves.toBe(true)
    await applyPulledSqliteRecord(drop('drop-1', 'entry-1'))

    expect(rows('SELECT id, world_id FROM boss_profit_entries')).toEqual([{ id: 'entry-1', world_id: 'world-1' }])
    expect(rows('SELECT id FROM boss_drops')).toEqual([{ id: 'drop-1' }])
    expect(queue()).toEqual([])
  })

  it('기기만 쓰는 칸(`over_crystal_sale_limit`)은 있던 값을 둔다', async () => {
    await insertDeviceEntry('entry-1')
    clearQueue()

    await applyPulledSqliteRecord(entry('entry-1', { world_id: 'world-1' }))

    expect(rows('SELECT world_id, over_crystal_sale_limit FROM boss_profit_entries')).toEqual([{ world_id: 'world-1', over_crystal_sale_limit: 1 }])
  })

  // 아직 못 올린 기기 값이 다음 올리기로 서버를 덮는다. 받은 값으로 덮으면 사용자가 방금 고친 값이 사라진다.
  it('대기 표에 같은 id 의 기록이 있으면 넣지도 지우지도 않는다', async () => {
    await insertDeviceEntry('entry-1')

    await expect(applyPulledSqliteRecord(entry('entry-1', { world_id: 'world-1' }))).resolves.toBe(false)
    await expect(applyPulledSqliteRecord(entry('entry-1', {}, true))).resolves.toBe(false)

    expect(rows('SELECT world_id FROM boss_profit_entries')).toEqual([{ world_id: null }])
    expect(queue()).toEqual(['entry-1'])
  })

  it('지운 줄은 기기에서 지우고 드롭도 함께 지워진다. 그 지우기는 대기 표에 들어가지 않는다', async () => {
    await insertDeviceEntry('entry-1')
    await insertDeviceDrop('drop-1', 'entry-1')
    clearQueue()

    await applyPulledSqliteRecord(entry('entry-1', {}, true))

    expect(rows('SELECT id FROM boss_profit_entries')).toEqual([])
    expect(rows('SELECT id FROM boss_drops')).toEqual([])
    expect(queue()).toEqual([])
  })

  // 기기에서 지운 수익 건이라 그 지우기가 대기 표에 있다. 넣으면 외래키에 걸린다.
  it('가리키는 수익 건이 기기에 없는 드롭은 넣지 않는다', async () => {
    await expect(applyPulledSqliteRecord(drop('drop-1', 'missing'))).resolves.toBe(false)

    expect(rows('SELECT id FROM boss_drops')).toEqual([])
  })

  it('기기 표의 CHECK 에 걸리는 줄은 던지고 아무것도 남기지 않는다', async () => {
    await expect(applyPulledSqliteRecord(entry('entry-1', { clear_recorded_by: 'manual' }))).rejects.toThrow()

    expect(rows('SELECT id FROM boss_profit_entries')).toEqual([])
    expect(rows('SELECT * FROM server_sync_pause')).toEqual([])
  })
})

describe('유일 기준이 같은 기기 줄', () => {
  // 두 기기에 따로 쌓인 같은 처치가 한 줄이 된다. 드롭은 서버 id 의 수익 건을 가리켜야 다음 올리기가 받는다.
  it('서버 줄로 바꾸고 가리키는 드롭과 대기 줄을 옮기지 않고 뺀다', async () => {
    await insertDeviceEntry('device-entry')
    await insertDeviceDrop('device-drop', 'device-entry')

    await applyPulledSqliteRecord(entry('server-entry', { world_id: 'world-1' }))

    expect(rows('SELECT id, world_id FROM boss_profit_entries')).toEqual([{ id: 'server-entry', world_id: 'world-1' }])
    expect(rows('SELECT id, profit_entry_id FROM boss_drops')).toEqual([{ id: 'device-drop', profit_entry_id: 'server-entry' }])
    expect(queue()).toEqual(['device-drop'])
  })

  it('서버 id 의 줄이 기기에 따로 있으면 겹친 기기 줄을 지우고 드롭은 서버 id 로 옮긴다. 같은 아이템의 드롭은 함께 지워진다', async () => {
    await insertDeviceEntry('server-entry', 'difficulty-2')
    await insertDeviceEntry('device-entry')
    await insertDeviceDrop('drop-same', 'server-entry', 'item-1')
    await insertDeviceDrop('drop-dup', 'device-entry', 'item-1')
    await insertDeviceDrop('drop-other', 'device-entry', 'item-2')
    clearQueue()

    await applyPulledSqliteRecord(entry('server-entry'))

    expect(rows('SELECT id, boss_difficulty_id FROM boss_profit_entries')).toEqual([{ id: 'server-entry', boss_difficulty_id: 'difficulty-1' }])
    expect(rows('SELECT id, profit_entry_id FROM boss_drops ORDER BY id')).toEqual([
      { id: 'drop-other', profit_entry_id: 'server-entry' },
      { id: 'drop-same', profit_entry_id: 'server-entry' },
    ])
    expect(queue()).toEqual([])
  })

  it('강화 합계 · MVP 등급 · 리프도 유일 기준으로 서버 줄로 바꾼다', async () => {
    await db.run(
      `INSERT INTO mvp_grade_history (id, account_id, from_date, grade_id, updated_at) VALUES ('device-mvp', 'maple-1', '2026-11-01', 'g1', ?)`,
      [AT],
    )
    await db.run(`INSERT INTO character_world_leaps (id, previous_ocid, ocid) VALUES ('device-leap', 'old', 'new')`)

    await applyPulledSqliteRecord({
      table: 'mvpGradeHistory',
      id: 'server-mvp',
      deleted: false,
      row: { id: 'server-mvp', account_id: 'maple-1', from_date: '2026-11-01', grade_id: 'g2', updated_at: AT },
    })
    await applyPulledSqliteRecord({
      table: 'characterWorldLeaps',
      id: 'server-leap',
      deleted: false,
      row: { id: 'server-leap', previous_ocid: 'old', ocid: 'new' },
    })

    expect(rows('SELECT id, grade_id FROM mvp_grade_history')).toEqual([{ id: 'server-mvp', grade_id: 'g2' }])
    expect(rows('SELECT id FROM character_world_leaps')).toEqual([{ id: 'server-leap' }])
    expect(queue()).toEqual([])
  })
})

describe('가계부 기록', () => {
  const children = {
    items: [
      { item_name: '첫째', amount_meso: 1, inventory_item_id: 'inv-1' },
      { item_name: '둘째', amount_meso: 2, inventory_item_id: 'missing' },
    ],
    huntInput: { typed_meso: 100 },
    transferInput: null,
    exchangeInput: null,
    fragmentUses: [{ fragment_source: 'hunt', ocid: 'ocid-2', fragment_quantity: 3 }],
  }
  const head = {
    id: 'cash-1',
    ocid: 'ocid-1',
    account_id: null,
    world_id: null,
    category_id: 'category-1',
    date: '2026-11-20',
    memo: null,
    recorded_at: AT,
    updated_at: AT,
  }

  it('딸린 줄을 지우고 받은 것으로 다시 넣는다. 없는 인벤토리 줄을 가리키는 품목은 비운다', async () => {
    await db.run(
      `INSERT INTO inventory_items (id, account_id, world_id, item_id, cashbook_item_type_id, added_quantity, created_at, updated_at)
       VALUES ('inv-1', 'maple-1', 'w', 'i', 't', 1, ?, ?)`,
      [AT, AT],
    )
    await db.run(`INSERT INTO cashbook_entries (id, ocid, category_id, date, recorded_at, updated_at) VALUES ('cash-1', 'ocid-1', 'c', '2026-11-19', ?, ?)`, [AT, AT])
    await db.run(`INSERT INTO cashbook_entry_items (id, entry_id, item_name, amount_meso) VALUES ('old-item', 'cash-1', '옛', 9)`)
    clearQueue()

    await applyPulledSqliteRecord({ table: 'cashbookEntries', id: 'cash-1', deleted: false, row: head, children })

    expect(rows('SELECT date, category_id FROM cashbook_entries')).toEqual([{ date: '2026-11-20', category_id: 'category-1' }])
    expect(rows('SELECT item_name, inventory_item_id FROM cashbook_entry_items ORDER BY rowid')).toEqual([
      { item_name: '첫째', inventory_item_id: 'inv-1' },
      { item_name: '둘째', inventory_item_id: null },
    ])
    expect(rows('SELECT typed_meso FROM cashbook_entry_hunt_inputs')).toEqual([{ typed_meso: 100 }])
    expect(rows('SELECT ocid, fragment_quantity FROM cashbook_entry_fragment_uses')).toEqual([{ ocid: 'ocid-2', fragment_quantity: 3 }])
    expect(queue()).toEqual([])
  })
})

describe('굳은 날', () => {
  const day = { table: 'enhancementSettledDays' as const, nexonAccountId: 'account-1', enhancementType: 'cube', historyDate: '2026-11-20' }

  it('없는 날은 굳은 줄로 넣고, 굳지 않은 줄은 굳힌다', async () => {
    await db.run(
      `INSERT INTO enhancement_history_checks (nexon_account_id, enhancement_type, history_date, next_cursor, settled, checked_at)
       VALUES ('account-1', 'starforce', '2026-11-20', 'c', 0, ?)`,
      [AT],
    )

    await applyPulledSettledDay({ ...day, deleted: false })
    await applyPulledSettledDay({ ...day, enhancementType: 'starforce', deleted: false })

    expect(rows('SELECT enhancement_type, settled, next_cursor FROM enhancement_history_checks ORDER BY enhancement_type')).toEqual([
      { enhancement_type: 'cube', settled: 1, next_cursor: null },
      { enhancement_type: 'starforce', settled: 1, next_cursor: 'c' },
    ])
    expect(queue()).toEqual([])
  })

  // 굳은 표시만 내리면 커서가 같아 넥슨을 다시 불러도 합계를 다시 적지 않는다.
  it('지운 굳은 날은 조회 기록 줄을 지운다', async () => {
    await applyPulledSettledDay({ ...day, deleted: false })

    await applyPulledSettledDay({ ...day, deleted: true })

    expect(rows('SELECT id FROM enhancement_history_checks')).toEqual([])
  })
})

describe('해시의 짝', () => {
  it('본 캐릭터 · 메이플 ID 의 해시와 메이플 ID 의 넥슨 계정 id 를 읽는다', async () => {
    await recordCharacterAccounts(account('maple-1', 'ocid-1', '하나'), '2026-11-20', 'account-1')

    const lookup = await loadNexonIdLookup()

    expect(lookup.ocids.get(nexonIdHashHex('ocid-1'))).toBe('ocid-1')
    expect(lookup.mapleIds.get(nexonIdHashHex('maple-1'))).toBe('maple-1')
    expect(lookup.nexonAccountIds.get('maple-1')).toBe('account-1')
  })
})

describe('주인의 기록 비우기', () => {
  // 180일 넘게 받지 않아 서버가 지운 표식을 놓친 기기가 0 부터 다시 받기 전이다.
  it('그 메이플 ID 의 기록과 Preferences 기록을 비우되 대기 중인 기록과 다른 메이플 ID 는 남긴다', async () => {
    await recordCharacterAccounts(account('maple-1', 'ocid-1', '하나'), '2026-11-20', 'account-1')
    await recordCharacterAccounts(account('maple-9', 'ocid-9', '아홉'), '2026-11-20', 'account-9')
    await insertDeviceEntry('entry-1')
    await db.run(
      `INSERT INTO boss_profit_entries (id, ocid, boss_difficulty_id, period_code, split_fee_follows_mvp_grade, created_at, updated_at)
       VALUES ('entry-queued', 'ocid-1', 'difficulty-2', 'W202647', 1, ?, ?), ('entry-9', 'ocid-9', 'difficulty-1', 'W202647', 1, ?, ?)`,
      [AT, AT, AT, AT],
    )
    await db.run(`INSERT INTO cashbook_entries (id, account_id, category_id, date, recorded_at, updated_at) VALUES ('cash-1', 'maple-1', 'c', '2026-11-20', ?, ?)`, [AT, AT])
    await db.run(
      `INSERT INTO enhancement_history_checks (nexon_account_id, enhancement_type, history_date, settled, checked_at) VALUES ('account-1', 'cube', '2026-11-20', 1, ?)`,
      [AT],
    )
    clearQueue()
    await db.run(`INSERT INTO server_sync_queue (id, record_type, record_id, created_at) VALUES ('q', 'bossProfitEntries', 'entry-queued', ?)`, [AT])
    await prefs.set('mapleIdNames', JSON.stringify({ 'maple-1': '본캐', 'maple-9': '부캐' }))
    await prefs.set('manualTrackedContent:ocid-1', JSON.stringify([{ type: 'weekly', targetId: 'c' }]))
    await prefs.set('accountSharedProgress:maple-1', JSON.stringify({ c: {} }))

    await clearServerSyncOwners({ mapleIds: ['maple-1'], person: false })

    expect(rows('SELECT id FROM boss_profit_entries ORDER BY id')).toEqual([{ id: 'entry-9' }, { id: 'entry-queued' }])
    expect(rows('SELECT id FROM cashbook_entries')).toEqual([])
    expect(rows('SELECT id FROM enhancement_history_checks')).toEqual([])
    expect(JSON.parse((await prefs.get('mapleIdNames'))!)).toEqual({ 'maple-9': '부캐' })
    await expect(prefs.get('manualTrackedContent:ocid-1')).resolves.toBeNull()
    await expect(prefs.get('accountSharedProgress:maple-1')).resolves.toBeNull()
    expect(queue()).toEqual(['entry-queued'])
  })

  it('사람의 기록은 추적 목록과 대표 · 약속 · 계산기 기록이고 대기 중인 항목은 남긴다', async () => {
    await prefs.set('trackedCharacters', JSON.stringify(['ocid-1', 'ocid-2']))
    await prefs.set('representativeCharacter', 'ocid-1')
    await prefs.set('partyAppointments', JSON.stringify([{ id: 'a1' }, { id: 'a2' }]))
    await prefs.set('bossProfitCalculatorRecords', JSON.stringify([{ id: 'c1' }]))
    await prefs.set('trackingType', 'manual')
    await db.run(`INSERT INTO server_sync_queue (id, record_type, record_id, created_at) VALUES ('q', 'partyAppointments', 'a2', ?)`, [AT])

    await clearServerSyncOwners({ mapleIds: [], person: true })

    await expect(prefs.get('trackedCharacters')).resolves.toBe('[]')
    await expect(prefs.get('representativeCharacter')).resolves.toBeNull()
    expect(JSON.parse((await prefs.get('partyAppointments'))!)).toEqual([{ id: 'a2' }])
    expect(JSON.parse((await prefs.get('bossProfitCalculatorRecords'))!)).toEqual([])
    await expect(prefs.get('trackingType')).resolves.toBe('manual')
  })
})
