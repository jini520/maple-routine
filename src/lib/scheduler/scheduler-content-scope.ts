import catalog from '../../data/scheduler-content-catalog.json'

export type ShareScope = 'character' | 'world' | 'account'

interface CatalogEntry {
  name: string
  section: 'daily' | 'weekly'
  group: string
  shortName: string
  onlyWhenScheduled?: boolean
}

export interface ContentCatalogEntry {
  name: string
  scope: 'world' | 'account'
}

const WORLD_ENTRIES = catalog.worldShared as CatalogEntry[]
const ACCOUNT_ENTRIES = catalog.accountShared as CatalogEntry[]
const MAX_COUNT_OVERRIDES = catalog.maxCountOverrides as Record<string, number>
const SHARED_GROUP_ORDER = catalog.sharedGroupOrder as string[]
const CUMULATIVE_SCORES = catalog.cumulativeScores as string[]

// 공백 유무 방향이 항목마다 달라 양쪽 공백을 제거한 뒤 비교한다.
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
 * 리셋 없이 계속 누적되는 **개인** 점수인가.
 *
 * 공유 여부와는 다른 축이다. 이 항목들은 캐릭터 개인 기록이 맞고 저장·표시도 그대로다.
 * 다르게 다뤄야 하는 곳은 **후보 자격 판정** 하나뿐이다: `now_count` 가 주간 리셋을 넘어서도
 * 줄지 않아 "한 번이라도 해본 적 있음"과 "최근 14일에 했음"을 구분하지 못한다
 * (실측 : `[길드] 지하 수로` 73635 → 75889 → 79579, 07-30 리셋 통과에도 감소 없음).
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

/** 공유 항목 하나. 계열까지 붙은 카탈로그 줄 그대로다. */
export interface SharedContentEntry {
  /** API 가 보내는 이름. 호출부가 캐릭터 응답에서 이 항목을 다시 찾을 때 쓴다. */
  name: string
  /** 화면에 그리는 짧은 이름. 계열명이 위에 있어 그것을 뺀 나머지다. */
  shortName: string
  group: string
  section: 'daily' | 'weekly'
  scope: 'world' | 'account'
  /**
   * 참이면 **추적 중인 캐릭터 중 누구의 스케줄러에도 없을 때 그 줄을 안 그린다**
   * (유니온 둘만 해당). 나머지는 등록 여부와 무관하게 늘 그린다.
   *
   * 판정 자체는 이 파일이 아니라 호출부가 한다(`displayedWeeklyContents` 의 결과). 여기서
   * 항목을 빼면 컨텐츠 화면에서도 사라진다.
   */
  onlyWhenScheduled: boolean
}

export interface SharedContentGroup {
  group: string
  entries: readonly SharedContentEntry[]
}

function toSharedEntry(entry: CatalogEntry, scope: 'world' | 'account'): SharedContentEntry {
  return {
    name: entry.name,
    shortName: entry.shortName,
    group: entry.group,
    section: entry.section,
    scope,
    onlyWhenScheduled: entry.onlyWhenScheduled === true,
  }
}

/**
 * 공유 컨텐츠를 계열별로 묶은 목록. today 의 계정 및 메이플 ID 공유 컨텐츠 위젯이 읽는다.
 *
 * ## 월드/계정이 축이 아니다
 *
 * 두 목록을 **합쳐서** 계열로 다시 가른다. 월드 공유는 응답이 마지막 접속 월드 것이라 월드로 가를
 * 수 없고, 계열로 묶으면 그 축을 화면이 아예 주장하지 않게 된다. `scope` 는
 * 그래도 나른다. 그리는 데 안 쓰지만 다계정 처리(열린 질문)가 오면 필요한 값이다.
 *
 * ## 순서의 출처가 둘이다
 *
 * - **계열 순서**는 `sharedGroupOrder` 가 손으로 적는다. 배열을 이어 읽은 첫 등장 순서는
 *   몬스터파크 · 메이플 유니온 · 에픽던전이라 사용자가 지정한 순서와 다르다.
 * - **계열 안의 항목 순서**는 `worldShared` → `accountShared` 를 이어 읽은 순서 그대로다.
 *   월드 하나 + 계정 하나로 갈리는 계열은 메이플 유니온뿐이고, 그 둘의 순서가 이것으로
 *   정해진다.
 *
 * `sharedGroupOrder` 에 없는 계열은 **버리지 않고 뒤에 붙인다**. 카탈로그에 항목을 더하고 순서를
 * 안 적었을 때 화면에서 조용히 사라지는 것보다 순서가 어긋나는 편이 낫다.
 */
export function getSharedContentGroups(): SharedContentGroup[] {
  const entries: SharedContentEntry[] = [
    ...WORLD_ENTRIES.map((entry): SharedContentEntry => toSharedEntry(entry, 'world')),
    ...ACCOUNT_ENTRIES.map((entry): SharedContentEntry => toSharedEntry(entry, 'account')),
  ]

  const groups = new Map<string, SharedContentEntry[]>()
  for (const entry of entries) {
    const bucket = groups.get(entry.group)
    if (bucket === undefined) groups.set(entry.group, [entry])
    else bucket.push(entry)
  }

  const ordered = [...groups.keys()].sort((a, b) => {
    const rankA = SHARED_GROUP_ORDER.indexOf(a)
    const rankB = SHARED_GROUP_ORDER.indexOf(b)
    return (rankA === -1 ? SHARED_GROUP_ORDER.length : rankA) -
      (rankB === -1 ? SHARED_GROUP_ORDER.length : rankB)
  })

  return ordered.map((group) => ({ group, entries: groups.get(group) ?? [] }))
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
