/// <reference types="node" />
/**
 * 처음 동기화가 기기의 기록을 모두 대기 표에 넣는 저장 함수를 진짜 SQLite 로 본다.
 *
 * 기기 변환이 옮긴 줄은 트리거를 거치지 않아 대기 표에 없다. 넣는 표나 조건이 트리거와 갈리면 그 기록은 조용히 올라가지 않는다. 설정을
 * 기본값으로 올리면 다른 기기가 고른 값을 덮고, 이미 있는 대기 줄을 갈면 거절 횟수가 0 으로 돌아간다.
 */
import { contentIdOf } from '../../../lib/scheduler/contents'
import type { SyncPushRecord } from '../../../server/sync'
import { pushServerSync, type PushDeps } from '../../../features/server-sync/push'
import { installFakePreferences, type FakePreferences } from '../../__tests__/fake-preferences'
import { recordCharacterAccounts } from '../../character-accounts'
import { __resetStoragePortsForTest, setSqlitePort, type SqliteDbConnection } from '../../ports'
import { enqueueAllServerSyncRecords, getFirstServerSync, markFirstServerSyncPulled } from '../../server-sync-first'
import { countServerSyncAttempt, listServerSyncQueue, preferenceRecordIdOf, removeServerSync } from '../../server-sync-queue'
import {
  deleteServerSyncRecord,
  mapleIdOfNexonAccount,
  mapleIdOfOcid,
  mapleIdOfProfitEntry,
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
const APPOINTMENT_ID = '11111111-1111-4111-8111-111111111111'

/** 대기 표의 줄. 넣은 차례(rowid)대로다. */
function queue(): [string, string][] {
  return real.inspect((file) =>
    (file.prepare('SELECT record_type, record_id FROM server_sync_queue ORDER BY rowid').all() as Record<string, string>[]).map(
      (row) => [row.record_type!, row.record_id!],
    ),
  )
}

function queueRows(): Record<string, unknown>[] {
  return real.inspect((file) => file.prepare('SELECT record_id, attempts, created_at FROM server_sync_queue ORDER BY rowid').all() as Record<string, unknown>[])
}

/** 기기 변환이 옮긴 줄처럼 대기 표에 없게 한다. */
function clearQueue(): void {
  real.inspect((file) => file.exec('DELETE FROM server_sync_queue'))
}

async function insertEntry(id: string, ocid: string, period = 'W202647'): Promise<void> {
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

async function insertCheck(id: string, settled: 0 | 1): Promise<void> {
  await db.run(
    `INSERT INTO enhancement_history_checks (id, nexon_account_id, enhancement_type, history_date, settled, checked_at)
     VALUES (?, 'account-1', 'starforce', ?, ?, ?)`,
    [id, `2026-11-${id === 'check-1' ? '19' : '20'}`, settled, AT],
  )
}

async function seeCharacter(ocid: string, mapleId: string): Promise<void> {
  await recordCharacterAccounts(
    [{ accountId: mapleId, characters: [{ ocid, name: `이름-${ocid}`, world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 }] }],
    '2026-11-20',
    'account-1',
  )
}

describe('SQLite 기록 표', () => {
  it('트리거를 건 표의 줄을 모두 넣고, 가계부의 딸린 줄은 기록의 id 로, 강화 조회 기록은 굳은 날만 넣는다', async () => {
    await insertEntry('entry-1', 'ocid-1')
    await insertDrop('drop-1', 'entry-1')
    await db.run(
      `INSERT INTO boss_split_settings (id, ocid, boss_difficulty_id, split_type, party_size, split_fee_follows_mvp_grade, created_at, updated_at)
       VALUES ('split-1', 'ocid-1', 'difficulty-1', 'even', 2, 1, ?, ?)`,
      [AT, AT],
    )
    await db.run(
      `INSERT INTO cashbook_entries (id, ocid, category_id, date, recorded_at, updated_at) VALUES ('cash-1', 'ocid-1', 'category-1', '2026-11-20', ?, ?)`,
      [AT, AT],
    )
    await db.run(`INSERT INTO cashbook_entry_items (id, entry_id, item_name, amount_meso) VALUES ('item-1', 'cash-1', '물건', 100)`)
    await db.run(`INSERT INTO cashbook_entry_hunt_inputs (id, entry_id, typed_meso) VALUES ('hunt-1', 'cash-1', 100)`)
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
    await insertCheck('check-1', 1)
    await insertCheck('check-2', 0)
    await db.run(
      `INSERT INTO remembered_levels (id, ocid, type, target_id, level, updated_at) VALUES ('level-1', 'ocid-1', 'symbol', 'symbol-1', 3, ?)`,
      [AT],
    )
    await db.run(
      `INSERT INTO mvp_grade_history (id, account_id, from_date, grade_id, updated_at) VALUES ('mvp-1', 'maple-1', '2026-11-01', 'gold', ?)`,
      [AT],
    )
    await db.run(`INSERT INTO character_world_leaps (id, previous_ocid, ocid) VALUES ('leap-1', 'ocid-old', 'ocid-1')`)
    clearQueue()

    const first = await enqueueAllServerSyncRecords()

    expect(queue().sort()).toEqual(
      [
        ['bossDrops', 'drop-1'],
        ['bossProfitEntries', 'entry-1'],
        ['bossSplitSettings', 'split-1'],
        ['cashbookEntries', 'cash-1'],
        ['characterWorldLeaps', 'leap-1'],
        ['enhancementSettledDays', 'check-1'],
        ['enhancementTotals', 'total-1'],
        ['inventoryItems', 'inv-1'],
        ['mvpGradeHistory', 'mvp-1'],
        ['rememberedLevels', 'level-1'],
      ].sort(),
    )
    expect(new Set(queueRows().map((row) => row.created_at))).toEqual(new Set([first.queuedAt]))
  })

  // 다시 넣어 횟수가 0 으로 돌아가면 서버가 계속 거절하는 건이 끝없이 다시 나간다.
  it('이미 대기 줄이 있는 기록은 그 줄을 횟수 · 넣은 시각과 함께 두고 하나만 남긴다', async () => {
    await insertEntry('entry-1', 'ocid-1')
    await countServerSyncAttempt('entry-1', 'rejected: 수익 건이 아직 없다')
    const before = queueRows()

    await enqueueAllServerSyncRecords()

    expect(queueRows()).toEqual(before)
    expect(before).toEqual([expect.objectContaining({ record_id: 'entry-1', attempts: 1 })])
  })
})

describe('Preferences 기록', () => {
  it('저장 함수가 넣는 항목을 같은 대기 줄 id 로 모두 넣는다', async () => {
    const dojo = contentIdOf('mu_lung_dojo')!
    const entry = { isRegistered: true, nowCount: 1, maxCount: 7, questState: null, periodCode: 'W202647' }
    const appointment = (id: string) => ({
      id,
      bosses: [{ bossDifficultyId: 'd', ocid: 'ocid-1' }],
      time: '21:00',
      durationMinutes: 60,
      alarmMinutesBefore: null,
      schedule: { type: 'once', date: '2026-11-21' },
      exceptions: {},
    })
    // 옛 설치본의 약속 id 는 uuid 가 아니다. 읽을 때 uuid 로 바뀌고, 서버 줄 id 는 uuid 라 그대로 올리면 거절만 받는다.
    await prefs.set('partyAppointments', JSON.stringify([appointment(APPOINTMENT_ID), appointment('1700000000000-abc')]))
    await prefs.set('bossProfitCalculatorRecords', JSON.stringify([{ id: 'calc-1', savedAt: AT, characters: [] }]))
    await prefs.set('manualTrackedContent:ocid-1', JSON.stringify([{ type: 'weekly', targetId: dojo }]))
    await prefs.set('worldSharedProgress:maple-1:world-1', JSON.stringify({ c1: entry }))
    await prefs.set('accountSharedProgress:maple-1', JSON.stringify({ c2: entry }))
    await prefs.set('mapleIdNames', JSON.stringify({ 'maple-1': '본캐' }))
    await prefs.set('trackedCharacters', JSON.stringify(['ocid-1', 'ocid-2']))
    await prefs.set('representativeCharacter', 'ocid-2')
    await prefs.set('figureMotions', JSON.stringify({ 'ocid-1': { actions: ['A00'], emotions: [], durationMs: 1000, restsBetweenActions: true } }))
    await prefs.set('barOrder', JSON.stringify({ groupKeys: ['today'], subPageKeys: { schedule: ['Boss', 'Content'] } }))

    await enqueueAllServerSyncRecords()

    const ids = queue().map(([, id]) => id)
    expect(ids.sort()).toEqual(
      [
        APPOINTMENT_ID,
        'calc-1',
        preferenceRecordIdOf('manualTrackedItems', ['ocid-1', 'weekly', dojo]),
        preferenceRecordIdOf('sharedContentProgress', ['maple-1', 'world-1', 'c1']),
        preferenceRecordIdOf('sharedContentProgress', ['maple-1', '', 'c2']),
        preferenceRecordIdOf('mapleIdNames', ['maple-1']),
        preferenceRecordIdOf('trackedCharacters', ['ocid-1']),
        preferenceRecordIdOf('trackedCharacters', ['ocid-2']),
        preferenceRecordIdOf('representativeCharacterMotions', ['ocid-1']),
        preferenceRecordIdOf('accountSettings', ['barGroupKeys']),
        preferenceRecordIdOf('bottomBarSubPageOrders', ['schedule']),
      ].sort(),
    )
    expect(queue().find(([, id]) => id === 'calc-1')).toEqual(['bossProfitCalculatorRecords', 'calc-1'])
  })

  // 고른 적이 없는 칸을 기본값으로 올리면 나중에 도착한 쪽이 남아 다른 기기가 고른 값을 덮는다.
  it('설정은 키에 값이 적힌 칸만 넣는다', async () => {
    await prefs.set('trackingType', 'manual')
    await prefs.set('isMvpWeeklyCheckOff', 'true')
    await prefs.set('quickLinks', JSON.stringify({ rowCount: 2, keys: ['Boss'] }))

    await enqueueAllServerSyncRecords()

    expect(queue().sort()).toEqual(
      [
        ['accountSettings', preferenceRecordIdOf('accountSettings', ['trackingType'])],
        ['accountSettings', preferenceRecordIdOf('accountSettings', ['isMvpWeeklyCheckOff'])],
        ['accountSettings', preferenceRecordIdOf('accountSettings', ['quickLinkRowCount'])],
        ['accountSettings', preferenceRecordIdOf('accountSettings', ['quickLinkKeys'])],
      ].sort(),
    )
  })
})

describe('처음 동기화의 표시', () => {
  it('넣기를 마친 시각을 적고, 받기를 끝냈는지를 따로 켠다', async () => {
    await expect(getFirstServerSync()).resolves.toBeNull()

    const first = await enqueueAllServerSyncRecords()

    expect(first).toEqual({ queuedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), pulled: false })
    await expect(getFirstServerSync()).resolves.toEqual(first)
    await markFirstServerSyncPulled(first)
    await expect(getFirstServerSync()).resolves.toEqual({ queuedAt: first.queuedAt, pulled: true })
  })

  // 다시 넣으면 받은 기록까지 서버로 되돌아간다. 마친 것으로 읽으면 알림만 평소대로 나간다.
  it('깨진 표시는 처음 동기화를 마친 것으로 읽는다', async () => {
    await prefs.set('firstServerSync', '{깨짐')

    await expect(getFirstServerSync()).resolves.toEqual({ queuedAt: '', pulled: true })
  })
})

// 메이플 ID 를 모르면 서버가 주인을 찾지 못한다. 드롭만 보내면 서버가 수익 건이 없다고 거절해 다섯 번째에 대기 줄이 빠진다.
describe('메이플 ID 를 모르는 기록', () => {
  function pushDeps(sent: unknown[][]): PushDeps {
    return {
      identity: async () => ({ 'x-maple-id-hash': 'h' }),
      list: listServerSyncQueue,
      read: readServerSyncSource,
      owners: { mapleIdOfOcid, mapleIdOfNexonAccount, mapleIdOfProfitEntry },
      send: async (_headers, records: SyncPushRecord[]) => {
        sent.push(records.map((record) => record.row.id))
        return { outcome: 'answered', results: records.map(() => ({ ok: true, id: null })) }
      },
      remove: removeServerSync,
      countAttempt: countServerSyncAttempt,
      replaceId: replaceServerSyncRecordId,
      deleteRecord: deleteServerSyncRecord,
      nameOf: async () => null,
      notify: jest.fn(),
      afterRecordsChanged: () => {},
      wait: async () => {},
    }
  }

  it('수익 건과 그 드롭이 올리기 뒤에도 대기 표에 남았다가, 캐릭터가 목록에 나타나면 올라간다', async () => {
    await seeCharacter('ocid-1', 'maple-1')
    await insertEntry('entry-known', 'ocid-1')
    await insertDrop('drop-known', 'entry-known')
    await insertEntry('entry-unknown', 'ocid-new')
    await insertDrop('drop-unknown', 'entry-unknown')
    clearQueue()
    const first = await enqueueAllServerSyncRecords()

    const sent: unknown[][] = []
    const summary = await pushServerSync({ firstQueuedAt: first.queuedAt }, pushDeps(sent))

    expect(sent).toEqual([['entry-known'], ['drop-known']])
    expect(summary).toMatchObject({ held: 2, rejected: 0 })
    expect(queue().map(([, id]) => id).sort()).toEqual(['drop-unknown', 'entry-unknown'])

    await seeCharacter('ocid-new', 'maple-1')
    sent.length = 0
    await pushServerSync({ firstQueuedAt: first.queuedAt }, pushDeps(sent))

    expect(sent).toEqual([['entry-unknown'], ['drop-unknown']])
    expect(queue()).toEqual([])
  })
})
