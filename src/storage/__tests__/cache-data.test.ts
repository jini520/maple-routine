import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import { clearCacheData, getCacheDataSize } from '../cache-data'
import { BOSS_PROFIT_TABLE_NAMES, getBossProfitDb } from '../sqlite/db'

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>()
  return {
    Preferences: {
      keys: vi.fn(async () => ({ keys: [...store.keys()] })),
      get: vi.fn(async ({ key }: { key: string }) => ({
        value: store.has(key) ? (store.get(key) as string) : null,
      })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        store.set(key, value)
      }),
      remove: vi.fn(async ({ key }: { key: string }) => {
        store.delete(key)
      }),
    },
  }
})

const { dbExecuteMock, dbQueryMock } = vi.hoisted(() => ({
  dbExecuteMock: vi.fn(async () => {}),
  dbQueryMock: vi.fn(),
}))
// ADR-052 결정 2: 삭제 대상 테이블 목록은 db.ts가 단일 진실 공급원이므로, 커넥션(getBossProfitDb)만
// 가짜로 바꾸고 BOSS_PROFIT_TABLE_NAMES는 실제 값을 그대로 쓴다 — 목록까지 모킹하면 "실제 테이블
// 전부를 지우는가"를 검증하지 못한다.
vi.mock('../sqlite/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sqlite/db')>()),
  getBossProfitDb: vi.fn(async () => ({ execute: dbExecuteMock, query: dbQueryMock })),
}))

beforeEach(async () => {
  const { keys } = await Preferences.keys()
  await Promise.all(keys.map((key) => Preferences.remove({ key })))
  await Preferences.set({ key: 'apiKey', value: 'test-key' })
  await Preferences.set({ key: 'selectedAccountId', value: 'acc-1' })
  await Preferences.set({ key: 'theme', value: '렌' })
  await Preferences.set({ key: 'trackingMode', value: 'manual' })
  await Preferences.set({ key: 'dropEffect', value: 'off' })
  await Preferences.set({ key: 'schedulerCache:ocid-1', value: '{}' })
  await Preferences.set({ key: 'characterBasicCache:index', value: '[]' })
  await Preferences.set({ key: 'trackedCharacters:content', value: '[]' })
  await Preferences.set({ key: 'lastSelectedCharacter:boss', value: 'ocid-1' })
  dbQueryMock.mockResolvedValue({ values: [] })
  vi.clearAllMocks()
})

describe('clearCacheData', () => {
  // ADR-052 결정 1: trackingMode·dropEffect는 재조회로 복구되는 캐시가 아니라 사용자가 고른
  // 취향 설정이라, theme과 같이 캐시 삭제에도 보존한다.
  it('apiKey·selectedAccountId·theme·trackingMode·dropEffect는 남긴다', async () => {
    await clearCacheData()

    expect((await Preferences.get({ key: 'apiKey' })).value).toBe('test-key')
    expect((await Preferences.get({ key: 'selectedAccountId' })).value).toBe('acc-1')
    expect((await Preferences.get({ key: 'theme' })).value).toBe('렌')
    expect((await Preferences.get({ key: 'trackingMode' })).value).toBe('manual')
    expect((await Preferences.get({ key: 'dropEffect' })).value).toBe('off')
  })

  it('캐시·추적 목록·마지막 선택 등 나머지 Preferences를 모두 지운다', async () => {
    await clearCacheData()

    expect((await Preferences.get({ key: 'schedulerCache:ocid-1' })).value).toBeNull()
    expect((await Preferences.get({ key: 'characterBasicCache:index' })).value).toBeNull()
    expect((await Preferences.get({ key: 'trackedCharacters:content' })).value).toBeNull()
    expect((await Preferences.get({ key: 'lastSelectedCharacter:boss' })).value).toBeNull()
  })

  // 여기서 테이블 이름을 다시 나열하면 db.ts와 갈라질 두 번째 목록이 생겨, 정확히 이 테스트가
  // 막아야 할 누락(boss_drop_records가 빠져 캐시를 지워도 드롭 기록이 남던 결함)을 못 잡는다.
  it('db.ts가 정의한 SQLite 테이블을 하나도 빠짐없이 비운다', async () => {
    await clearCacheData()

    expect(getBossProfitDb).toHaveBeenCalled()
    for (const table of BOSS_PROFIT_TABLE_NAMES) {
      expect(dbExecuteMock).toHaveBeenCalledWith(`DELETE FROM ${table};`)
    }
    // 목록에 없는 테이블까지 지우지 않는다(스키마 DROP·다른 DELETE 없음).
    expect(dbExecuteMock).toHaveBeenCalledTimes(BOSS_PROFIT_TABLE_NAMES.length)
  })
})

describe('getCacheDataSize', () => {
  it('보존 키(KEEP_KEYS)를 제외한 Preferences 값의 바이트 수를 합산한다', async () => {
    const size = await getCacheDataSize()

    // schedulerCache:ocid-1 '{}'(2) + characterBasicCache:index '[]'(2)
    // + trackedCharacters:content '[]'(2) + lastSelectedCharacter:boss 'ocid-1'(6) = 12.
    // 보존 키(apiKey·selectedAccountId·theme·trackingMode·dropEffect)는 삭제되지 않으므로 제외 —
    // trackingMode 'manual'(6)·dropEffect 'off'(3)를 seed해도 합계가 늘지 않아야 한다(ADR-052 결정 1).
    expect(size).toBe(12)
  })

  it('SQLite 각 테이블 행의 값 바이트 수도 합산한다', async () => {
    dbQueryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('boss_profit_records')) {
        return { values: [{ ocid: 'ocid-1', boss: '자쿰' }] }
      }
      return { values: [] }
    })

    const size = await getCacheDataSize()

    const prefsBytes = 12
    const rowBytes = new TextEncoder().encode('ocid-1').length + new TextEncoder().encode('자쿰').length
    expect(size).toBe(prefsBytes + rowBytes)
  })

  it('보존 키만 남아 있으면 0을 반환한다', async () => {
    const keepKeys = ['apiKey', 'selectedAccountId', 'theme', 'trackingMode', 'dropEffect']
    const { keys } = await Preferences.keys()
    await Promise.all(
      keys.filter((key) => !keepKeys.includes(key)).map((key) => Preferences.remove({ key })),
    )

    const size = await getCacheDataSize()

    expect(size).toBe(0)
  })
})
