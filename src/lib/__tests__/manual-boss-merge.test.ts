import { describe, expect, it } from 'vitest'
import { mergeManualBossList } from '../manual-boss-merge'
import type { BossContent } from '../../types'
import type { ManualTrackedItem } from '../../storage/manual-tracked-content'

function bossItem(contentName: string, difficulty: string): ManualTrackedItem {
  return { contentName, kind: 'boss', difficulty }
}

function synced(
  overrides: Partial<BossContent> & { name: string; difficulty: BossContent['difficulty'] },
): BossContent {
  return {
    cycle: 'weekly',
    isRegistered: false,
    isComplete: false,
    ownComplete: false,
    ...overrides,
  }
}

describe('mergeManualBossList', () => {
  it('synced에 (보스, 난이도)가 있으면 등록 여부와 무관하게 synced의 isComplete/ownComplete/cycle을 그대로 쓴다 (공백 차이 정규화)', () => {
    // 추적 이름은 우리 데이터 '검은마법사', synced는 API 원문 '검은 마법사'(공백 있음).
    const tracked = [bossItem('검은마법사', '익스트림')]
    const syncedList = [
      synced({
        name: '검은 마법사',
        difficulty: '익스트림',
        cycle: 'monthly',
        isRegistered: false,
        isComplete: true,
        ownComplete: true,
      }),
    ]

    const result = mergeManualBossList(tracked, syncedList)

    expect(result).toEqual([
      {
        name: '검은 마법사',
        difficulty: '익스트림',
        cycle: 'monthly',
        isRegistered: false,
        isComplete: true,
        ownComplete: true,
      },
    ])
  })

  it('같은 보스라도 난이도가 다르면 매칭하지 않고 폴백(미완료)으로 채운다', () => {
    const tracked = [bossItem('루시드', '하드')]
    const syncedList = [synced({ name: '루시드', difficulty: '노멀', isComplete: true, ownComplete: true })]

    const result = mergeManualBossList(tracked, syncedList)

    expect(result).toEqual([
      { name: '루시드', difficulty: '하드', cycle: 'weekly', isRegistered: false, isComplete: false, ownComplete: false },
    ])
  })

  it('synced에 없는 주간 보스는 weekly-bosses.json 조회로 cycle: weekly, 미완료로 채운다', () => {
    const result = mergeManualBossList([bossItem('자쿰', '카오스')], [])

    expect(result).toEqual([
      { name: '자쿰', difficulty: '카오스', cycle: 'weekly', isRegistered: false, isComplete: false, ownComplete: false },
    ])
  })

  it('synced에 없는 월간 보스는 cycle: monthly로 채운다', () => {
    const result = mergeManualBossList([bossItem('검은마법사', '하드')], [])

    expect(result).toEqual([
      { name: '검은마법사', difficulty: '하드', cycle: 'monthly', isRegistered: false, isComplete: false, ownComplete: false },
    ])
  })

  it('시즌 보스(eventWeekly)는 cycle: weekly로 채운다', () => {
    const result = mergeManualBossList([bossItem('시즌 보스 메이린', '하드')], [])

    expect(result).toEqual([
      {
        name: '시즌 보스 메이린',
        difficulty: '하드',
        cycle: 'weekly',
        isRegistered: false,
        isComplete: false,
        ownComplete: false,
      },
    ])
  })

  it('weekly-bosses.json에 없는 보스명이면 크래시 없이 cycle: weekly로 폴백한다', () => {
    const result = mergeManualBossList([bossItem('알 수 없는 보스', '노멀')], [])

    expect(result).toEqual([
      { name: '알 수 없는 보스', difficulty: '노멀', cycle: 'weekly', isRegistered: false, isComplete: false, ownComplete: false },
    ])
  })

  it('반환 순서는 tracked 배열 순서를 그대로 따른다', () => {
    const tracked = [bossItem('검은마법사', '하드'), bossItem('자쿰', '카오스'), bossItem('루시드', '이지')]

    const result = mergeManualBossList(tracked, [])

    expect(result.map((boss) => boss.name)).toEqual(['검은마법사', '자쿰', '루시드'])
  })
})
