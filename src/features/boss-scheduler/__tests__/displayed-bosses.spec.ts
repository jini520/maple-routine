// 지금까지 이 판정은 `BossScreen` 을 렌더해야만 검증됐다(지역 함수였다) — 화면으로 보면 «카드가
// 몇 장인가» 까지만 알 수 있고 «어느 규칙이 그 장 수를 만들었는가» 는 못 본다. 꺼낸 김에 입출력으로
// 직접 못 박는다([[ADR-147]] 결정 8).

import type { BossCharacterView } from '../store'
import { displayedBosses, displayedBossSections, type DisplayedBoss } from '../displayed-bosses'
import weeklyBossesData from '../../../data/weekly-bosses.json'
import {
  matchBossContent,
  WEEKLY_BOSS_CLEAR_LIMIT,
  type MatchedBoss,
} from '../../../lib/boss-matching'
import type { BossContent, BossCycle, BossDifficulty } from '../../../types'
import type { ManualTrackedItem } from '../../../types/scheduler'

function boss(
  overrides: Partial<BossContent> & { name: string; difficulty: BossDifficulty; cycle: BossCycle },
): MatchedBoss {
  return matchBossContent({
    isRegistered: false,
    isComplete: false,
    ownComplete: false,
    ...overrides,
  })
}

function character(overrides: Partial<BossCharacterView> = {}): BossCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '단풍',
    weeklyBosses: [],
    monthlyBosses: [],
    weeklyBossClearCount: null,
    weeklyBossClearLimitCount: null,
    isStale: false,
    syncedAt: null,
    error: null,
    ...overrides,
  }
}

/**
 * 목록 원소는 `MatchedBoss` 가 아니라 `DisplayedBoss` 다([[ADR-187]] 결정 2) — 아래 동등 비교는
 * 그 필드까지 함께 본다. 기본값이 `false` 인 것은 이 파일 대부분의 상황이 «한도 전» 이라서다.
 */
function shown(matched: MatchedBoss, isWeeklyLimitClosed = false): DisplayedBoss {
  return { ...matched, isWeeklyLimitClosed }
}

function bossItem(contentName: string, difficulty: string): ManualTrackedItem {
  return { contentName, kind: 'boss', difficulty }
}

describe('displayedBosses — 자동 모드', () => {
  // [[ADR-031]] 결정 5: 등록한 난이도가 있으면 그것만(중복 카드 방지), 없으면 완료한 난이도를 대신.
  it('등록된 보스와 «미등록이지만 완료된» 보스를 함께 보여준다', () => {
    const registered = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })
    const unregisteredComplete = boss({
      name: '루시드',
      difficulty: '하드',
      cycle: 'weekly',
      isComplete: true,
      ownComplete: true,
    })
    const unregisteredIncomplete = boss({ name: '윌', difficulty: '하드', cycle: 'weekly' })

    const result = displayedBosses(
      character({ weeklyBosses: [registered, unregisteredComplete, unregisteredIncomplete] }),
      'weekly',
      'auto',
      null,
    )

    expect(result.map((entry) => entry.apiName)).toEqual(['스우', '루시드'])
  })

  // 같은 보스를 여러 난이도로 받아도 등록된 난이도가 있으면 그 행만 남는다 — 카드가 겹치지 않게.
  it('같은 보스의 등록 난이도가 있으면 완료된 다른 난이도는 카드로 서지 않는다', () => {
    const registeredHard = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })
    const completeNormal = boss({
      name: '스우',
      difficulty: '노멀',
      cycle: 'weekly',
      isComplete: true,
      ownComplete: true,
    })

    const result = displayedBosses(
      character({ weeklyBosses: [registeredHard, completeNormal] }),
      'weekly',
      'auto',
      null,
    )

    expect(result).toEqual([shown(registeredHard)])
  })

  it('cycle 이 주간·월간을 가른다 — 자동 모드는 캐릭터 뷰의 두 목록에서 고른다', () => {
    const weekly = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })
    const monthly = boss({ name: '검은마법사', difficulty: '하드', cycle: 'monthly', isRegistered: true })
    const view = character({ weeklyBosses: [weekly], monthlyBosses: [monthly] })

    expect(displayedBosses(view, 'weekly', 'auto', null)).toEqual([shown(weekly)])
    expect(displayedBosses(view, 'monthly', 'auto', null)).toEqual([shown(monthly)])
  })

  // 자동 모드는 게임 등록이 진실이라 멤버십을 아예 안 본다 — 모드 전환 직후 남아 있는 수동 목록이
  // 자동 화면에 새지 않는다.
  it('멤버십이 있어도 자동 모드에서는 그것을 읽지 않는다', () => {
    const registered = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })

    const result = displayedBosses(character({ weeklyBosses: [registered] }), 'weekly', 'auto', {
      'ocid-1': [bossItem('루시드', '하드')],
    })

    expect(result).toEqual([shown(registered)])
  })
})

// [[ADR-186]]: 자동 모드는 정렬이 아예 없어 Nexon `boss_contents` **응답 순서**로 서고 있었다.
// 이제 두 모드가 같은 비교자(`compareBossOrder`)를 지나므로 응답이 어떤 차례로 오든 화면이 안 흔들린다.
describe('displayedBosses — 순서는 weekly-bosses.json 정규 순서다 ([[ADR-186]])', () => {
  it('자동 모드가 응답 순서를 버리고 정규 순서로 낸다', () => {
    const 루시드 = boss({ name: '루시드', difficulty: '하드', cycle: 'weekly', isRegistered: true })
    const 자쿰 = boss({ name: '자쿰', difficulty: '카오스', cycle: 'weekly', isRegistered: true })
    const 스우 = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })

    const result = displayedBosses(
      character({ weeklyBosses: [루시드, 자쿰, 스우] }),
      'weekly',
      'auto',
      null,
    )

    expect(result.map((entry) => entry.apiName)).toEqual(['자쿰', '스우', '루시드'])
  })

  it('입력 순서를 뒤집어도 같은 목록이 나온다 — 결정적이다', () => {
    const bosses = [
      boss({ name: '루시드', difficulty: '하드', cycle: 'weekly', isRegistered: true }),
      boss({ name: '자쿰', difficulty: '카오스', cycle: 'weekly', isRegistered: true }),
      boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true }),
    ]

    const once = displayedBosses(character({ weeklyBosses: bosses }), 'weekly', 'auto', null)
    const twice = displayedBosses(
      character({ weeklyBosses: [...bosses].reverse() }),
      'weekly',
      'auto',
      null,
    )

    expect(twice).toEqual(once)
  })

  // 같은 보스를 여러 난이도로 완료할 수는 없지만(게임 룰), 미등록 완료가 여러 난이도로 오는
  // 응답이 실재한다 — 그때도 자리가 결정적이어야 한다([[ADR-036]] 결정 3 의 2차 키).
  it('같은 보스의 여러 난이도는 난이도 순서로 선다', () => {
    const 하드 = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isComplete: true, ownComplete: true })
    const 노멀 = boss({ name: '스우', difficulty: '노멀', cycle: 'weekly', isComplete: true, ownComplete: true })

    const result = displayedBosses(character({ weeklyBosses: [하드, 노멀] }), 'weekly', 'auto', null)

    expect(result.map((entry) => entry.difficulty)).toEqual(['노멀', '하드'])
  })

  // 참조표에 없는 보스는 이름을 못 바꾼 채([[ADR-008]]) 맨 뒤에 선다 — 버리지 않는다.
  it('참조표에 없는 보스는 버리지 않고 맨 뒤에 둔다', () => {
    const 미지 = boss({ name: '알 수 없는 보스', difficulty: '하드', cycle: 'weekly', isRegistered: true })
    const 자쿰 = boss({ name: '자쿰', difficulty: '카오스', cycle: 'weekly', isRegistered: true })

    const result = displayedBosses(character({ weeklyBosses: [미지, 자쿰] }), 'weekly', 'auto', null)

    expect(result.map((entry) => entry.apiName)).toEqual(['자쿰', '알 수 없는 보스'])
  })

  // 수동 경로는 `mergeManualBossList` 가 이미 같은 순서로 내므로 멱등이다 — 그래도 계약을
  // 여기서 못 박는다(정렬 자리가 모드 분기 안이 아니라 함수 끝인 것이 [[ADR-186]] 결정 3 이다).
  it('수동 모드도 같은 순서다', () => {
    const result = displayedBosses(character(), 'weekly', 'manual', {
      'ocid-1': [bossItem('루시드', '하드'), bossItem('자쿰', '카오스'), bossItem('스우', '하드')],
    })

    expect(result.map((entry) => entry.apiName)).toEqual(['자쿰', '스우', '루시드'])
  })
})

describe('displayedBosses — 수동 모드', () => {
  // [[ADR-035]] 결정 3·6·12: 게임 등록 여부가 아니라 «앱에서 관리하는 멤버십» 이 표시 목록을 정한다.
  it('추적 멤버십이 표시 목록을 정한다 — 등록·동기화된 적 없는 보스도 카드로 선다', () => {
    const result = displayedBosses(character(), 'weekly', 'manual', {
      'ocid-1': [bossItem('스우', '하드')],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      apiName: '스우',
      difficulty: '하드',
      cycle: 'weekly',
      isRegistered: false,
      isComplete: false,
      matchedBossName: '스우',
    })
  })

  it('멤버십에 없는 보스는 등록·완료돼 있어도 카드로 서지 않는다', () => {
    const registeredComplete = boss({
      name: '루시드',
      difficulty: '하드',
      cycle: 'weekly',
      isRegistered: true,
      isComplete: true,
      ownComplete: true,
    })

    const result = displayedBosses(
      character({ weeklyBosses: [registeredComplete] }),
      'weekly',
      'manual',
      { 'ocid-1': [bossItem('스우', '하드')] },
    )

    expect(result.map((entry) => entry.apiName)).toEqual(['스우'])
  })

  // 완료 여부는 멤버십에 복제하지 않고 동기화 결과에서 즉석 조회한다(단일 진실 공급원).
  it('동기화 결과의 완료 여부가 멤버십 항목에 붙는다', () => {
    const synced = boss({
      name: '스우',
      difficulty: '하드',
      cycle: 'weekly',
      isRegistered: true,
      isComplete: true,
      ownComplete: true,
    })

    const result = displayedBosses(character({ weeklyBosses: [synced] }), 'weekly', 'manual', {
      'ocid-1': [bossItem('스우', '하드')],
    })

    expect(result[0]).toMatchObject({ apiName: '스우', difficulty: '하드', isComplete: true })
  })

  // 조회 대상이 주간·월간 두 목록을 합친 것이라, 월간 보스를 추적해도 주간 탭에 새지 않는다.
  it('멤버십 목록을 cycle 로 가른다 — 월간 추적은 주간 탭에 오지 않는다', () => {
    const tracked = {
      'ocid-1': [bossItem('스우', '하드'), bossItem('검은마법사', '하드')],
    }
    const view = character()

    expect(displayedBosses(view, 'weekly', 'manual', tracked).map((entry) => entry.apiName)).toEqual(['스우'])
    expect(displayedBosses(view, 'monthly', 'manual', tracked).map((entry) => entry.apiName)).toEqual([
      '검은마법사',
    ])
  })

  it('보스가 아닌 멤버십 항목(컨텐츠)은 걸러진다', () => {
    const result = displayedBosses(character(), 'weekly', 'manual', {
      'ocid-1': [bossItem('스우', '하드'), { contentName: '몬스터파크', kind: 'daily' }],
    })

    expect(result.map((entry) => entry.apiName)).toEqual(['스우'])
  })

  it('멤버십 맵이 null 이거나 그 ocid 키가 없으면 빈 목록', () => {
    const view = character({
      weeklyBosses: [boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })],
    })

    expect(displayedBosses(view, 'weekly', 'manual', null)).toEqual([])
    expect(displayedBosses(view, 'weekly', 'manual', {})).toEqual([])
    expect(displayedBosses(view, 'weekly', 'manual', { 'ocid-2': [bossItem('스우', '하드')] })).toEqual([])
  })

  // 화면이 캐릭터를 인자로 받는 이유([[ADR-142]] 결정 4) — 레일의 링은 «선택되지 않은» 캐릭터의
  // 목록도 세야 하고, 그 목록은 그 캐릭터의 ocid 로 뽑은 멤버십이어야 한다.
  it('멤버십은 인자로 받은 캐릭터의 ocid 로 뽑는다', () => {
    const result = displayedBosses(character({ ocid: 'ocid-2' }), 'weekly', 'manual', {
      'ocid-1': [bossItem('스우', '하드')],
      'ocid-2': [bossItem('루시드', '하드')],
    })

    expect(result.map((entry) => entry.apiName)).toEqual(['루시드'])
  })
})

// 탭이 걷히면서 «어느 순서로 서는가» 가 화면의 판단이 아니라 이 모듈의 판단이 된다([[ADR-164]]
// 결정 1) — 화면이 다시 해석하면 today 가 같은 목록을 다른 순서로 읽을 길이 열린다.
describe('displayedBossSections — 통합 목록의 순서 ([[ADR-164]] 결정 1)', () => {
  it('월간이 먼저, 그다음 주간이다', () => {
    const weekly = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })
    const monthly = boss({ name: '검은마법사', difficulty: '하드', cycle: 'monthly', isRegistered: true })

    const sections = displayedBossSections(
      character({ weeklyBosses: [weekly], monthlyBosses: [monthly] }),
      'auto',
      null,
    )

    expect(sections).toEqual([
      { cycle: 'monthly', bosses: [shown(monthly)] },
      { cycle: 'weekly', bosses: [shown(weekly)] },
    ])
  })

  // 빈 무리를 여기서 걷지 않는 것이 결정이다 — 솔로/파티 필터는 화면이 걸고, «비었다» 는 판정은
  // 그 뒤에야 성립한다([[ADR-164]] 결정 6). 여기서 미리 걷으면 화면이 필터 후 다시 걷어야 한다.
  it('무리가 비어도 자리는 남긴다 — 걷는 것은 화면의 일이다', () => {
    const weekly = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })

    expect(displayedBossSections(character({ weeklyBosses: [weekly] }), 'auto', null)).toEqual([
      { cycle: 'monthly', bosses: [] },
      { cycle: 'weekly', bosses: [shown(weekly)] },
    ])
  })

  // 무리 안의 규칙은 한 글자도 안 바뀐다 — 같은 함수를 부른다.
  it('무리 안은 `displayedBosses` 와 같은 목록이다 — 수동 모드도', () => {
    const tracked = { 'ocid-1': [bossItem('스우', '하드'), bossItem('검은마법사', '하드')] }
    const view = character()

    const sections = displayedBossSections(view, 'manual', tracked)

    expect(sections.map((section) => section.cycle)).toEqual(['monthly', 'weekly'])
    expect(sections[0]?.bosses).toEqual(displayedBosses(view, 'monthly', 'manual', tracked))
    expect(sections[1]?.bosses).toEqual(displayedBosses(view, 'weekly', 'manual', tracked))
  })

  // 완료는 자리를 안 바꾼다([[ADR-164]] 결정 2) — 정렬 규칙을 새로 만들지 않는 것이 그 결정의 값이다.
  it('완료된 검마도 여전히 위에 선다', () => {
    const weekly = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })
    const doneMonthly = boss({
      name: '검은마법사',
      difficulty: '하드',
      cycle: 'monthly',
      isRegistered: true,
      isComplete: true,
      ownComplete: true,
    })

    const sections = displayedBossSections(
      character({ weeklyBosses: [weekly], monthlyBosses: [doneMonthly] }),
      'auto',
      null,
    )

    expect(sections[0]).toEqual({ cycle: 'monthly', bosses: [shown(doneMonthly)] })
  })
})

// [[ADR-187]] 결정 2 — 주간 12마리를 채우면 남은 미처치 주간 보스는 «마감» 이다. 판정이 여기 있는
// 이유는 today 「남은 스케줄」이 같은 함수를 부르기 때문이다([[ADR-147]] 결정 8) — 화면이 다시
// 판정하면 그 등식이 깨진다.
describe('displayedBosses — 주간 한도 마감 ([[ADR-187]] 결정 2)', () => {
  // 참조표에서 앞에서부터 뽑는다 — 이름을 손으로 적지 않는다([[ADR-006]]).
  const WEEKLY_NAMES = (weeklyBossesData.weekly as { boss: string }[]).map((entry) => entry.boss)

  /** 「끝에서부터」 한도만큼 잡아 둔 주간 보스들 — 아래 미처치 보스와 겹치지 않게 뒤에서 뽑는다. */
  function clearedBosses(count: number): MatchedBoss[] {
    return WEEKLY_NAMES.slice(-count).map((name) =>
      boss({
        name,
        difficulty: '하드',
        cycle: 'weekly',
        isRegistered: false,
        isComplete: true,
        ownComplete: true,
      }),
    )
  }

  const pending = boss({ name: WEEKLY_NAMES[0], difficulty: '하드', cycle: 'weekly', isRegistered: true })

  it('한도를 채우면 미처치 등록 보스가 마감이다', () => {
    const view = character({
      weeklyBosses: [pending, ...clearedBosses(WEEKLY_BOSS_CLEAR_LIMIT)],
    })

    const closed = displayedBosses(view, 'weekly', 'auto', null).find(
      (entry) => entry.apiName === pending.apiName,
    )

    expect(closed?.isWeeklyLimitClosed).toBe(true)
  })

  it('한 마리 모자라면 마감이 아니다', () => {
    const view = character({
      weeklyBosses: [pending, ...clearedBosses(WEEKLY_BOSS_CLEAR_LIMIT - 1)],
    })

    const entry = displayedBosses(view, 'weekly', 'auto', null).find(
      (item) => item.apiName === pending.apiName,
    )

    expect(entry?.isWeeklyLimitClosed).toBe(false)
  })

  // 마감은 완료를 대체하지 않는다 — 잡은 것은 잡은 것이다.
  it('이미 처치한 보스는 마감이 아니다', () => {
    const cleared = clearedBosses(WEEKLY_BOSS_CLEAR_LIMIT)
    const view = character({ weeklyBosses: cleared })

    const result = displayedBosses(view, 'weekly', 'auto', null)

    expect(result.every((entry) => entry.isWeeklyLimitClosed === false)).toBe(true)
  })

  it('시즌 보스는 한도 밖이라 마감이 없다', () => {
    const season = boss({ name: '시즌 보스 메이린', difficulty: '노멀', cycle: 'weekly', isRegistered: true })
    const view = character({ weeklyBosses: [season, ...clearedBosses(WEEKLY_BOSS_CLEAR_LIMIT)] })

    const entry = displayedBosses(view, 'weekly', 'auto', null).find(
      (item) => item.apiName === season.apiName,
    )

    expect(entry?.isWeeklyLimitClosed).toBe(false)
  })

  it('월간 보스는 한도 밖이라 마감이 없다', () => {
    const monthly = boss({ name: '검은마법사', difficulty: '하드', cycle: 'monthly', isRegistered: true })
    const view = character({
      weeklyBosses: clearedBosses(WEEKLY_BOSS_CLEAR_LIMIT),
      monthlyBosses: [monthly],
    })

    const entry = displayedBosses(view, 'monthly', 'auto', null)[0]

    expect(entry?.isWeeklyLimitClosed).toBe(false)
  })

  // 이 결정이 겨누는 실제 상황 — 추적한 12마리 중 열을 잡고, 목록 밖 두 마리로 한도를 채운 경우.
  it('수동 모드: 추적 목록 밖 처치로 한도를 채워도 목록의 미처치 보스가 마감이 된다', () => {
    const tracked = { 'ocid-1': [bossItem(WEEKLY_NAMES[0], '하드')] }
    const view = character({ weeklyBosses: clearedBosses(WEEKLY_BOSS_CLEAR_LIMIT) })

    const entry = displayedBosses(view, 'weekly', 'manual', tracked).find(
      (item) => item.matchedBossName === WEEKLY_NAMES[0],
    )

    expect(entry?.isWeeklyLimitClosed).toBe(true)
  })
})
