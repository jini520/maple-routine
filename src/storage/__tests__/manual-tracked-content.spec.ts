import { installFakePreferences } from './fake-preferences'
import {
  getManualTrackedContent,
  setManualTrackedContent,
  type ManualTrackedItem,
} from '../manual-tracked-content'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('manualTrackedContent:ocid-1')
  await prefs.remove('manualTrackedContent:ocid-2')
})

const SAMPLE_ITEMS: ManualTrackedItem[] = [
  { contentName: '몬스터파크', kind: 'daily', maxCount: 14 },
  { contentName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'daily' },
  { contentName: '무릉도장', kind: 'weekly' },
  { kind: 'boss', bossKey: 'black_mage', difficulty: 'extreme' },
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

describe('레거시 kind 마이그레이션', () => {
  it("결정 19 이전의 kind: 'content' 항목은 템플릿 조회로 daily/weekly로 재분류된다", async () => {
    await prefs.set('manualTrackedContent:ocid-1', JSON.stringify([
        { contentName: '몬스터파크', kind: 'content', maxCount: 14 },
        { contentName: '무릉도장', kind: 'content' },
        { kind: 'boss', bossKey: 'lucid', difficulty: 'easy' },
      ]))

    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([
      { contentName: '몬스터파크', kind: 'daily', maxCount: 14 },
      { contentName: '무릉도장', kind: 'weekly' },
      { kind: 'boss', bossKey: 'lucid', difficulty: 'easy' },
    ])
  })

  it("템플릿에 없는 레거시 'content' 항목은 목록에서 제외된다 (결정 11 일관 적용)", async () => {
    await prefs.set('manualTrackedContent:ocid-1', JSON.stringify([
        { contentName: '템플릿에 없는 콘텐츠', kind: 'content' },
        { contentName: '몬스터파크', kind: 'content' },
      ]))

    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([
      { contentName: '몬스터파크', kind: 'daily' },
    ])
  })
})

// 보스가 key 대신 이름과 한글 난이도를 들던 모양. 읽을 때 보스 표에서 key 를 찾는다.
describe('보스 항목 key 이관', () => {
  it('보스 이름과 한글 난이도를 보스 key 와 난이도 key 로 옮긴다. 데이터 옛 표기도 찾는다', async () => {
    await prefs.set('manualTrackedContent:ocid-1', JSON.stringify([
        { contentName: '루시드', kind: 'boss', difficulty: '이지' },
        { contentName: '검은마법사', kind: 'boss', difficulty: '익스트림' },
        { contentName: '몬스터파크', kind: 'daily', maxCount: 14 },
      ]))

    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([
      { kind: 'boss', bossKey: 'lucid', difficulty: 'easy' },
      { kind: 'boss', bossKey: 'black_mage', difficulty: 'extreme' },
      { contentName: '몬스터파크', kind: 'daily', maxCount: 14 },
    ])
  })

  // 보스 표에 없는 보스는 추적할 key 가 없다.
  it('보스 표에서 못 찾는 보스 항목은 빠진다', async () => {
    await prefs.set('manualTrackedContent:ocid-1', JSON.stringify([
        { contentName: '카이', kind: 'boss', difficulty: '노멀' },
        { contentName: '루시드', kind: 'boss', difficulty: '헬' },
        { contentName: '윌', kind: 'boss', difficulty: '하드' },
      ]))

    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([{ kind: 'boss', bossKey: 'will', difficulty: 'hard' }])
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 빈 배열을 반환한다', async () => {
    await prefs.set('manualTrackedContent:ocid-1', 'not-valid-json{')
    await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([])
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setManualTrackedContent도 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setManualTrackedContent('ocid-1', SAMPLE_ITEMS)).rejects.toThrow('disk full')
  })
})
