import { mergeManualBossList } from '../boss/manual-boss-merge'
import type { BossContent } from '../../types'
import type { ManualTrackedItem } from '../../types/scheduler'

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

  // 결정 5(2026-08-10): 정확 일치 행이 없어도 같은 보스명의 다른 난이도가 완료면 완료로
  // 승격한다. normalize.ts가 하는 보스 단위 승격(032)을 수동 경로에도 적용하는 누락 보완.
  // 그 전에는 난이도를 바꾸는 순간 완료 배지가 사라졌다.
  it('같은 보스의 다른 난이도가 완료면, 정확 일치 행이 없어도 isComplete로 승격한다', () => {
    const tracked = [bossItem('루시드', '하드')]
    const syncedList = [synced({ name: '루시드', difficulty: '노멀', isComplete: true, ownComplete: true })]

    const result = mergeManualBossList(tracked, syncedList)

    expect(result).toEqual([
      // 난이도·cycle·isRegistered 는 폴백 그대로고 isComplete 만 승격된다.
      { name: '루시드', difficulty: '하드', cycle: 'weekly', isRegistered: false, isComplete: true, ownComplete: false },
    ])
  })

  it('승격은 isComplete 에만 걸고 ownComplete 는 원본(false)을 유지한다', () => {
    // 보스 수익이 "실제로 어느 난이도를 처치했는가"를 판정하는 근거라 승격하면 안 된다.
    const tracked = [bossItem('스우', '익스트림')]
    const syncedList = [synced({ name: '스우', difficulty: '하드', isComplete: true, ownComplete: true })]

    const [result] = mergeManualBossList(tracked, syncedList)

    expect(result.isComplete).toBe(true)
    expect(result.ownComplete).toBe(false)
  })

  it('정확 일치 행이 있어도 그 행이 미완료면 다른 난이도의 완료로 승격한다', () => {
    // 익스트림 행이 미등록이라 normalize 단계의 승격(isRegistered 게이트)을 못 받고 온 경우.
    const tracked = [bossItem('스우', '익스트림')]
    const syncedList = [
      synced({ name: '스우', difficulty: '하드', isRegistered: true, isComplete: true, ownComplete: true }),
      synced({ name: '스우', difficulty: '익스트림', isRegistered: false, isComplete: false, ownComplete: false }),
    ]

    const [result] = mergeManualBossList(tracked, syncedList)

    expect(result.difficulty).toBe('익스트림')
    expect(result.isComplete).toBe(true)
    expect(result.ownComplete).toBe(false)
  })

  it('다른 난이도가 모두 미완료면 승격하지 않는다', () => {
    const tracked = [bossItem('루시드', '하드')]
    const syncedList = [synced({ name: '루시드', difficulty: '노멀', isComplete: false, ownComplete: false })]

    const [result] = mergeManualBossList(tracked, syncedList)

    expect(result.isComplete).toBe(false)
  })

  it('다른 보스의 완료는 승격에 쓰이지 않는다', () => {
    const tracked = [bossItem('루시드', '하드')]
    const syncedList = [synced({ name: '윌', difficulty: '하드', isComplete: true, ownComplete: true })]

    const [result] = mergeManualBossList(tracked, syncedList)

    expect(result.isComplete).toBe(false)
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

  // 결정 20(2026-07-25): 표시 순서는 멤버십(tracked) 삽입 순서가 아니라 weekly-bosses.json
  // 순서(보스 관리 페이지와 동일)로 고정한다. 추가/삭제해도 순서가 흔들리지 않게.
  it('반환 순서는 tracked 삽입 순서가 아니라 weekly-bosses.json 순서를 따른다', () => {
    // weekly-bosses.json: 자쿰(0) … 루시드(10) … 검은마법사(monthly, 맨 뒤)
    const tracked = [bossItem('검은마법사', '하드'), bossItem('자쿰', '카오스'), bossItem('루시드', '이지')]

    const result = mergeManualBossList(tracked, [])

    expect(result.map((boss) => boss.name)).toEqual(['자쿰', '루시드', '검은마법사'])
  })

  it('weekly-bosses.json에 없는 보스는 버리지 않고 참조 보스들 뒤에 붙인다', () => {
    const tracked = [bossItem('알 수 없는 보스', '노멀'), bossItem('루시드', '하드'), bossItem('자쿰', '카오스')]

    const result = mergeManualBossList(tracked, [])

    // 참조에 있는 자쿰(0)·루시드(10)가 참조 순서로 먼저, 미지의 보스는 맨 뒤
    expect(result.map((boss) => boss.name)).toEqual(['자쿰', '루시드', '알 수 없는 보스'])
  })

  // 미지의 보스끼리도 **난이도·이름으로 완전 결정**한다. 공용 `compareBossOrder` 를
  // 쓰면서 의 **그들끼리는 tracked 삽입 순서** 를 덮었다. 실제로는 안 생기는
  // 자리다(보스 관리 화면이 참조표에서 고르므로, 참조표에서 보스가 빠진 뒤 남은 저장분뿐이다).
  it('미지의 보스가 둘이면 삽입 순서가 아니라 난이도·이름으로 갈린다', () => {
    const tracked = [bossItem('나중보스', '하드'), bossItem('가나보스', '하드'), bossItem('나중보스', '노멀')]

    const result = mergeManualBossList(tracked, [])

    expect(result.map((boss) => `${boss.name}:${boss.difficulty}`)).toEqual([
      '나중보스:노멀',
      '가나보스:하드',
      '나중보스:하드',
    ])
  })
})
