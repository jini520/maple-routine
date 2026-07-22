import { describe, expect, it } from 'vitest'
import type { SchedulerCharacterState, SharedProgressEntry } from '../../types'
import { mergeSchedulerState } from '../scheduler-merge'

function baseState(overrides: Partial<SchedulerCharacterState> = {}): SchedulerCharacterState {
  return {
    asOf: '2026-07-21T00:00+09:00',
    characterName: '낟낟',
    world: '엘리시움',
    level: 293,
    jobClass: '렌',
    dailyContents: [],
    weeklyContents: [],
    bossContents: [],
    isDailyStale: false,
    isWeeklyStale: false,
    isWeeklyBossStale: false,
    isMonthlyBossStale: false,
    ...overrides,
  }
}

// 2026-07-21은 화요일 — 가장 최근 주간 리셋은 2026-07-16(목), 오늘 날짜(KST)는 2026-07-21
const NOW = new Date('2026-07-21T10:00:00+09:00')

describe('mergeSchedulerState — character 범위', () => {
  it('fresh 섹션의 character 범위 항목은 그대로 통과한다', () => {
    const item = {
      name: '[일일 퀘스트] 레헬른의 평온한 밤',
      kind: 'quest' as const,
      isRegistered: true,
      nowCount: 0,
      maxCount: 0,
      questState: 1 as const,
    }
    const fresh = baseState({ dailyContents: [item] })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toEqual([item])
    expect(result.worldLedgerUpdates).toEqual({})
    expect(result.accountLedgerUpdates).toEqual({})
  })

  it('daily가 stale이면 이전 캐시의 character 항목 이름/등록은 유지하고 진행값만 리셋한다', () => {
    const previous = baseState({
      dailyContents: [
        {
          name: '[일일 퀘스트] 레헬른의 평온한 밤',
          kind: 'quest',
          isRegistered: true,
          nowCount: 0,
          maxCount: 0,
          questState: 2,
        },
      ],
    })
    const fresh = baseState({ dailyContents: [], isDailyStale: true })

    const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toEqual([
      {
        name: '[일일 퀘스트] 레헬른의 평온한 밤',
        kind: 'quest',
        isRegistered: true,
        nowCount: 0,
        maxCount: 0,
        questState: 0,
      },
    ])
  })

  it('contents kind 항목의 questState(null)는 리셋 후에도 null로 유지된다', () => {
    const previous = baseState({
      weeklyContents: [
        { name: '무릉도장', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0, questState: null },
      ],
    })
    const fresh = baseState({ weeklyContents: [], isWeeklyStale: true })

    const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.weeklyContents).toEqual([
      { name: '무릉도장', kind: 'contents', isRegistered: true, nowCount: 0, maxCount: 0, questState: null },
    ])
  })

  it('previous가 null이고 stale이어도 크래시 없이 빈 배열을 반환한다 (캐릭터 첫 동기화)', () => {
    const fresh = baseState({ dailyContents: [], isDailyStale: true })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toEqual([])
  })
})

describe('mergeSchedulerState — world 범위 (몬스터파크)', () => {
  it('처음 fresh로 registration_flag: true가 오면 원장이 active: true로 갱신되고 결과에 노출된다', () => {
    const fresh = baseState({
      dailyContents: [
        { name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null },
      ],
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.worldLedgerUpdates).toEqual({
      몬스터파크: { active: true, kind: 'contents', nowCount: 7, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-21' },
    })
    expect(result.characterState.dailyContents).toEqual([
      { name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null },
    ])
  })

  it('registration_flag: false인 응답에서는 아직 active가 아니었다면 노출되지 않는다', () => {
    const fresh = baseState({
      dailyContents: [
        { name: '몬스터파크', kind: 'contents', isRegistered: false, nowCount: 0, maxCount: 14, questState: null },
      ],
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toEqual([])
    expect(result.worldLedgerUpdates.몬스터파크.active).toBe(false)
  })

  it('이미 active인 항목이 이번 응답에 registration_flag: false로 와도 여전히 노출되고 값은 갱신된다', () => {
    const worldLedger: Record<string, SharedProgressEntry> = {
      몬스터파크: { active: true, kind: 'contents', nowCount: 5, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-21' },
    }
    const fresh = baseState({
      dailyContents: [
        { name: '몬스터파크', kind: 'contents', isRegistered: false, nowCount: 7, maxCount: 14, questState: null },
      ],
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toEqual([
      { name: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null },
    ])
    expect(result.worldLedgerUpdates.몬스터파크.active).toBe(true)
  })

  it('이미 active인 항목이 이번 응답에 아예 없어도(누락) 원장 값으로 계속 노출되고 원장은 갱신하지 않는다', () => {
    const worldLedger: Record<string, SharedProgressEntry> = {
      몬스터파크: { active: true, kind: 'contents', nowCount: 5, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-21' },
    }
    // 이 캐릭터 자신의 daily 섹션은 정상(다른 항목은 있음)이지만 몬스터파크만 빠진 상황
    const fresh = baseState({
      dailyContents: [
        { name: '[일일 퀘스트] 레헬른의 평온한 밤', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 1 },
      ],
      isDailyStale: false,
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toContainEqual({
      name: '몬스터파크',
      kind: 'contents',
      isRegistered: true,
      nowCount: 5,
      maxCount: 14,
      questState: null,
    })
    expect(result.worldLedgerUpdates).toEqual({})
  })

  it('원장이 리셋 경계(오늘 날짜)를 넘겼는데 아무도 안 갱신했으면 진행값만 리셋되고 active는 유지된다', () => {
    const worldLedger: Record<string, SharedProgressEntry> = {
      몬스터파크: { active: true, kind: 'contents', nowCount: 12, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-20' },
    }
    const fresh = baseState({
      dailyContents: [
        { name: '[일일 퀘스트] 레헬른의 평온한 밤', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 1 },
      ],
      isDailyStale: false,
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toContainEqual({
      name: '몬스터파크',
      kind: 'contents',
      isRegistered: true,
      nowCount: 0,
      maxCount: 14,
      questState: null,
    })
  })
})

describe('mergeSchedulerState — account 범위 (에픽 던전)', () => {
  it('처음 fresh로 registration_flag: true가 오면 accountLedgerUpdates가 갱신된다', () => {
    const fresh = baseState({
      weeklyContents: [
        { name: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 0, questState: null },
      ],
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.accountLedgerUpdates).toEqual({
      '에픽 던전 : 악몽선경': { active: true, kind: 'contents', nowCount: 1, maxCount: 0, questState: null, lastUpdatedBucket: '2026-07-16' },
    })
    expect(result.worldLedgerUpdates).toEqual({})
  })
})

describe('mergeSchedulerState — maxCountOverride', () => {
  it('오버라이드가 등록된 항목은 API 응답의 max_count 대신 오버라이드 값을 쓴다', () => {
    const fresh = baseState({
      weeklyContents: [
        { name: '[길드] 주간 미션 포인트', kind: 'contents', isRegistered: true, nowCount: 3, maxCount: 0, questState: null },
      ],
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.weeklyContents[0].maxCount).toBe(10)
  })

  it('stale 폴백 경로에서도 오버라이드가 적용된다', () => {
    const previous = baseState({
      weeklyContents: [
        { name: '[길드] 주간 미션 포인트', kind: 'contents', isRegistered: true, nowCount: 3, maxCount: 0, questState: null },
      ],
    })
    const fresh = baseState({ weeklyContents: [], isWeeklyStale: true })

    const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.weeklyContents[0].maxCount).toBe(10)
  })
})

describe('mergeSchedulerState — 보스 (cycle별 독립 stale)', () => {
  it('주간 보스만 stale이면 주간 보스만 리셋되고 월간 보스는 그대로 유지된다', () => {
    const previous = baseState({
      bossContents: [
        { name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true, isComplete: true },
        { name: '검은 마법사', difficulty: '익스트림', cycle: 'monthly', isRegistered: true, isComplete: true },
      ],
    })
    const fresh = baseState({
      bossContents: [{ name: '검은 마법사', difficulty: '익스트림', cycle: 'monthly', isRegistered: true, isComplete: true }],
      isWeeklyBossStale: true,
      isMonthlyBossStale: false,
    })

    const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.bossContents).toEqual([
      { name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true, isComplete: false },
      { name: '검은 마법사', difficulty: '익스트림', cycle: 'monthly', isRegistered: true, isComplete: true },
    ])
  })
})

describe('mergeSchedulerState — 그 외 필드', () => {
  it('asOf/characterName/world/level/jobClass는 fresh 값을 그대로 반영한다', () => {
    const fresh = baseState({ characterName: '테스트캐릭', level: 100 })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.characterName).toBe('테스트캐릭')
    expect(result.characterState.level).toBe(100)
  })
})
