import dailyQuestRegionsData from '../data/daily-quest-regions.json'

const DAILY_QUEST_PREFIX = '[일일 퀘스트] '

interface DailyQuestRegionEntry {
  region: string
  backgroundSlug: string
}

const REGION_ENTRIES = dailyQuestRegionsData as DailyQuestRegionEntry[]

function stripSpaces(value: string): string {
  return value.replace(/\s+/g, '')
}

export function stripDailyQuestPrefix(name: string): string {
  return name.startsWith(DAILY_QUEST_PREFIX) ? name.slice(DAILY_QUEST_PREFIX.length) : name
}

// 접두어를 제거한 퀘스트명은 지역명과 정확히 같지 않고 조사·서술어가 붙는다
// (예: "레헬른의 평온한 밤" -> 지역명 "레헬른"). 양쪽 공백을 제거한 뒤
// 퀘스트명이 지역명으로 시작하는지로 판정한다 (ADR-020).
export function matchDailyQuestRegionSlug(displayName: string): string | null {
  const normalizedName = stripSpaces(displayName)
  const entry = REGION_ENTRIES.find((candidate) => normalizedName.startsWith(stripSpaces(candidate.region)))
  return entry?.backgroundSlug ?? null
}
