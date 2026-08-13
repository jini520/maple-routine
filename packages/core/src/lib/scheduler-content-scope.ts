import catalog from '@core/data/scheduler-content-catalog.json'

export type ShareScope = 'character' | 'world' | 'account'

interface CatalogEntry {
  name: string
  section: 'daily' | 'weekly'
}

export interface ContentCatalogEntry {
  name: string
  scope: 'world' | 'account'
}

const WORLD_ENTRIES = catalog.worldShared as CatalogEntry[]
const ACCOUNT_ENTRIES = catalog.accountShared as CatalogEntry[]
const MAX_COUNT_OVERRIDES = catalog.maxCountOverrides as Record<string, number>
const CUMULATIVE_SCORES = catalog.cumulativeScores as string[]

// 공백 유무 방향이 항목마다 달라(ADR-007의 보스명 매칭과 동일한 이유) 양쪽 공백을 제거한 뒤 비교한다.
function stripSpaces(value: string): string {
  return value.replace(/\s+/g, '')
}

function findEntry(entries: CatalogEntry[], name: string): CatalogEntry | undefined {
  const normalized = stripSpaces(name)
  return entries.find((entry) => stripSpaces(entry.name) === normalized)
}

export function getShareScope(name: string): ShareScope {
  if (findEntry(WORLD_ENTRIES, name) !== undefined) {
    return 'world'
  }
  if (findEntry(ACCOUNT_ENTRIES, name) !== undefined) {
    return 'account'
  }
  return 'character'
}

export function getContentSection(name: string): 'daily' | 'weekly' | null {
  const entry = findEntry(WORLD_ENTRIES, name) ?? findEntry(ACCOUNT_ENTRIES, name)
  return entry?.section ?? null
}

/**
 * 리셋 없이 계속 누적되는 **개인** 점수인가([[ADR-086]] 정정 2).
 *
 * 공유 여부와는 다른 축이다 — 이 항목들은 캐릭터 개인 기록이 맞고 저장·표시도 그대로다.
 * 다르게 다뤄야 하는 곳은 **후보 자격 판정** 하나뿐이다: `now_count` 가 주간 리셋을 넘어서도
 * 줄지 않아 "한 번이라도 해본 적 있음"과 "최근 14일에 했음"을 구분하지 못한다
 * (실측 2026-08-03: `[길드] 지하 수로` 73635 → 75889 → 79579, 07-30 리셋 통과에도 감소 없음).
 */
export function isCumulativeScore(name: string): boolean {
  const normalized = stripSpaces(name)
  return CUMULATIVE_SCORES.some((entry) => stripSpaces(entry) === normalized)
}

export function getMaxCountOverride(name: string): number | null {
  const normalized = stripSpaces(name)
  const match = Object.entries(MAX_COUNT_OVERRIDES).find(([key]) => stripSpaces(key) === normalized)
  return match?.[1] ?? null
}

export function getContentCatalogEntries(section: 'daily' | 'weekly'): ContentCatalogEntry[] {
  const world = WORLD_ENTRIES.filter((entry) => entry.section === section).map(
    (entry): ContentCatalogEntry => ({ name: entry.name, scope: 'world' }),
  )
  const account = ACCOUNT_ENTRIES.filter((entry) => entry.section === section).map(
    (entry): ContentCatalogEntry => ({ name: entry.name, scope: 'account' }),
  )
  return [...world, ...account]
}
