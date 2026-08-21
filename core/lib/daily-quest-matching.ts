import dailyQuestRegionsData from '@core/data/daily-quest-regions.json'

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
/**
 * 같은 판정으로 **지역 이름**을 돌려준다 — 배경 슬러그가 아니라 화면에 적을 글자다.
 *
 * today 의 「남은 스케줄」 아코디언이 항목을 이름으로 펼치는데, 원문(«[일일 퀘스트] 소멸의 여로
 * 조사»)은 한 줄에 여러 개를 세울 수 없다. 지역명만 쓰기로 했고(사용자 지정), 그 판정은 아래
 * 슬러그 함수와 **같은 규칙**이라 여기서 갈라 두면 두 벌이 된다.
 */
export function matchDailyQuestRegion(displayName: string): string | null {
  const normalizedName = stripSpaces(displayName)
  const entry = REGION_ENTRIES.find((candidate) => normalizedName.startsWith(stripSpaces(candidate.region)))
  return entry?.region ?? null
}

export function matchDailyQuestRegionSlug(displayName: string): string | null {
  const normalizedName = stripSpaces(displayName)
  const entry = REGION_ENTRIES.find((candidate) => normalizedName.startsWith(stripSpaces(candidate.region)))
  return entry?.backgroundSlug ?? null
}
