/**
 * `buildBossViews` 와 `readBossCharacters`. 스냅샷을 보스 스케줄러의 캐릭터 뷰로 바꾸는 순수 함수라 스냅샷을 손으로
 * 만들어 넣고, `readBossCharacters` 만 쿼리 캐시에서 읽는다. 레벨 순서 규칙은 컨텐츠 뷰와 같은 함수라 거기서 고정한다.
 */
import type { CachedCharacterBasicEntry } from '../../../storage/character-basic-cache'
import type { CachedSchedulerEntry } from '../../../storage/scheduler-cache'
import type { BossContent, SchedulerCharacterState } from '../../../types'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import type { ScheduleRoundResult } from '../../schedule-sync/schedule-query'
import type { ScheduleSnapshot } from '../../schedule-sync/use-schedule-queries'
import { buildBossViews, readBossCharacters } from '../views'

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

function entry(characterName: string, bossContents: BossContent[] = [bossContent()]): CachedSchedulerEntry {
  const state: SchedulerCharacterState = {
    asOf: '2026-10-30T00:00+09:00',
    characterName,
    world: '베라',
    worldKey: 'bera',
    level: 200,
    jobClass: '렌',
    dailyContents: [],
    weeklyContents: [],
    bossContents,
    isDailyStale: false,
    isWeeklyStale: false,
    isWeeklyBossStale: false,
    isMonthlyBossStale: false,
  }
  return { state, syncedAt: '2026-10-30T05:00:00.000Z' }
}

function basic(level: number): CachedCharacterBasicEntry {
  return { profile: { name: '캐릭터', level, imageUrl: '', accessFlag: true }, cachedAt: '2026-10-30T05:00:00.000Z' }
}

function round(overrides: Partial<ScheduleRoundResult> = {}): ScheduleRoundResult {
  return { fetchedAt: '2026-10-30T05:00:00.000Z', ocids: [], outcomes: {}, stranded: [], ...overrides }
}

function snapshot(parts: {
  ocids: string[]
  schedules?: Record<string, CachedSchedulerEntry>
  basics?: Record<string, CachedCharacterBasicEntry>
  round?: ScheduleRoundResult
}): ScheduleSnapshot {
  return {
    ocids: parts.ocids,
    schedules: new Map(Object.entries(parts.schedules ?? {})),
    basics: new Map(Object.entries(parts.basics ?? {})),
    round: parts.round,
  }
}

describe('buildBossViews', () => {
  it('보스를 주기로 갈라 weeklyBosses · monthlyBosses 에 넣는다', () => {
    const [view] = buildBossViews(
      snapshot({
        ocids: ['a'],
        schedules: {
          a: entry('캐릭터', [
            bossContent({ bossKey: 'zakum', apiName: '자쿰', cycle: 'weekly' }),
            bossContent({ bossKey: 'black_mage', apiName: '검은 마법사', cycle: 'monthly' }),
          ]),
        },
      }),
    )

    expect(view.weeklyBosses.map((boss) => boss.bossKey)).toEqual(['zakum'])
    expect(view.monthlyBosses.map((boss) => boss.bossKey)).toEqual(['black_mage'])
    // 보스 표와 맞춘 결과(초상 slug)가 실려 있다. 화면이 API 이름으로 다시 찾지 않는다.
    expect(view.monthlyBosses[0].portraitSlug).toBe('blackMage')
  })

  it('주간 처치 수는 등록 없이 완료된 보스도 세고 시즌 보스(메이린)는 뺀다', () => {
    const [view] = buildBossViews(
      snapshot({
        ocids: ['a'],
        schedules: {
          a: entry('캐릭터', [
            bossContent({ bossKey: 'zakum', apiName: '자쿰', isRegistered: false, isComplete: true }),
            bossContent({ bossKey: 'meirin', apiName: '시즌 보스 메이린', difficulty: 'normal', isComplete: true }),
            bossContent({ bossKey: 'lotus', apiName: '스우', difficulty: 'hard', isComplete: false }),
          ]),
        },
      }),
    )

    expect(view.weeklyBossClearCount).toBe(1)
    expect(view.weeklyBossClearLimitCount).toBe(12)
  })

  // `0/12` 는 안 잡았다는 단정이라 모르는 캐릭터에 쓰지 않는다. 링이 캐시의 옛 진행률을 그리지 않게 목록도 비운다.
  it('회차가 조회 불가라고 한 캐릭터는 보스 목록을 비우고 처치 수를 null 로 둔다', () => {
    const [view] = buildBossViews(
      snapshot({
        ocids: ['a'],
        schedules: { a: entry('지내우시', [bossContent({ isComplete: true })]) },
        round: round({
          ocids: ['a'],
          outcomes: { a: { isStale: true, syncedAt: null, error: { kind: 'characterUnavailable' } } },
        }),
      }),
    )

    expect(view.characterName).toBe('지내우시')
    expect(view.weeklyBosses).toEqual([])
    expect(view.monthlyBosses).toEqual([])
    expect(view.weeklyBossClearCount).toBeNull()
    expect(view.weeklyBossClearLimitCount).toBeNull()
    expect(view.error).toEqual({ kind: 'characterUnavailable' })
  })

  it('동기화가 답하지 않은 캐릭터는 자리를 남기고 처치 수를 null 로 둔다', () => {
    const [view] = buildBossViews(
      snapshot({
        ocids: ['stranded'],
        round: round({
          ocids: ['stranded'],
          stranded: [
            {
              ocid: 'stranded',
              characterName: '지내우시',
              world: '챌린저스2',
              worldKey: 'challengers_2',
              level: 285,
              imageUrl: null,
            },
          ],
        }),
      }),
    )

    expect(view).toEqual({
      ocid: 'stranded',
      characterName: '지내우시',
      worldKey: 'challengers_2',
      level: 285,
      imageUrl: null,
      weeklyBosses: [],
      monthlyBosses: [],
      weeklyBossClearCount: null,
      weeklyBossClearLimitCount: null,
      isStale: true,
      syncedAt: null,
      error: { kind: 'characterUnavailable' },
    })
  })

  it('캐시로 채운 캐릭터는 보스 목록 · 처치 수를 그대로 두고 회차의 isStale · error 만 얹는다', () => {
    const [view] = buildBossViews(
      snapshot({
        ocids: ['a'],
        schedules: { a: entry('캐릭터', [bossContent({ isComplete: true })]) },
        round: round({ ocids: ['a'], outcomes: { a: { isStale: true, syncedAt: null, error: { kind: 'network' } } } }),
      }),
    )

    expect(view.weeklyBosses).toHaveLength(1)
    expect(view.weeklyBossClearCount).toBe(1)
    expect(view.isStale).toBe(true)
    expect(view.error).toEqual({ kind: 'network' })
  })

  it('레벨 내림차순으로 세우고 스케줄이 없는 캐릭터는 내지 않는다', () => {
    const views = buildBossViews(
      snapshot({
        ocids: ['a', 'b', 'c'],
        schedules: { a: entry('낮음'), b: entry('높음') },
        basics: { a: basic(100), b: basic(200), c: basic(300) },
      }),
    )

    expect(views.map((view) => view.ocid)).toEqual(['b', 'a'])
  })
})

// 계산기 스토어처럼 렌더 밖에서 읽는 곳이 쓴다. 화면 훅과 같은 캐시를 보므로 값이 갈리지 않는다.
describe('readBossCharacters', () => {
  beforeEach(() => {
    queryClient.clear()
  })

  it('쿼리 캐시의 추적 목록 · 스케줄 · 회차로 뷰를 만든다', () => {
    queryClient.setQueryData(queryKeys.trackedOcids(), ['a', 'b'])
    queryClient.setQueryData(queryKeys.schedule('a'), entry('캐릭터', [bossContent({ isComplete: true })]))
    queryClient.setQueryData(queryKeys.characterBasic('a'), basic(250))
    queryClient.setQueryData(
      queryKeys.scheduleRound(),
      round({ ocids: ['a', 'b'], outcomes: { a: { isStale: false, syncedAt: '2026-10-30T05:00:00.000Z', error: null } } }),
    )

    const views = readBossCharacters()

    expect(views.map((view) => view.ocid)).toEqual(['a'])
    expect(views[0].level).toBe(250)
    expect(views[0].weeklyBossClearCount).toBe(1)
    expect(views[0].isStale).toBe(false)
  })

  it('추적 목록을 아직 안 읽었으면 빈 배열이다', () => {
    queryClient.setQueryData(queryKeys.schedule('a'), entry('캐릭터'))

    expect(readBossCharacters()).toEqual([])
  })
})
