import catalog from '../scheduler-content-catalog.json'
import contentTemplate from '../scheduler-content-template.json'
import { CONTENT_CATEGORIES } from '../../lib/scheduler/content-categories'

const templateRows = [...contentTemplate.daily, ...contentTemplate.weekly]
const templateKeys = new Set(templateRows.map((row) => row.key))
const categoryKeys = new Set<string>(CONTENT_CATEGORIES.map((category) => category.key))
const sharedRows = [...catalog.worldShared, ...catalog.accountShared]

function categoryOf(contentKey: string): string | undefined {
  return templateRows.find((row) => row.key === contentKey)?.category
}

describe('scheduler-content-catalog.json 정합성', () => {
  it('worldShared/accountShared 사이에 컨텐츠가 겹치지 않는다', () => {
    const worldKeys = catalog.worldShared.map((entry) => entry.content)
    const accountKeys = catalog.accountShared.map((entry) => entry.content)
    expect(worldKeys.filter((key) => accountKeys.includes(key))).toEqual([])
  })

  it('worldShared/accountShared 각각 내부에도 중복 컨텐츠가 없다', () => {
    for (const section of [catalog.worldShared, catalog.accountShared] as const) {
      const keys = section.map((entry) => entry.content)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('worldShared/accountShared 항목의 section은 daily 또는 weekly만 허용한다', () => {
    for (const entry of sharedRows) {
      expect(['daily', 'weekly']).toContain(entry.section)
    }
  })

  // 섹션이 갈리면 병합이 원장에서 줄을 되살릴 때 다른 섹션에 세운다.
  it('줄의 section 은 그 컨텐츠가 템플릿에서 선 섹션과 같다', () => {
    const mismatched = sharedRows
      .filter((entry) => !contentTemplate[entry.section as 'daily' | 'weekly'].some((row) => row.key === entry.content))
      .map((entry) => entry.content)
    expect(mismatched).toEqual([])
  })

  // 이 항목의 분모는 한 번 뒤집혔다. 2026-08-18 에 5 를 2 로 덮었다가 2026-09-05 에 되돌렸다.
  // 완료 조건은 일간 몬스터파크 5회이고, 주 2회는 수행 제한이라 다른 축이다.
  it('익스트림 몬스터파커에는 오버라이드를 걸지 않는다. API 의 5 가 맞는 값이다', () => {
    expect(Object.keys(catalog.maxCountOverrides)).not.toContain('monster_park_extreme')
  })

  it('maxCountOverrides 값은 전부 양의 정수다', () => {
    for (const value of Object.values(catalog.maxCountOverrides)) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
  })
})

// 카탈로그는 컨텐츠를 key 로 가리킨다. 표에 없는 key 는 어느 응답과도 안 맞아 그 줄이 조용히 죽는다.
describe('카탈로그가 가리키는 key', () => {
  it('worldShared/accountShared 의 content 는 모두 템플릿에 있는 컨텐츠 key 다', () => {
    expect(sharedRows.map((entry) => entry.content).filter((key) => !templateKeys.has(key))).toEqual([])
  })

  it('cumulativeScores 의 컨텐츠 key 는 모두 템플릿에 있다', () => {
    expect(catalog.cumulativeScores.filter((key) => !templateKeys.has(key))).toEqual([])
  })

  it('maxCountOverrides 의 컨텐츠 key 는 모두 템플릿에 있다', () => {
    expect(Object.keys(catalog.maxCountOverrides).filter((key) => !templateKeys.has(key))).toEqual([])
  })

  it('groupWeeklyLimits 의 갈래 key 는 모두 갈래 표에 있다', () => {
    expect(Object.keys(catalog.groupWeeklyLimits).filter((key) => !categoryKeys.has(key))).toEqual([])
  })

  it('sharedGroupOrder 의 갈래 key 는 모두 갈래 표에 있고 겹치지 않는다', () => {
    expect(catalog.sharedGroupOrder.filter((key) => !categoryKeys.has(key))).toEqual([])
    expect(new Set(catalog.sharedGroupOrder).size).toBe(catalog.sharedGroupOrder.length)
  })

  // 옛 카탈로그는 줄마다 group 칸을 들었다. 그 칸을 템플릿의 category 로 옮기면서 값이 바뀌지 않았는지 지킨다.
  it.each([
    ['monster_park', 'monster_park'],
    ['monster_park_extreme', 'monster_park'],
    ['maple_union_weekly_dragon', 'maple_union'],
    ['maple_union_pc_cafe_weekly_dragon', 'maple_union'],
    ['epic_dungeon_high_mountain', 'epic_dungeon'],
    ['epic_dungeon_angler_company', 'epic_dungeon'],
    ['epic_dungeon_nightmare_paradise', 'epic_dungeon'],
    ['epic_dungeon_aurum_regis', 'epic_dungeon'],
  ])('공유 줄 %s 의 갈래는 옛 계열과 같은 %s 다', (contentKey, category) => {
    expect(sharedRows.map((entry) => entry.content)).toContain(contentKey)
    expect(categoryOf(contentKey)).toBe(category)
  })

  it('공유 줄은 위 여덟이 전부다', () => {
    expect(sharedRows).toHaveLength(8)
  })
})
