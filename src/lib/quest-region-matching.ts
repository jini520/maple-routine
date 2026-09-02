/**
 * 컨텐츠 이름에서 **지역 슬러그**를 찾는다. 그 슬러그로 배경·아이콘을 조회한다(`lib/artwork`).
 *
 * 세 자리가 같은 모양이라 모았다. 갈리는 것은 표와 접두어뿐이다.
 *
 * | | 표 | 접두어 | 맞추는 법 |
 * |---|---|---|---|
 * | 일일 퀘스트 | `daily-quest-regions.json` | `[일일 퀘스트] ` | 앞부분 일치 |
 * | 주간 퀘스트 | `weekly-quest-regions.json` | `[주간 퀘스트] ` | 앞부분 일치 |
 * | 주간 지역 퀘스트 | `weekly-regional-quests.json` | 없음 | 이름 전체 일치 |
 *
 * ## 왜 공백을 지우고 견주나
 *
 * 넥슨이 주는 이름과 표의 이름이 **띄어쓰기만 다른** 경우가 있다. 공백을 지운 뒤 견주면 그 차이가
 * 사라진다. 지우는 것은 견줄 때뿐이고 돌려주는 값은 표의 원본이다.
 *
 * ## 왜 앞부분 일치인가
 *
 * 넥슨 이름에 지역 뒤로 꼬리가 붙는다(`아르카나 - 무릉도원`). 전체 일치로 두면 그 꼬리 때문에 다
 * 놓친다. 주간 지역 퀘스트만 전체 일치인 것은 그 표가 컨텐츠 이름을 통째로 들고 있어서다.
 */
import dailyQuestRegionsData from '../data/daily-quest-regions.json'
import weeklyQuestRegionsData from '../data/weekly-quest-regions.json'
import weeklyRegionalQuestsData from '../data/weekly-regional-quests.json'

interface RegionEntry {
  region: string
  backgroundSlug: string
}

interface RegionalQuestEntry {
  name: string
  backgroundSlug: string
}

const DAILY_ENTRIES = dailyQuestRegionsData as RegionEntry[]
const WEEKLY_ENTRIES = weeklyQuestRegionsData as RegionEntry[]
const REGIONAL_ENTRIES = weeklyRegionalQuestsData as RegionalQuestEntry[]

const DAILY_QUEST_PREFIX = '[일일 퀘스트] '
const WEEKLY_QUEST_PREFIX = '[주간 퀘스트] '

function stripSpaces(value: string): string {
  return value.replace(/\s+/g, '')
}

function stripPrefix(name: string, prefix: string): string {
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

function findRegion(entries: RegionEntry[], displayName: string): RegionEntry | undefined {
  const normalizedName = stripSpaces(displayName)

  return entries.find((candidate) => normalizedName.startsWith(stripSpaces(candidate.region)))
}

export function stripDailyQuestPrefix(name: string): string {
  return stripPrefix(name, DAILY_QUEST_PREFIX)
}

export function stripWeeklyQuestPrefix(name: string): string {
  return stripPrefix(name, WEEKLY_QUEST_PREFIX)
}

/** 지역 **이름**을 돌려준다(슬러그가 아니다). 화면이 지역명을 그대로 적는 자리가 있다. */
export function matchDailyQuestRegion(displayName: string): string | null {
  return findRegion(DAILY_ENTRIES, displayName)?.region ?? null
}

export function matchDailyQuestRegionSlug(displayName: string): string | null {
  return findRegion(DAILY_ENTRIES, displayName)?.backgroundSlug ?? null
}

export function matchWeeklyQuestRegionSlug(displayName: string): string | null {
  return findRegion(WEEKLY_ENTRIES, displayName)?.backgroundSlug ?? null
}

/** 이 표만 **이름 전체**로 맞춘다 — 표가 지역이 아니라 컨텐츠 이름을 들고 있다. */
export function matchWeeklyRegionalQuestSlug(contentName: string): string | null {
  return REGIONAL_ENTRIES.find((candidate) => candidate.name === contentName)?.backgroundSlug ?? null
}
