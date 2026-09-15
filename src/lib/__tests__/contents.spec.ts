import {
  CONTENT_TEMPLATE,
  TEMPLATE_DAILY_KEYS,
  TEMPLATE_WEEKLY_KEYS,
  contentCategoryOf,
  contentDisplayNameOf,
  contentKeyOfApiName,
  contentSectionOf,
  contentShortNameOf,
  findContent,
} from '../scheduler/contents'
import { contentCategoryNameOf, contentCategoryTagOf } from '../scheduler/content-categories'

// API 이름에서 컨텐츠 key 를 얻는 규칙은 하나다. NFC 로 맞추고 공백을 모두 지운 뒤 완전 일치로 찾는다.
describe('contentKeyOfApiName', () => {
  it('표의 content_name 과 같은 이름은 그 key 다', () => {
    expect(contentKeyOfApiName('몬스터파크')).toBe('monster_park')
    expect(contentKeyOfApiName('[일일 퀘스트] 레헬른의 평온한 밤')).toBe('daily_quest_lacheln')
    expect(contentKeyOfApiName('에픽 던전 : 악몽선경')).toBe('epic_dungeon_nightmare_paradise')
  })

  it('공백이 달라도 같은 key 다', () => {
    expect(contentKeyOfApiName('몬스터 파크')).toBe('monster_park')
    expect(contentKeyOfApiName('에픽던전:악몽선경')).toBe('epic_dungeon_nightmare_paradise')
    expect(contentKeyOfApiName('[메이플유니온] 주간 드래곤 퇴치')).toBe('maple_union_weekly_dragon')
    expect(contentKeyOfApiName('[길드]주간 미션포인트')).toBe('guild_weekly_mission_points')
    expect(contentKeyOfApiName(' 무릉도장\t')).toBe('mu_lung_dojo')
  })

  // macOS 파일 이름이나 복사한 글자는 한글이 자모로 풀린(NFD) 채 올 수 있다. 눈에 같은 이름이면 같은 key 다.
  it('NFD 로 풀린 이름도 같은 key 다', () => {
    const decomposed = '[일일 퀘스트] 레헬른의 평온한 밤'.normalize('NFD')
    expect(decomposed).not.toBe('[일일 퀘스트] 레헬른의 평온한 밤')
    expect(contentKeyOfApiName(decomposed)).toBe('daily_quest_lacheln')
  })

  // 접두 · 수식이 붙은 변형은 별도 컨텐츠다. 비슷한 이름을 끌어다 붙이면 다른 컨텐츠의 진행으로 읽힌다.
  it('접두가 붙은 변형은 접두 없는 컨텐츠로 매칭하지 않는다', () => {
    expect(contentKeyOfApiName('[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?')).toBe('monster_park_extreme')
    expect(contentKeyOfApiName('[메이플 유니온] PC방 주간 드래곤 퇴치')).toBe('maple_union_pc_cafe_weekly_dragon')
  })

  it('표에 없는 이름은 null 이다. 부분 일치도 매칭하지 않는다', () => {
    expect(contentKeyOfApiName('존재하지 않는 컨텐츠')).toBeNull()
    expect(contentKeyOfApiName('레헬른의 평온한 밤')).toBeNull()
    expect(contentKeyOfApiName('헤이븐 주간 임무장')).toBeNull()
    expect(contentKeyOfApiName('')).toBeNull()
  })

  it('표의 모든 줄은 자기 content_name 으로 자기 key 를 얻는다', () => {
    const rows = [...CONTENT_TEMPLATE.daily, ...CONTENT_TEMPLATE.weekly]
    expect(rows.filter((row) => contentKeyOfApiName(row.content_name) !== row.key).map((row) => row.key)).toEqual([])
  })
})

describe('findContent', () => {
  it('key 로 표의 줄을 찾는다', () => {
    expect(findContent('monster_park')).toMatchObject({ key: 'monster_park', content_name: '몬스터파크' })
  })

  it('모르는 key · null · undefined 는 null 이다', () => {
    expect(findContent('unknown_content')).toBeNull()
    expect(findContent(null)).toBeNull()
    expect(findContent(undefined)).toBeNull()
  })

  // key 는 이름이 아니다. API 이름을 key 자리에 넘기면 찾지 않는다.
  it('API 이름을 key 로 넘기면 찾지 않는다', () => {
    expect(findContent('몬스터파크')).toBeNull()
  })
})

describe('contentDisplayNameOf / contentShortNameOf', () => {
  it('표에 있는 key 는 표의 이름이다', () => {
    expect(contentDisplayNameOf('daily_quest_road_of_vanishing', '무시')).toBe('소멸의 여로 조사')
    expect(contentShortNameOf('daily_quest_road_of_vanishing', '무시')).toBe('소멸의 여로')
    expect(contentDisplayNameOf('epic_dungeon_high_mountain', '무시')).toBe('하이마운틴')
    expect(contentShortNameOf('epic_dungeon_high_mountain', '무시')).toBe('에픽 던전 : 하이마운틴')
  })

  // 표에 없는 컨텐츠는 응답의 원문 이름을 그대로 그린다. 이름을 지어내지 않는다.
  it('모르는 key 와 key 없음은 넘긴 이름이다', () => {
    expect(contentDisplayNameOf(null, '[일일 퀘스트] 새 지역 조사')).toBe('[일일 퀘스트] 새 지역 조사')
    expect(contentShortNameOf(null, '[일일 퀘스트] 새 지역 조사')).toBe('[일일 퀘스트] 새 지역 조사')
    expect(contentDisplayNameOf('unknown_content', '원문')).toBe('원문')
    expect(contentShortNameOf(undefined, '원문')).toBe('원문')
  })
})

describe('contentSectionOf', () => {
  it('일간 · 주간 섹션을 낸다', () => {
    expect(contentSectionOf('monster_park')).toBe('daily')
    expect(contentSectionOf('daily_quest_geardrak')).toBe('daily')
    expect(contentSectionOf('monster_park_extreme')).toBe('weekly')
    expect(contentSectionOf('mu_lung_dojo')).toBe('weekly')
  })

  it('모르는 key 와 key 없음은 null 이다', () => {
    expect(contentSectionOf('unknown_content')).toBeNull()
    expect(contentSectionOf(null)).toBeNull()
  })

  it('key 집합이 섹션과 같다', () => {
    expect(TEMPLATE_DAILY_KEYS.has('monster_park')).toBe(true)
    expect(TEMPLATE_DAILY_KEYS.has('monster_park_extreme')).toBe(false)
    expect(TEMPLATE_WEEKLY_KEYS.has('monster_park_extreme')).toBe(true)
    expect(TEMPLATE_DAILY_KEYS.size + TEMPLATE_WEEKLY_KEYS.size).toBe(
      CONTENT_TEMPLATE.daily.length + CONTENT_TEMPLATE.weekly.length,
    )
  })
})

describe('contentCategoryOf', () => {
  // 같은 갈래가 두 섹션에 걸친다. 섹션이 아니라 줄의 category 가 말한다.
  it('줄의 갈래를 낸다', () => {
    expect(contentCategoryOf('monster_park')).toBe('monster_park')
    expect(contentCategoryOf('monster_park_extreme')).toBe('monster_park')
    expect(contentCategoryOf('weekly_quest_faithful_investigation_reward')).toBe('arcane_river_quest')
    expect(contentCategoryOf('guild_flag_race')).toBe('guild')
  })

  it('모르는 key 와 key 없음은 null 이다', () => {
    expect(contentCategoryOf('unknown_content')).toBeNull()
    expect(contentCategoryOf(null)).toBeNull()
  })
})

describe('갈래 표 조회', () => {
  it('갈래 이름은 카드 라벨의 글자다', () => {
    expect(contentCategoryNameOf('epic_dungeon')).toBe('에픽 던전')
    expect(contentCategoryNameOf('arcane_river_quest')).toBe('아케인리버 지역 퀘스트')
  })

  it('갈래 태그는 정한 갈래만 있고, null 은 숨김 · undefined 는 정하지 않음이다', () => {
    expect(contentCategoryTagOf('epic_dungeon')).toBe('ID당 1회')
    expect(contentCategoryTagOf('arcane_river_quest')).toBeNull()
    expect(contentCategoryTagOf('guild')).toBeUndefined()
  })
})
