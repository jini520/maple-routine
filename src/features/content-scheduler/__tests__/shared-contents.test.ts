import { findContent } from '../../../lib/scheduler/contents'
import { getShareScope } from '../../../lib/scheduler/scheduler-content-scope'
import type { DailyContent } from '../../../types'
import { mergeSharedProgress, sharedContentsOf, sharedMapleIdsOf, type SharedContentsInput } from '../shared-contents'
import type { ContentCharacterView } from '../views'

const 이번주 = '2026-11-26'

function item(contentKey: string, overrides: Partial<DailyContent> = {}): DailyContent {
  return {
    contentKey,
    apiName: findContent(contentKey)!.content_name,
    kind: 'contents',
    isRegistered: false,
    nowCount: 0,
    maxCount: 3,
    questState: null,
    ...overrides,
  }
}

function character(ocid: string, overrides: Partial<ContentCharacterView> = {}): ContentCharacterView {
  return {
    ocid,
    characterName: ocid,
    level: 200,
    imageUrl: null,
    dailyContents: [],
    weeklyContents: [],
    isStale: false,
    syncedAt: null,
    error: null,
    ...overrides,
  }
}

const 에픽 = ['epic_dungeon_high_mountain', 'epic_dungeon_angler_company', 'epic_dungeon_nightmare_paradise'] as const

function input(characters: ContentCharacterView[], ofOcid: Record<string, string>, manual = {}): SharedContentsInput {
  return { characters, ofOcid, manualTrackedByOcid: manual }
}

describe('sharedMapleIdsOf', () => {
  it('추적 캐릭터가 있는 메이플 ID 만 메이플 ID 차례로 세우고, 대표는 그 가운데 레벨이 가장 높은 캐릭터다', () => {
    const characters = [
      character('a1', { level: 210, characterName: '가' }),
      character('b1', { level: 280, characterName: '나' }),
      character('a2', { level: 270, characterName: '다', imageUrl: 'face-a2' }),
    ]

    const result = sharedMapleIdsOf(characters, { ofOcid: { a1: 'A', a2: 'A', b1: 'B' }, order: ['B', 'C', 'A'] }, { A: '본계정' })

    expect(result.map((one) => [one.mapleId, one.name, one.representative.ocid])).toEqual([
      ['B', expect.stringContaining('메이플ID-'), 'b1'],
      ['A', '본계정', 'a2'],
    ])
  })

  it('메이플 ID 를 모르는 캐릭터는 어느 메이플 ID 에도 넣지 않는다', () => {
    const result = sharedMapleIdsOf([character('x', { level: 300 })], { ofOcid: {}, order: ['A'] }, undefined)

    expect(result).toEqual([])
  })

  it('소속을 아직 못 읽었으면 빈 목록이다', () => {
    expect(sharedMapleIdsOf([character('a1')], null, undefined)).toEqual([])
  })
})

describe('mergeSharedProgress', () => {
  it('완료는 하나라도 완료면 완료이고, 횟수는 가장 큰 값이다', () => {
    const merged = mergeSharedProgress([
      item('monster_park', { nowCount: 1, maxCount: 7 }),
      item('monster_park', { nowCount: 7, maxCount: 7 }),
    ])

    expect(merged).toMatchObject({ contentKey: 'monster_park', nowCount: 7, maxCount: 7 })
  })

  it('퀘스트 상태도 가장 앞선 값이다', () => {
    const merged = mergeSharedProgress([
      item('maple_union_weekly_dragon', { questState: 2, kind: 'quest' }),
      item('maple_union_weekly_dragon', { questState: 1, kind: 'quest' }),
    ])

    expect(merged.questState).toBe(2)
  })
})

describe('sharedContentsOf', () => {
  it('그 메이플 ID 의 캐릭터 것만 모은다. 다른 메이플 ID 의 완료가 섞이지 않는다', () => {
    const characters = [
      character('a1', { dailyContents: [item('monster_park', { isRegistered: true, nowCount: 1, maxCount: 7 })] }),
      character('b1', { dailyContents: [item('monster_park', { isRegistered: true, nowCount: 7, maxCount: 7 })] }),
    ]

    const result = sharedContentsOf(input(characters, { a1: 'A', b1: 'B' }), 'A', 'auto', 이번주)

    expect(result.daily).toEqual([expect.objectContaining({ contentKey: 'monster_park', nowCount: 1 })])
  })

  it('메이플 ID 를 모르는 캐릭터의 값은 넣지 않는다', () => {
    const characters = [
      character('a1', { dailyContents: [item('monster_park', { isRegistered: true, nowCount: 0, maxCount: 7 })] }),
      character('x', { dailyContents: [item('monster_park', { isRegistered: true, nowCount: 7, maxCount: 7 })] }),
    ]

    const result = sharedContentsOf(input(characters, { a1: 'A' }), 'A', 'auto', 이번주)

    expect(result.daily[0].nowCount).toBe(0)
  })

  it('자동 모드는 캐릭터 가운데 하나라도 게임에 등록한 항목을 가장 앞선 값으로 보인다', () => {
    const characters = [
      character('a1', { dailyContents: [item('monster_park', { isRegistered: true, nowCount: 2, maxCount: 7 })] }),
      character('a2', { dailyContents: [item('monster_park', { isRegistered: false, nowCount: 5, maxCount: 7 })] }),
    ]

    const result = sharedContentsOf(input(characters, { a1: 'A', a2: 'A' }), 'A', 'auto', 이번주)

    expect(result.daily).toEqual([expect.objectContaining({ contentKey: 'monster_park', nowCount: 5 })])
  })

  it('자동 모드에서 아무도 등록하지 않은 항목은 보이지 않는다', () => {
    const characters = [character('a1', { dailyContents: [item('monster_park', { nowCount: 7, maxCount: 7 })] })]

    expect(sharedContentsOf(input(characters, { a1: 'A' }), 'A', 'auto', 이번주).daily).toEqual([])
  })

  it('수동 모드는 캐릭터 가운데 하나라도 추적 목록에 넣은 항목을 보인다', () => {
    const characters = [
      character('a1', { weeklyContents: [item(에픽[0], { nowCount: 1 })] }),
      character('a2', { weeklyContents: [item(에픽[0], { nowCount: 3 })] }),
    ]

    const result = sharedContentsOf(
      input(characters, { a1: 'A', a2: 'A' }, { a2: [{ contentKey: 에픽[0], kind: 'weekly' }] }),
      'A',
      'manual',
      이번주,
    )

    expect(result.weekly).toEqual([expect.objectContaining({ contentKey: 에픽[0], nowCount: 3 })])
    expect(result.daily).toEqual([])
  })

  it('수동 모드에서 응답에 없는 추적 항목도 버리지 않는다', () => {
    const result = sharedContentsOf(
      input([character('a1')], { a1: 'A' }, { a1: [{ contentKey: 'monster_park', kind: 'daily' }] }),
      'A',
      'manual',
      이번주,
    )

    expect(result.daily.map((content) => content.contentKey)).toEqual(['monster_park'])
  })

  it('캐릭터 범위 항목은 넣지 않는다', () => {
    const result = sharedContentsOf(
      input([character('a1', { weeklyContents: [item('mu_lung_dojo', { isRegistered: true })] })], { a1: 'A' }),
      'A',
      'auto',
      이번주,
    )

    expect(result.weekly).toEqual([])
  })

  it('보이는 항목은 모두 공유 범위가 캐릭터가 아니고, 분류의 공유 차례(몬스터파크 · 메이플 유니온 · 에픽 던전)로 선다', () => {
    const weeklyKeys = [에픽[0], 'maple_union_weekly_dragon', 'monster_park_extreme']
    const characters = [
      character('a1', { weeklyContents: weeklyKeys.map((key) => item(key, { isRegistered: true })) }),
    ]

    const result = sharedContentsOf(input(characters, { a1: 'A' }), 'A', 'auto', 이번주)

    expect(result.weekly.map((content) => content.contentKey)).toEqual(['monster_park_extreme', 'maple_union_weekly_dragon', 에픽[0]])
    expect(result.weekly.every((content) => getShareScope(content.contentKey) !== 'character')).toBe(true)
  })

  it('시작 기간 전인 컨텐츠는 그리지 않는다', () => {
    const characters = [character('a1', { weeklyContents: [item('epic_dungeon_aurum_regis', { isRegistered: true })] })]

    expect(sharedContentsOf(input(characters, { a1: 'A' }), 'A', 'auto', '2026-09-10').weekly).toEqual([])
    expect(sharedContentsOf(input(characters, { a1: 'A' }), 'A', 'auto', '2026-09-17').weekly).toHaveLength(1)
  })

  it('에픽 던전 주간 한도는 메이플 ID 단위로 센다. 캐릭터 셋이 하나씩 끝냈으면 남은 던전이 마감이다', () => {
    const characters = 에픽.map((key, index) =>
      character(`a${index}`, {
        weeklyContents: [item(key, { isRegistered: true, nowCount: 3, maxCount: 3 }), item('epic_dungeon_aurum_regis', { isRegistered: true })],
      }),
    )

    const result = sharedContentsOf(input(characters, { a0: 'A', a1: 'A', a2: 'A' }), 'A', 'auto', 이번주)

    expect([...result.closedKeys]).toEqual(['epic_dungeon_aurum_regis'])
  })

  it('다른 메이플 ID 의 에픽 던전 완료는 한도에 들지 않는다', () => {
    const characters = 에픽.map((key, index) =>
      character(`c${index}`, {
        weeklyContents: [item(key, { isRegistered: true, nowCount: 3, maxCount: 3 }), item('epic_dungeon_aurum_regis', { isRegistered: true })],
      }),
    )

    const result = sharedContentsOf(input(characters, { c0: 'A', c1: 'B', c2: 'B' }), 'A', 'auto', 이번주)

    expect(result.closedKeys.size).toBe(0)
  })
})
