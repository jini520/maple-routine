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

// 먼저 올린 기기의 값이 남는다. id 가 없는 기록은 대기 줄 id 가 유일 기준의 값이라, 평소처럼 건너뛰면 나중 기기의 값이 서버를 덮는다.
describe('처음 동기화의 받기', () => {
  const QUEUED_AT = '2026-11-24T00:00:00.000Z'
  const FIRST = '2026-11-23T23:59:59.000Z'
  const LATER = '2026-11-24T00:00:01.000Z'

  async function enqueueAt(recordId: string, createdAt: string): Promise<void> {
    await db.run(`INSERT INTO server_sync_queue (id, record_type, record_id, created_at) VALUES (?, 'x', ?, ?)`, [
      `q-${recordId}`,
      recordId,
      createdAt,
    ])
  }

  it('처음 올리기의 대기 줄이 있는 항목과 설정 칸은 서버 값으로 덮고 그 대기 줄을 빼며, 그 뒤에 들어간 대기 줄은 둔다', async () => {
    await prefs.set('mapleIdNames', JSON.stringify({ 'maple-1': '메인', 'maple-2': '부캐' }))
    await prefs.set('manualTrackedContent:ocid-1', JSON.stringify([{ type: 'weekly', targetId: 'c1' }]))
    await prefs.set('trackingType', 'auto')
    await prefs.set('isMvpWeeklyCheckOff', 'true')
    await enqueueAt('mapleIdNames:maple-1', FIRST)
    await enqueueAt('mapleIdNames:maple-2', LATER)
    await enqueueAt('manualTrackedItems:ocid-1/weekly/c1', QUEUED_AT)
    await enqueueAt('accountSettings:trackingType', FIRST)
    await enqueueAt('accountSettings:isMvpWeeklyCheckOff', LATER)

    await applyPulledPreferenceRecords(
      [
        { table: 'mapleIdNames', deleted: false, mapleId: 'maple-1', name: '본캐' },
        { table: 'mapleIdNames', deleted: false, mapleId: 'maple-2', name: '서브' },
        { table: 'manualTrackedItems', deleted: true, ocid: 'ocid-1', type: 'weekly', targetId: 'c1' },
        { table: 'accountSettings', values: { trackingType: 'manual', isMvpWeeklyCheckOff: false } },
      ],
      { firstQueuedAt: QUEUED_AT },
    )

    expect(await json('mapleIdNames')).toEqual({ 'maple-1': '본캐', 'maple-2': '부캐' })
    expect(await json('manualTrackedContent:ocid-1')).toEqual([])
    await expect(prefs.get('trackingType')).resolves.toBe('manual')
    await expect(prefs.get('isMvpWeeklyCheckOff')).resolves.toBe('true')
    expect(queue()).toEqual(['mapleIdNames:maple-2', 'accountSettings:isMvpWeeklyCheckOff'])
  })

  // 기기의 uuid 가 줄 id 라 두 기기의 약속이 둘 다 남는다. 같은 id 면 이 기기가 올린 같은 약속이다.
  it('약속은 처음 올리기의 대기 줄이 있어도 덮지 않는다', async () => {
    await prefs.set('partyAppointments', JSON.stringify([appointment('a1', '20:00')]))
    await enqueueAt('a1', FIRST)

    await applyPulledPreferenceRecords([{ table: 'partyAppointments', id: 'a1', deleted: false, item: appointment('a1', '22:00') as never }], {
      firstQueuedAt: QUEUED_AT,
    })

    expect(await json('partyAppointments')).toEqual([appointment('a1', '20:00')])
    expect(queue()).toEqual(['a1'])
  })

  // 서버 차례 값과 기기 자리를 같은 칸에 견주면 같은 값이 둘 생겨 기기마다 차례가 갈린다.
  it('추적 목록은 서버 캐릭터를 서버 차례대로 앞에, 서버에 없는 기기 캐릭터를 지금 차례대로 뒤에 두고 서버의 대표를 따른다', async () => {
    await prefs.set('trackedCharacters', JSON.stringify(['z', 'x', 'y']))
    await prefs.set('representativeCharacter', 'z')
    for (const ocid of ['z', 'x', 'y']) await enqueueAt(`trackedCharacters:${ocid}`, FIRST)

    await applyPulledPreferenceRecords(
      [
        { table: 'trackedCharacters', deleted: false, ocid: 'w', sortOrder: 1, isRepresentative: false },
        { table: 'trackedCharacters', deleted: false, ocid: 'x', sortOrder: 0, isRepresentative: true },
      ],
      { firstQueuedAt: QUEUED_AT },
    )

    expect(await json('trackedCharacters')).toEqual(['x', 'w', 'z', 'y'])
    await expect(prefs.get('representativeCharacter')).resolves.toBe('x')
    expect(queue()).toEqual(['trackedCharacters:z', 'trackedCharacters:y'])
  })

  // 남기면 기기 쪽 대표가 올라가 서버에 대표가 둘이 된다.
  it('서버 목록의 대표가 이 기기에 짝이 없으면 서버에 없는 기기 캐릭터의 대표 표시를 지운다', async () => {
    await prefs.set('trackedCharacters', JSON.stringify(['z']))
    await prefs.set('representativeCharacter', 'z')
    await enqueueAt('trackedCharacters:z', FIRST)

    await applyPulledPreferenceRecords([], { firstQueuedAt: QUEUED_AT, unpairedRepresentative: true })

    expect(await json('trackedCharacters')).toEqual(['z'])
    await expect(prefs.get('representativeCharacter')).resolves.toBeNull()
    expect(queue()).toEqual(['trackedCharacters:z'])
  })

  it('서버 목록에 대표가 없으면 서버에 없는 기기 캐릭터의 대표는 남고, 서버에 있는 캐릭터는 서버의 거짓 표시를 따른다', async () => {
    await prefs.set('trackedCharacters', JSON.stringify(['z', 'x']))
    await prefs.set('representativeCharacter', 'z')
    for (const ocid of ['z', 'x']) await enqueueAt(`trackedCharacters:${ocid}`, FIRST)
    await applyPulledPreferenceRecords([{ table: 'trackedCharacters', deleted: false, ocid: 'x', sortOrder: 0, isRepresentative: false }], {
      firstQueuedAt: QUEUED_AT,
    })
    expect(await json('trackedCharacters')).toEqual(['x', 'z'])
    await expect(prefs.get('representativeCharacter')).resolves.toBe('z')

    await prefs.set('representativeCharacter', 'x')
    await enqueueAt('trackedCharacters:x', FIRST)
    await applyPulledPreferenceRecords([{ table: 'trackedCharacters', deleted: false, ocid: 'x', sortOrder: 0, isRepresentative: false }], {
      firstQueuedAt: QUEUED_AT,
    })
    await expect(prefs.get('representativeCharacter')).resolves.toBeNull()
  })

  // 사용자가 처음 동기화 뒤에 친 값이다. 올리기가 서버를 덮는다.
  it('그 뒤에 들어간 대기 줄의 추적 캐릭터는 덮지 않는다', async () => {
    await prefs.set('trackedCharacters', JSON.stringify(['z', 'x']))
    await enqueueAt('trackedCharacters:z', FIRST)
    await enqueueAt('trackedCharacters:x', LATER)

    await applyPulledPreferenceRecords([{ table: 'trackedCharacters', deleted: false, ocid: 'x', sortOrder: 5, isRepresentative: true }], {
      firstQueuedAt: QUEUED_AT,
    })

    expect(await json('trackedCharacters')).toEqual(['z', 'x'])
    await expect(prefs.get('representativeCharacter')).resolves.toBeNull()
    expect(queue()).toEqual(['trackedCharacters:z', 'trackedCharacters:x'])
  })
})
