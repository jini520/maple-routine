import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Preferences } from '@capacitor/preferences'
import {
  getManualTrackedContent,
  setManualTrackedContent,
  type ManualTrackedItem,
} from '../manual-tracked-content'

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
  vi.mocked(Preferences.remove).mockClear()
  await Preferences.remove({ key: 'manualTrackedContent:ocid-1' })
  await Preferences.remove({ key: 'manualTrackedContent:ocid-2' })
})

const SAMPLE_ITEMS: ManualTrackedItem[] = [
  { contentName: '몬스터파크', kind: 'daily', maxCount: 14 },
  { contentName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'daily' },
  { contentName: '무릉도장', kind: 'weekly' },
  { contentName: '검은 마법사', kind: 'boss', difficulty: 'extreme' },
]

describe('저장된 값이 없는 경우', () => {
  it('한 번도 저장한 적 없으면 빈 배열을 반환한다', async () => {
    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([])
  })
})

describe('round-trip', () => {
  it('setManualTrackedContent 후 getManualTrackedContent로 저장한 배열을 그대로 읽는다', async () => {
    await setManualTrackedContent('ocid-1', SAMPLE_ITEMS)
    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual(SAMPLE_ITEMS)
  })

  it('전체 교체 방식이라 다시 저장하면 이전 배열을 완전히 덮어쓴다', async () => {
    await setManualTrackedContent('ocid-1', SAMPLE_ITEMS)
    const replaced: ManualTrackedItem[] = [{ contentName: '무릉도장', kind: 'weekly' }]
    await setManualTrackedContent('ocid-1', replaced)
    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual(replaced)
  })

  it('빈 배열도 그대로 저장·복원된다', async () => {
    await setManualTrackedContent('ocid-1', SAMPLE_ITEMS)
    await setManualTrackedContent('ocid-1', [])
    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([])
  })
})

describe('ocid 독립성', () => {
  it('한 ocid에 저장해도 다른 ocid는 영향받지 않는다', async () => {
    await setManualTrackedContent('ocid-1', SAMPLE_ITEMS)
    await expect(getManualTrackedContent('ocid-2')).resolves.toEqual([])
  })

  it('서로 다른 ocid는 서로 다른 배열을 독립적으로 저장한다', async () => {
    const other: ManualTrackedItem[] = [{ contentName: '에르다 스펙트럼', kind: 'weekly', maxCount: 1 }]
    await setManualTrackedContent('ocid-1', SAMPLE_ITEMS)
    await setManualTrackedContent('ocid-2', other)
    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual(SAMPLE_ITEMS)
    await expect(getManualTrackedContent('ocid-2')).resolves.toEqual(other)
  })
})

describe('레거시 kind 마이그레이션 (ADR-035 결정 19)', () => {
  it("결정 19 이전의 kind: 'content' 항목은 템플릿 조회로 daily/weekly로 재분류된다", async () => {
    await Preferences.set({
      key: 'manualTrackedContent:ocid-1',
      value: JSON.stringify([
        { contentName: '몬스터파크', kind: 'content', maxCount: 14 },
        { contentName: '무릉도장', kind: 'content' },
        { contentName: '루시드', kind: 'boss', difficulty: '이지' },
      ]),
    })

    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([
      { contentName: '몬스터파크', kind: 'daily', maxCount: 14 },
      { contentName: '무릉도장', kind: 'weekly' },
      { contentName: '루시드', kind: 'boss', difficulty: '이지' },
    ])
  })

  it("템플릿에 없는 레거시 'content' 항목은 목록에서 제외된다 (결정 11 일관 적용)", async () => {
    await Preferences.set({
      key: 'manualTrackedContent:ocid-1',
      value: JSON.stringify([
        { contentName: '템플릿에 없는 콘텐츠', kind: 'content' },
        { contentName: '몬스터파크', kind: 'content' },
      ]),
    })

    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([
      { contentName: '몬스터파크', kind: 'daily' },
    ])
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 빈 배열을 반환한다', async () => {
    await Preferences.set({ key: 'manualTrackedContent:ocid-1', value: 'not-valid-json{' })
    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([])
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setManualTrackedContent도 에러를 그대로 전파한다', async () => {
    vi.mocked(Preferences.set).mockRejectedValueOnce(new Error('disk full'))
    await expect(setManualTrackedContent('ocid-1', SAMPLE_ITEMS)).rejects.toThrow('disk full')
  })
})
