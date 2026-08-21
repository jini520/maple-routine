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
// **지역 «이름» 을 돌려주는 짝은 없다** — [[ADR-147]] 정정 26 이 today 아코디언을 위해 하나 뒀다가
// 정정 41 에서 걷었다(주간은 접두어만 뗀다 — 같은 지역에 임무/보답 둘이 있어 뒷말이 곧 구분이다).
// 일일 쪽(`daily-quest-matching`)에는 그 짝이 여전히 있다.

export function matchWeeklyQuestRegionSlug(displayName: string): string | null {
  const normalizedName = stripSpaces(displayName)
  const entry = REGION_ENTRIES.find((candidate) => normalizedName.startsWith(stripSpaces(candidate.region)))
  return entry?.backgroundSlug ?? null
}
