import weeklyQuestRegionsData from '@core/data/weekly-quest-regions.json'

const WEEKLY_QUEST_PREFIX = '[주간 퀘스트] '

interface WeeklyQuestRegionEntry {
  region: string
  backgroundSlug: string
}

const REGION_ENTRIES = weeklyQuestRegionsData as WeeklyQuestRegionEntry[]

function stripSpaces(value: string): string {
  return value.replace(/\s+/g, '')
}

export function stripWeeklyQuestPrefix(name: string): string {
  return name.startsWith(WEEKLY_QUEST_PREFIX) ? name.slice(WEEKLY_QUEST_PREFIX.length) : name
}

// daily-quest-matching.ts의 matchDailyQuestRegionSlug와 동일한 방식(ADR-020) — 접두어를
// 제거한 퀘스트명이 지역명으로 시작하는지로 판정한다. 보상형 퀘스트(예: "꾸준한 의뢰에 대한
// 보답")는 지역명이 앞에 오지 않으므로 데이터에서 퀘스트명 전체를 region으로 등록해둔다.
/**
 * 같은 판정으로 **지역 이름**을 돌려준다 — 배경 슬러그가 아니라 화면에 적을 글자다.
 *
 * today 의 「남은 스케줄」 아코디언이 항목을 이름으로 펼치는데, 원문(«[일일 퀘스트] 소멸의 여로
 * 조사»)은 한 줄에 여러 개를 세울 수 없다. 지역명만 쓰기로 했고(사용자 지정), 그 판정은 아래
 * 슬러그 함수와 **같은 규칙**이라 여기서 갈라 두면 두 벌이 된다.
 */
export function matchWeeklyQuestRegion(displayName: string): string | null {
  const normalizedName = stripSpaces(displayName)
  const entry = REGION_ENTRIES.find((candidate) => normalizedName.startsWith(stripSpaces(candidate.region)))
  return entry?.region ?? null
}

export function matchWeeklyQuestRegionSlug(displayName: string): string | null {
  const normalizedName = stripSpaces(displayName)
  const entry = REGION_ENTRIES.find((candidate) => normalizedName.startsWith(stripSpaces(candidate.region)))
  return entry?.backgroundSlug ?? null
}
