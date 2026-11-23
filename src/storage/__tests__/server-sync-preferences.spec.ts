/// <reference types="node" />
/**
 * Preferences 에 든 기록의 저장 함수가 바뀐 항목을 대기 표에 넣는지 진짜 SQLite 와 가짜 Preferences 로 본다.
 *
 * 목록을 통째로 저장하는 함수가 많아, 앞 값과 견주지 않으면 지운 항목을 알 수 없다. 바뀌지 않은 항목까지 넣으면 같은 값이 올라가
 * 서버의 변경 번호만 오르고 모든 기기가 그 줄을 다시 받는다.
 */
import { bossDifficultyIdOf } from '../../lib/boss/bosses'
import { contentIdOf } from '../../lib/scheduler/contents'
import { findWorld } from '../../lib/world/worlds'
import type { SharedProgressEntry } from '../../types'
import type { FigureMotion } from '../../types/figure-motion'
import type { PartyAppointment } from '../../types/party-appointment'
import { setBarOrder } from '../bar-order'
import { setBossProfitCalculatorRecords } from '../boss-profit-calculator-records'
import {
  clearRepresentativeCharacter,
  clearTrackedCharacterOcids,
  setRepresentativeCharacter,
  setTrackedCharacterOcids,
} from '../character-selection'
import { setFigureMotions } from '../figure-motions'
import { moveManualTrackedContentToOcid, setManualTrackedContent } from '../manual-tracked-content'
import { setMapleIdNames } from '../maple-id-names'
import { setMvpBulkApplyAsked, setMvpLastCheckedWeek, setMvpWeeklyCheckOff } from '../mvp-grade-prefs'
import { setPartyAppointments } from '../party-appointments'
import { __resetStoragePortsForTest, setSqlitePort } from '../ports'
import { setQuickLinks } from '../quick-links'
import { withServerSyncPaused } from '../server-sync-queue'
import { setAccountSharedProgressEntry, setWorldSharedProgressEntry } from '../shared-progress-cache'
import { closeBossProfitDb, getBossProfitDb } from '../sqlite/db'
import { createRealSqlite, type RealSqlite } from '../sqlite/__tests__/node-sqlite-port'
import { setStatsCumulativeStart } from '../stats-cumulative-start'
import { setTrackingMode } from '../tracking-mode'
import { installFakePreferences } from './fake-preferences'

let real: RealSqlite

beforeEach(async () => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  installFakePreferences()
  await getBossProfitDb()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

/** 대기 표의 줄. 넣은 차례대로다. */
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

describe('id 가 없는 항목', () => {
  it('메이플 ID 이름은 바뀐 메이플 ID 만 넣고, 지운 이름도 넣는다', async () => {
    await setMapleIdNames({ 'maple-1': '본캐', 'maple-2': '부캐' })
    expect(queue()).toEqual([
      ['mapleIdNames', 'mapleIdNames:maple-1'],
      ['mapleIdNames', 'mapleIdNames:maple-2'],
    ])

    clearQueue()
    await setMapleIdNames({ 'maple-1': '본캐' })
    expect(queue()).toEqual([['mapleIdNames', 'mapleIdNames:maple-2']])
  })

  it('수동 추적 항목은 캐릭터 · 종류 · 대상으로 가리키고, 리프로 옮기면 두 캐릭터의 항목을 넣는다', async () => {
    const dojo = contentIdOf('mu_lung_dojo')!
    const blackMage = bossDifficultyIdOf('black_mage', 'extreme')!
    await setManualTrackedContent('ocid-1', [
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
      { kind: 'boss', bossKey: 'black_mage', difficulty: 'extreme' },
    ])
    expect(queue()).toEqual([
      ['manualTrackedItems', `manualTrackedItems:ocid-1/weekly/${dojo}`],
      ['manualTrackedItems', `manualTrackedItems:ocid-1/boss/${blackMage}`],
    ])

    clearQueue()
    await setManualTrackedContent('ocid-1', [{ contentKey: 'mu_lung_dojo', kind: 'weekly' }])
    expect(queue()).toEqual([['manualTrackedItems', `manualTrackedItems:ocid-1/boss/${blackMage}`]])

    clearQueue()
    await moveManualTrackedContentToOcid('ocid-1', 'ocid-2')
    expect(queue()).toEqual([
      ['manualTrackedItems', `manualTrackedItems:ocid-1/weekly/${dojo}`],
      ['manualTrackedItems', `manualTrackedItems:ocid-2/weekly/${dojo}`],
    ])
  })

  it('공유 진행은 메이플 ID · 월드 · 컨텐츠로 가리키고 계정 공유는 월드가 빈 값이며, 같은 값을 다시 적으면 넣지 않는다', async () => {
    const entry: SharedProgressEntry = {
      active: true,
      kind: 'contents',
      nowCount: 7,
      maxCount: 14,
      questState: null,
      lastUpdatedBucket: '2026-07-21',
    }
    const park = contentIdOf('monster_park')!
    const elysium = findWorld('elysium')!.id
    await setWorldSharedProgressEntry('maple-1', 'elysium', 'monster_park', entry)
    await setAccountSharedProgressEntry('maple-1', 'monster_park', entry)
    expect(queue()).toEqual([
      ['sharedContentProgress', `sharedContentProgress:maple-1/${elysium}/${park}`],
      ['sharedContentProgress', `sharedContentProgress:maple-1//${park}`],
    ])

    clearQueue()
    await setWorldSharedProgressEntry('maple-1', 'elysium', 'monster_park', entry)
    expect(queue()).toEqual([])
    await setWorldSharedProgressEntry('maple-1', 'elysium', 'monster_park', { ...entry, nowCount: 8 })
    expect(queue()).toEqual([['sharedContentProgress', `sharedContentProgress:maple-1/${elysium}/${park}`]])
  })

  it('대표 캐릭터 동작은 바뀐 캐릭터만 넣는다', async () => {
    const motion: FigureMotion = { actions: ['A00'], emotions: ['E00'], durationMs: 3000, rest: true }
    await setFigureMotions({ 'ocid-1': motion, 'ocid-2': motion })
    clearQueue()

    await setFigureMotions({ 'ocid-1': motion, 'ocid-2': { ...motion, rest: false } })

    expect(queue()).toEqual([['representativeCharacterMotions', 'representativeCharacterMotions:ocid-2']])
  })
})

describe('추적 목록과 대표', () => {
  it('차례나 대표 표시가 바뀐 캐릭터만 넣는다', async () => {
    await setTrackedCharacterOcids(['ocid-1', 'ocid-2', 'ocid-3'])
    expect(queue().map(([, id]) => id)).toEqual(['trackedCharacters:ocid-1', 'trackedCharacters:ocid-2', 'trackedCharacters:ocid-3'])

    clearQueue()
    await setTrackedCharacterOcids(['ocid-2', 'ocid-1', 'ocid-3'])
    expect(queue().map(([, id]) => id)).toEqual(['trackedCharacters:ocid-1', 'trackedCharacters:ocid-2'])

    clearQueue()
    await setRepresentativeCharacter('ocid-3')
    expect(queue()).toEqual([['trackedCharacters', 'trackedCharacters:ocid-3']])

    clearQueue()
    await setTrackedCharacterOcids(['ocid-2', 'ocid-1'])
    expect(queue().map(([, id]) => id)).toEqual(['trackedCharacters:ocid-3'])
  })

  // 넣으면 새 기기의 로그인이 서버의 추적 목록을 지운다. 비운 뒤에는 서버에서 받아 채운다.
  it('로그인할 때 비우는 목록과 그 뒤의 대표 지우기는 넣지 않는다', async () => {
    await setTrackedCharacterOcids(['ocid-1', 'ocid-2'])
    await setRepresentativeCharacter('ocid-2')
    clearQueue()

    await clearTrackedCharacterOcids()
    await clearRepresentativeCharacter()

    expect(queue()).toEqual([])
  })
})

// 서버는 실은 칸과 그룹만 고친다. 칸마다 넣어야 두 기기가 다른 설정을 고쳐도 서로를 덮지 않는다.
describe('설정', () => {
  it('바뀐 칸마다 넣고 같은 값을 다시 적으면 넣지 않는다', async () => {
    await setTrackingMode('manual')
    clearQueue()
    await setTrackingMode('manual')
    expect(queue()).toEqual([])

    await setTrackingMode('auto')
    await setStatsCumulativeStart('2026-01-01')
    await setMvpWeeklyCheckOff(true)
    await setMvpLastCheckedWeek('2026-11-19')
    await setMvpBulkApplyAsked()

    expect(queue()).toEqual([
      ['accountSettings', 'accountSettings:trackingType'],
      ['accountSettings', 'accountSettings:statsCumulativeStartDate'],
      ['accountSettings', 'accountSettings:isMvpWeeklyCheckOff'],
      ['accountSettings', 'accountSettings:mvpLastCheckedWeekCode'],
      ['accountSettings', 'accountSettings:isMvpBulkApplyAsked'],
    ])
  })

  it('빠른 이동은 줄 수와 화면 목록을 칸마다 견준다', async () => {
    await setQuickLinks({ rows: 1, ids: ['boss', 'profit'] })
    clearQueue()

    await setQuickLinks({ rows: 1, ids: ['profit', 'boss'] })

    expect(queue()).toEqual([['accountSettings', 'accountSettings:quickLinkKeys']])
  })

  it('하단바 순서는 그룹 목록 칸과 하위 페이지 차례의 그룹마다 견준다', async () => {
    await setBarOrder({
      groups: ['today', 'schedule', 'ledger', 'utility', 'settings'],
      subs: { schedule: ['Appointments', 'Content', 'Boss'], ledger: ['Profit', 'Cashbook', 'Stats', 'Inventory'] },
    })
    expect(queue()).toEqual([
      ['accountSettings', 'accountSettings:barGroupKeys'],
      ['bottomBarSubPageOrders', 'bottomBarSubPageOrders:schedule'],
      ['bottomBarSubPageOrders', 'bottomBarSubPageOrders:ledger'],
    ])

    clearQueue()
    await setBarOrder({
      groups: ['today', 'schedule', 'ledger', 'utility', 'settings'],
      subs: { schedule: ['Boss', 'Content', 'Appointments'], ledger: ['Profit', 'Cashbook', 'Stats', 'Inventory'] },
    })
    expect(queue()).toEqual([['bottomBarSubPageOrders', 'bottomBarSubPageOrders:schedule']])
  })
})

describe('id 가 있는 항목', () => {
  const APPOINTMENT: PartyAppointment = {
    id: '11111111-1111-4111-8111-111111111111',
    bosses: [{ bossKey: 'black_mage', difficulty: 'extreme', ocid: 'ocid-1' }],
    timeKst: '21:00',
    durationMinutes: 60,
    leadMinutes: null,
    schedule: { type: 'weekly', weekday: 4, fromWeek: '2026-11-19', untilWeek: null },
    exceptions: {},
  }

  it('약속은 바뀐 약속의 id 를 넣고, uuid 가 아닌 옛 id 는 넣지 않는다', async () => {
    await setPartyAppointments([APPOINTMENT, { ...APPOINTMENT, id: '1700000000000-abc' }])
    expect(queue()).toEqual([['partyAppointments', APPOINTMENT.id]])

    clearQueue()
    await setPartyAppointments([{ ...APPOINTMENT, timeKst: '22:00' }])
    expect(queue()).toEqual([['partyAppointments', APPOINTMENT.id]])
  })

  it('계산기 기록은 바뀐 기록의 id 를 넣는다', async () => {
    const record = { id: '22222222-2222-4222-8222-222222222222', savedAt: '2026-11-20T12:00:00.000Z', characters: [] }
    await setBossProfitCalculatorRecords([record])
    clearQueue()

    await setBossProfitCalculatorRecords([record, { ...record, id: '33333333-3333-4333-8333-333333333333' }])
    await setBossProfitCalculatorRecords([{ ...record, id: '33333333-3333-4333-8333-333333333333' }])

    expect(queue()).toEqual([
      ['bossProfitCalculatorRecords', '33333333-3333-4333-8333-333333333333'],
      ['bossProfitCalculatorRecords', record.id],
    ])
  })
})

// 받은 값을 저장하는 동안 넣으면 받은 값을 다시 올린다.
it('`withServerSyncPaused` 안의 저장은 넣지 않는다', async () => {
  await withServerSyncPaused(async () => {
    await setMapleIdNames({ 'maple-1': '본캐' })
    await setTrackingMode('auto')
  })

  expect(queue()).toEqual([])
})
