import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import { clearCacheData, getCacheDataSize } from '../cache-data'
import { getBossProfitDb } from '../sqlite/db'

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
vi.mock('../sqlite/db', () => ({
  getBossProfitDb: vi.fn(async () => ({ execute: dbExecuteMock, query: dbQueryMock })),
}))

beforeEach(async () => {
  const { keys } = await Preferences.keys()
  await Promise.all(keys.map((key) => Preferences.remove({ key })))
  await Preferences.set({ key: 'apiKey', value: 'test-key' })
  await Preferences.set({ key: 'selectedAccountId', value: 'acc-1' })
  await Preferences.set({ key: 'theme', value: '렌' })
  await Preferences.set({ key: 'schedulerCache:ocid-1', value: '{}' })
  await Preferences.set({ key: 'characterBasicCache:index', value: '[]' })
  await Preferences.set({ key: 'trackedCharacters:content', value: '[]' })
  await Preferences.set({ key: 'lastSelectedCharacter:boss', value: 'ocid-1' })
  dbQueryMock.mockResolvedValue({ values: [] })
  vi.clearAllMocks()
})

describe('clearCacheData', () => {
  it('apiKey·selectedAccountId·theme는 남긴다', async () => {
    await clearCacheData()

    expect((await Preferences.get({ key: 'apiKey' })).value).toBe('test-key')
    expect((await Preferences.get({ key: 'selectedAccountId' })).value).toBe('acc-1')
    expect((await Preferences.get({ key: 'theme' })).value).toBe('렌')
  })

  it('캐시·추적 목록·마지막 선택 등 나머지 Preferences를 모두 지운다', async () => {
    await clearCacheData()

    expect((await Preferences.get({ key: 'schedulerCache:ocid-1' })).value).toBeNull()
    expect((await Preferences.get({ key: 'characterBasicCache:index' })).value).toBeNull()
    expect((await Preferences.get({ key: 'trackedCharacters:content' })).value).toBeNull()
    expect((await Preferences.get({ key: 'lastSelectedCharacter:boss' })).value).toBeNull()
  })

  it('SQLite 보스 수익 관련 테이블을 모두 비운다', async () => {
    await clearCacheData()

    expect(getBossProfitDb).toHaveBeenCalled()
    expect(dbExecuteMock).toHaveBeenCalledWith('DELETE FROM boss_profit_records;')
    expect(dbExecuteMock).toHaveBeenCalledWith('DELETE FROM boss_party_settings;')
    expect(dbExecuteMock).toHaveBeenCalledWith('DELETE FROM boss_profit_period_checks;')
  })
})

describe('getCacheDataSize', () => {
  it('apiKey·selectedAccountId·theme를 제외한 Preferences 값의 바이트 수를 합산한다', async () => {
    const size = await getCacheDataSize()

    // '{}'(2) + '[]'(2) + '[]'(2) + 'ocid-1'(6) = 12, apiKey·selectedAccountId·theme는 제외
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

  it('저장된 캐시 데이터가 없으면 0을 반환한다', async () => {
    const { keys } = await Preferences.keys()
    await Promise.all(
      keys
        .filter((key) => key !== 'apiKey' && key !== 'selectedAccountId' && key !== 'theme')
        .map((key) => Preferences.remove({ key })),
    )

    const size = await getCacheDataSize()

    expect(size).toBe(0)
  })
})
