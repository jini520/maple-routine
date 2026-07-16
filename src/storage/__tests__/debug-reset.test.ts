import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import { clearAppDataExceptAuth } from '../debug-reset'
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

const { dbExecuteMock } = vi.hoisted(() => ({ dbExecuteMock: vi.fn(async () => {}) }))
vi.mock('../sqlite/db', () => ({
  getBossProfitDb: vi.fn(async () => ({ execute: dbExecuteMock })),
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
  vi.clearAllMocks()
})

describe('clearAppDataExceptAuth', () => {
  it('apiKey·selectedAccountId·theme는 남긴다', async () => {
    await clearAppDataExceptAuth()

    expect((await Preferences.get({ key: 'apiKey' })).value).toBe('test-key')
    expect((await Preferences.get({ key: 'selectedAccountId' })).value).toBe('acc-1')
    expect((await Preferences.get({ key: 'theme' })).value).toBe('렌')
  })

  it('캐시·추적 목록·마지막 선택 등 나머지 Preferences를 모두 지운다', async () => {
    await clearAppDataExceptAuth()

    expect((await Preferences.get({ key: 'schedulerCache:ocid-1' })).value).toBeNull()
    expect((await Preferences.get({ key: 'characterBasicCache:index' })).value).toBeNull()
    expect((await Preferences.get({ key: 'trackedCharacters:content' })).value).toBeNull()
    expect((await Preferences.get({ key: 'lastSelectedCharacter:boss' })).value).toBeNull()
  })

  it('SQLite 보스 수익 관련 테이블을 모두 비운다', async () => {
    await clearAppDataExceptAuth()

    expect(getBossProfitDb).toHaveBeenCalled()
    expect(dbExecuteMock).toHaveBeenCalledWith('DELETE FROM boss_profit_records;')
    expect(dbExecuteMock).toHaveBeenCalledWith('DELETE FROM boss_party_settings;')
    expect(dbExecuteMock).toHaveBeenCalledWith('DELETE FROM boss_profit_period_checks;')
  })
})
