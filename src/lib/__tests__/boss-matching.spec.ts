import weeklyBossesData from '../../data/weekly-bosses.json'
import type { BossContent } from '../../types'
import type { ManualTrackedItem } from '../../types/scheduler'
import {
  compareBossOrder,
  countClearedWeeklyBosses,
  countManualWeeklyBosses,
  isWeeklyClearLimitReached,
  matchBossContent,
  selectBossProfitBosses,
  selectDisplayBosses,
  WEEKLY_BOSS_CLEAR_LIMIT,
  WEEKLY_CRYSTAL_SALE_LIMIT,
  type MatchedBoss,
} from '../boss/boss-matching'

function bossContent(overrides: Partial<BossContent> = {}): BossContent {
  const merged = {
    bossKey: 'zakum',
    apiName: '자쿰',
    difficulty: 'chaos' as const,
    cycle: 'weekly' as const,
    isRegistered: true,
    isComplete: false,
    ...overrides,
  }
  return { ...merged, ownComplete: overrides.ownComplete ?? merged.isComplete }
}

// API 이름에서 key 를 얻는 일은 응답을 앱 상태로 바꿀 때 끝났다. 여기서는 key 로 보스 표의 초상 · 시즌 여부만 채운다.
describe('matchBossContent', () => {
  it('보스 key 로 초상과 시즌 여부를 채우고 나머지는 그대로 옮긴다', () => {
    const result = matchBossContent(bossContent())

    expect(result).toEqual({
      bossKey: 'zakum',
      apiName: '자쿰',
      difficulty: 'chaos',
      cycle: 'weekly',
      isRegistered: true,
      isComplete: false,
      ownComplete: false,
      portraitSlug: 'zakum',
      isSeasonBoss: false,
    })
  })

  it('월간 보스도 key 로 초상을 찾고 API 원문 이름을 보존한다', () => {
    const result = matchBossContent(
      bossContent({ bossKey: 'black_mage', apiName: '검은 마법사', difficulty: 'extreme', cycle: 'monthly', isComplete: true }),
    )

    expect(result.portraitSlug).toBe('blackMage')
    expect(result.apiName).toBe('검은 마법사')
    expect(result.cycle).toBe('monthly')
    expect(result.isComplete).toBe(true)
  })

  it('eventWeekly(시즌 보스) 소속 보스는 isSeasonBoss: true다', () => {
    const result = matchBossContent(bossContent({ bossKey: 'meirin', apiName: '시즌 보스 메이린', difficulty: 'normal' }))

    expect(result.isSeasonBoss).toBe(true)
    expect(result.portraitSlug).toBe('maerin')
  })

  it('일반 주간/월간 보스는 isSeasonBoss: false다', () => {
    expect(matchBossContent(bossContent()).isSeasonBoss).toBe(false)
    expect(
      matchBossContent(bossContent({ bossKey: 'black_mage', apiName: '검은 마법사', cycle: 'monthly', difficulty: 'extreme' }))
        .isSeasonBoss,
    ).toBe(false)
  })

  it('보스 표에 없는 보스(key 없음)는 에러 없이 초상 null · 시즌 아님으로 두고 원문을 보존한다', () => {
    const result = matchBossContent(bossContent({ bossKey: null, apiName: '알 수 없는 콘텐츠', difficulty: 'normal' }))

    expect(result).toEqual({
      bossKey: null,
      apiName: '알 수 없는 콘텐츠',
      difficulty: 'normal',
      cycle: 'weekly',
      isRegistered: true,
      isComplete: false,
      ownComplete: false,
      portraitSlug: null,
      isSeasonBoss: false,
    })
  })

  it('ownComplete를 승격 없이 그대로 전달한다', () => {
    const result = matchBossContent(bossContent({ isComplete: true, ownComplete: false }))

    expect(result.isComplete).toBe(true)
    expect(result.ownComplete).toBe(false)
  })
})

describe('WEEKLY_BOSS_CLEAR_LIMIT', () => {
  it('weekly-bosses.json의 weeklyBossSelectionLimit(12)를 그대로 노출한다', () => {
    expect(WEEKLY_BOSS_CLEAR_LIMIT).toBe(12)
  })
})

// 캐릭터당 한도(12)와 월드당 결정석 판매 한도(90)는 별개 지표다.
describe('WEEKLY_CRYSTAL_SALE_LIMIT', () => {
  it('weekly-bosses.json의 weeklyCrystalSaleLimit(90)을 그대로 노출한다', () => {
    expect(WEEKLY_CRYSTAL_SALE_LIMIT).toBe(90)
  })

  it('캐릭터당 한도(12)와 월드당 한도(90)는 서로 다른 값이다. 둘을 혼용하는 회귀 가드', () => {
    expect(WEEKLY_CRYSTAL_SALE_LIMIT).not.toBe(WEEKLY_BOSS_CLEAR_LIMIT)
  })
})

function matchedBoss(overrides: Partial<MatchedBoss> = {}): MatchedBoss {
  const merged = {
    bossKey: 'zakum' as string | null,
    apiName: '자쿰',
    difficulty: 'chaos' as const,
    cycle: 'weekly' as const,
    isRegistered: true,
    isComplete: false,
    portraitSlug: 'zakum',
    isSeasonBoss: false,
    ...overrides,
  }
  return { ...merged, ownComplete: overrides.ownComplete ?? merged.isComplete }
}

const 루시드 = { bossKey: 'lucid', apiName: '루시드', portraitSlug: 'lucid' }

describe('countClearedWeeklyBosses', () => {
  it('등록되고 완료된 주간 보스를 센다', () => {
    const bosses = [matchedBoss({ isRegistered: true, isComplete: true })]
    expect(countClearedWeeklyBosses(bosses)).toBe(1)
  })

  it('등록 여부와 무관하게 완료된 주간 보스는 카운트에 포함된다. 등록 없이 잡아도 센다', () => {
    const bosses = [matchedBoss({ isRegistered: false, isComplete: true })]
    expect(countClearedWeeklyBosses(bosses)).toBe(1)
  })

  it('미완료 보스는 세지 않는다', () => {
    const bosses = [matchedBoss({ isRegistered: true, isComplete: false })]
    expect(countClearedWeeklyBosses(bosses)).toBe(0)
  })

  it('시즌 보스는 완료·등록 여부와 무관하게 카운트에서 제외된다', () => {
    const bosses = [
      matchedBoss({
        bossKey: 'meirin',
        apiName: '시즌 보스 메이린',
        isRegistered: true,
        isComplete: true,
        isSeasonBoss: true,
      }),
    ]
    expect(countClearedWeeklyBosses(bosses)).toBe(0)
  })

  it('월간 보스는 카운트에서 제외된다', () => {
    const bosses = [
      matchedBoss({ bossKey: 'black_mage', apiName: '검은 마법사', cycle: 'monthly', isRegistered: true, isComplete: true }),
    ]
    expect(countClearedWeeklyBosses(bosses)).toBe(0)
  })

  it('같은 보스를 서로 다른 난이도로 동시에 완료해도 1로만 센다(보스 key 단위)', () => {
    const bosses = [
      matchedBoss({ ...루시드, difficulty: 'normal', isRegistered: false, isComplete: true }),
      matchedBoss({ ...루시드, difficulty: 'hard', isRegistered: false, isComplete: true }),
    ]
    expect(countClearedWeeklyBosses(bosses)).toBe(1)
  })

  it('서로 다른 보스는 각각 센다', () => {
    const bosses = [
      matchedBoss({ isRegistered: true, isComplete: true }),
      matchedBoss({ ...루시드, difficulty: 'hard', isRegistered: true, isComplete: true }),
    ]
    expect(countClearedWeeklyBosses(bosses)).toBe(2)
  })

  // 보스 표에 없는 보스도 스케줄러 처치 수에는 선다. key 가 없어 API 원문으로 묶는다.
  it('key 가 없는 보스는 API 원문으로 묶어 센다', () => {
    const bosses = [
      matchedBoss({ bossKey: null, apiName: '새 보스', difficulty: 'normal', isComplete: true }),
      matchedBoss({ bossKey: null, apiName: '새 보스', difficulty: 'hard', isComplete: true }),
      matchedBoss({ bossKey: null, apiName: '또 다른 새 보스', difficulty: 'normal', isComplete: true }),
    ]
    expect(countClearedWeeklyBosses(bosses)).toBe(2)
  })
})

describe('isWeeklyClearLimitReached', () => {
  // 보스 표에서 앞에서부터 뽑는다. 보스 key 를 손으로 적지 않는다.
  const WEEKLY_BOSSES = weeklyBossesData.weekly as { key: string; name: string }[]

  function cleared(count: number): MatchedBoss[] {
    return WEEKLY_BOSSES.slice(0, count).map((entry) =>
      matchedBoss({ bossKey: entry.key, apiName: entry.name, isComplete: true, ownComplete: true }),
    )
  }

  it('한도보다 적게 잡았으면 false 다', () => {
    expect(isWeeklyClearLimitReached(cleared(WEEKLY_BOSS_CLEAR_LIMIT - 1))).toBe(false)
  })

  it('한도만큼 잡았으면 true 다', () => {
    expect(isWeeklyClearLimitReached(cleared(WEEKLY_BOSS_CLEAR_LIMIT))).toBe(true)
  })

  // 세는 규칙은 countClearedWeeklyBosses 그대로여야 한다. 두 벌이 되면 **선택은 12/12 인데
  // 처치는 11/12** 가 다시 생긴다.
  it('시즌 보스는 한도를 채우지 않는다', () => {
    const bosses = [
      ...cleared(WEEKLY_BOSS_CLEAR_LIMIT - 1),
      matchedBoss({
        bossKey: 'meirin',
        apiName: '시즌 보스 메이린',
        isSeasonBoss: true,
        isComplete: true,
        ownComplete: true,
      }),
    ]
    expect(isWeeklyClearLimitReached(bosses)).toBe(false)
  })

  it('월간 보스는 한도를 채우지 않는다', () => {
    const bosses = [
      ...cleared(WEEKLY_BOSS_CLEAR_LIMIT - 1),
      matchedBoss({ bossKey: 'black_mage', apiName: '검은 마법사', cycle: 'monthly', isComplete: true, ownComplete: true }),
    ]
    expect(isWeeklyClearLimitReached(bosses)).toBe(false)
  })
})

describe('selectDisplayBosses', () => {
  it('등록된 항목이 있으면 그 항목만 카드로 선택한다', () => {
    const bosses = [matchedBoss({ isRegistered: true, isComplete: false })]
    expect(selectDisplayBosses(bosses)).toEqual(bosses)
  })

  it('등록된 난이도가 없어도 완료된 난이도가 있으면 그 난이도를 카드로 선택한다', () => {
    const cleared = matchedBoss({ isRegistered: false, isComplete: true })
    expect(selectDisplayBosses([cleared])).toEqual([cleared])
  })

  it('등록도 완료도 없는 항목은 선택하지 않는다', () => {
    const untouched = matchedBoss({ isRegistered: false, isComplete: false })
    expect(selectDisplayBosses([untouched])).toEqual([])
  })

  it('등록된 난이도가 있으면, 같은 보스의 다른 미등록 완료 난이도는 중복으로 추가하지 않는다', () => {
    const registered = matchedBoss({ ...루시드, difficulty: 'hard', isRegistered: true, isComplete: true })
    const unregisteredComplete = matchedBoss({ ...루시드, difficulty: 'normal', isRegistered: false, isComplete: true })

    expect(selectDisplayBosses([registered, unregisteredComplete])).toEqual([registered])
  })

  it('서로 다른 보스는 독립적으로 판정된다', () => {
    const registered = matchedBoss({ isRegistered: true, isComplete: false })
    const unregisteredComplete = matchedBoss({ ...루시드, difficulty: 'hard', isRegistered: false, isComplete: true })
    const untouched = matchedBoss({
      bossKey: 'lotus',
      apiName: '스우',
      difficulty: 'normal',
      isRegistered: false,
      isComplete: false,
    })

    expect(selectDisplayBosses([registered, unregisteredComplete, untouched])).toEqual([
      registered,
      unregisteredComplete,
    ])
  })

  // 보스 표에 없는 보스도 카드는 선다. 수익 선택과 다르다.
  it('key 가 없는 보스도 카드로 선택한다', () => {
    const unknown = matchedBoss({ bossKey: null, apiName: '새 보스', difficulty: 'normal', isRegistered: true })
    expect(selectDisplayBosses([unknown])).toEqual([unknown])
  })
})

describe('selectBossProfitBosses', () => {
  it('등록 난이도와 실제 처치 난이도가 다르면, 실제 처치 난이도(ownComplete)를 선택하고 등록 난이도는 제외한다', () => {
    // 이지로 등록했지만 실제로는 노멀을 처치한 상황. isComplete는 승격으로 이지도 true지만
    // ownComplete는 노멀만 true다.
    const registeredEasy = matchedBoss({
      ...루시드,
      difficulty: 'easy',
      isRegistered: true,
      isComplete: true,
      ownComplete: false,
    })
    const actualNormal = matchedBoss({
      ...루시드,
      difficulty: 'normal',
      isRegistered: false,
      isComplete: true,
      ownComplete: true,
    })

    expect(selectBossProfitBosses([registeredEasy, actualNormal])).toEqual([actualNormal])
  })

  it('아직 미완료면 등록 난이도를 placeholder로 선택한다', () => {
    const registered = matchedBoss({ isRegistered: true, isComplete: false, ownComplete: false })
    expect(selectBossProfitBosses([registered])).toEqual([registered])
  })

  it('등록 난이도 자체가 실제로 완료됐으면(승격과 무관하게) 그대로 선택한다', () => {
    const registered = matchedBoss({ isRegistered: true, isComplete: true, ownComplete: true })
    expect(selectBossProfitBosses([registered])).toEqual([registered])
  })

  it('등록도 완료도 없으면 선택하지 않는다', () => {
    const untouched = matchedBoss({ isRegistered: false, isComplete: false, ownComplete: false })
    expect(selectBossProfitBosses([untouched])).toEqual([])
  })

  it('등록 없이 완료된 난이도는 그대로 선택한다', () => {
    const cleared = matchedBoss({ isRegistered: false, isComplete: true, ownComplete: true })
    expect(selectBossProfitBosses([cleared])).toEqual([cleared])
  })

  it('서로 다른 보스는 독립적으로 판정된다', () => {
    const registeredEasy = matchedBoss({
      ...루시드,
      difficulty: 'easy',
      isRegistered: true,
      isComplete: true,
      ownComplete: false,
    })
    const actualNormal = matchedBoss({
      ...루시드,
      difficulty: 'normal',
      isRegistered: false,
      isComplete: true,
      ownComplete: true,
    })
    const placeholder = matchedBoss({ isRegistered: true, isComplete: false, ownComplete: false })

    expect(selectBossProfitBosses([registeredEasy, actualNormal, placeholder])).toEqual([actualNormal, placeholder])
  })

  // 결정석 가격도 기록할 key 도 없어 수익 행이 될 수 없다.
  it('key 가 없는 보스는 완료여도 선택하지 않는다', () => {
    const unknown = matchedBoss({
      bossKey: null,
      apiName: '새 보스',
      difficulty: 'normal',
      isRegistered: true,
      isComplete: true,
      ownComplete: true,
    })
    const known = matchedBoss({ isRegistered: true, isComplete: true, ownComplete: true })

    expect(selectBossProfitBosses([unknown, known])).toEqual([known])
  })
})

// 앱의 보스 목록 넷(스케줄러· today 펼침· 보스 수익· 가계부 타일)이 이 비교자
// 하나를 부른다. 키 셋은 이 보스 수익에 정한 그것 그대로다. 정렬 코드가 네
// 벌이면 값을 바꿀 때 한 벌만 바뀐다.
describe('compareBossOrder', () => {
  function sorted(entries: { boss: string; difficulty: string }[]): string[] {
    return [...entries].sort(compareBossOrder).map((entry) => `${entry.boss}:${entry.difficulty}`)
  }

  it('1차 키는 보스 표 차례다', () => {
    expect(
      sorted([
        { boss: 'lucid', difficulty: 'hard' },
        { boss: 'zakum', difficulty: 'hard' },
        { boss: 'lotus', difficulty: 'hard' },
      ]),
    ).toEqual(['zakum:hard', 'lotus:hard', 'lucid:hard'])
  })

  it('같은 보스면 난이도 순서다(easy < normal < hard < chaos < extreme)', () => {
    expect(
      sorted([
        { boss: 'lotus', difficulty: 'extreme' },
        { boss: 'lotus', difficulty: 'normal' },
        { boss: 'lotus', difficulty: 'hard' },
        { boss: 'lotus', difficulty: 'easy' },
      ]),
    ).toEqual(['lotus:easy', 'lotus:normal', 'lotus:hard', 'lotus:extreme'])
  })

  it('eventWeekly(시즌 보스 메이린)는 weekly 뒤, monthly(검은 마법사)는 맨 뒤에 온다', () => {
    expect(
      sorted([
        { boss: 'black_mage', difficulty: 'hard' },
        { boss: 'meirin', difficulty: 'hard' },
        { boss: 'kaling', difficulty: 'hard' },
      ]),
    ).toEqual(['kaling:hard', 'meirin:hard', 'black_mage:hard'])
  })

  // 표에 없는 보스(스케줄러 카드에만 서는 API 원문)는 맨 뒤이고, 그들끼리도 완전 결정적이어야
  // 한다. 입력 순서에 기대면 이 없앤 비결정성이 되살아난다.
  it('표에 없는 보스는 맨 뒤로 가고 그들끼리는 난이도·글자로 갈린다', () => {
    expect(
      sorted([
        { boss: '나중보스', difficulty: 'hard' },
        { boss: 'black_mage', difficulty: 'hard' },
        { boss: '가나보스', difficulty: 'hard' },
        { boss: '나중보스', difficulty: 'normal' },
      ]),
    ).toEqual(['black_mage:hard', '나중보스:normal', '가나보스:hard', '나중보스:hard'])
  })

  it('입력 순서를 뒤집어도 결과가 같다', () => {
    const entries = [
      { boss: 'lucid', difficulty: 'hard' },
      { boss: 'zakum', difficulty: 'chaos' },
      { boss: 'black_mage', difficulty: 'extreme' },
      { boss: 'lotus', difficulty: 'normal' },
    ]

    expect(sorted([...entries].reverse())).toEqual(sorted(entries))
  })
})

// 수동 선택 12개 한도의 카운트 규칙을 여기 한 곳에만 둔다. 관리 화면의 주간 섹션은 weekly와
// eventWeekly를 합쳐 출처 구분을 잃으므로, 주기·시즌 여부는 반드시 보스 표에서 되찾아야 한다.
describe('countManualWeeklyBosses', () => {
  const bossItem = (bossKey: string, difficulty: 'easy' | 'normal' | 'hard' | 'chaos' | 'extreme'): ManualTrackedItem => ({
    kind: 'boss',
    bossKey,
    difficulty,
  })

  it('주간 보스 항목 수를 센다', () => {
    expect(countManualWeeklyBosses([bossItem('zakum', 'chaos'), bossItem('lotus', 'hard')])).toBe(2)
  })

  it('시즌 보스(메이린)는 세지 않는다. countClearedWeeklyBosses와 같은 규칙', () => {
    expect(countManualWeeklyBosses([bossItem('zakum', 'chaos'), bossItem('meirin', 'normal')])).toBe(1)
  })

  it('월간 보스(검은 마법사)는 세지 않는다. 같은 배열에 kind: boss로 저장되지만 주간 한도와 무관하다', () => {
    expect(countManualWeeklyBosses([bossItem('zakum', 'chaos'), bossItem('black_mage', 'hard')])).toBe(1)
  })

  it('컨텐츠 항목(kind: daily/weekly)은 세지 않는다', () => {
    const items: ManualTrackedItem[] = [
      bossItem('zakum', 'chaos'),
      { contentKey: 'monster_park', kind: 'daily' },
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
    ]
    expect(countManualWeeklyBosses(items)).toBe(1)
  })

  it('보스 표에 없는 key 는 주기를 알 수 없으므로 세지 않는다', () => {
    expect(countManualWeeklyBosses([bossItem('unknown_boss', 'normal')])).toBe(0)
  })

  it('같은 보스의 다른 난이도는 각각 센다. 저장 단위가 (보스, 난이도) 쌍이다', () => {
    expect(countManualWeeklyBosses([bossItem('lotus', 'normal'), bossItem('lotus', 'hard')])).toBe(2)
  })
})
