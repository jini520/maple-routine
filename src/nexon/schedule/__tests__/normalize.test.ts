import { describe, expect, it } from 'vitest'
import type { NexonSchedulerCharacterStateWire } from '../../../types'
import { normalizeSchedulerCharacterState } from '../normalize'

describe('normalizeSchedulerCharacterState', () => {
  const baseWire: NexonSchedulerCharacterStateWire = {
    date: '2026-07-09T00:00+09:00',
    character_name: '낟낟',
    world_name: '엘리시움',
    character_level: 293,
    character_class: '렌',
    daily_contents: [
      {
        content_name: '몬스터파크',
        type: 'contents',
        registration_flag: 'true',
        now_count: 7,
        max_count: 14,
        quest_state: null,
      },
      {
        content_name: '[일일 퀘스트] 레헬른의 평온한 밤',
        type: 'quest',
        registration_flag: 'true',
        now_count: 0,
        max_count: 0,
        quest_state: '1',
      },
    ],
    weekly_contents: [
      {
        content_name: '에픽 던전 : 악몽선경',
        type: 'contents',
        registration_flag: 'true',
        now_count: 5,
        max_count: 0,
        quest_state: null,
      },
      {
        content_name: '[메이플 유니온] 주간 드래곤 퇴치',
        type: 'quest',
        registration_flag: 'false',
        now_count: 0,
        max_count: 0,
        quest_state: '0',
      },
    ],
    boss_contents: [
      {
        content_name: '검은 마법사',
        difficulty: 'extreme',
        cycle: 'bossMonthly',
        registration_flag: 'true',
        complete_flag: 'true',
      },
      {
        content_name: '스우',
        difficulty: 'hard',
        cycle: 'bossWeekly',
        registration_flag: 'true',
        complete_flag: 'false',
      },
      {
        content_name: '힐라',
        difficulty: 'hard',
        cycle: 'bossDaily',
        registration_flag: 'true',
        complete_flag: 'true',
      },
    ],
    weekly_boss_clear_count: 0,
    weekly_boss_clear_limit_count: 0,
  }

  it('문자열 flag를 boolean으로, 필드명을 domain 표기로 변환한다', () => {
    const result = normalizeSchedulerCharacterState(baseWire)

    expect(result.asOf).toBe('2026-07-09T00:00+09:00')
    expect(result.characterName).toBe('낟낟')
    expect(result.world).toBe('엘리시움')
    expect(result.level).toBe(293)
    expect(result.jobClass).toBe('렌')

    expect(result.dailyContents[0]).toEqual({
      name: '몬스터파크',
      kind: 'contents',
      isRegistered: true,
      nowCount: 7,
      maxCount: 14,
      questState: null,
    })

    expect(result.weeklyContents[1]).toEqual({
      name: '[메이플 유니온] 주간 드래곤 퇴치',
      kind: 'quest',
      isRegistered: false,
      nowCount: 0,
      maxCount: 0,
      questState: 0,
    })
  })

  it('일간 quest_state 문자열을 숫자로 파싱하고 kind를 채운다', () => {
    const result = normalizeSchedulerCharacterState(baseWire)

    expect(result.dailyContents[1]).toEqual({
      name: '[일일 퀘스트] 레헬른의 평온한 밤',
      kind: 'quest',
      isRegistered: true,
      nowCount: 0,
      maxCount: 0,
      questState: 1,
    })
  })

  it('주간 quest_state 문자열도 일간과 동일하게 숫자로 파싱한다', () => {
    const result = normalizeSchedulerCharacterState(baseWire)

    expect(result.weeklyContents[0]).toEqual({
      name: '에픽 던전 : 악몽선경',
      kind: 'contents',
      isRegistered: true,
      nowCount: 5,
      maxCount: 0,
      questState: null,
    })
    expect(result.weeklyContents[1].questState).toBe(0)
  })

  it('difficulty 영문 표기를 한글로, cycle을 weekly/monthly로 변환한다', () => {
    const result = normalizeSchedulerCharacterState(baseWire)

    const blackMage = result.bossContents.find((boss) => boss.name === '검은 마법사')
    expect(blackMage).toEqual({
      name: '검은 마법사',
      difficulty: '익스트림',
      cycle: 'monthly',
      isRegistered: true,
      isComplete: true,
    })

    const swoo = result.bossContents.find((boss) => boss.name === '스우')
    expect(swoo).toEqual({
      name: '스우',
      difficulty: '하드',
      cycle: 'weekly',
      isRegistered: true,
      isComplete: false,
    })
  })

  it('cycle이 bossDaily인 항목은 결과의 bossContents에서 제외된다', () => {
    const result = normalizeSchedulerCharacterState(baseWire)

    expect(result.bossContents.find((boss) => boss.name === '힐라')).toBeUndefined()
    expect(result.bossContents).toHaveLength(2)
  })

  it('섹션에 내용이 있으면 stale 플래그가 전부 false다', () => {
    const result = normalizeSchedulerCharacterState(baseWire)

    expect(result.isDailyStale).toBe(false)
    expect(result.isWeeklyStale).toBe(false)
    expect(result.isWeeklyBossStale).toBe(false)
    expect(result.isMonthlyBossStale).toBe(false)
  })
})

describe('normalizeSchedulerCharacterState — 미접속으로 인한 누락 (ADR-030)', () => {
  const minimalWire: NexonSchedulerCharacterStateWire = {
    date: '2026-07-21T00:00+09:00',
    character_name: '낟낟',
    world_name: '엘리시움',
    character_level: 293,
    character_class: '렌',
    weekly_boss_clear_count: 0,
    weekly_boss_clear_limit_count: 0,
  }

  it('daily_contents/weekly_contents/boss_contents 필드 자체가 없어도 크래시 없이 빈 배열을 반환한다', () => {
    const result = normalizeSchedulerCharacterState(minimalWire)

    expect(result.dailyContents).toEqual([])
    expect(result.weeklyContents).toEqual([])
    expect(result.bossContents).toEqual([])
  })

  it('필드가 없으면 4개 stale 플래그가 모두 true다', () => {
    const result = normalizeSchedulerCharacterState(minimalWire)

    expect(result.isDailyStale).toBe(true)
    expect(result.isWeeklyStale).toBe(true)
    expect(result.isWeeklyBossStale).toBe(true)
    expect(result.isMonthlyBossStale).toBe(true)
  })

  it('필드가 빈 배열([])로 와도 필드가 없을 때와 동일하게 stale로 취급한다', () => {
    const result = normalizeSchedulerCharacterState({
      ...minimalWire,
      daily_contents: [],
      weekly_contents: [],
      boss_contents: [],
    })

    expect(result.isDailyStale).toBe(true)
    expect(result.isWeeklyStale).toBe(true)
    expect(result.isWeeklyBossStale).toBe(true)
    expect(result.isMonthlyBossStale).toBe(true)
  })

  it('boss_contents에 bossWeekly만 있으면 isWeeklyBossStale만 false다', () => {
    const result = normalizeSchedulerCharacterState({
      ...minimalWire,
      boss_contents: [
        { content_name: '스우', difficulty: 'hard', cycle: 'bossWeekly', registration_flag: 'true', complete_flag: 'false' },
      ],
    })

    expect(result.isWeeklyBossStale).toBe(false)
    expect(result.isMonthlyBossStale).toBe(true)
  })

  it('boss_contents에 bossMonthly만 있으면 isMonthlyBossStale만 false다', () => {
    const result = normalizeSchedulerCharacterState({
      ...minimalWire,
      boss_contents: [
        { content_name: '검은 마법사', difficulty: 'extreme', cycle: 'bossMonthly', registration_flag: 'true', complete_flag: 'true' },
      ],
    })

    expect(result.isWeeklyBossStale).toBe(true)
    expect(result.isMonthlyBossStale).toBe(false)
  })
})
