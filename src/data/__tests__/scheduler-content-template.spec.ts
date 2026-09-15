import contentTemplate from '../scheduler-content-template.json'
import { getBossPortraitUrl, getDailyQuestBackgroundUrl } from '../../lib/assets/asset-lookup'
import { CONTENT_CATEGORIES } from '../../lib/scheduler/content-categories'

interface TemplateRow {
  key: string
  content_name: string
  category: string
  displayName: string
  shortName: string
  background?: { map?: string; portrait?: string }
  countTag?: string | null
}

const dailyRows = contentTemplate.daily as TemplateRow[]
const weeklyRows = contentTemplate.weekly as TemplateRow[]
const rows = [...dailyRows, ...weeklyRows]

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

function rowOf(key: string): TemplateRow | undefined {
  return rows.find((row) => row.key === key)
}

describe('scheduler-content-template.json 표 정합성', () => {
  it('컨텐츠 key 는 snake_case 이고 일간 · 주간을 합쳐 겹치지 않는다', () => {
    const keys = rows.map((row) => row.key)
    expect(keys.filter((key) => !/^[a-z0-9]+(_[a-z0-9]+)*$/.test(key))).toEqual([])
    expect(findDuplicates(keys)).toEqual([])
  })

  // API 이름은 NFC 뒤 공백을 지우고 맞춘다. 지운 뒤 두 이름이 같으면 한 응답이 어느 컨텐츠인지 갈리지 않는다.
  it('content_name 은 NFC 뒤 공백을 지워도 겹치지 않는다', () => {
    const names = rows.map((row) => row.content_name.normalize('NFC').replace(/\s+/g, ''))
    expect(findDuplicates(names)).toEqual([])
  })

  it('category 는 모두 갈래 표에 있는 key 다', () => {
    const categoryKeys = new Set<string>(CONTENT_CATEGORIES.map((category) => category.key))
    expect(rows.filter((row) => !categoryKeys.has(row.category)).map((row) => row.key)).toEqual([])
  })

  it('갈래 표의 key 는 겹치지 않는다', () => {
    expect(findDuplicates(CONTENT_CATEGORIES.map((category) => category.key))).toEqual([])
  })

  // today 남은 스케줄이 이 글자로 칩을 세운다. 한 섹션 안에서 겹치면 같은 칩이 둘 선다.
  it.each([
    ['daily', dailyRows],
    ['weekly', weeklyRows],
  ] as const)('shortName 은 %s 섹션 안에서 겹치지 않는다', (_section, sectionRows) => {
    expect(findDuplicates(sectionRows.map((row) => row.shortName))).toEqual([])
  })

  it('displayName · shortName 은 모든 줄에 비어 있지 않게 있다', () => {
    const missing = rows.filter((row) => !row.displayName?.trim() || !row.shortName?.trim()).map((row) => row.key)
    expect(missing).toEqual([])
  })

  // 그림이 없으면 화면이 비운다. 표에 적은 slug 가 에셋에 없으면 조용히 빈 카드가 된다.
  it('background.map 은 지도 배경 에셋에 있는 slug 다', () => {
    const missing = rows
      .filter((row) => row.background?.map !== undefined)
      .filter((row) => getDailyQuestBackgroundUrl(row.background!.map!) === null)
      .map((row) => `${row.key} -> ${row.background!.map}`)
    expect(missing).toEqual([])
  })

  it('background.portrait 는 보스 초상 에셋에 있는 slug 다', () => {
    const missing = rows
      .filter((row) => row.background?.portrait !== undefined)
      .filter((row) => getBossPortraitUrl(row.background!.portrait!) === null)
      .map((row) => `${row.key} -> ${row.background!.portrait}`)
    expect(missing).toEqual([])
  })

  it('background 는 map · portrait 밖의 칸을 들지 않는다', () => {
    const invalid = rows
      .filter((row) => row.background !== undefined)
      .filter((row) => Object.keys(row.background!).some((field) => field !== 'map' && field !== 'portrait'))
      .map((row) => row.key)
    expect(invalid).toEqual([])
  })
})

// 지역 이름표(daily-quest-regions.json)가 표의 칸으로 옮겨 왔다. 이 표가 그 사실을 지킨다.
describe('일일 퀘스트 17개의 지역과 그림', () => {
  const cases: Array<[string, string, string, string]> = [
    ['daily_quest_road_of_vanishing', '[일일 퀘스트] 소멸의 여로 조사', '소멸의 여로', 'roadOfVanishing'],
    ['daily_quest_chew_chew', '[일일 퀘스트] 츄츄 아일랜드 최고의 요리', '츄츄 아일랜드', 'chewChew'],
    ['daily_quest_lacheln', '[일일 퀘스트] 레헬른의 평온한 밤', '레헬른', 'lacheln'],
    ['daily_quest_arcana', '[일일 퀘스트] 아르카나의 평온한 바람', '아르카나', 'arcana'],
    ['daily_quest_morass', '[일일 퀘스트] 모라스의 안정을 위해', '모라스', 'morass'],
    ['daily_quest_esfera', '[일일 퀘스트] 에스페라 연구 명령', '에스페라', 'esfera'],
    ['daily_quest_moon_bridge', '[일일 퀘스트] 문브릿지 조사', '문브릿지', 'moonBridge'],
    ['daily_quest_labyrinth_of_suffering', '[일일 퀘스트] 고통의 미궁 조사', '고통의 미궁', 'theLabyrinthOfSuffering'],
    ['daily_quest_limen', '[일일 퀘스트] 리멘 조사', '리멘', 'limen'],
    ['daily_quest_cernium', '[일일 퀘스트] 세르니움 조사', '세르니움', 'cernium'],
    ['daily_quest_arcs', '[일일 퀘스트] 호텔 아르크스 주변 청소', '호텔 아르크스', 'Arcs'],
    ['daily_quest_odium', '[일일 퀘스트] 오디움 일대 탐사', '오디움', 'odium'],
    ['daily_quest_dowonkyung', '[일일 퀘스트] 도원경 오염 정화', '도원경', 'dowonkyung'],
    ['daily_quest_arteria', '[일일 퀘스트] 아르테리아 잔당 처치', '아르테리아', 'arteria'],
    ['daily_quest_carcion', '[일일 퀘스트] 카르시온 복구 지원', '카르시온', 'carcion'],
    ['daily_quest_tallahart', '[일일 퀘스트] 탈라하트 고대신의 힘 조사', '탈라하트', 'tallahart'],
    ['daily_quest_geardrak', '[일일 퀘스트] 기어드락 크로노스의 잔재 수집', '기어드락', 'geardrak'],
  ]

  it('일일 퀘스트 갈래의 줄은 정확히 이 17개다', () => {
    const keys = dailyRows.filter((row) => row.category === 'daily_quest').map((row) => row.key)
    expect(keys).toEqual(cases.map(([key]) => key))
  })

  it.each(cases)('%s 는 API 이름 "%s" · 지역 "%s" · 지도 "%s" 다', (key, apiName, region, map) => {
    expect(rowOf(key)).toMatchObject({ content_name: apiName, shortName: region, background: { map } })
  })

  it('표시명은 API 이름에서 "[일일 퀘스트] " 접두어를 뗀 글자다', () => {
    const mismatched = dailyRows
      .filter((row) => row.category === 'daily_quest')
      .filter((row) => row.displayName !== row.content_name.replace(/^\[일일 퀘스트\] /, ''))
      .map((row) => row.key)
    expect(mismatched).toEqual([])
  })

  it('17개 모두 지도 그림을 든다', () => {
    const missing = dailyRows
      .filter((row) => row.category === 'daily_quest' && row.background?.map === undefined)
      .map((row) => row.key)
    expect(missing).toEqual([])
  })
})

// 주간 퀘스트 · 아케인리버 지역 컨텐츠의 그림도 이름표(weekly-quest-regions.json · weekly-regional-quests.json)에서
// 표의 칸으로 옮겨 왔다.
describe('주간 퀘스트 · 지역 컨텐츠의 그림', () => {
  const cases: Array<[string, string]> = [
    ['erda_spectrum', 'roadOfVanishing'],
    ['hungry_muto', 'chewChew'],
    ['midnight_chaser', 'lacheln'],
    ['spirit_saviour', 'arcana'],
    ['enheim_defense', 'morass'],
    ['protect_esfera', 'esfera'],
    ['weekly_quest_faithful_investigation_reward', 'roadOfVanishing'],
    ['weekly_quest_critias', 'critias'],
    ['weekly_quest_fallen_world_tree', 'fallenWorldTree'],
    ['weekly_quest_fallen_world_tree_purification_reward', 'fallenWorldTree'],
    ['weekly_quest_haven', 'haven'],
    ['weekly_quest_steady_request_reward', 'haven'],
    ['mu_lung_dojo', 'muruengRaid'],
  ]

  it.each(cases)('%s 의 지도는 "%s" 다', (key, map) => {
    expect(rowOf(key)?.background).toEqual({ map })
  })

  it('아케인리버 지역 퀘스트 · 주간 퀘스트 갈래의 줄은 모두 위 표에 있다', () => {
    const listed = new Set(cases.map(([key]) => key))
    const unlisted = weeklyRows
      .filter((row) => row.category === 'arcane_river_quest' || row.category === 'weekly_quest')
      .filter((row) => !listed.has(row.key))
      .map((row) => row.key)
    expect(unlisted).toEqual([])
  })

  it('"[주간 퀘스트] " 접두어가 붙은 줄의 표시명은 접두어를 뗀 글자다', () => {
    const mismatched = weeklyRows
      .filter((row) => row.content_name.startsWith('[주간 퀘스트] '))
      .filter((row) => row.displayName !== row.content_name.replace(/^\[주간 퀘스트\] /, ''))
      .map((row) => row.key)
    expect(mismatched).toEqual([])
  })
})

describe('에픽 던전의 그림', () => {
  const cases: Array<[string, string]> = [
    ['epic_dungeon_high_mountain', 'ancientGodMitra'],
    ['epic_dungeon_angler_company', 'senya'],
    ['epic_dungeon_nightmare_paradise', 'baekyeon'],
    ['epic_dungeon_aurum_regis', 'lesa'],
  ]

  it.each(cases)('%s 의 초상은 "%s" 다', (key, portrait) => {
    expect(rowOf(key)?.background).toEqual({ portrait })
  })
})
