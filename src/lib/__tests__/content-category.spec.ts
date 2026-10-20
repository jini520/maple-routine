import {
  categorizeContentEntries,
  contentCountTag,
  isGuildContent,
} from '../scheduler/content-category'
import type { ContentCategoryKey } from '../scheduler/content-categories'
import { findContent, type ContentEntry } from '../scheduler/contents'

function entry(key: string, category: ContentCategoryKey, overrides: Partial<ContentEntry> = {}): ContentEntry {
  return {
    key,
    content_name: key,
    category,
    displayName: `${key} 표시`,
    shortName: key,
    type: 'contents',
    registration_flag: 'false',
    now_count: 0,
    max_count: 0,
    quest_state: null,
    ...overrides,
  }
}

function templateEntry(key: string): ContentEntry {
  const found = findContent(key)
  if (found === null) throw new Error(`템플릿에 없는 key: ${key}`)
  return found
}

describe('categorizeContentEntries', () => {
  it('갈래 key 로 묶고, 라벨은 갈래 표의 이름 · 표시명은 줄의 displayName 이다', () => {
    const groups = categorizeContentEntries([
      entry('daily_quest_road_of_vanishing', 'daily_quest', { displayName: '소멸의 여로 조사' }),
      entry('daily_quest_chew_chew', 'daily_quest', { displayName: '츄츄 아일랜드 최고의 요리' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('daily_quest')
    expect(groups[0].label).toBe('일일 퀘스트')
    expect(groups[0].items.map((i) => i.displayName)).toEqual(['소멸의 여로 조사', '츄츄 아일랜드 최고의 요리'])
    // 토글 · 저장은 key 로 하므로 원본 줄을 그대로 보존한다
    expect(groups[0].items[0].entry.key).toBe('daily_quest_road_of_vanishing')
  })

  it('카드 라벨과 계열 이름이 한 갈래 key 를 쓴다. 에픽 던전의 라벨은 띄어 쓴 이름이다', () => {
    const groups = categorizeContentEntries([templateEntry('epic_dungeon_high_mountain')])

    expect(groups[0].category).toBe('epic_dungeon')
    expect(groups[0].label).toBe('에픽 던전')
    expect(groups[0].items[0].displayName).toBe('하이마운틴')
  })

  it('갈래 첫 등장 순서를 보존하고, 떨어져 있어도 같은 갈래는 한 그룹으로 묶는다', () => {
    const groups = categorizeContentEntries([
      entry('guild_weekly_mission_points', 'guild', { displayName: '주간 미션 포인트' }),
      entry('daily_quest_road_of_vanishing', 'daily_quest'),
      entry('guild_underground_waterway', 'guild', { displayName: '지하 수로' }),
    ])

    expect(groups.map((g) => g.label)).toEqual(['길드', '일일 퀘스트'])
    expect(groups[0].items.map((i) => i.displayName)).toEqual(['주간 미션 포인트', '지하 수로'])
  })
})

describe('contentCountTag: 태그 오버라이드 (사용자 지정)', () => {
  it('줄의 countTag 가 갈래 태그 · 기본 규칙보다 우선한다', () => {
    // 일간 몬스터파크: "월드 당 최대 14회"
    expect(contentCountTag(templateEntry('monster_park'))).toBe('월드 당 최대 14회')
    // 익스트림 몬스터파커(주간, 같은 갈래지만 줄의 태그가 이김): "월드 당 2회".
    // 완료 조건(일간 5회)이 아니라 수행 제한을 말하는 자리다.
    expect(contentCountTag(templateEntry('monster_park_extreme'))).toBe('월드 당 2회')
  })

  it('줄의 countTag 가 null 이면 갈래 태그가 있어도 숨긴다', () => {
    expect(contentCountTag(entry('epic_dungeon_x', 'epic_dungeon', { countTag: null }))).toBeNull()
  })

  it('갈래 태그: 에픽 던전 = ID당 1회, 아케인리버 = 태그 숨김(null)', () => {
    expect(contentCountTag(templateEntry('epic_dungeon_high_mountain'))).toBe('ID당 1회')
    expect(contentCountTag(templateEntry('erda_spectrum'))).toBeNull()
  })

  it('태그가 없으면 기본 규칙(contents & max>0 → 최대 N회, 그 외 null)', () => {
    expect(contentCountTag(templateEntry('guild_weekly_mission_points'))).toBe('최대 10회')
    expect(contentCountTag(templateEntry('daily_quest_road_of_vanishing'))).toBeNull()
    expect(contentCountTag(templateEntry('mu_lung_dojo'))).toBeNull()
  })
})

describe('categorizeContentEntries: categoryOrder 재정렬', () => {
  it('목록에 있는 갈래는 그 순서로 앞세우고, 없는 갈래는 첫 등장 순서로 뒤에 둔다', () => {
    const groups = categorizeContentEntries(
      [
        entry('maple_union_weekly_dragon', 'maple_union'),
        entry('guild_weekly_mission_points', 'guild'),
        entry('epic_dungeon_high_mountain', 'epic_dungeon'),
      ],
      ['epic_dungeon', 'guild'],
    )

    // 에픽 던전(0) · 길드(1)가 앞으로, 목록에 없는 메이플 유니온은 뒤에(첫 등장 순서 유지)
    expect(groups.map((g) => g.label)).toEqual(['에픽 던전', '길드', '메이플 유니온'])
  })
})

// 길드 컨텐츠 판정. 길드 가입 여부로 선택을 막을 대상을 고르는 데 쓴다. 컨텐츠를 코드에 나열하지 않고
// 표의 갈래로 가르므로 길드 컨텐츠가 추가돼도 따라온다.
describe('isGuildContent', () => {
  it('갈래가 guild 인 줄은 길드 컨텐츠다', () => {
    expect(isGuildContent(templateEntry('guild_weekly_mission_points'))).toBe(true)
    expect(isGuildContent(templateEntry('guild_underground_waterway'))).toBe(true)
    expect(isGuildContent(templateEntry('guild_flag_race'))).toBe(true)
  })

  it('다른 갈래의 줄과 표에 없는 컨텐츠(null)는 길드 컨텐츠가 아니다', () => {
    expect(isGuildContent(templateEntry('mu_lung_dojo'))).toBe(false)
    expect(isGuildContent(templateEntry('weekly_quest_haven'))).toBe(false)
    expect(isGuildContent(templateEntry('daily_quest_road_of_vanishing'))).toBe(false)
    expect(isGuildContent(templateEntry('epic_dungeon_high_mountain'))).toBe(false)
    expect(isGuildContent(null)).toBe(false)
  })
})
