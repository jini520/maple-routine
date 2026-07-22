import { describe, expect, it } from 'vitest'
import type { BossContent } from '../../types'
import { countClearedWeeklyBosses, matchBossContent, selectDisplayBosses, WEEKLY_BOSS_CLEAR_LIMIT, type MatchedBoss } from '../boss-matching'

function bossContent(overrides: Partial<BossContent> = {}): BossContent {
  return {
    name: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ...overrides,
  }
}

describe('matchBossContent', () => {
  it('공백 유무 없이 정확히 일치하면 매칭된다', () => {
    const result = matchBossContent(bossContent({ name: '자쿰' }))

    expect(result).toEqual({
      apiName: '자쿰',
      difficulty: '카오스',
      cycle: 'weekly',
      isRegistered: true,
      isComplete: false,
      matchedBossName: '자쿰',
      portraitSlug: 'zakum',
      isSeasonBoss: false,
    })
  })

  it('API 쪽에 공백이 더 많은 경우에도 매칭된다 (월간 보스: "검은 마법사" -> "검은마법사")', () => {
    const result = matchBossContent(
      bossContent({ name: '검은 마법사', difficulty: '익스트림', cycle: 'monthly', isComplete: true }),
    )

    expect(result.matchedBossName).toBe('검은마법사')
    expect(result.portraitSlug).toBe('blackMage')
    expect(result.apiName).toBe('검은 마법사')
    expect(result.cycle).toBe('monthly')
    expect(result.isComplete).toBe(true)
  })

  it('데이터 쪽에 공백이 더 많은 경우에도 매칭된다 ("블러디퀸" -> "블러디 퀸")', () => {
    const result = matchBossContent(bossContent({ name: '블러디퀸' }))

    expect(result.matchedBossName).toBe('블러디 퀸')
    expect(result.portraitSlug).toBe('crimsonQueen')
  })

  it('eventWeekly(시즌 보스) 항목은 API content_name과 표시명이 동일해 정확히 일치로 매칭된다 ("시즌 보스 메이린")', () => {
    const result = matchBossContent(bossContent({ name: '시즌 보스 메이린', difficulty: '노멀' }))

    expect(result.matchedBossName).toBe('시즌 보스 메이린')
    expect(result.portraitSlug).toBe('maerin')
  })

  it('eventWeekly(시즌 보스) 소속 보스는 isSeasonBoss: true다', () => {
    const result = matchBossContent(bossContent({ name: '시즌 보스 메이린', difficulty: '노멀' }))

    expect(result.isSeasonBoss).toBe(true)
  })

  it('일반 주간/월간 보스는 isSeasonBoss: false다', () => {
    expect(matchBossContent(bossContent({ name: '자쿰' })).isSeasonBoss).toBe(false)
    expect(
      matchBossContent(bossContent({ name: '검은 마법사', cycle: 'monthly', difficulty: '익스트림' })).isSeasonBoss,
    ).toBe(false)
  })

  it('portraitSlug가 있는 일반 주간 보스는 그 값을 그대로 반환한다', () => {
    const result = matchBossContent(bossContent({ name: '스우', difficulty: '익스트림' }))

    expect(result.matchedBossName).toBe('스우')
    expect(result.portraitSlug).toBe('lotus')
  })

  it('참조 테이블에 없는 콘텐츠명은 에러를 던지지 않고 matchedBossName: null로 처리하며 원문을 보존한다', () => {
    const result = matchBossContent(bossContent({ name: '알 수 없는 콘텐츠', difficulty: '노멀' }))

    expect(result).toEqual({
      apiName: '알 수 없는 콘텐츠',
      difficulty: '노멀',
      cycle: 'weekly',
      isRegistered: true,
      isComplete: false,
      matchedBossName: null,
      portraitSlug: null,
      isSeasonBoss: false,
    })
  })
})

describe('WEEKLY_BOSS_CLEAR_LIMIT', () => {
  it('weekly-bosses.json의 weeklyBossSelectionLimit(12)를 그대로 노출한다', () => {
    expect(WEEKLY_BOSS_CLEAR_LIMIT).toBe(12)
  })
})

function matchedBoss(overrides: Partial<MatchedBoss> = {}): MatchedBoss {
  return {
    apiName: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    matchedBossName: '자쿰',
    portraitSlug: 'zakum',
    isSeasonBoss: false,
    ...overrides,
  }
}

describe('countClearedWeeklyBosses (ADR-031)', () => {
  it('등록되고 완료된 주간 보스를 센다', () => {
    const bosses = [matchedBoss({ apiName: '자쿰', isRegistered: true, isComplete: true })]
    expect(countClearedWeeklyBosses(bosses)).toBe(1)
  })

  it('등록 여부와 무관하게 완료된 주간 보스는 카운트에 포함된다 — 등록 없이 잡아도 센다', () => {
    const bosses = [matchedBoss({ apiName: '자쿰', isRegistered: false, isComplete: true })]
    expect(countClearedWeeklyBosses(bosses)).toBe(1)
  })

  it('미완료 보스는 세지 않는다', () => {
    const bosses = [matchedBoss({ apiName: '자쿰', isRegistered: true, isComplete: false })]
    expect(countClearedWeeklyBosses(bosses)).toBe(0)
  })

  it('시즌 보스는 완료·등록 여부와 무관하게 카운트에서 제외된다', () => {
    const bosses = [
      matchedBoss({ apiName: '시즌 보스 메이린', isRegistered: true, isComplete: true, isSeasonBoss: true }),
    ]
    expect(countClearedWeeklyBosses(bosses)).toBe(0)
  })

  it('월간 보스는 카운트에서 제외된다', () => {
    const bosses = [matchedBoss({ apiName: '검은 마법사', cycle: 'monthly', isRegistered: true, isComplete: true })]
    expect(countClearedWeeklyBosses(bosses)).toBe(0)
  })

  it('같은 보스를 서로 다른 난이도로 동시에 완료해도 1로만 센다(content_name 그룹 단위)', () => {
    const bosses = [
      matchedBoss({ apiName: '루시드', difficulty: '노멀', isRegistered: false, isComplete: true }),
      matchedBoss({ apiName: '루시드', difficulty: '하드', isRegistered: false, isComplete: true }),
    ]
    expect(countClearedWeeklyBosses(bosses)).toBe(1)
  })

  it('서로 다른 보스는 각각 센다', () => {
    const bosses = [
      matchedBoss({ apiName: '자쿰', isRegistered: true, isComplete: true }),
      matchedBoss({ apiName: '루시드', difficulty: '하드', isRegistered: true, isComplete: true }),
    ]
    expect(countClearedWeeklyBosses(bosses)).toBe(2)
  })
})

describe('selectDisplayBosses (ADR-031)', () => {
  it('등록된 항목이 있으면 그 항목만 카드로 선택한다', () => {
    const bosses = [matchedBoss({ apiName: '자쿰', isRegistered: true, isComplete: false })]
    expect(selectDisplayBosses(bosses)).toEqual(bosses)
  })

  it('등록된 난이도가 없어도 완료된 난이도가 있으면 그 난이도를 카드로 선택한다', () => {
    const cleared = matchedBoss({ apiName: '자쿰', isRegistered: false, isComplete: true })
    expect(selectDisplayBosses([cleared])).toEqual([cleared])
  })

  it('등록도 완료도 없는 항목은 선택하지 않는다', () => {
    const untouched = matchedBoss({ apiName: '자쿰', isRegistered: false, isComplete: false })
    expect(selectDisplayBosses([untouched])).toEqual([])
  })

  it('등록된 난이도가 있으면, 같은 보스의 다른 미등록 완료 난이도는 중복으로 추가하지 않는다', () => {
    const registered = matchedBoss({ apiName: '루시드', difficulty: '하드', isRegistered: true, isComplete: true })
    const unregisteredComplete = matchedBoss({ apiName: '루시드', difficulty: '노멀', isRegistered: false, isComplete: true })

    expect(selectDisplayBosses([registered, unregisteredComplete])).toEqual([registered])
  })

  it('서로 다른 보스는 독립적으로 판정된다', () => {
    const registered = matchedBoss({ apiName: '자쿰', isRegistered: true, isComplete: false })
    const unregisteredComplete = matchedBoss({ apiName: '루시드', difficulty: '하드', isRegistered: false, isComplete: true })
    const untouched = matchedBoss({ apiName: '스우', difficulty: '노멀', isRegistered: false, isComplete: false })

    expect(selectDisplayBosses([registered, unregisteredComplete, untouched])).toEqual([
      registered,
      unregisteredComplete,
    ])
  })
})
