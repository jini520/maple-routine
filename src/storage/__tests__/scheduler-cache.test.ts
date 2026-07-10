import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import type { SchedulerCharacterState } from '../../types'
import {
  clearCachedSchedulerState,
  getCachedSchedulerState,
  setCachedSchedulerState,
  type CachedSchedulerEntry,
} from '../scheduler-cache'

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>()
  return {
    Preferences: {
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

const sampleState: SchedulerCharacterState = {
  asOf: '2026-07-09T00:00+09:00',
  characterName: '낟낟',
  world: '엘리시움',
  level: 293,
  jobClass: '렌',
  dailyContents: [],
  weeklyContents: [],
  bossContents: [],
  weeklyBossClearCount: 0,
  weeklyBossClearLimitCount: 0,
}

const sampleEntry: CachedSchedulerEntry = {
  state: sampleState,
  syncedAt: '2026-07-09T00:05:00.000Z',
}

beforeEach(async () => {
  vi.mocked(Preferences.get).mockClear()
  vi.mocked(Preferences.set).mockClear()
  vi.mocked(Preferences.remove).mockClear()
  await clearCachedSchedulerState('ocid-1')
})

describe('round-trip', () => {
  it('setCachedSchedulerState 후 getCachedSchedulerState로 저장한 값을 그대로 읽는다', async () => {
    await setCachedSchedulerState('ocid-1', sampleEntry)
    await expect(getCachedSchedulerState('ocid-1')).resolves.toEqual(sampleEntry)
  })
})

describe('저장된 값이 없는 경우', () => {
  it('캐시된 적 없는 ocid는 null을 반환한다', async () => {
    await expect(getCachedSchedulerState('unknown-ocid')).resolves.toBeNull()
  })

  it('clearCachedSchedulerState 이후에는 null을 반환한다', async () => {
    await setCachedSchedulerState('ocid-1', sampleEntry)
    await clearCachedSchedulerState('ocid-1')
    await expect(getCachedSchedulerState('ocid-1')).resolves.toBeNull()
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 null을 반환한다', async () => {
    await Preferences.set({ key: 'schedulerCache:ocid-broken', value: 'not-valid-json{' })
    await expect(getCachedSchedulerState('ocid-broken')).resolves.toBeNull()
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setCachedSchedulerState도 에러를 그대로 전파한다', async () => {
    vi.mocked(Preferences.set).mockRejectedValueOnce(new Error('disk full'))
    await expect(setCachedSchedulerState('ocid-1', sampleEntry)).rejects.toThrow('disk full')
  })
})
