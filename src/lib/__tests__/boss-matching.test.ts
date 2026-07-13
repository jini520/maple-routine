import { describe, expect, it } from 'vitest'
import type { BossContent } from '../../types'
import { matchBossContent } from '../boss-matching'

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

  it('apiAlias로 등록된 예외는 공백 제거로 못 잡아도 매칭된다 ("시즌 보스 메이린" -> "메이린")', () => {
    const result = matchBossContent(bossContent({ name: '시즌 보스 메이린', difficulty: '노멀' }))

    expect(result.matchedBossName).toBe('메이린')
    expect(result.portraitSlug).toBe('maerin')
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
    })
  })
})
