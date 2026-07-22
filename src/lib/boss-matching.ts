import weeklyBossesData from '../data/weekly-bosses.json'
import type { BossContent, BossCycle, BossDifficulty } from '../types'

export interface MatchedBoss {
  apiName: string
  difficulty: BossDifficulty
  cycle: BossCycle
  isRegistered: boolean
  isComplete: boolean
  ownComplete: boolean // 승격 없는 원본 완료 여부(ADR-032) — selectBossProfitBosses가 실제 처치 난이도를 판정할 때 사용
  matchedBossName: string | null
  portraitSlug: string | null
  isSeasonBoss: boolean
}

interface BossReferenceEntry {
  boss: string
  difficulties: string[]
  portraitSlug?: string
  apiAlias?: string
  status?: string
  note?: string
}

interface ReferenceEntryWithOrigin extends BossReferenceEntry {
  isSeasonBoss: boolean
}

// eventWeekly(시즌 보스, 현재 메이린) 소속 여부를 isSeasonBoss로 태깅해둔다 — 주간 보스
// 12마리 제한/처치 카운트에서 시즌 보스를 제외하는 판정에 쓰인다([[ADR-007]], [[ADR-031]]).
const REFERENCE_ENTRIES: ReferenceEntryWithOrigin[] = [
  ...(weeklyBossesData.weekly as BossReferenceEntry[]).map((entry) => ({ ...entry, isSeasonBoss: false })),
  ...(weeklyBossesData.eventWeekly as BossReferenceEntry[]).map((entry) => ({ ...entry, isSeasonBoss: true })),
  ...(weeklyBossesData.monthly as BossReferenceEntry[]).map((entry) => ({ ...entry, isSeasonBoss: false })),
]

export const WEEKLY_BOSS_CLEAR_LIMIT: number = weeklyBossesData.weeklyBossSelectionLimit

function stripSpaces(value: string): string {
  return value.replace(/\s+/g, '')
}

// 공백 유무 방향이 보스마다 달라(API 쪽에 더 있을 때도, 데이터 쪽에 더 있을 때도 있음, ADR-007)
// 양쪽 다 공백을 제거한 뒤 비교한다. apiAlias는 공백 제거로도 못 잡는 예외(예: "시즌 보스 메이린")를 위한 명시 매핑이다.
function findReferenceEntry(apiName: string): ReferenceEntryWithOrigin | undefined {
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
    ownComplete: content.ownComplete,
    matchedBossName: entry?.boss ?? null,
    portraitSlug: entry?.portraitSlug ?? null,
    isSeasonBoss: entry?.isSeasonBoss ?? false,
  }
}

function groupByApiName(bosses: MatchedBoss[]): Map<string, MatchedBoss[]> {
  const groups = new Map<string, MatchedBoss[]>()
  for (const boss of bosses) {
    const group = groups.get(boss.apiName) ?? []
    group.push(boss)
    groups.set(boss.apiName, group)
  }
  return groups
}

// 등록 여부와 무관하게 시즌 보스를 제외한 주간 보스 중 완료된(content_name 기준) 보스 수를
// 센다([[ADR-031]] 결정 1) — 등록 없이 잡은 보스도 포함하되, 같은 보스를 여러 난이도로
// 동시에 완료해도 1로만 센다.
export function countClearedWeeklyBosses(bosses: MatchedBoss[]): number {
  const weeklyBosses = bosses.filter((boss) => boss.cycle === 'weekly' && !boss.isSeasonBoss)
  let count = 0
  for (const group of groupByApiName(weeklyBosses).values()) {
    if (group.some((boss) => boss.isComplete)) {
      count += 1
    }
  }
  return count
}

// 보스 카드 목록에 표시할 항목을 content_name 그룹별로 고른다([[ADR-031]] 결정 5) — 등록된
// 난이도가 있으면 그것만 보여주고(중복 카드 방지), 없으면 완료된 난이도를 대신 보여준다.
export function selectDisplayBosses(bosses: MatchedBoss[]): MatchedBoss[] {
  const result: MatchedBoss[] = []
  for (const group of groupByApiName(bosses).values()) {
    const registered = group.filter((boss) => boss.isRegistered)
    if (registered.length > 0) {
      result.push(...registered)
      continue
    }
    result.push(...group.filter((boss) => boss.isComplete))
  }
  return result
}

// 보스 수익 계산기 전용 선택 로직(ADR-032). selectDisplayBosses(카드 표시용, 등록 여부 우선)와
// 달리 "실제로 처치했는가"(ownComplete, 승격 없는 원본 완료 여부)를 우선한다 — 등록한 난이도와
// 실제로 처치한 난이도가 다를 수 있어([[ADR-031]]), 수익 계산은 반드시 진짜 처치한 난이도의
// 가격을 써야 한다. 같은 content_name·같은 cycle(weekly/monthly) 안에서는 게임 룰상 한
// 캐릭터가 여러 난이도를 동시에 완료할 수 없으므로(사용자 확인, 2026-07-22) ownComplete: true인
// 항목은 그룹당 최대 1개다 — 그 이상이면(예: 서로 다른 cycle 그룹이 우연히 같은 content_name을
// 쓰는 경우) 전부 실제 완료이므로 데이터를 숨기지 않고 그대로 보여준다.
export function selectBossProfitBosses(bosses: MatchedBoss[]): MatchedBoss[] {
  const result: MatchedBoss[] = []
  for (const group of groupByApiName(bosses).values()) {
    const actuallyComplete = group.filter((boss) => boss.ownComplete)
    if (actuallyComplete.length > 0) {
      result.push(...actuallyComplete)
      continue
    }
    const registered = group.find((boss) => boss.isRegistered)
    if (registered !== undefined) {
      result.push(registered) // 미완료 placeholder — 등록 난이도로 표시(ADR-032)
    }
  }
  return result
}
