/// <reference types="node" />
/**
 * 기기의 기록 주인을 바꿀 때 쓰는 저장 함수를 진짜 SQLite 로 본다. 다른 사람으로 로그인하거나 부계정을 해제하면 이 기기에서 그 주인의
 * 기록을 비운다.
 *
 * 비우는 쓰기가 대기 표에 들어가면 서버의 기록까지 지우고, 번호가 남으면 다시 쓸 수 있게 돼도 비운 기록이 돌아오지 않는다.
 */
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import type { MapleAccount } from '../../../types'
import { installFakePreferences, type FakePreferences } from '../../__tests__/fake-preferences'
import { recordCharacterAccounts } from '../../character-accounts'
import { clearTrackedCharacterOcids } from '../../character-selection'
import { __resetStoragePortsForTest, setSqlitePort, type SqliteDbConnection } from '../../ports'
import { getServerSyncCursors, setServerSyncCursors } from '../../server-sync-cursors'
import {
  discardServerSyncRecords,
  forgetServerSyncMapleIds,
  forgetServerSyncOwners,
  listServerSyncMapleIds,
  ownerOfServerSyncRecord,
  previousOwnerMapleIdHashes,
} from '../../server-sync-owners'
import { clearServerSyncOwners } from '../../server-sync-pull'
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

const AT = '2026-11-24T00:00:00.000Z'

/** 넥슨 목록에서 본 메이플 ID 하나와 그 캐릭터 하나. */
function account(accountId: string, ocid: string): MapleAccount[] {
  return [{ accountId, characters: [{ ocid, name: ocid, world: '스카니아', worldKey: 'scania', level: 1, jobClass: '히어로' }] } as unknown as MapleAccount]
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

async function enqueue(type: string, recordId: string): Promise<void> {
  await db.run(`INSERT INTO server_sync_queue (id, record_type, record_id, created_at) VALUES (?, ?, ?, ?)`, [`q-${recordId}`, type, recordId, AT])
}

async function insertEntry(id: string, ocid: string): Promise<void> {
  await db.run(
    `INSERT INTO boss_profit_entries (id, ocid, boss_difficulty_id, period_code, split_fee_follows_mvp_grade, created_at, updated_at)
     VALUES (?, ?, ?, 'W202647', 1, ?, ?)`,
    [id, ocid, `difficulty-${id}`, AT, AT],
  )
}

async function insertCashbook(id: string, owner: { ocid?: string; accountId?: string }): Promise<void> {
  await db.run(`INSERT INTO cashbook_entries (id, ocid, account_id, category_id, date, recorded_at, updated_at) VALUES (?, ?, ?, 'c', '2026-11-20', ?, ?)`, [
    id,
    owner.ocid ?? null,
    owner.accountId ?? null,
    AT,
    AT,
  ])
}

describe('대기 줄의 주인', () => {
  it('캐릭터 기록은 그 캐릭터의 메이플 ID, 메이플 ID 기록은 그 칸, 사람의 기록은 사람이다', async () => {
    await recordCharacterAccounts(account('maple-1', 'ocid-1'), '2026-11-20', 'account-1')
    await insertEntry('entry-1', 'ocid-1')
    await insertCashbook('cash-1', { accountId: '#hash-9' })
    await db.run(
      `INSERT INTO enhancement_history_checks (id, nexon_account_id, enhancement_type, history_date, settled, checked_at)
       VALUES ('check-1', 'account-1', 'cube', '2026-11-20', 1, ?)`,
      [AT],
    )

    expect(await ownerOfServerSyncRecord('bossProfitEntries', 'entry-1')).toEqual({ kind: 'mapleId', mapleId: 'maple-1' })
    expect(await ownerOfServerSyncRecord('cashbookEntries', 'cash-1')).toEqual({ kind: 'mapleId', mapleId: '#hash-9' })
    expect(await ownerOfServerSyncRecord('enhancementSettledDays', 'check-1')).toEqual({ kind: 'mapleId', mapleId: 'maple-1' })
    expect(await ownerOfServerSyncRecord('sharedContentProgress', 'sharedContentProgress:maple-2//c')).toEqual({ kind: 'mapleId', mapleId: 'maple-2' })
    expect(await ownerOfServerSyncRecord('manualTrackedItems', 'manualTrackedItems:ocid-1/weekly/c')).toEqual({ kind: 'mapleId', mapleId: 'maple-1' })
    expect(await ownerOfServerSyncRecord('partyAppointments', 'appointment-1')).toEqual({ kind: 'person' })
    expect(await ownerOfServerSyncRecord('accountSettings', 'accountSettings:trackingType')).toEqual({ kind: 'person' })
  })

  // 지운 기록의 지우기 · `#` 로 적은 캐릭터 · 목록에서 본 적 없는 캐릭터는 어느 메이플 ID 의 것인지 모른다.
  it('원본이 없거나 캐릭터의 메이플 ID 를 모르면 주인을 모른다', async () => {
    await insertEntry('entry-unknown', '#ocid-hash')

    expect(await ownerOfServerSyncRecord('bossProfitEntries', 'entry-gone')).toEqual({ kind: 'unknown' })
    expect(await ownerOfServerSyncRecord('bossProfitEntries', 'entry-unknown')).toEqual({ kind: 'unknown' })
    expect(await ownerOfServerSyncRecord('manualTrackedItems', 'manualTrackedItems:ocid-never/weekly/c')).toEqual({ kind: 'unknown' })
  })
})

describe('버린 대기 줄', () => {
  it('대기 줄과 그 기록을 지우고, 지우는 쓰기를 대기 표에 넣지 않는다. 설정은 대기 줄만 지운다', async () => {
    await insertEntry('entry-1', 'ocid-1')
    await insertEntry('entry-kept', 'ocid-1')
    await prefs.set('partyAppointments', JSON.stringify([{ id: 'appointment-1' }, { id: 'appointment-2' }]))
    await prefs.set('manualTrackedContent:ocid-1', JSON.stringify([{ type: 'weekly', targetId: 'c' }, { type: 'weekly', targetId: 'd' }]))
    await prefs.set('mapleIdNames', JSON.stringify({ 'maple-1': '본캐' }))
    await prefs.set('trackingType', 'manual')
    clearQueue()
    const discarded: [string, string][] = [
      ['bossProfitEntries', 'entry-1'],
      ['partyAppointments', 'appointment-1'],
      ['manualTrackedItems', 'manualTrackedItems:ocid-1/weekly/c'],
      ['mapleIdNames', 'mapleIdNames:maple-1'],
      ['accountSettings', 'accountSettings:trackingType'],
    ]
    for (const [type, id] of discarded) await enqueue(type, id)
    await enqueue('bossProfitEntries', 'entry-kept')

    await discardServerSyncRecords(discarded.map(([recordType, recordId]) => ({ recordType, recordId })))

    expect(rows('SELECT id FROM boss_profit_entries')).toEqual([{ id: 'entry-kept' }])
    expect(JSON.parse((await prefs.get('partyAppointments'))!)).toEqual([{ id: 'appointment-2' }])
    expect(JSON.parse((await prefs.get('manualTrackedContent:ocid-1'))!)).toEqual([{ type: 'weekly', targetId: 'd' }])
    expect(JSON.parse((await prefs.get('mapleIdNames'))!)).toEqual({})
    // 화면의 모양을 정하는 값이라 기기의 값은 둔다.
    await expect(prefs.get('trackingType')).resolves.toBe('manual')
    expect(queue()).toEqual(['entry-kept'])
  })
})

describe('기록이 있는 메이플 ID', () => {
  it('본 메이플 ID 와 기록 · Preferences 에 `#` 로 적은 메이플 ID 를 겹치지 않게 모은다', async () => {
    await recordCharacterAccounts(account('maple-1', 'ocid-1'), '2026-11-20', 'account-1')
    await insertCashbook('cash-1', { accountId: '#hash-cash' })
    await insertCashbook('cash-2', { accountId: '#hash-cash' })
    await db.run(`INSERT INTO mvp_grade_history (id, account_id, from_date, grade_id, updated_at) VALUES ('mvp-1', '#hash-mvp', '2026-11-01', 'g', ?)`, [AT])
    await prefs.set('mapleIdNames', JSON.stringify({ '#hash-name': '이름' }))
    await prefs.set('accountSharedProgress:#hash-account', JSON.stringify({}))
    await prefs.set('worldSharedProgress:#hash-world:scania', JSON.stringify({}))

    expect((await listServerSyncMapleIds()).sort()).toEqual(
      ['#hash-account', '#hash-cash', '#hash-mvp', '#hash-name', '#hash-world', 'maple-1'].sort(),
    )
  })
})

describe('앞 계정의 메이플 ID', () => {
  // 번호는 받은 적이 없는 기기에 없고, 추적 캐릭터는 받기 전에도 있다.
  it('번호의 메이플 ID 열쇠와 추적 캐릭터의 메이플 ID 해시다', async () => {
    await recordCharacterAccounts(account('maple-1', 'ocid-1'), '2026-11-20', 'account-1')
    await prefs.set('trackedCharacters', JSON.stringify(['ocid-1']))
    await setServerSyncCursors({ nexonAccount: null, mapleIds: { 'hash-cursor': 3 } })

    expect((await previousOwnerMapleIdHashes()).sort()).toEqual(['hash-cursor', nexonIdHashHex('maple-1')].sort())
  })
})

describe('주인의 기록과 번호 지우기', () => {
  it('비운 메이플 ID 의 번호를 지우고, 사람의 기록을 비우면 사람의 번호도 지운다', async () => {
    await recordCharacterAccounts(account('maple-1', 'ocid-1'), '2026-11-20', 'account-1')
    await insertEntry('entry-1', 'ocid-1')
    clearQueue()
    await setServerSyncCursors({ nexonAccount: { id: 'person-1', changeSeq: 7 }, mapleIds: { [nexonIdHashHex('maple-1')]: 5, other: 2 } })

    await forgetServerSyncOwners({ mapleIds: ['maple-1'], person: true })

    expect(rows('SELECT id FROM boss_profit_entries')).toEqual([])
    expect(await getServerSyncCursors()).toEqual({ nexonAccount: null, mapleIds: { other: 2 } })
  })

  // 해제한 메이플 ID 의 기록은 서버가 받지 않는다. 남기면 다섯 번 거절된 뒤 기기에만 남는다.
  it('해제한 메이플 ID 는 원문과 `#` 값 모두, 대기 중인 기록과 그 대기 줄까지 지우고 번호를 지운다', async () => {
    await recordCharacterAccounts(account('maple-1', 'ocid-1'), '2026-11-20', 'account-1')
    const hash = nexonIdHashHex('maple-1')
    await insertEntry('entry-queued', 'ocid-1')
    await insertCashbook('cash-marked', { accountId: `#${hash}` })
    await insertCashbook('cash-other', { accountId: 'maple-2' })
    await prefs.set('manualTrackedContent:ocid-1', JSON.stringify([{ type: 'weekly', targetId: 'c' }]))
    clearQueue()
    await enqueue('bossProfitEntries', 'entry-queued')
    await enqueue('manualTrackedItems', 'manualTrackedItems:ocid-1/weekly/c')
    await enqueue('cashbookEntries', 'cash-other')
    await setServerSyncCursors({ nexonAccount: { id: 'person-1', changeSeq: 7 }, mapleIds: { [hash]: 5 } })

    await forgetServerSyncMapleIds([hash])

    expect(rows('SELECT id FROM boss_profit_entries')).toEqual([])
    expect(rows('SELECT id FROM cashbook_entries')).toEqual([{ id: 'cash-other' }])
    await expect(prefs.get('manualTrackedContent:ocid-1')).resolves.toBeNull()
    expect(queue()).toEqual(['cash-other'])
    expect(await getServerSyncCursors()).toEqual({ nexonAccount: { id: 'person-1', changeSeq: 7 }, mapleIds: {} })
  })

  it('대기 중인 기록까지 비우지 않으면 대기 중인 기록과 그 대기 줄을 남긴다', async () => {
    await recordCharacterAccounts(account('maple-1', 'ocid-1'), '2026-11-20', 'account-1')
    await insertEntry('entry-queued', 'ocid-1')
    clearQueue()
    await enqueue('bossProfitEntries', 'entry-queued')

    await clearServerSyncOwners({ mapleIds: ['maple-1'], person: false })

    expect(rows('SELECT id FROM boss_profit_entries')).toEqual([{ id: 'entry-queued' }])
    expect(queue()).toEqual(['entry-queued'])
  })
})

// 비운 목록의 대기 줄이 남으면 올리기가 원본이 없다고 지우기를 보내, 같은 사람의 서버 추적 목록을 지운다.
it('로그인이 추적 목록을 비우면 추적 캐릭터의 대기 줄도 지운다', async () => {
  await prefs.set('trackedCharacters', JSON.stringify(['ocid-1']))
  clearQueue()
  await enqueue('trackedCharacters', 'trackedCharacters:ocid-1')
  await enqueue('partyAppointments', 'appointment-1')

  await clearTrackedCharacterOcids()

  await expect(prefs.get('trackedCharacters')).resolves.toBeNull()
  expect(queue()).toEqual(['appointment-1'])
})
