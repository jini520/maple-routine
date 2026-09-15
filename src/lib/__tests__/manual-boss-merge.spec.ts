import { mergeManualBossList } from '../boss/manual-boss-merge'
import type { BossContent, BossDifficulty } from '../../types'
import type { ManualTrackedBossItem } from '../../types/scheduler'

function bossItem(bossKey: string, difficulty: BossDifficulty): ManualTrackedBossItem {
  return { kind: 'boss', bossKey, difficulty }
}

function synced(
  overrides: Partial<BossContent> & { bossKey: string | null; apiName: string; difficulty: BossContent['difficulty'] },
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
  it('synced에 (보스 key, 난이도)가 있으면 등록 여부와 무관하게 synced의 isComplete/ownComplete/cycle을 그대로 쓴다', () => {
    const tracked = [bossItem('black_mage', 'extreme')]
    const syncedList = [
      synced({
        bossKey: 'black_mage',
        apiName: '검은 마법사',
        difficulty: 'extreme',
        cycle: 'monthly',
        isRegistered: false,
        isComplete: true,
        ownComplete: true,
      }),
    ]

    const result = mergeManualBossList(tracked, syncedList)

    expect(result).toEqual([
      {
        bossKey: 'black_mage',
        apiName: '검은 마법사',
        difficulty: 'extreme',
        cycle: 'monthly',
        isRegistered: false,
        isComplete: true,
        ownComplete: true,
      },
    ])
  })

  // 정확 일치 행이 없어도 같은 보스의 다른 난이도가 완료면 완료로
  // 승격한다. normalize.ts가 하는 보스 단위 승격(032)을 수동 경로에도 적용하는 누락 보완.
  // 그 전에는 난이도를 바꾸는 순간 완료 배지가 사라졌다.
  it('같은 보스의 다른 난이도가 완료면, 정확 일치 행이 없어도 isComplete로 승격한다', () => {
    const tracked = [bossItem('lucid', 'hard')]
    const syncedList = [
      synced({ bossKey: 'lucid', apiName: '루시드', difficulty: 'normal', isComplete: true, ownComplete: true }),
    ]

    const result = mergeManualBossList(tracked, syncedList)

    expect(result).toEqual([
      // 난이도·cycle·isRegistered 는 폴백 그대로고 isComplete 만 승격된다.
      {
        bossKey: 'lucid',
        apiName: '루시드',
        difficulty: 'hard',
        cycle: 'weekly',
        isRegistered: false,
        isComplete: true,
        ownComplete: false,
      },
    ])
  })

  it('승격은 isComplete 에만 걸고 ownComplete 는 원본(false)을 유지한다', () => {
    // 보스 수익이 "실제로 어느 난이도를 처치했는가"를 판정하는 근거라 승격하면 안 된다.
    const tracked = [bossItem('lotus', 'extreme')]
    const syncedList = [synced({ bossKey: 'lotus', apiName: '스우', difficulty: 'hard', isComplete: true, ownComplete: true })]

    const [result] = mergeManualBossList(tracked, syncedList)

    expect(result.isComplete).toBe(true)
    expect(result.ownComplete).toBe(false)
  })

  it('정확 일치 행이 있어도 그 행이 미완료면 다른 난이도의 완료로 승격한다', () => {
    // 익스트림 행이 미등록이라 normalize 단계의 승격(isRegistered 게이트)을 못 받고 온 경우.
    const tracked = [bossItem('lotus', 'extreme')]
    const syncedList = [
      synced({ bossKey: 'lotus', apiName: '스우', difficulty: 'hard', isRegistered: true, isComplete: true, ownComplete: true }),
      synced({ bossKey: 'lotus', apiName: '스우', difficulty: 'extreme', isRegistered: false, isComplete: false, ownComplete: false }),
    ]

    const [result] = mergeManualBossList(tracked, syncedList)

    expect(result.difficulty).toBe('extreme')
    expect(result.isComplete).toBe(true)
    expect(result.ownComplete).toBe(false)
  })

  it('다른 난이도가 모두 미완료면 승격하지 않는다', () => {
    const tracked = [bossItem('lucid', 'hard')]
    const syncedList = [
      synced({ bossKey: 'lucid', apiName: '루시드', difficulty: 'normal', isComplete: false, ownComplete: false }),
    ]

    const [result] = mergeManualBossList(tracked, syncedList)

    expect(result.isComplete).toBe(false)
  })

  it('다른 보스의 완료는 승격에 쓰이지 않는다', () => {
    const tracked = [bossItem('lucid', 'hard')]
    const syncedList = [synced({ bossKey: 'will', apiName: '윌', difficulty: 'hard', isComplete: true, ownComplete: true })]

    const [result] = mergeManualBossList(tracked, syncedList)

    expect(result.isComplete).toBe(false)
  })

  // 보스 표에 없는 동기화 항목은 key 가 없어 추적 항목과 이어지지 않는다.
  it('key 가 없는 동기화 항목은 추적 항목과 이어지지 않는다', () => {
    const tracked = [bossItem('lucid', 'hard')]
    const syncedList = [synced({ bossKey: null, apiName: '루시드', difficulty: 'hard', isComplete: true, ownComplete: true })]

    const [result] = mergeManualBossList(tracked, syncedList)

    expect(result).toMatchObject({ bossKey: 'lucid', isComplete: false, ownComplete: false })
  })

  it('synced에 없는 주간 보스는 보스 표의 이름과 cycle: weekly, 미완료로 채운다', () => {
    const result = mergeManualBossList([bossItem('zakum', 'chaos')], [])

    expect(result).toEqual([
      {
        bossKey: 'zakum',
        apiName: '자쿰',
        difficulty: 'chaos',
        cycle: 'weekly',
        isRegistered: false,
        isComplete: false,
        ownComplete: false,
      },
    ])
  })

  it('synced에 없는 월간 보스는 cycle: monthly로 채우고 이름은 API 표기다', () => {
    const result = mergeManualBossList([bossItem('black_mage', 'hard')], [])

    expect(result).toEqual([
      {
        bossKey: 'black_mage',
        apiName: '검은 마법사',
        difficulty: 'hard',
        cycle: 'monthly',
        isRegistered: false,
        isComplete: false,
        ownComplete: false,
      },
    ])
  })

  it('시즌 보스(eventWeekly)는 cycle: weekly로 채운다', () => {
    const result = mergeManualBossList([bossItem('meirin', 'hard')], [])

    expect(result).toEqual([
      {
        bossKey: 'meirin',
        apiName: '시즌 보스 메이린',
        difficulty: 'hard',
        cycle: 'weekly',
        isRegistered: false,
        isComplete: false,
        ownComplete: false,
      },
    ])
  })

  it('보스 표에 없는 key 면 크래시 없이 key 를 이름으로, cycle: weekly로 폴백한다', () => {
    const result = mergeManualBossList([bossItem('unknown_boss', 'normal')], [])

    expect(result).toEqual([
      {
        bossKey: 'unknown_boss',
        apiName: 'unknown_boss',
        difficulty: 'normal',
        cycle: 'weekly',
        isRegistered: false,
        isComplete: false,
        ownComplete: false,
      },
    ])
  })

  // 표시 순서는 멤버십(tracked) 삽입 순서가 아니라 보스 표
  // 순서(보스 관리 페이지와 동일)로 고정한다. 추가/삭제해도 순서가 흔들리지 않게.
  it('반환 순서는 tracked 삽입 순서가 아니라 보스 표 순서를 따른다', () => {
    // 보스 표: 자쿰(0) … 루시드(10) … 검은 마법사(monthly, 맨 뒤)
    const tracked = [bossItem('black_mage', 'hard'), bossItem('zakum', 'chaos'), bossItem('lucid', 'easy')]

    const result = mergeManualBossList(tracked, [])

    expect(result.map((boss) => boss.bossKey)).toEqual(['zakum', 'lucid', 'black_mage'])
  })

  it('보스 표에 없는 보스는 버리지 않고 표의 보스들 뒤에 붙인다', () => {
    const tracked = [bossItem('unknown_boss', 'normal'), bossItem('lucid', 'hard'), bossItem('zakum', 'chaos')]

    const result = mergeManualBossList(tracked, [])

    // 표에 있는 자쿰(0)·루시드(10)가 표 순서로 먼저, 모르는 보스는 맨 뒤
    expect(result.map((boss) => boss.bossKey)).toEqual(['zakum', 'lucid', 'unknown_boss'])
  })

  // 모르는 보스끼리도 **난이도·key 로 완전 결정**한다. 공용 `compareBossOrder` 를
  // 쓰면서 **그들끼리는 tracked 삽입 순서** 를 덮었다. 실제로는 안 생기는
  // 자리다(보스 관리 화면이 표에서 고르므로, 표에서 보스가 빠진 뒤 남은 저장분뿐이다).
  it('모르는 보스가 둘이면 삽입 순서가 아니라 난이도·key 로 갈린다', () => {
    const tracked = [bossItem('later_boss', 'hard'), bossItem('early_boss', 'hard'), bossItem('later_boss', 'normal')]

    const result = mergeManualBossList(tracked, [])

    expect(result.map((boss) => `${boss.bossKey}:${boss.difficulty}`)).toEqual([
      'later_boss:normal',
      'early_boss:hard',
      'later_boss:hard',
    ])
  })
})
