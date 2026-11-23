/// <reference types="node" />
/**
 * 받은 줄을 Preferences 기록 키에 넣는 저장 함수. 대기 줄은 SQLite 에 있어 진짜 SQLite 로 본다.
 *
 * 저장 함수를 거치면 받은 값이 대기 표에 들어가 서버로 되돌아가고, 대기 줄을 보지 않으면 아직 못 올린 기기 값을 덮는다.
 */
import { installFakePreferences, type FakePreferences } from '../../__tests__/fake-preferences'
import { __resetStoragePortsForTest, setSqlitePort, type SqliteDbConnection } from '../../ports'
import { applyPulledPreferenceRecords } from '../../server-sync-pull-preferences'
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
    (file.prepare('SELECT record_id FROM server_sync_queue ORDER BY rowid').all() as { record_id: string }[]).map((row) => row.record_id),
  )
}

async function enqueue(recordId: string): Promise<void> {
  await db.run(`INSERT INTO server_sync_queue (id, record_type, record_id, created_at) VALUES (?, 'x', ?, ?)`, [`q-${recordId}`, recordId, AT])
}

async function json(key: string): Promise<unknown> {
  const raw = await prefs.get(key)
  return raw === null ? null : JSON.parse(raw)
}

const appointment = (id: string, time: string) => ({
  id,
  bosses: [{ bossDifficultyId: 'd', ocid: 'ocid-1' }],
  time,
  durationMinutes: 60,
  alarmMinutesBefore: null,
  schedule: { type: 'once', date: '2026-11-21' },
  exceptions: {},
})

describe('id 가 있는 목록', () => {
  it('약속을 id 로 고치거나 더하고, 지운 약속은 뺀다', async () => {
    await prefs.set('partyAppointments', JSON.stringify([appointment('a1', '20:00'), appointment('a2', '21:00')]))

    await applyPulledPreferenceRecords([
      { table: 'partyAppointments', id: 'a1', deleted: false, item: appointment('a1', '22:00') as never },
      { table: 'partyAppointments', id: 'a2', deleted: true, item: appointment('a2', '21:00') as never },
      { table: 'partyAppointments', id: 'a3', deleted: false, item: appointment('a3', '23:00') as never },
    ])

    expect(await json('partyAppointments')).toEqual([appointment('a1', '22:00'), appointment('a3', '23:00')])
    expect(queue()).toEqual([])
  })

  it('대기 줄이 있는 계산기 기록은 덮지 않는다', async () => {
    await prefs.set('bossProfitCalculatorRecords', JSON.stringify([{ id: 'c1', savedAt: AT, characters: [] }]))
    await enqueue('c1')

    await applyPulledPreferenceRecords([
      { table: 'bossProfitCalculatorRecords', id: 'c1', deleted: true, item: { id: 'c1', savedAt: AT, characters: [] } as never },
    ])

    expect(await json('bossProfitCalculatorRecords')).toEqual([{ id: 'c1', savedAt: AT, characters: [] }])
  })
})

describe('id 가 없는 항목', () => {
  it('수동 추적 항목을 캐릭터의 목록에 더하고 뺀다', async () => {
    await prefs.set('manualTrackedContent:ocid-1', JSON.stringify([{ type: 'weekly', targetId: 'c1' }]))

    await applyPulledPreferenceRecords([
      { table: 'manualTrackedItems', deleted: false, ocid: 'ocid-1', type: 'boss', targetId: 'd1' },
      { table: 'manualTrackedItems', deleted: true, ocid: 'ocid-1', type: 'weekly', targetId: 'c1' },
      { table: 'manualTrackedItems', deleted: false, ocid: 'ocid-1', type: 'boss', targetId: 'd1' },
    ])

    expect(await json('manualTrackedContent:ocid-1')).toEqual([{ type: 'boss', targetId: 'd1' }])
  })

  it('공유 진행을 월드 · 계정 원장에 적고, 메이플 ID 이름과 대표 캐릭터 동작을 적고 지운다', async () => {
    const entry = { isRegistered: true, nowCount: 1, maxCount: 7, questState: null, periodCode: 'W202647' }
    await prefs.set('mapleIdNames', JSON.stringify({ 'maple-1': '옛 이름', 'maple-2': '부캐' }))
    await prefs.set('figureMotions', JSON.stringify({ 'ocid-2': { actions: [] } }))

    await applyPulledPreferenceRecords([
      { table: 'sharedContentProgress', deleted: false, mapleId: 'maple-1', worldId: 'w1', contentId: 'c1', entry },
      { table: 'sharedContentProgress', deleted: false, mapleId: 'maple-1', worldId: null, contentId: 'c2', entry },
      { table: 'mapleIdNames', deleted: false, mapleId: 'maple-1', name: '본캐' },
      { table: 'mapleIdNames', deleted: true, mapleId: 'maple-2', name: '부캐' },
      { table: 'representativeCharacterMotions', deleted: false, ocid: 'ocid-1', motion: { actions: ['A00'], restsBetweenActions: true } },
      { table: 'representativeCharacterMotions', deleted: true, ocid: 'ocid-2', motion: {} },
    ])

    expect(await json('worldSharedProgress:maple-1:w1')).toEqual({ c1: entry })
    expect(await json('accountSharedProgress:maple-1')).toEqual({ c2: entry })
    expect(await json('mapleIdNames')).toEqual({ 'maple-1': '본캐' })
    expect(await json('figureMotions')).toEqual({ 'ocid-1': { actions: ['A00'], restsBetweenActions: true } })
    expect(queue()).toEqual([])
  })

  it('대기 줄이 있는 항목은 대기 줄 id 로 견주어 덮지 않는다', async () => {
    await prefs.set('mapleIdNames', JSON.stringify({ 'maple-1': '기기 이름' }))
    await enqueue('mapleIdNames:maple-1')

    await applyPulledPreferenceRecords([{ table: 'mapleIdNames', deleted: false, mapleId: 'maple-1', name: '서버 이름' }])

    expect(await json('mapleIdNames')).toEqual({ 'maple-1': '기기 이름' })
  })
})

describe('추적 목록', () => {
  it('받은 차례로 다시 놓고 받지 않은 캐릭터는 지금 자리를 쓴다. 대표 표시를 따른다', async () => {
    await prefs.set('trackedCharacters', JSON.stringify(['a', 'b', 'c']))
    await prefs.set('representativeCharacter', 'a')

    await applyPulledPreferenceRecords([
      { table: 'trackedCharacters', deleted: false, ocid: 'd', sortOrder: 1, isRepresentative: true },
      { table: 'trackedCharacters', deleted: false, ocid: 'b', sortOrder: 2, isRepresentative: false },
      { table: 'trackedCharacters', deleted: false, ocid: 'c', sortOrder: 3, isRepresentative: false },
    ])

    expect(await json('trackedCharacters')).toEqual(['a', 'd', 'b', 'c'])
    await expect(prefs.get('representativeCharacter')).resolves.toBe('d')
  })

  it('지운 캐릭터를 빼고, 대표였으면 대표를 지운다. 거짓 대표 표시도 지금 대표를 지운다', async () => {
    await prefs.set('trackedCharacters', JSON.stringify(['a', 'b']))
    await prefs.set('representativeCharacter', 'a')

    await applyPulledPreferenceRecords([{ table: 'trackedCharacters', deleted: true, ocid: 'a', sortOrder: 0, isRepresentative: true }])
    expect(await json('trackedCharacters')).toEqual(['b'])
    await expect(prefs.get('representativeCharacter')).resolves.toBeNull()

    await prefs.set('representativeCharacter', 'b')
    await applyPulledPreferenceRecords([{ table: 'trackedCharacters', deleted: false, ocid: 'b', sortOrder: 0, isRepresentative: false }])
    await expect(prefs.get('representativeCharacter')).resolves.toBeNull()
  })
})

describe('설정', () => {
  it('칸마다 기기 키에 적고, 대기 줄이 있는 칸과 빈 칸은 둔다. 거짓은 키를 지운다', async () => {
    await prefs.set('trackingType', 'auto')
    await prefs.set('quickLinks', JSON.stringify({ rowCount: 1, keys: ['A'] }))
    await prefs.set('statsCumulativeStartDate', '2026-01-01')
    await prefs.set('isMvpWeeklyCheckOff', 'true')
    await enqueue('accountSettings:quickLinkRowCount')

    await applyPulledPreferenceRecords([
      {
        table: 'accountSettings',
        values: {
          trackingType: 'manual',
          quickLinkRowCount: 2,
          quickLinkKeys: ['B', 'C'],
          statsCumulativeStartDate: null,
          isMvpWeeklyCheckOff: false,
          isMvpBulkApplyAsked: true,
          mvpLastCheckedWeekCode: 'W202647',
          barGroupKeys: ['today', 'schedule'],
        },
      },
      { table: 'bottomBarSubPageOrders', groupKey: 'schedule', subPageKeys: ['Content', 'Boss'] },
    ])

    await expect(prefs.get('trackingType')).resolves.toBe('manual')
    expect(await json('quickLinks')).toEqual({ rowCount: 1, keys: ['B', 'C'] })
    await expect(prefs.get('statsCumulativeStartDate')).resolves.toBe('2026-01-01')
    await expect(prefs.get('isMvpWeeklyCheckOff')).resolves.toBeNull()
    await expect(prefs.get('isMvpBulkApplyAsked')).resolves.toBe('true')
    await expect(prefs.get('mvpLastCheckedWeekCode')).resolves.toBe('W202647')
    expect(await json('barOrder')).toEqual({ groupKeys: ['today', 'schedule'], subPageKeys: { schedule: ['Content', 'Boss'] } })
    expect(queue()).toEqual(['accountSettings:quickLinkRowCount'])
  })

  it('대기 줄이 있는 하위 페이지 차례는 덮지 않고 옛 이름의 하단바 순서도 읽어 새 이름으로 적는다', async () => {
    await prefs.set('barOrder', JSON.stringify({ groups: ['today'], subs: { schedule: ['Boss'], more: ['A'] } }))
    await enqueue('bottomBarSubPageOrders:schedule')

    await applyPulledPreferenceRecords([
      { table: 'bottomBarSubPageOrders', groupKey: 'schedule', subPageKeys: ['Content'] },
      { table: 'bottomBarSubPageOrders', groupKey: 'more', subPageKeys: ['B'] },
    ])

    expect(await json('barOrder')).toEqual({ groupKeys: ['today'], subPageKeys: { schedule: ['Boss'], more: ['B'] } })
  })
})
