/**
 * `buildContentViews`. 스냅샷(추적 목록 · 캐릭터마다의 스케줄 · 기본 정보 · 회차)을 컨텐츠 스케줄러의 캐릭터 뷰로
 * 바꾸는 순수 함수라 캐시 없이 스냅샷을 손으로 만들어 넣는다.
 */
import { findContent } from '../../../lib/scheduler/contents'
import type { CachedCharacterBasicEntry } from '../../../storage/character-basic-cache'
import type { CachedSchedulerEntry } from '../../../storage/scheduler-cache'
import type { CharacterBasicProfile, DailyContent, SchedulerCharacterState } from '../../../types'
import type { ScheduleRoundResult } from '../../schedule-sync/schedule-query'
import type { ScheduleSnapshot } from '../../schedule-sync/use-schedule-queries'
import { buildContentViews } from '../views'

function dailyContent(contentKey: string): DailyContent {
  const apiName = findContent(contentKey)!.content_name
  return { contentKey, apiName, kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 3, questState: null }
}

function entry(characterName: string, overrides: Partial<SchedulerCharacterState> = {}): CachedSchedulerEntry {
  return {
    state: {
      asOf: '2026-10-30T00:00+09:00',
      characterName,
      world: '베라',
      worldKey: 'bera',
      level: 200,
      jobClass: '렌',
      dailyContents: [dailyContent('monster_park')],
      weeklyContents: [],
      bossContents: [],
      isDailyStale: false,
      isWeeklyStale: false,
      isWeeklyBossStale: false,
      isMonthlyBossStale: false,
      ...overrides,
    },
    syncedAt: '2026-10-30T05:00:00.000Z',
  }
}

function basic(level: number, overrides: Partial<CharacterBasicProfile> = {}): CachedCharacterBasicEntry {
  return {
    profile: { name: '캐릭터', level, imageUrl: '', accessFlag: true, ...overrides },
    cachedAt: '2026-10-30T05:00:00.000Z',
  }
}

function round(overrides: Partial<ScheduleRoundResult> = {}): ScheduleRoundResult {
  return { fetchedAt: '2026-10-30T05:00:00.000Z', receivedAt: null, ocids: [], outcomes: {}, stranded: [], ...overrides }
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

describe('buildContentViews', () => {
  it('레벨 내림차순이고 같은 레벨은 compareByName 순서(한글이 알파벳보다 앞)다', () => {
    const views = buildContentViews(
      snapshot({
        ocids: ['a', 'b', 'c'],
        schedules: { a: entry('알파벳Zebra'), b: entry('높음'), c: entry('가나다') },
        basics: { a: basic(100), b: basic(200), c: basic(100) },
      }),
    )

    expect(views.map((view) => view.ocid)).toEqual(['b', 'c', 'a'])
  })

  it('기본 정보가 없어 레벨을 모르는 캐릭터는 level 이 null 이고 맨 뒤다', () => {
    const views = buildContentViews(
      snapshot({
        ocids: ['a', 'b'],
        schedules: { a: entry('캐시없음'), b: entry('캐시있음') },
        basics: { b: basic(1) },
      }),
    )

    expect(views.map((view) => view.ocid)).toEqual(['b', 'a'])
    expect(views[1].level).toBeNull()
    expect(views[1].imageUrl).toBeNull()
  })

  // 회차가 아직 말한 적 없으면 캐시가 곧 지금 값이다. 표식을 남기면 탭을 옮길 때마다 스탈 토스트가 뜬다.
  it('회차가 없으면 캐시 값은 isStale 이 false 이고 error 가 null 이다', () => {
    const [view] = buildContentViews(snapshot({ ocids: ['a'], schedules: { a: entry('캐릭터') } }))

    expect(view.isStale).toBe(false)
    expect(view.error).toBeNull()
    expect(view.syncedAt).toBe('2026-10-30T05:00:00.000Z')
  })

  it('캐시로 채운 캐릭터는 내용을 그대로 두고 회차의 isStale · error 만 얹는다', () => {
    const [view] = buildContentViews(
      snapshot({
        ocids: ['a'],
        schedules: { a: entry('캐릭터') },
        round: round({ ocids: ['a'], outcomes: { a: { isStale: true, syncedAt: null, error: { kind: 'network' } } } }),
      }),
    )

    expect(view.dailyContents).toEqual([dailyContent('monster_park')])
    expect(view.isStale).toBe(true)
    expect(view.error).toEqual({ kind: 'network' })
    // 받은 시각은 캐시의 것이다. 방금 받은 것처럼 꾸미지 않는다.
    expect(view.syncedAt).toBe('2026-10-30T05:00:00.000Z')
  })

  // 빈 배열은 0개 가 아니라 그릴 것이 없다 이고 `error` 가 그 사실을 말한다. 캐시의 옛 진행률을 지금 할 일처럼 그리지 않는다.
  it('회차가 조회 불가라고 한 캐릭터는 내용을 비운다', () => {
    const [view] = buildContentViews(
      snapshot({
        ocids: ['a'],
        schedules: { a: entry('지내우시') },
        round: round({
          ocids: ['a'],
          outcomes: { a: { isStale: true, syncedAt: null, error: { kind: 'characterUnavailable' } } },
        }),
      }),
    )

    expect(view.characterName).toBe('지내우시')
    expect(view.dailyContents).toEqual([])
    expect(view.weeklyContents).toEqual([])
    expect(view.error).toEqual({ kind: 'characterUnavailable' })
    expect(view.isStale).toBe(true)
  })

  // 월드 이전으로 `character/list` 에서 빠진 캐릭터는 동기화 결과에 안 온다. 결과만 보면 그 캐릭터가 사라진다.
  it('동기화가 답하지 않은 캐릭터는 자리를 남기고 조회 불가로 선다', () => {
    const [view] = buildContentViews(
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
      guildName: undefined,
      dailyContents: [],
      weeklyContents: [],
      isStale: true,
      syncedAt: null,
      error: { kind: 'characterUnavailable' },
    })
  })

  // 이름 없이 카드를 그릴 수 없고 ocid 는 사용자에게 뜻이 없다.
  it('스케줄도 없고 답하지 않은 캐릭터도 아니면 내지 않는다', () => {
    const views = buildContentViews(
      snapshot({
        ocids: ['a', 'b'],
        schedules: { a: entry('캐릭터') },
        basics: { b: basic(250) },
        round: round({ ocids: ['a'] }),
      }),
    )

    expect(views.map((view) => view.ocid)).toEqual(['a'])
  })

  // 길드 컨텐츠 잠금의 근거다. null 은 미가입이라 잠그고, undefined 는 모름이라 잠그지 않는다.
  it('guildName 은 기본 정보에서 온다. null 은 미가입이고 기본 정보가 없으면 undefined 다', () => {
    const views = buildContentViews(
      snapshot({
        ocids: ['a', 'b'],
        schedules: { a: entry('미가입'), b: entry('모름') },
        basics: { a: basic(200, { guildName: null }) },
      }),
    )

    expect(views.find((view) => view.ocid === 'a')?.guildName).toBeNull()
    expect(views.find((view) => view.ocid === 'b')?.guildName).toBeUndefined()
  })
})
