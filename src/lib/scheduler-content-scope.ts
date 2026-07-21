import catalog from '../data/scheduler-content-catalog.json'

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
