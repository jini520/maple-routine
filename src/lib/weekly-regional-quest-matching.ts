import weeklyRegionalQuestsData from '../data/weekly-regional-quests.json'

interface WeeklyRegionalQuestEntry {
  name: string
  backgroundSlug: string
}

const ENTRIES = weeklyRegionalQuestsData as WeeklyRegionalQuestEntry[]

// 일일퀘스트([[ADR-020]])와 달리 콘텐츠명에 지역명이 텍스트로 포함되지 않아
// (예: "에르다 스펙트럼" ↔ "소멸의 여로") startsWith가 아니라 콘텐츠명 정확 일치로 조회한다.
export function matchWeeklyRegionalQuestSlug(contentName: string): string | null {
  const entry = ENTRIES.find((candidate) => candidate.name === contentName)
  return entry?.backgroundSlug ?? null
}
