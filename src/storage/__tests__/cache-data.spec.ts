/// <reference types="node" />
/**
 * 데이터 삭제가 고른 그룹의 목록만 지우는지 진짜 SQLite 와 가짜 Preferences 로 본다.
 *
 * 목록에 없는 것은 어떤 선택에서도 남아야 한다. 화면에 적지 않은 것을 함께 지우면 사용자가 모르는 것을 잃는다.
 */
import { installFakePreferences, type FakePreferences } from './fake-preferences'
import { clearCacheData, getCacheDataCounts, type CacheDataSelection } from '../cache-data'
import { __resetStoragePortsForTest, setSqlitePort } from '../ports'
import { closeBossProfitDb, getBossProfitDb } from '../sqlite/db'
import { createRealSqlite, type RealSqlite } from '../sqlite/__tests__/node-sqlite-port'

let real: RealSqlite
let prefs: FakePreferences

beforeEach(async () => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  prefs = installFakePreferences()
  await getBossProfitDb()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const NONE: CacheDataSelection = { manual: false, boss: false, cashbook: false, enhancement: false, cache: false }
const ALL: CacheDataSelection = { manual: true, boss: true, cashbook: true, enhancement: true, cache: true }

let seq = 0

/** CHECK 제약이 있는 칸은 아무 글자나 못 넣어 맞는 값을 준다. */
const CHECKED_VALUES: Record<string, string> = { entry_type: 'income' }

/** NOT NULL 칸만 채운 줄 하나를 넣는다. 이 파일은 줄이 남았는가 만 보므로 값의 뜻은 따지지 않는다. */
function insertRow(table: string, values: Record<string, string | number> = {}): void {
  real.inspect((db) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string
      type: string
      notnull: number
      dflt_value: unknown
      pk: number
    }[]
    const row: Record<string, string | number> = {}
    for (const column of columns) {
      if (column.name in values) {
        row[column.name] = values[column.name]!
        continue
      }
      if ((column.notnull === 0 && column.pk === 0) || column.dflt_value !== null) continue
      if (column.name in CHECKED_VALUES) {
        row[column.name] = CHECKED_VALUES[column.name]!
        continue
      }
      seq += 1
      row[column.name] = /INT|REAL|NUM/i.test(column.type) ? seq : `${column.name}-${seq}`
    }
    const names = Object.keys(row)
    // 부모 줄 없이 자식 줄만 넣으므로 이 연결에서만 외래키 검사를 끈다. 앱 연결은 그대로 켜져 있다.
    db.exec('PRAGMA foreign_keys = OFF')
    db.prepare(`INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`).run(
      ...names.map((name) => row[name]!),
    )
    db.exec('PRAGMA foreign_keys = ON')
  })
}

function count(table: string): number {
  return real.inspect((db) => (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n)
}

const MANUAL_KEYS = [
  'manualTrackedContent:o1',
  'worldSharedProgress:scania',
  'accountSharedProgress:a1',
  'lastHunts',
  'lastHuntSelection',
  'lastHuntToggles',
  'lastPointRate',
]

const CACHE_KEYS = ['schedulerCache:o1', 'characterBasicCache:o1', 'mesoRateCache:o1', 'eventWorldNames']

const KEPT_KEYS = [
  'authMethods',
  'apiKey',
  'theme',
  'trackingMode',
  'trackedCharacters',
  'representativeCharacter',
  'enhancementTotalsMoved',
  'legacyCleanupDone',
  'partyAppointments',
  'scheduleProbe:o1',
  'dataFetchedAt',
  'notices',
  'serverBackfill',
  'lastRunBundleVersion',
]

const KEPT_TABLES = [
  'game_data_sections',
  'character_profiles',
  'character_accounts',
  'mvp_grade_history',
  'enhancement_history',
  'income_records',
  'spend_records',
]

async function seedAll(): Promise<void> {
  for (const key of [...MANUAL_KEYS, ...CACHE_KEYS, ...KEPT_KEYS]) await prefs.set(key, 'v')
  for (const table of [
    'cashbook_entries',
    'cashbook_entry_items',
    'enhancement_totals',
    'enhancement_history_checks',
    'server_sync_queue',
    'query_cache',
    ...KEPT_TABLES,
  ]) {
    insertRow(table)
  }
}

async function remainingKeys(): Promise<string[]> {
  return (await prefs.keys()).sort()
}

describe('clearCacheData', () => {
  it('아무 그룹도 고르지 않으면 아무것도 지우지 않는다', async () => {
    await seedAll()
    const before = real.statements.length

    await clearCacheData(NONE)

    expect(real.statements.slice(before).filter((statement) => /DELETE|UPDATE|VACUUM/.test(statement))).toEqual([])
    expect(await remainingKeys()).toEqual([...MANUAL_KEYS, ...CACHE_KEYS, ...KEPT_KEYS].sort())
  })

  it('수동 선택 항목은 그 키만 지우고 표는 기록을 건드리지 않는다', async () => {
    await seedAll()

    await clearCacheData({ ...NONE, manual: true })

    expect(await remainingKeys()).toEqual([...CACHE_KEYS, ...KEPT_KEYS].sort())
    expect([count('cashbook_entries'), count('enhancement_totals')]).toEqual([1, 1])
  })

  it('가계부는 가계부 표만 비운다', async () => {
    await seedAll()

    await clearCacheData({ ...NONE, cashbook: true })

    expect([count('cashbook_entries'), count('cashbook_entry_items')]).toEqual([0, 0])
    expect([count('enhancement_totals'), count('enhancement_history_checks')]).toEqual([1, 1])
    expect(await remainingKeys()).toEqual([...MANUAL_KEYS, ...CACHE_KEYS, ...KEPT_KEYS].sort())
  })

  // 확인 기록만 남으면 그 날짜를 다시 부르지 않아 합계가 빈 채로 굳는다.
  it('강화는 합계와 확인 기록을 함께 비운다', async () => {
    await seedAll()

    await clearCacheData({ ...NONE, enhancement: true })

    expect([count('enhancement_totals'), count('enhancement_history_checks')]).toEqual([0, 0])
    expect(count('cashbook_entries')).toBe(1)
  })

  it('다섯 그룹을 다 골라도 목록에 없는 키 · 표는 남는다', async () => {
    await seedAll()

    await clearCacheData(ALL)

    expect(await remainingKeys()).toEqual([...KEPT_KEYS].sort())
    expect(KEPT_TABLES.map(count)).toEqual(KEPT_TABLES.map(() => 1))
  })

  it('캐시는 쿼리 캐시 표와 그 키만 지운다', async () => {
    await seedAll()

    await clearCacheData({ ...NONE, cache: true })

    expect(count('query_cache')).toBe(0)
    expect(await remainingKeys()).toEqual([...MANUAL_KEYS, ...KEPT_KEYS].sort())
    expect([count('cashbook_entries'), count('enhancement_totals')]).toEqual([1, 1])
  })

  // 대기 표가 남으면 방금 지운 기록마다 지우기 요청이 서버로 간다. 서버 사본은 남긴다.
  it.each(['manual', 'boss', 'cashbook', 'enhancement'] as const)('%s 을 고르면 서버 전송 대기 표를 비운다', async (group) => {
    await seedAll()

    await clearCacheData({ ...NONE, [group]: true })

    expect(count('server_sync_queue')).toBe(0)
  })

  // 기록이 그대로라 지우기 요청이 생기지 않는다. 비우면 아직 못 보낸 드롭 시세가 사라진다.
  it('캐시만 고르면 서버 전송 대기 표를 남긴다', async () => {
    await seedAll()

    await clearCacheData({ ...NONE, cache: true })

    expect(count('server_sync_queue')).toBe(1)
  })

  describe('옛 프로필', () => {
    const basicEntry = (name: string): string =>
      JSON.stringify({
        profile: { name, level: 285, imageUrl: 'https://example.test/a.png', accessFlag: true, world: '루나', worldKey: 'luna', jobClass: '레테' },
        cachedAt: '2026-08-01T00:00:00.000Z',
      })
    const profileNames = (): Record<string, string> =>
      real.inspect((db) =>
        Object.fromEntries(
          (db.prepare('SELECT ocid, name FROM character_profiles').all() as { ocid: string; name: string }[]).map((row) => [
            row.ocid,
            row.name,
          ]),
        ),
      )

    // 이 키가 이름이 남은 마지막 자리인 캐릭터가 있다. 그냥 지우면 가계부 · 드롭 이력에서 줄이 사라진다.
    it('캐시가 옛 키를 지우기 전에 표에 없는 캐릭터를 표에 심는다', async () => {
      await prefs.set('characterBasicCache:untracked', basicEntry('옛추적'))

      await clearCacheData({ ...NONE, cache: true })

      expect(profileNames()).toEqual({ untracked: '옛추적' })
      expect(await prefs.get('characterBasicCache:untracked')).toBeNull()
      expect(
        real.inspect((db) => db.prepare('SELECT world_key, job_class, updated_at FROM character_profiles').get()),
      ).toEqual({ world_key: 'luna', job_class: '레테', updated_at: '2026-08-01T00:00:00.000Z' })
    })

    it('표에 있는 캐릭터는 덮지 않는다. 옛 키의 값이 더 오래됐다', async () => {
      insertRow('character_profiles', { ocid: 'tracked', name: '새이름' })
      await prefs.set('characterBasicCache:tracked', basicEntry('옛이름'))

      await clearCacheData({ ...NONE, cache: true })

      expect(profileNames()).toEqual({ tracked: '새이름' })
    })

    // 이름이 빈 행을 심으면 화면에 이름 없는 줄이 선다.
    it('이름이 비었거나 상한 값 · 계정별 인덱스 키는 심지 않고 지운다', async () => {
      await prefs.set('characterBasicCache:empty', basicEntry(''))
      await prefs.set('characterBasicCache:broken', '{{{')
      await prefs.set('characterBasicCache:index:account-1', '["ocid-1"]')

      await clearCacheData({ ...NONE, cache: true })

      expect(profileNames()).toEqual({})
      expect(await remainingKeys()).toEqual([])
    })

    it('캐시를 안 고르면 옛 키를 표에 옮기지 않는다', async () => {
      await prefs.set('characterBasicCache:untracked', basicEntry('옛추적'))

      await clearCacheData({ ...NONE, cashbook: true })

      expect(profileNames()).toEqual({})
      expect(await prefs.get('characterBasicCache:untracked')).not.toBeNull()
    })

    // 표에 못 심었는데 키를 지우면 그 이름은 어디에도 안 남는다.
    it('표 지우기가 실패하면 옛 키가 남는다', async () => {
      await prefs.set('characterBasicCache:untracked', basicEntry('옛추적'))
      real.inspect((db) => db.exec('DROP TABLE query_cache'))

      await expect(clearCacheData({ ...NONE, cache: true })).rejects.toThrow()

      expect(await prefs.get('characterBasicCache:untracked')).not.toBeNull()
      expect(profileNames()).toEqual({})
    })
  })

  it('표 지우기가 중간에 실패하면 앞에서 지운 표도 되돌아간다', async () => {
    await seedAll()
    // 강화 표 하나를 없애 그 문장에서 실패하게 한다. 가계부 표는 그보다 앞에서 지워진다.
    real.inspect((db) => db.exec('DROP TABLE enhancement_recomputes'))

    await expect(clearCacheData({ ...NONE, cashbook: true, enhancement: true })).rejects.toThrow()

    expect([count('cashbook_entries'), count('enhancement_totals')]).toEqual([1, 1])
  })

  // 행을 지워도 SQLite 는 그 공간을 파일 안에 남긴다. 트랜잭션 안에서는 VACUUM 이 돌지 않는다.
  it('지운 뒤 트랜잭션 밖에서 VACUUM 을 부른다', async () => {
    await seedAll()
    const before = real.statements.length

    await clearCacheData({ ...NONE, cashbook: true })

    const after = real.statements.slice(before)
    expect(after.indexOf('VACUUM')).toBeGreaterThan(after.indexOf('COMMIT'))
  })
})

describe('getCacheDataCounts', () => {
  it('그룹마다 지울 기록의 건수를 센다', async () => {
    await prefs.set('manualTrackedContent:o1', '[]')
    await prefs.set('manualTrackedContent:o2', '[]')
    insertRow('cashbook_entries')
    insertRow('cashbook_entries')
    insertRow('enhancement_totals', { history_date: '2026-10-01' })
    insertRow('enhancement_totals', { history_date: '2026-10-01' })
    insertRow('enhancement_totals', { history_date: '2026-10-02' })
    for (const key of CACHE_KEYS) await prefs.set(key, 'v')
    await prefs.set('scheduleProbe:o1', 'v')

    const counts = await getCacheDataCounts()

    expect(counts).toEqual({
      manualCharacters: 2,
      bossClears: 0,
      bossDrops: 0,
      cashbookEntries: 2,
      enhancementDays: 2,
      cacheEntries: CACHE_KEYS.length,
    })
  })
})
