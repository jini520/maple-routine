/// <reference types="node" />
/**
 * 1.0.15 기기 변환의 Preferences 단계. 1.0.14 모양의 값을 심고 변환을 돌려, 새 모양으로 적히고 저장소가 변환 전과 같은 값으로
 * 되읽는지 본다. Preferences 는 트랜잭션 밖이라 두 번 돌아도 같아야 하고, 못 찾은 항목만 빠져야 한다.
 */
import { bossPayoutMeso, type CalculatorBoss } from '../../lib/boss/boss-profit-calculator'
import { bossDifficultyIdOf } from '../../lib/boss/bosses'
import { contentIdOf } from '../../lib/scheduler/contents'
import { findWorld } from '../../lib/world/worlds'
import { getBossProfitCalculatorRecords } from '../boss-profit-calculator-records'
import { getBarOrder } from '../bar-order'
import { getFigureMotions } from '../figure-motions'
import { getManualTrackedContent } from '../manual-tracked-content'
import { getMvpLastCheckedWeek, getMvpWeeklyCheckOff } from '../mvp-grade-prefs'
import { getPartyAppointments } from '../party-appointments'
import { __resetStoragePortsForTest, setSqlitePort, type SqliteDbConnection } from '../ports'
import {
  PreferencesConversionError,
  runPreferencesConversion,
  splitWorldSharedProgress,
} from '../preferences-conversion'
import { getQuickLinks } from '../quick-links'
import { getAccountSharedProgress, getWorldSharedProgress } from '../shared-progress-cache'
import { closeBossProfitDb, getBossProfitDbUngated } from '../sqlite/db'
import { createRealSqlite, type RealSqlite } from '../sqlite/__tests__/node-sqlite-port'
import { getStatsCumulativeStart } from '../stats-cumulative-start'
import { getTrackingMode } from '../tracking-mode'
import { installFakePreferences, type FakePreferences } from './fake-preferences'

let prefs: FakePreferences
let real: RealSqlite
let db: SqliteDbConnection

beforeEach(async () => {
  prefs = installFakePreferences()
  real = createRealSqlite()
  setSqlitePort(real.port)
  db = await getBossProfitDbUngated()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

async function setJson(key: string, value: unknown): Promise<void> {
  await prefs.set(key, JSON.stringify(value))
}

async function json(key: string): Promise<unknown> {
  const raw = await prefs.get(key)
  return raw === null ? null : JSON.parse(raw)
}

/** 저장된 값 전부. 두 번 돌린 결과를 견준다. */
async function snapshot(): Promise<Record<string, string | null>> {
  const keys = (await prefs.keys()).sort()
  return Object.fromEntries(await Promise.all(keys.map(async (key) => [key, await prefs.get(key)] as const)))
}

function bossId(bossKey: string, difficulty: string): string {
  return bossDifficultyIdOf(bossKey, difficulty)!
}

function contentId(key: string): string {
  return contentIdOf(key)!
}

function worldId(key: string): string {
  return findWorld(key)!.id
}

describe('수동 추적 항목', () => {
  // 이름으로 적힌 옛 항목은 1.0.14 가 읽을 때 옮기던 규칙으로 key 를 얻은 뒤 줄 id 로 바꾼다. 최대 횟수는 읽는 곳이 없어 버린다.
  it('key · 이름 · 옛 content 종류 · 한글 난이도 항목을 종류와 줄 id 로 옮기고 최대 횟수를 버린다', async () => {
    await setJson('manualTrackedContent:ocid-1', [
      { contentName: '몬스터파크', kind: 'content', maxCount: 14 },
      { contentName: '에픽던전:하이마운틴', kind: 'weekly' },
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
      { contentName: '루시드', kind: 'boss', difficulty: '이지' },
      { kind: 'boss', bossKey: 'black_mage', difficulty: 'extreme' },
    ])

    await runPreferencesConversion(db)

    expect(await json('manualTrackedContent:ocid-1')).toEqual([
      { type: 'daily', targetId: contentId('monster_park') },
      { type: 'weekly', targetId: contentId('epic_dungeon_high_mountain') },
      { type: 'weekly', targetId: contentId('mu_lung_dojo') },
      { type: 'boss', targetId: bossId('lucid', 'easy') },
      { type: 'boss', targetId: bossId('black_mage', 'extreme') },
    ])
    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([
      { contentKey: 'monster_park', kind: 'daily' },
      { contentKey: 'epic_dungeon_high_mountain', kind: 'weekly' },
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
      { kind: 'boss', bossKey: 'lucid', difficulty: 'easy' },
      { kind: 'boss', bossKey: 'black_mage', difficulty: 'extreme' },
    ])
  })

  // 서버의 유일 기준이 캐릭터 · 종류 · 대상이다. 같은 컨텐츠를 이름과 key 로 두 번 적은 옛 목록이 그렇다.
  it('표에서 못 찾는 항목은 빠지고, 종류 · 대상이 같은 항목은 앞의 것만 남는다', async () => {
    await setJson('manualTrackedContent:ocid-1', [
      { contentName: '없어진 컨텐츠', kind: 'weekly' },
      { contentName: '카이', kind: 'boss', difficulty: '노멀' },
      { contentName: '루시드', kind: 'boss', difficulty: '헬' },
      { contentName: '무릉도장', kind: 'weekly' },
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
    ])

    await runPreferencesConversion(db)

    expect(await json('manualTrackedContent:ocid-1')).toEqual([{ type: 'weekly', targetId: contentId('mu_lung_dojo') }])
  })
})

describe('공유 진행', () => {
  const daily = { active: true, kind: 'contents', nowCount: 7, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-21' }
  const weekly = { active: false, kind: 'quest', nowCount: 0, maxCount: 1, questState: 1, lastUpdatedBucket: '2026-07-16' }

  // 종류는 컨텐츠 줄에 있어 적지 않는다. 기간은 그 컨텐츠의 주기로 일간은 날짜, 주간은 주차 값이다.
  it('열쇠를 컨텐츠 줄 id 로, 등록을 isRegistered 로, 기간을 컨텐츠 주기의 기간 값으로 바꾸고 종류를 버린다', async () => {
    await setJson('accountSharedProgress:maple-a', {
      '에픽 던전 : 하이마운틴': weekly,
      epic_dungeon_nightmare_paradise: weekly,
      없어진컨텐츠: weekly,
    })
    await setJson('worldSharedProgress:maple-a:elysium', { monster_park: daily, maple_union_weekly_dragon: weekly })

    await runPreferencesConversion(db)

    const stored = { isRegistered: false, nowCount: 0, maxCount: 1, questState: 1, periodCode: 'W202629' }
    expect(await json('accountSharedProgress:maple-a')).toEqual({
      [contentId('epic_dungeon_high_mountain')]: stored,
      [contentId('epic_dungeon_nightmare_paradise')]: stored,
    })
    expect(await json(`worldSharedProgress:maple-a:${worldId('elysium')}`)).toEqual({
      [contentId('monster_park')]: { isRegistered: true, nowCount: 7, maxCount: 14, questState: null, periodCode: 'D20260721' },
      [contentId('maple_union_weekly_dragon')]: { ...stored, periodCode: 'W202629' },
    })
    expect(await prefs.get('worldSharedProgress:maple-a:elysium')).toBeNull()
    await expect(getWorldSharedProgress('maple-a', 'elysium')).resolves.toEqual({
      monster_park: daily,
      maple_union_weekly_dragon: weekly,
    })
    await expect(getAccountSharedProgress('maple-a')).resolves.toEqual({
      epic_dungeon_high_mountain: { ...weekly, kind: 'contents' },
      epic_dungeon_nightmare_paradise: { ...weekly, kind: 'contents' },
    })
  })

  // 월드 줄 id 로 가리킬 수 없는 원장은 읽는 코드가 닿지 못한다.
  it('월드 표에 없는 월드의 원장은 지운다', async () => {
    await setJson('worldSharedProgress:maple-a:없어진월드', { monster_park: daily })

    await runPreferencesConversion(db)

    expect(await prefs.get('worldSharedProgress:maple-a:없어진월드')).toBeNull()
  })
})

describe('월드로만 묶던 옛 원장 나누기', () => {
  const entry = { active: true, kind: 'contents', nowCount: 7, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-21' }
  const converted = { isRegistered: true, nowCount: 7, maxCount: 14, questState: null, periodCode: 'D20260721' }

  async function sighting(ocid: string, accountId: string, lastSeen: string, worldKey: string | null): Promise<void> {
    await db.run(
      `INSERT INTO character_accounts (ocid, name, account_id, nexon_account_id, first_seen_date, last_seen_date, world_key)
       VALUES (?, ?, ?, 'account-main', ?, ?, ?)`,
      [ocid, `이름-${ocid}`, accountId, lastSeen, lastSeen, worldKey],
    )
  }

  async function profile(ocid: string, worldKey: string): Promise<void> {
    await db.run(
      `INSERT INTO character_profiles (ocid, name, image_url, world, world_key, updated_at) VALUES (?, ?, '', ?, ?, '2026-11-20')`,
      [ocid, `이름-${ocid}`, findWorld(worldKey)!.name, worldKey],
    )
  }

  // 넥슨 목록을 기다리지 않고 기기에 있는 소속 기록으로 나눈다. 1.0.13 까지의 소속 기록은 월드가 비어 프로필의 월드를 쓴다.
  it('추적 캐릭터를 가장 늦게 본 소속 기록의 메이플 ID 와 월드(없으면 프로필의 월드)로 새 모양으로 베끼고 옛 원장을 지운다', async () => {
    await setJson('trackedCharacters', ['ocid-1', 'ocid-2'])
    await sighting('ocid-1', 'maple-old', '2026-10-01', 'elysium')
    await sighting('ocid-1', 'maple-a', '2026-11-01', 'elysium')
    await sighting('ocid-2', 'maple-b', '2026-11-01', null)
    await profile('ocid-2', 'elysium')
    await setJson('worldSharedProgress:elysium', { monster_park: entry })
    await setJson('worldSharedProgress:스카니아', { monster_park: entry })
    // 새 원장에 이미 적힌 항목이 이긴다.
    const fresh = { ...converted, nowCount: 1 }
    await setJson(`worldSharedProgress:maple-a:${worldId('elysium')}`, { [contentId('monster_park')]: fresh })

    await runPreferencesConversion(db)

    expect(await json(`worldSharedProgress:maple-a:${worldId('elysium')}`)).toEqual({ [contentId('monster_park')]: fresh })
    expect(await json(`worldSharedProgress:maple-b:${worldId('elysium')}`)).toEqual({ [contentId('monster_park')]: converted })
    expect(await prefs.get(`worldSharedProgress:maple-old:${worldId('elysium')}`)).toBeNull()
    expect(await prefs.get('worldSharedProgress:elysium')).toBeNull()
    expect(await prefs.get('worldSharedProgress:스카니아')).toBeNull()
    expect(await prefs.get('worldSharedProgressSplit')).not.toBeNull()
  })

  // 빠진 메이플 ID 는 옛 원장을 받지 못한다. 버리지 않고 남겨, 모든 계정의 목록을 받은 스케줄 회차가 나누게 한다.
  it('메이플 ID 나 월드를 못 찾은 추적 캐릭터가 있으면 옛 원장을 남기고, 스케줄 회차의 나누기가 새 모양으로 베낀다', async () => {
    await setJson('trackedCharacters', ['ocid-1', 'ocid-2'])
    await sighting('ocid-1', 'maple-a', '2026-11-01', 'elysium')
    await setJson('worldSharedProgress:elysium', { monster_park: entry })

    await runPreferencesConversion(db)

    expect(await json('worldSharedProgress:elysium')).toEqual({ monster_park: entry })
    expect(await prefs.get('worldSharedProgressSplit')).toBeNull()

    await splitWorldSharedProgress([{ accountId: 'maple-a', worldKey: 'elysium' }, { accountId: 'maple-b', worldKey: 'elysium' }])

    expect(await json(`worldSharedProgress:maple-b:${worldId('elysium')}`)).toEqual({ [contentId('monster_park')]: converted })
    expect(await prefs.get('worldSharedProgress:elysium')).toBeNull()
  })

  it('옛 원장이 없으면 표식만 적는다', async () => {
    await runPreferencesConversion(db)

    expect(await prefs.get('worldSharedProgressSplit')).not.toBeNull()
  })
})

describe('파티 약속', () => {
  const boss = (bossKey: string, difficulty: string, ocid = 'ocid-1') => ({ bossKey, difficulty, ocid })
  const legacy = {
    id: '3f2b6c1e-8d4a-4c2f-9b1e-5a7d0c9e2f41',
    bosses: [boss('limbo', 'hard'), boss('없는보스', 'hard')],
    members: [],
    timeKst: '21:00',
    durationMinutes: 30,
    leadMinutes: 10,
    schedule: { type: 'weekly', weekday: 4, fromWeek: '2026-09-24', untilWeek: '2026-11-19' },
    exceptions: {
      '2026-10-01': { type: 'override', dateKey: '2026-10-02', timeKst: '22:00', durationMinutes: 60, bosses: [boss('bardrix', 'hard')], leadMinutes: null },
      '2026-10-08': { type: 'override', dateKey: '2026-10-08', timeKst: '22:00', durationMinutes: 60, bosses: [boss('없는보스', 'hard')], leadMinutes: null },
    },
    memo: '2번 방',
  }

  // 보스는 난이도 줄 id, 주는 주차 값이다. 파티원과 예외 종류는 화면이 없거나 값이 하나뿐이라 버린다.
  it('칸 이름을 서버와 같게 바꾸고, 못 찾은 보스와 보스가 다 빠진 예외 · 약속을 뺀다', async () => {
    const onlyUnknown = { ...legacy, id: '1d6c9a44-3b2f-4e8a-9c71-0f5e2d8b6a13', bosses: [boss('없는보스', 'hard')] }
    const once = {
      ...legacy,
      id: '7a1e5c2d-9f4b-4d3a-8e6c-2b1f0a9d7c55',
      schedule: { type: 'once', dateKey: '2026-11-21' },
      exceptions: {},
      memo: undefined,
    }
    const malformed = { ...legacy, id: 'bad', timeKst: 2100 }
    await setJson('partyAppointments', [legacy, onlyUnknown, once, malformed])

    await runPreferencesConversion(db)

    expect(await json('partyAppointments')).toEqual([
      {
        id: legacy.id,
        bosses: [{ bossDifficultyId: bossId('limbo', 'hard'), ocid: 'ocid-1' }],
        time: '21:00',
        durationMinutes: 30,
        alarmMinutesBefore: 10,
        schedule: { type: 'weekly', weekday: 4, fromWeekCode: 'W202639', untilWeekCode: 'W202647' },
        exceptions: {
          W202640: {
            date: '2026-10-02',
            time: '22:00',
            durationMinutes: 60,
            bosses: [{ bossDifficultyId: bossId('bardrix', 'hard'), ocid: 'ocid-1' }],
            alarmMinutesBefore: null,
          },
        },
        memo: '2번 방',
      },
      {
        id: once.id,
        bosses: [{ bossDifficultyId: bossId('limbo', 'hard'), ocid: 'ocid-1' }],
        time: '21:00',
        durationMinutes: 30,
        alarmMinutesBefore: 10,
        schedule: { type: 'once', date: '2026-11-21' },
        exceptions: {},
      },
    ])
    const [read] = await getPartyAppointments()
    expect(read).toEqual({
      id: legacy.id,
      bosses: [boss('limbo', 'hard')],
      timeKst: '21:00',
      durationMinutes: 30,
      leadMinutes: 10,
      schedule: { type: 'weekly', weekday: 4, fromWeek: '2026-09-24', untilWeek: '2026-11-19' },
      exceptions: {
        '2026-10-01': { dateKey: '2026-10-02', timeKst: '22:00', durationMinutes: 60, bosses: [boss('bardrix', 'hard')], leadMinutes: null },
      },
      memo: '2번 방',
    })
  })
})

describe('보스 수익 계산기 기록', () => {
  const even = { myShare: null, sharesTotal: null, splitFeePercent: null }

  // 분배 칸은 분배 설정과 같은 규칙이다. 계산기는 수수료 자동을 저장하지 않아 요율이 있으면 손으로 고른 값이다.
  it('보스를 난이도 줄 id 와 분배 칸 다섯으로 바꾸고, 못 찾은 보스를 뺀 뒤 보스가 하나도 안 남은 기록을 지운다', async () => {
    await setJson('bossProfitCalculatorRecords', [
      {
        id: 'rec-1',
        savedAt: '2026-11-17T00:00:00.000Z',
        characters: [
          {
            ocid: 'ocid-1',
            bosses: [
              { bossKey: 'lucid', difficulty: 'hard', partySize: 3, shares: even },
              { bossKey: 'will', difficulty: 'hard', partySize: 2, shares: { myShare: 2, sharesTotal: 3, splitFeePercent: 3 } },
              { bossKey: '없는보스', difficulty: 'hard', partySize: 1, shares: even },
            ],
          },
          { ocid: 'ocid-2', bosses: [] },
        ],
      },
      {
        id: 'rec-2',
        savedAt: '2026-11-16T00:00:00.000Z',
        characters: [{ ocid: 'ocid-1', bosses: [{ bossKey: '없는보스', difficulty: 'hard', partySize: 1, shares: even }] }],
      },
    ])

    await runPreferencesConversion(db)

    expect(await json('bossProfitCalculatorRecords')).toEqual([
      {
        id: 'rec-1',
        savedAt: '2026-11-17T00:00:00.000Z',
        characters: [
          {
            ocid: 'ocid-1',
            bosses: [
              {
                bossDifficultyId: bossId('lucid', 'hard'),
                splitType: 'even',
                partySize: 3,
                splitShareMillipercent: null,
                splitFeePercent: null,
                splitFeeFollowsMvpGrade: true,
              },
              {
                bossDifficultyId: bossId('will', 'hard'),
                splitType: 'ratio',
                partySize: 2,
                splitShareMillipercent: 66_667,
                splitFeePercent: 3,
                splitFeeFollowsMvpGrade: false,
              },
            ],
          },
          { ocid: 'ocid-2', bosses: [] },
        ],
      },
    ])
    const [record] = await getBossProfitCalculatorRecords()
    expect(record!.characters[0]!.bosses).toEqual([
      { bossKey: 'lucid', difficulty: 'hard', partySize: 3, shares: { ...even, splitFeeAuto: true } },
      {
        bossKey: 'will',
        difficulty: 'hard',
        partySize: 2,
        shares: { myShare: 66_667, sharesTotal: 100_000, splitFeePercent: 3, splitFeeAuto: false },
      },
    ])
  })

  // 계산기 기록은 금액을 남기지 않고 열 때마다 분배 칸으로 다시 센다. 분배 칸을 바꿨다고 지난 기록의 금액이 달라지면 안 된다.
  it('균등 분배와 % 로 나눠떨어지는 비율은 변환 뒤에 센 금액이 변환 전 모양으로 센 금액과 같다', async () => {
    const now = new Date('2026-11-20T03:00:00.000Z')
    const legacyBosses: CalculatorBoss[] = [
      { bossKey: 'lucid', difficulty: 'hard', partySize: 3, shares: even },
      { bossKey: 'will', difficulty: 'hard', partySize: 2, shares: { myShare: 2, sharesTotal: 5, splitFeePercent: 3 } },
      { bossKey: 'lotus', difficulty: 'hard', partySize: 2, shares: { myShare: 1, sharesTotal: 4, splitFeePercent: null } },
    ]
    await setJson('bossProfitCalculatorRecords', [
      { id: 'rec-1', savedAt: '2026-11-17T00:00:00.000Z', characters: [{ ocid: 'ocid-1', bosses: legacyBosses }] },
    ])
    const before = legacyBosses.map((boss) => bossPayoutMeso(boss, now, 5))

    await runPreferencesConversion(db)

    const [record] = await getBossProfitCalculatorRecords()
    const converted = record!.characters[0]!.bosses
    expect(converted.map((boss) => boss.shares.sharesTotal)).toEqual([null, 100_000, 100_000])
    expect(before).not.toContain(0)
    expect(converted.map((boss) => bossPayoutMeso(boss, now, 5))).toEqual(before)
  })
})

describe('칸 이름 · 키 이름만 바뀌는 값', () => {
  it('빠른 이동 · 하단바 · 대표 캐릭터 동작의 칸 이름을 바꾸고, 저장소는 변환 전과 같은 값으로 읽는다', async () => {
    const quickLinks = { rows: 2, ids: ['profit', 'stats'] }
    const barOrder = { groups: ['today', 'content'], subs: { content: ['Content', 'Boss'] } }
    const motion = { actions: ['A00'], emotions: ['E00'], durationMs: 5000, rest: true }
    await setJson('quickLinks', quickLinks)
    await setJson('barOrder', barOrder)
    await setJson('figureMotions', { 'ocid-1': motion })

    await runPreferencesConversion(db)

    expect(await json('quickLinks')).toEqual({ rowCount: 2, keys: ['profit', 'stats'] })
    expect(await json('barOrder')).toEqual({ groupKeys: barOrder.groups, subPageKeys: barOrder.subs })
    expect(await json('figureMotions')).toEqual({
      'ocid-1': { actions: ['A00'], emotions: ['E00'], durationMs: 5000, restsBetweenActions: true },
    })
    await expect(getQuickLinks()).resolves.toEqual(quickLinks)
    await expect(getBarOrder()).resolves.toEqual(barOrder)
    await expect(getFigureMotions()).resolves.toEqual({ 'ocid-1': motion })
  })

  // 마지막으로 확인한 주는 주차 값으로 적는다. 목요일이 아니면 주차 값으로 바꿀 수 없어 옮기지 않는다.
  it('설정 키 다섯을 새 키로 옮기고 옛 키를 지운다. 마지막 확인 주는 주차 값이고, 목요일이 아니면 옮기지 않는다', async () => {
    await prefs.set('trackingMode', 'manual')
    await prefs.set('statsCumulativeStart', '2026-10-05')
    await prefs.set('mvpLastCheckedWeek', '2026-11-19')
    await prefs.set('mvpWeeklyCheckOff', 'true')
    await prefs.set('mvpBulkApplyAsked', 'true')

    await runPreferencesConversion(db)

    expect(await snapshot()).toMatchObject({
      trackingType: 'manual',
      statsCumulativeStartDate: '2026-10-05',
      mvpLastCheckedWeekCode: 'W202647',
      isMvpWeeklyCheckOff: 'true',
      isMvpBulkApplyAsked: 'true',
    })
    for (const key of ['trackingMode', 'statsCumulativeStart', 'mvpLastCheckedWeek', 'mvpWeeklyCheckOff', 'mvpBulkApplyAsked']) {
      expect(await prefs.get(key)).toBeNull()
    }
    await expect(getTrackingMode()).resolves.toBe('manual')
    await expect(getStatsCumulativeStart()).resolves.toBe('2026-10-05')
    await expect(getMvpLastCheckedWeek()).resolves.toBe('2026-11-19')
    await expect(getMvpWeeklyCheckOff()).resolves.toBe(true)

    await prefs.remove('preferencesConversion')
    await prefs.set('mvpLastCheckedWeek', '2026-11-18')
    await runPreferencesConversion(db)

    expect(await prefs.get('mvpLastCheckedWeek')).toBeNull()
    expect(await prefs.get('mvpLastCheckedWeekCode')).toBe('W202647')
  })
})

// 과거 드롭을 묶음으로 올리던 진행이다. 1.0.15 에는 그 경로가 없고 읽는 코드도 없어, 남기면 기기에 쓸모없는 값이 남는다.
it('옛 과거 드롭 올리기의 진행(serverBackfill)을 지운다', async () => {
  await setJson('serverBackfill', { dropPriceOwner: { after: 'drop-9', done: false } })

  await runPreferencesConversion(db)

  expect(await prefs.get('serverBackfill')).toBeNull()
})

describe('여러 번 돌리기', () => {
  async function seedLegacy(): Promise<void> {
    await setJson('manualTrackedContent:ocid-1', [{ contentName: '몬스터파크', kind: 'daily' }])
    await setJson('accountSharedProgress:maple-a', {
      epic_dungeon_nightmare_paradise: { active: true, kind: 'contents', nowCount: 1, maxCount: 1, questState: null, lastUpdatedBucket: '2026-07-16' },
    })
    await setJson('quickLinks', { rows: 1, ids: ['profit'] })
    await prefs.set('trackingMode', 'auto')
  }

  // 트랜잭션 밖이라 도중에 꺼지면 처음부터 다시 돈다. 이미 바꾼 키를 다시 바꾸면 줄 id 를 key 로 읽어 항목이 사라진다.
  it('표식을 지우고 다시 돌려도 결과가 같다', async () => {
    await seedLegacy()

    await runPreferencesConversion(db)
    const once = await snapshot()
    await prefs.remove('preferencesConversion')
    await runPreferencesConversion(db)

    expect(await snapshot()).toEqual(once)
    expect(once.preferencesConversion).toBe('1')
  })

  it('표식이 이 판이면 돌지 않는다', async () => {
    await prefs.set('preferencesConversion', '1')
    await seedLegacy()

    await runPreferencesConversion(db)

    expect(await prefs.get('trackingMode')).toBe('auto')
  })

  // 실패하면 표식을 적지 않아 다음에 켤 때 다시 돈다. 사용 로그는 SQLite 단계와 가른다.
  it('도중에 던지면 표식 없이 PreferencesConversionError 로 던진다', async () => {
    await seedLegacy()
    prefs.set.mockRejectedValueOnce(new Error('disk full'))

    await expect(runPreferencesConversion(db)).rejects.toBeInstanceOf(PreferencesConversionError)
    expect(await prefs.get('preferencesConversion')).toBeNull()
  })
})
