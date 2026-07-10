import weeklyBossesData from '../data/weekly-bosses.json'
import type { BossContent, BossCycle, BossDifficulty } from '../types'

export interface MatchedBoss {
  apiName: string
  difficulty: BossDifficulty
  cycle: BossCycle
  isRegistered: boolean
  isComplete: boolean
  matchedBossName: string | null
  portraitSlug: string | null
}

interface BossReferenceEntry {
  boss: string
  difficulties: string[]
  portraitSlug?: string
  apiAlias?: string
  status?: string
  note?: string
}

const REFERENCE_ENTRIES: BossReferenceEntry[] = [
  ...(weeklyBossesData.weekly as BossReferenceEntry[]),
  ...(weeklyBossesData.eventWeekly as BossReferenceEntry[]),
  ...(weeklyBossesData.monthly as BossReferenceEntry[]),
]

function stripSpaces(value: string): string {
  return value.replace(/\s+/g, '')
}

// 공백 유무 방향이 보스마다 달라(API 쪽에 더 있을 때도, 데이터 쪽에 더 있을 때도 있음, ADR-007)
// 양쪽 다 공백을 제거한 뒤 비교한다. apiAlias는 공백 제거로도 못 잡는 예외(예: "시즌 보스 메이린")를 위한 명시 매핑이다.
function findReferenceEntry(apiName: string): BossReferenceEntry | undefined {
  const normalizedApiName = stripSpaces(apiName)
  return REFERENCE_ENTRIES.find((entry) => {
    const candidates = [entry.boss, entry.apiAlias].filter((value): value is string => value !== undefined)
    return candidates.some((candidate) => stripSpaces(candidate) === normalizedApiName)
  })
}

export function matchBossContent(content: BossContent): MatchedBoss {
  const entry = findReferenceEntry(content.name)

  return {
    apiName: content.name,
    difficulty: content.difficulty,
    cycle: content.cycle,
    isRegistered: content.isRegistered,
    isComplete: content.isComplete,
    matchedBossName: entry?.boss ?? null,
    portraitSlug: entry?.portraitSlug ?? null,
  }
}
