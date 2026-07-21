import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import type { SharedProgressEntry } from '../../types'
import {
  getAccountSharedProgress,
  getWorldSharedProgress,
  setAccountSharedProgressEntry,
  setWorldSharedProgressEntry,
} from '../shared-progress-cache'

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

const sampleEntry: SharedProgressEntry = {
  active: true,
  kind: 'contents',
  nowCount: 7,
  maxCount: 14,
  questState: null,
  lastUpdatedBucket: '2026-07-21',
}

const KEYS_USED_IN_TESTS = [
  'worldSharedProgress:엘리시움',
  'worldSharedProgress:스카니아',
  'worldSharedProgress:깨짐',
  'accountSharedProgress:acc-1',
  'accountSharedProgress:acc-2',
  'accountSharedProgress:acc-unknown',
]

beforeEach(async () => {
  vi.mocked(Preferences.get).mockClear()
  vi.mocked(Preferences.set).mockClear()
  await Promise.all(KEYS_USED_IN_TESTS.map((key) => Preferences.remove({ key })))
})

describe('world 원장', () => {
  it('저장된 적 없는 월드는 빈 객체를 반환한다', async () => {
    await expect(getWorldSharedProgress('스카니아')).resolves.toEqual({})
  })

  it('setWorldSharedProgressEntry 후 같은 월드에서 그대로 읽힌다', async () => {
    await setWorldSharedProgressEntry('엘리시움', '몬스터파크', sampleEntry)
    await expect(getWorldSharedProgress('엘리시움')).resolves.toEqual({ 몬스터파크: sampleEntry })
  })

  it('같은 월드에 다른 항목을 추가로 저장해도 기존 항목이 유지된다', async () => {
    await setWorldSharedProgressEntry('엘리시움', '몬스터파크', sampleEntry)
    const second: SharedProgressEntry = { ...sampleEntry, nowCount: 3 }
    await setWorldSharedProgressEntry('엘리시움', '[메이플 유니온] 주간 드래곤 퇴치', second)

    await expect(getWorldSharedProgress('엘리시움')).resolves.toEqual({
      몬스터파크: sampleEntry,
      '[메이플 유니온] 주간 드래곤 퇴치': second,
    })
  })

  it('다른 월드끼리는 서로 격리된다', async () => {
    await setWorldSharedProgressEntry('엘리시움', '몬스터파크', sampleEntry)
    await expect(getWorldSharedProgress('스카니아')).resolves.toEqual({})
  })
})

describe('account 원장', () => {
  it('저장된 적 없는 계정은 빈 객체를 반환한다', async () => {
    await expect(getAccountSharedProgress('acc-unknown')).resolves.toEqual({})
  })

  it('setAccountSharedProgressEntry 후 같은 계정에서 그대로 읽힌다', async () => {
    await setAccountSharedProgressEntry('acc-1', '에픽 던전 : 악몽선경', sampleEntry)
    await expect(getAccountSharedProgress('acc-1')).resolves.toEqual({ '에픽 던전 : 악몽선경': sampleEntry })
  })

  it('다른 계정끼리는 서로 격리된다', async () => {
    await setAccountSharedProgressEntry('acc-1', '에픽 던전 : 악몽선경', sampleEntry)
    await expect(getAccountSharedProgress('acc-2')).resolves.toEqual({})
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 빈 객체를 반환한다', async () => {
    await Preferences.set({ key: 'worldSharedProgress:깨짐', value: 'not-valid-json{' })
    await expect(getWorldSharedProgress('깨짐')).resolves.toEqual({})
  })
})
