/**
 * 컨텐츠 마스터 표(`contents` 칸) 조회. 컨텐츠를 key 로 찾는 자리는 전부 이 모듈을 거친다.
 *
 * 캐시 · 추적 목록 · 공유 원장은 컨텐츠 key 를 들고, 이름 · 갈래 · 그림 · 요구 레벨은 이 표에서 찾는다.
 * API 이름에서 key 를 얻는 규칙도 여기 하나다(`contentKeyOfApiName`). 응답의 줄에서 지금 코드가 읽는
 * `ContentEntry` 를 만드는 것도 여기다. 수동 모드 기본값 중 `registration_flag` · `now_count` · `quest_state` 는
 * 표에 없고 `type` 이 정한다.
 */
import {
  CONTENT_CATEGORY_KEYS,
  type ContentCategoryKey,
  type ContentCategoryRow,
  type ContentRow,
  type ContentSection,
  type ContentsTable,
} from '../../types/game-data'
import type { EffectivePeriod } from '../boss/boss-profit-period'
import {
  compact,
  isBoolean,
  isNonEmptyString,
  isNonNegativeInteger,
  isOneOf,
  isPeriodText,
  isPositiveInteger,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { gameTable, derive } from '../game-data/table'

export type { ContentSection }

/** 카드 그림. 지도 배경 slug 또는 보스 초상 slug 다. */
export interface ContentBackground {
  map?: string
  portrait?: string
}

/** 컨텐츠 한 줄. API 응답(`NexonDailyContentWire` · `NexonWeeklyContentWire`)과 같은 모양에 표의 칸을 더했다. */
export interface ContentEntry extends EffectivePeriod {
  key: string
  /** API 이름. 매칭 기준이다. */
  content_name: string
  category: ContentCategoryKey
  /** 카드 · 관리 화면의 이름. */
  displayName: string
  /** today 남은 스케줄처럼 좁은 자리의 이름. */
  shortName: string
  background?: ContentBackground
  /** 관리 화면 참고 태그를 컨텐츠 단위로 덮는 글자. `null` 은 숨긴다. */
  countTag?: string | null
  type: 'contents' | 'quest'
  registration_flag: 'true' | 'false'
  now_count: number
  max_count: number
  quest_state: '0' | '1' | '2' | null
  requiredLevel?: number
}

const SECTIONS = ['daily', 'weekly'] as const
const TYPES = ['contents', 'quest'] as const
const SHARE_SCOPES = ['character', 'world', 'account'] as const

function toCategory(row: Row): ContentCategoryRow | null {
  if (!isOneOf(row.key, CONTENT_CATEGORY_KEYS) || !isNonEmptyString(row.name) || !isBoolean(row.hideCountTag)) return null
  const countTag = optional(row.countTag, isNonEmptyString)
  const weeklyLimit = optional(row.weeklyLimit, isPositiveInteger)
  const sharedOrder = optional(row.sharedOrder, isNonNegativeInteger)
  if (countTag === false || weeklyLimit === false || sharedOrder === false) return null
  return compact({ key: row.key, name: row.name, countTag, hideCountTag: row.hideCountTag, weeklyLimit, sharedOrder })
}

function toContent(row: Row): ContentRow | null {
  if (!isNonEmptyString(row.key) || !isOneOf(row.section, SECTIONS) || !isNonEmptyString(row.apiName)) return null
  if (!isOneOf(row.category, CONTENT_CATEGORY_KEYS) || !isNonEmptyString(row.displayName)) return null
  if (!isNonEmptyString(row.shortName) || !isOneOf(row.type, TYPES) || !isNonNegativeInteger(row.maxCount)) return null
  if (!isOneOf(row.shareScope, SHARE_SCOPES)) return null
  if (!isBoolean(row.onlyWhenScheduled) || !isBoolean(row.trustRegistrationFlag) || !isBoolean(row.cumulativeScore)) {
    return null
  }
  const backgroundMap = optional(row.backgroundMap, isNonEmptyString)
  const backgroundPortrait = optional(row.backgroundPortrait, isNonEmptyString)
  const countTag = optional(row.countTag, isNonEmptyString)
  const requiredLevel = optional(row.requiredLevel, isPositiveInteger)
  const from = optional(row.from, isPeriodText)
  const until = optional(row.until, isPeriodText)
  const sharedShortName = optional(row.sharedShortName, isNonEmptyString)
  const maxCountOverride = optional(row.maxCountOverride, isPositiveInteger)
  if (
    backgroundMap === false ||
    backgroundPortrait === false ||
    countTag === false ||
    requiredLevel === false ||
    from === false ||
    until === false ||
    sharedShortName === false ||
    maxCountOverride === false
  ) {
    return null
  }
  return compact({
    key: row.key,
    section: row.section,
    apiName: row.apiName,
    category: row.category,
    displayName: row.displayName,
    shortName: row.shortName,
    backgroundMap,
    backgroundPortrait,
    countTag,
    type: row.type,
    maxCount: row.maxCount,
    requiredLevel,
    from,
    until,
    shareScope: row.shareScope,
    sharedShortName,
    onlyWhenScheduled: row.onlyWhenScheduled,
    trustRegistrationFlag: row.trustRegistrationFlag,
    cumulativeScore: row.cumulativeScore,
    maxCountOverride,
  })
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. */
export function parseContents(value: unknown): ContentsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const categories = rowsOf(value.categories, toCategory)
  const contents = rowsOf(value.contents, toContent)
  if (categories === null || contents === null) return null
  if (!uniqueBy(categories, (category) => category.key) || !uniqueBy(contents, (content) => content.key)) return null
  return { updatedAt, categories, contents }
}

export const contentsTable = gameTable('contents', { updatedAt: null, categories: [], contents: [] }, parseContents)

/** 줄 하나를 지금 코드가 읽는 모양으로. 수동 모드 기본값 셋은 표에 없고 `type` 이 정한다. */
function toEntry(row: ContentRow): ContentEntry {
  const background =
    row.backgroundMap === undefined && row.backgroundPortrait === undefined
      ? undefined
      : compact<ContentBackground>({ map: row.backgroundMap, portrait: row.backgroundPortrait })
  return compact({
    key: row.key,
    content_name: row.apiName,
    category: row.category,
    displayName: row.displayName,
    shortName: row.shortName,
    background,
    countTag: row.countTag,
    type: row.type,
    registration_flag: 'false' as const,
    now_count: 0,
    max_count: row.maxCount,
    quest_state: row.type === 'quest' ? ('0' as const) : null,
    requiredLevel: row.requiredLevel,
    from: row.from,
    until: row.until,
  })
}

/** API 이름을 맞추는 규칙. 보스와 같다. NFC 로 맞추고 공백을 모두 지운다. */
function comparableName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '')
}

const index = derive(contentsTable, (table) => {
  const daily: ContentEntry[] = []
  const weekly: ContentEntry[] = []
  for (const row of table.contents) (row.section === 'daily' ? daily : weekly).push(toEntry(row))
  const all = [...daily, ...weekly]
  return {
    template: { daily, weekly } as Readonly<Record<ContentSection, readonly ContentEntry[]>>,
    entryByKey: new Map(all.map((entry) => [entry.key, entry])),
    sectionByKey: new Map<string, ContentSection>(table.contents.map((row) => [row.key, row.section])),
    keyByComparableName: new Map(all.map((entry) => [comparableName(entry.content_name), entry.key])),
    keysBySection: {
      daily: new Set(daily.map((entry) => entry.key)) as ReadonlySet<string>,
      weekly: new Set(weekly.map((entry) => entry.key)) as ReadonlySet<string>,
    },
  }
})

/** 섹션별 줄. **차례가 곧 관리 화면의 차례**다. */
export function contentTemplate(): Readonly<Record<ContentSection, readonly ContentEntry[]>> {
  return index().template
}

/** 섹션의 key 집합. 수동 추적 멤버십은 늘 이 집합의 부분집합이다. 기간을 안 본다. */
export function templateKeysOf(section: ContentSection): ReadonlySet<string> {
  return index().keysBySection[section]
}

/** 표의 한 줄. 모르는 key 와 key 없음은 `null` 이다. */
export function findContent(key: string | null | undefined): ContentEntry | null {
  return key == null ? null : (index().entryByKey.get(key) ?? null)
}

/** API 이름에서 key. 표에 없으면 `null` 이다. */
export function contentKeyOfApiName(name: string): string | null {
  return index().keyByComparableName.get(comparableName(name)) ?? null
}

/** 컨텐츠가 속한 섹션. 표에 없는 key 는 `null` 이다. */
export function contentSectionOf(key: string | null | undefined): ContentSection | null {
  return key == null ? null : (index().sectionByKey.get(key) ?? null)
}

/** 컨텐츠의 갈래. 표에 없는 key 는 `null` 이다. */
export function contentCategoryOf(key: string | null | undefined): ContentCategoryKey | null {
  return findContent(key)?.category ?? null
}

/**
 * 카드 · 관리 화면의 이름. 표 이름이고, 모르는 key 면 넘긴 이름이다.
 *
 * @example contentDisplayNameOf(content.contentKey, content.apiName)
 */
export function contentDisplayNameOf(key: string | null | undefined, fallbackName: string): string {
  return findContent(key)?.displayName ?? fallbackName
}

/** 좁은 자리의 이름. 표 이름이고, 모르는 key 면 넘긴 이름이다. */
export function contentShortNameOf(key: string | null | undefined, fallbackName: string): string {
  return findContent(key)?.shortName ?? fallbackName
}
