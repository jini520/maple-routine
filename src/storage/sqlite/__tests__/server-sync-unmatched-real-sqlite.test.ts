/// <reference types="node" />
/**
 * 받기가 짝을 못 찾아 `#` 를 붙여 넣은 값을, 짝이 생긴 뒤 원문으로 바꾸는 저장 함수.
 *
 * 바꾸지 않으면 부계정 키를 등록한 뒤에도 그 계정의 기록이 알 수 없는 캐릭터로 남는다. 바꾸는 쓰기가 대기 표에 들어가면 서버가 이미
 * 든 값을 다시 올린다. 트리거는 엔진에서만 돌아 진짜 SQLite 로 본다.
 */
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import { installFakePreferences, type FakePreferences } from '../../__tests__/fake-preferences'
import { __resetStoragePortsForTest, setSqlitePort, type SqliteDbConnection } from '../../ports'
import type { NexonIdLookup } from '../../server-sync-pull'
import { replaceMatchedNexonIds } from '../../server-sync-unmatched'
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
const OCID = 'ocid-1'
const MAPLE = 'maple-1'
const MARKED_OCID = `#${nexonIdHashHex(OCID)}`
const MARKED_MAPLE = `#${nexonIdHashHex(MAPLE)}`
const STILL_UNKNOWN = `#${'f'.repeat(64)}`

const lookup: NexonIdLookup = {
  ocids: new Map([[nexonIdHashHex(OCID), OCID]]),
  mapleIds: new Map([[nexonIdHashHex(MAPLE), MAPLE]]),
  nexonAccountIds: new Map(),
}

function rows(sql: string): Record<string, unknown>[] {
  return real.inspect((file) => file.prepare(sql).all() as Record<string, unknown>[])
}

function clearQueue(): void {
  real.inspect((file) => file.exec('DELETE FROM server_sync_queue'))
}

async function insertEntry(id: string, ocid: string): Promise<void> {
  await db.run(
    `INSERT INTO boss_profit_entries (id, ocid, boss_difficulty_id, period_code, split_fee_follows_mvp_grade, created_at, updated_at)
     VALUES (?, ?, 'difficulty-1', 'W202647', 1, ?, ?)`,
    [id, ocid, AT, AT],
  )
}

async function json(key: string): Promise<unknown> {
  const raw = await prefs.get(key)
  return raw === null ? null : JSON.parse(raw)
}

describe('SQLite 기록 표', () => {
  it('짝이 생긴 ocid · 메이플 ID 를 원문으로 바꾸고 대기 표에 넣지 않는다. 짝이 없는 값은 둔다', async () => {
    await insertEntry('entry-1', MARKED_OCID)
    await insertEntry('entry-2', STILL_UNKNOWN)
    await db.run(`INSERT INTO character_world_leaps (id, previous_ocid, ocid) VALUES ('leap-1', ?, 'new-ocid')`, [MARKED_OCID])
    await db.run(
      `INSERT INTO cashbook_entries (id, ocid, category_id, date, recorded_at, updated_at) VALUES ('cash-1', ?, 'c', '2026-11-20', ?, ?)`,
      [MARKED_OCID, AT, AT],
    )
    await db.run(
      `INSERT INTO cashbook_entries (id, account_id, category_id, date, recorded_at, updated_at) VALUES ('cash-2', ?, 'c', '2026-11-20', ?, ?)`,
      [MARKED_MAPLE, AT, AT],
    )
    await db.run(
      `INSERT INTO cashbook_entry_transfer_inputs (id, entry_id, receiver_ocid, transfer_meso, fee_percent, fee_follows_mvp_grade)
       VALUES ('t-1', 'cash-2', ?, 1, 3, 1)`,
      [MARKED_OCID],
    )
    await db.run(
      `INSERT INTO cashbook_entry_fragment_uses (id, entry_id, fragment_source, ocid, fragment_quantity) VALUES ('u-1', 'cash-2', 'hunt', ?, 1)`,
      [MARKED_OCID],
    )
    await db.run(`INSERT INTO mvp_grade_history (id, account_id, from_date, grade_id, updated_at) VALUES ('mvp-1', ?, '2026-11-01', 'g', ?)`, [
      MARKED_MAPLE,
      AT,
    ])
    clearQueue()

    const changed = await replaceMatchedNexonIds(lookup)

    expect(rows('SELECT id, ocid FROM boss_profit_entries ORDER BY id')).toEqual([
      { id: 'entry-1', ocid: OCID },
      { id: 'entry-2', ocid: STILL_UNKNOWN },
    ])
    expect(rows('SELECT previous_ocid FROM character_world_leaps')).toEqual([{ previous_ocid: OCID }])
    expect(rows('SELECT id, ocid, account_id FROM cashbook_entries ORDER BY id')).toEqual([
      { id: 'cash-1', ocid: OCID, account_id: null },
      { id: 'cash-2', ocid: null, account_id: MAPLE },
    ])
    expect(rows('SELECT receiver_ocid FROM cashbook_entry_transfer_inputs')).toEqual([{ receiver_ocid: OCID }])
    expect(rows('SELECT ocid FROM cashbook_entry_fragment_uses')).toEqual([{ ocid: OCID }])
    expect(rows('SELECT account_id FROM mvp_grade_history')).toEqual([{ account_id: MAPLE }])
    expect(rows('SELECT record_id FROM server_sync_queue')).toEqual([])
    expect(changed).toEqual(new Set(['bossProfitEntries', 'characterWorldLeaps', 'cashbookEntries', 'mvpGradeHistory']))
  })

  // 같은 받기가 서버 줄을 넣을 때 겹친 기기 줄을 서버 줄로 바꾼다.
  it('바꾸면 유일 기준이 겹치는 줄은 두고 나머지를 바꾼다', async () => {
    await insertEntry('device-entry', OCID)
    await insertEntry('marked-entry', MARKED_OCID)

    await replaceMatchedNexonIds(lookup)

    expect(rows('SELECT id, ocid FROM boss_profit_entries ORDER BY id')).toEqual([
      { id: 'device-entry', ocid: OCID },
      { id: 'marked-entry', ocid: MARKED_OCID },
    ])
  })

  it('바꿀 값이 없으면 아무 표도 바꾸지 않는다', async () => {
    await insertEntry('entry-2', STILL_UNKNOWN)

    await expect(replaceMatchedNexonIds(lookup)).resolves.toEqual(new Set())
  })
})

describe('Preferences 기록', () => {
  it('키 · 열쇠 · 약속 · 계산기 기록의 값을 원문으로 바꾸고, 원문 쪽에 이미 있는 값은 원문 쪽을 둔다', async () => {
    await prefs.set(`manualTrackedContent:${MARKED_OCID}`, JSON.stringify([{ type: 'boss', targetId: 'd1' }, { type: 'weekly', targetId: 'c1' }]))
    await prefs.set(`manualTrackedContent:${OCID}`, JSON.stringify([{ type: 'weekly', targetId: 'c1' }]))
    await prefs.set(`accountSharedProgress:${MARKED_MAPLE}`, JSON.stringify({ c1: { nowCount: 1 }, c2: { nowCount: 2 } }))
    await prefs.set(`accountSharedProgress:${MAPLE}`, JSON.stringify({ c1: { nowCount: 9 } }))
    await prefs.set(`worldSharedProgress:${MARKED_MAPLE}:w1`, JSON.stringify({ c3: { nowCount: 3 } }))
    await prefs.set('mapleIdNames', JSON.stringify({ [MARKED_MAPLE]: '서버 이름', [STILL_UNKNOWN]: '모름' }))
    await prefs.set('figureMotions', JSON.stringify({ [MARKED_OCID]: { actions: ['A01'] }, [OCID]: { actions: ['A00'] } }))
    await prefs.set(
      'partyAppointments',
      JSON.stringify([
        {
          id: 'a1',
          bosses: [{ bossDifficultyId: 'd', ocid: MARKED_OCID }],
          exceptions: { W202647: { bosses: [{ bossDifficultyId: 'd', ocid: MARKED_OCID }] } },
        },
      ]),
    )
    await prefs.set('bossProfitCalculatorRecords', JSON.stringify([{ id: 'c1', savedAt: AT, characters: [{ ocid: MARKED_OCID, bosses: [] }] }]))

    const changed = await replaceMatchedNexonIds(lookup)

    await expect(prefs.get(`manualTrackedContent:${MARKED_OCID}`)).resolves.toBeNull()
    expect(await json(`manualTrackedContent:${OCID}`)).toEqual([
      { type: 'weekly', targetId: 'c1' },
      { type: 'boss', targetId: 'd1' },
    ])
    await expect(prefs.get(`accountSharedProgress:${MARKED_MAPLE}`)).resolves.toBeNull()
    expect(await json(`accountSharedProgress:${MAPLE}`)).toEqual({ c1: { nowCount: 9 }, c2: { nowCount: 2 } })
    expect(await json(`worldSharedProgress:${MAPLE}:w1`)).toEqual({ c3: { nowCount: 3 } })
    expect(await json('mapleIdNames')).toEqual({ [MAPLE]: '서버 이름', [STILL_UNKNOWN]: '모름' })
    expect(await json('figureMotions')).toEqual({ [OCID]: { actions: ['A00'] } })
    expect(await json('partyAppointments')).toEqual([
      {
        id: 'a1',
        bosses: [{ bossDifficultyId: 'd', ocid: OCID }],
        exceptions: { W202647: { bosses: [{ bossDifficultyId: 'd', ocid: OCID }] } },
      },
    ])
    expect(await json('bossProfitCalculatorRecords')).toEqual([{ id: 'c1', savedAt: AT, characters: [{ ocid: OCID, bosses: [] }] }])
    expect(rows('SELECT record_id FROM server_sync_queue')).toEqual([])
    expect(changed).toEqual(
      new Set([
        'manualTrackedItems',
        'sharedContentProgress',
        'mapleIdNames',
        'representativeCharacterMotions',
        'partyAppointments',
        'bossProfitCalculatorRecords',
      ]),
    )
  })
})
