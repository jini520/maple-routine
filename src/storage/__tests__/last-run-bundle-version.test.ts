import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import { getLastRunBundleVersion, setLastRunBundleVersion } from '../last-run-bundle-version'

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

beforeEach(async () => {
  vi.mocked(Preferences.get).mockClear()
  vi.mocked(Preferences.set).mockClear()
  await Preferences.remove({ key: 'lastRunBundleVersion' })
})

describe('last-run-bundle-version 저장', () => {
  // ADR-126 결정 4: 저장값이 없다는 것은 "모른다"이지 "업데이트했다"가 아니다 — 이 null 이
  // 곧 완료 안내를 띄우지 않는 근거다.
  it('저장된 적이 없으면 null', async () => {
    await expect(getLastRunBundleVersion()).resolves.toBeNull()
  })

  it('적어 둔 버전을 그대로 읽는다', async () => {
    await setLastRunBundleVersion('1.0.4')
    await expect(getLastRunBundleVersion()).resolves.toBe('1.0.4')
  })

  it('다시 적으면 마지막 값만 남는다 — 이력이 아니라 마지막 한 번이다', async () => {
    await setLastRunBundleVersion('1.0.4')
    await setLastRunBundleVersion('1.0.5')
    await expect(getLastRunBundleVersion()).resolves.toBe('1.0.5')
  })
})
