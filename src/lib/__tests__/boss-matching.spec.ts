import weeklyBossesData from '../../data/weekly-bosses.json'
import type { BossContent } from '../../types'
import type { ManualTrackedItem } from '../../types/scheduler'
import {
  compareBossOrder,
  countClearedWeeklyBosses,
  countManualWeeklyBosses,
  getBossCycleByName,
  getBossReferenceOrder,
  isSeasonBossName,
  isWeeklyClearLimitReached,
  matchBossContent,
  selectBossProfitBosses,
  selectDisplayBosses,
  WEEKLY_BOSS_CLEAR_LIMIT,
  WEEKLY_CRYSTAL_SALE_LIMIT,
  type MatchedBoss,
} from '../boss-matching'

function bossContent(overrides: Partial<BossContent> = {}): BossContent {
  const merged = {
    name: '자쿰',
    difficulty: '카오스' as const,
    cycle: 'weekly' as const,
    isRegistered: true,
    isComplete: false,
    ...overrides,
  }
  return { ...merged, ownComplete: overrides.ownComplete ?? merged.isComplete }
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
      ownComplete: false,
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
      ownComplete: false,
      matchedBossName: null,
      portraitSlug: null,
      isSeasonBoss: false,
    })
  })

  it('ownComplete를 승격 없이 그대로 전달한다(ADR-032)', () => {
    const result = matchBossContent(bossContent({ name: '자쿰', isComplete: true, ownComplete: false }))

    expect(result.isComplete).toBe(true)
    expect(result.ownComplete).toBe(false)
  })
})

describe('WEEKLY_BOSS_CLEAR_LIMIT', () => {
  it('weekly-bosses.json의 weeklyBossSelectionLimit(12)를 그대로 노출한다', () => {
    expect(WEEKLY_BOSS_CLEAR_LIMIT).toBe(12)
  })
})

// ADR-054 결정 2: 캐릭터당 한도(12)와 월드당 결정석 판매 한도(90)는 별개 지표다.
describe('WEEKLY_CRYSTAL_SALE_LIMIT (ADR-054)', () => {
  it('weekly-bosses.json의 weeklyCrystalSaleLimit(90)을 그대로 노출한다', () => {
    expect(WEEKLY_CRYSTAL_SALE_LIMIT).toBe(90)
  })

  it('캐릭터당 한도(12)와 월드당 한도(90)는 서로 다른 값이다 — 둘을 혼용하는 회귀 가드', () => {
    expect(WEEKLY_CRYSTAL_SALE_LIMIT).not.toBe(WEEKLY_BOSS_CLEAR_LIMIT)
  })
})

// ADR-054 결정 3: 보스 표시명(BossProfitRow.boss)으로 시즌 보스 여부를 조회한다 —
// 주간 처치 수·결정석 판매 수 집계에서 시즌 보스를 빼는 판정에 쓴다.
describe('isSeasonBossName (ADR-054)', () => {
  it('eventWeekly 소속 보스명은 true다', () => {
    expect(isSeasonBossName('시즌 보스 메이린')).toBe(true)
  })

  it('weekly 소속 보스명은 false다', () => {
    expect(isSeasonBossName('자쿰')).toBe(false)
  })

  it('monthly 소속 보스명은 false다', () => {
    expect(isSeasonBossName('검은마법사')).toBe(false)
  })

  it('참조 목록에 없는 이름(매칭 실패 원문명)은 false다', () => {
    expect(isSeasonBossName('존재하지 않는 보스')).toBe(false)
  })
})

function matchedBoss(overrides: Partial<MatchedBoss> = {}): MatchedBoss {
  const merged = {
    apiName: '자쿰',
    difficulty: '카오스' as const,
    cycle: 'weekly' as const,
    isRegistered: true,
    isComplete: false,
    matchedBossName: '자쿰',
    portraitSlug: 'zakum',
    isSeasonBoss: false,
    ...overrides,
  }
  return { ...merged, ownComplete: overrides.ownComplete ?? merged.isComplete }
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

describe('isWeeklyClearLimitReached ([[ADR-187]] 결정 1)', () => {
  // 참조표에서 앞에서부터 뽑는다 — 보스 이름을 손으로 적지 않는다([[ADR-006]]).
  const WEEKLY_NAMES = (weeklyBossesData.weekly as { boss: string }[]).map((entry) => entry.boss)

  function cleared(count: number): MatchedBoss[] {
    return WEEKLY_NAMES.slice(0, count).map((name) =>
      matchedBoss({ apiName: name, matchedBossName: name, isComplete: true, ownComplete: true }),
    )
  }

  it('한도보다 적게 잡았으면 false 다', () => {
    expect(isWeeklyClearLimitReached(cleared(WEEKLY_BOSS_CLEAR_LIMIT - 1))).toBe(false)
  })

  it('한도만큼 잡았으면 true 다', () => {
    expect(isWeeklyClearLimitReached(cleared(WEEKLY_BOSS_CLEAR_LIMIT))).toBe(true)
  })

  // 세는 규칙은 countClearedWeeklyBosses 그대로여야 한다 — 두 벌이 되면 «선택은 12/12 인데
  // 처치는 11/12» 가 다시 생긴다([[ADR-055]] 결정 3).
  it('시즌 보스는 한도를 채우지 않는다', () => {
    const bosses = [
      ...cleared(WEEKLY_BOSS_CLEAR_LIMIT - 1),
      matchedBoss({
        apiName: '시즌 보스 메이린',
        matchedBossName: '메이린',
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
      matchedBoss({ apiName: '검은 마법사', cycle: 'monthly', isComplete: true, ownComplete: true }),
    ]
    expect(isWeeklyClearLimitReached(bosses)).toBe(false)
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

describe('selectBossProfitBosses (ADR-032)', () => {
  it('등록 난이도와 실제 처치 난이도가 다르면, 실제 처치 난이도(ownComplete)를 선택하고 등록 난이도는 제외한다', () => {
    // 이지로 등록했지만 실제로는 노멀을 처치한 상황 — isComplete는 승격으로 이지도 true지만
    // ownComplete는 노멀만 true다.
    const registeredEasy = matchedBoss({
      apiName: '루시드',
      difficulty: '이지',
      isRegistered: true,
      isComplete: true,
      ownComplete: false,
    })
    const actualNormal = matchedBoss({
      apiName: '루시드',
      difficulty: '노멀',
      isRegistered: false,
      isComplete: true,
      ownComplete: true,
    })

    expect(selectBossProfitBosses([registeredEasy, actualNormal])).toEqual([actualNormal])
  })

  it('아직 미완료면 등록 난이도를 placeholder로 선택한다', () => {
    const registered = matchedBoss({ apiName: '자쿰', isRegistered: true, isComplete: false, ownComplete: false })
    expect(selectBossProfitBosses([registered])).toEqual([registered])
  })

  it('등록 난이도 자체가 실제로 완료됐으면(승격과 무관하게) 그대로 선택한다', () => {
    const registered = matchedBoss({ apiName: '자쿰', isRegistered: true, isComplete: true, ownComplete: true })
    expect(selectBossProfitBosses([registered])).toEqual([registered])
  })

  it('등록도 완료도 없으면 선택하지 않는다', () => {
    const untouched = matchedBoss({ apiName: '자쿰', isRegistered: false, isComplete: false, ownComplete: false })
    expect(selectBossProfitBosses([untouched])).toEqual([])
  })

  it('등록 없이 완료된 난이도는 그대로 선택한다', () => {
    const cleared = matchedBoss({ apiName: '자쿰', isRegistered: false, isComplete: true, ownComplete: true })
    expect(selectBossProfitBosses([cleared])).toEqual([cleared])
  })

  it('서로 다른 보스는 독립적으로 판정된다', () => {
    const registeredEasy = matchedBoss({
      apiName: '루시드',
      difficulty: '이지',
      isRegistered: true,
      isComplete: true,
      ownComplete: false,
    })
    const actualNormal = matchedBoss({
      apiName: '루시드',
      difficulty: '노멀',
      isRegistered: false,
      isComplete: true,
      ownComplete: true,
    })
    const placeholder = matchedBoss({ apiName: '자쿰', isRegistered: true, isComplete: false, ownComplete: false })

    expect(selectBossProfitBosses([registeredEasy, actualNormal, placeholder])).toEqual([actualNormal, placeholder])
  })
})

// ADR-036: weekly-bosses.json 정규 순서(REFERENCE_ENTRIES: weekly → eventWeekly → monthly) 인덱스.
// 보스 수익 페이지·보스 관리(수동 병합)가 캐릭터 내부/추적 목록 보스 순서를 데이터 소스 순서에
// 의존하지 않고 이 정규 순서로 고정하기 위한 공용 정렬 키다.
describe('getBossReferenceOrder', () => {
  it('weekly-bosses.json 나열 순서대로 오름차순 인덱스를 부여한다(자쿰 < 매그너스 < 스우 < 루시드)', () => {
    expect(getBossReferenceOrder('자쿰')).toBe(0)
    expect(getBossReferenceOrder('자쿰')).toBeLessThan(getBossReferenceOrder('매그너스'))
    expect(getBossReferenceOrder('매그너스')).toBeLessThan(getBossReferenceOrder('스우'))
    expect(getBossReferenceOrder('스우')).toBeLessThan(getBossReferenceOrder('루시드'))
  })

  it('eventWeekly(시즌 보스 메이린)는 weekly 뒤, monthly(검은마법사)는 맨 뒤에 온다', () => {
    expect(getBossReferenceOrder('카링')).toBeLessThan(getBossReferenceOrder('시즌 보스 메이린'))
    expect(getBossReferenceOrder('시즌 보스 메이린')).toBeLessThan(getBossReferenceOrder('검은마법사'))
  })

  it('참조 목록에 없는 보스(매칭 실패 원문명)는 Number.MAX_SAFE_INTEGER로 맨 뒤로 보낸다', () => {
    expect(getBossReferenceOrder('알 수 없는 보스')).toBe(Number.MAX_SAFE_INTEGER)
    expect(getBossReferenceOrder('검은마법사')).toBeLessThan(getBossReferenceOrder('알 수 없는 보스'))
  })
})

// [[ADR-186]]: 앱의 보스 목록 넷(스케줄러 · today 펼침 · 보스 수익 · 가계부 타일)이 이 비교자
// 하나를 부른다. 키 셋은 [[ADR-036]] 결정 3 이 보스 수익에 정한 그것 그대로다 — 정렬 코드가 네
// 벌이면 값을 바꿀 때 한 벌만 바뀐다.
describe('compareBossOrder ([[ADR-186]])', () => {
  function sorted(entries: { boss: string; difficulty: string }[]): string[] {
    return [...entries].sort(compareBossOrder).map((entry) => `${entry.boss}:${entry.difficulty}`)
  }

  it('1차 키는 weekly-bosses.json 정규 순서다', () => {
    expect(
      sorted([
        { boss: '루시드', difficulty: '하드' },
        { boss: '자쿰', difficulty: '하드' },
        { boss: '스우', difficulty: '하드' },
      ]),
    ).toEqual(['자쿰:하드', '스우:하드', '루시드:하드'])
  })

  it('같은 보스면 난이도 순서다(이지 < 노멀 < 하드 < 카오스 < 익스트림)', () => {
    expect(
      sorted([
        { boss: '스우', difficulty: '익스트림' },
        { boss: '스우', difficulty: '노멀' },
        { boss: '스우', difficulty: '하드' },
        { boss: '스우', difficulty: '이지' },
      ]),
    ).toEqual(['스우:이지', '스우:노멀', '스우:하드', '스우:익스트림'])
  })

  // 참조에 없는 보스([[ADR-008]] 매칭 실패 원문명)는 맨 뒤이고, 그들끼리도 완전 결정적이어야
  // 한다 — 입력 순서에 기대면 [[ADR-036]] 이 없앤 비결정성이 되살아난다.
  it('참조에 없는 보스는 맨 뒤로 가고 그들끼리는 난이도·이름으로 갈린다', () => {
    expect(
      sorted([
        { boss: '나중보스', difficulty: '하드' },
        { boss: '검은마법사', difficulty: '하드' },
        { boss: '가나보스', difficulty: '하드' },
        { boss: '나중보스', difficulty: '노멀' },
      ]),
    ).toEqual(['검은마법사:하드', '나중보스:노멀', '가나보스:하드', '나중보스:하드'])
  })

  it('입력 순서를 뒤집어도 결과가 같다', () => {
    const entries = [
      { boss: '루시드', difficulty: '하드' },
      { boss: '자쿰', difficulty: '카오스' },
      { boss: '검은마법사', difficulty: '익스트림' },
      { boss: '스우', difficulty: '노멀' },
    ]

    expect(sorted([...entries].reverse())).toEqual(sorted(entries))
  })
})

// ADR-055 결정 3: 수동 선택 12개 한도의 카운트 규칙을 여기 한 곳에만 둔다. 화면의
// 관리 화면의 주간 섹션은 weekly와 eventWeekly를 합쳐 출처 구분을 잃으므로, 주기·시즌 여부는
// 반드시 참조표(getBossCycleByName·isSeasonBossName)로 되찾아야 한다.
describe('getBossCycleByName (ADR-055)', () => {
  it('weekly·eventWeekly 소속 보스는 weekly다', () => {
    expect(getBossCycleByName('자쿰')).toBe('weekly')
    expect(getBossCycleByName('시즌 보스 메이린')).toBe('weekly')
  })

  it('monthly 소속 보스(검은마법사)는 monthly다', () => {
    expect(getBossCycleByName('검은마법사')).toBe('monthly')
  })

  it('참조표에 없는 보스명은 null이다', () => {
    expect(getBossCycleByName('알 수 없는 보스')).toBeNull()
  })
})

describe('countManualWeeklyBosses (ADR-055)', () => {
  const bossItem = (contentName: string, difficulty: string): ManualTrackedItem => ({
    contentName,
    kind: 'boss',
    difficulty,
  })

  it('주간 보스 항목 수를 센다', () => {
    expect(countManualWeeklyBosses([bossItem('자쿰', '카오스'), bossItem('스우', '하드')])).toBe(2)
  })

  it('시즌 보스(메이린)는 세지 않는다 — countClearedWeeklyBosses와 같은 규칙', () => {
    expect(countManualWeeklyBosses([bossItem('자쿰', '카오스'), bossItem('시즌 보스 메이린', '노멀')])).toBe(1)
  })

  it('월간 보스(검은마법사)는 세지 않는다 — 같은 배열에 kind: boss로 저장되지만 주간 한도와 무관하다', () => {
    expect(countManualWeeklyBosses([bossItem('자쿰', '카오스'), bossItem('검은마법사', '하드')])).toBe(1)
  })

  it('컨텐츠 항목(kind: daily/weekly)은 세지 않는다', () => {
    const items: ManualTrackedItem[] = [
      bossItem('자쿰', '카오스'),
      { contentName: '몬스터파크', kind: 'daily' },
      { contentName: '무릉도장', kind: 'weekly' },
    ]
    expect(countManualWeeklyBosses(items)).toBe(1)
  })

  it('참조표에 없는 보스명은 주기를 알 수 없으므로 세지 않는다', () => {
    expect(countManualWeeklyBosses([bossItem('알 수 없는 보스', '노멀')])).toBe(0)
  })

  it('같은 보스의 다른 난이도는 각각 센다 — 저장 단위가 (보스, 난이도) 쌍이다', () => {
    expect(countManualWeeklyBosses([bossItem('스우', '노멀'), bossItem('스우', '하드')])).toBe(2)
  })
})
