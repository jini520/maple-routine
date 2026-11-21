/**
 * 컨텐츠 마스터 표(`contents` 칸) 조회. 컨텐츠를 key 로 찾는 자리는 전부 이 모듈을 거친다.
 *
 * 캐시 · 추적 목록 · 공유 원장은 컨텐츠 key 를 들고, 이름 · 분류 · 그림 · 요구 레벨은 이 표에서 찾는다.
 * API 이름에서 key 를 얻는 규칙도 여기 하나다(`contentKeyOfApiName`). 응답의 줄에서 지금 코드가 읽는
 * `ContentEntry` 를 만드는 것도 여기다. 수동 모드 기본값 중 `registration_flag` · `now_count` · `quest_state` 는
 * 표에 없고 `type` 이 정한다.
 */
import {
  CONTENT_CATEGORY_KEYS,
  CONTENT_CHECK_TYPES,
  type ContentCategoryKey,
  type ContentCategoryRow,
  type ContentCheckType,
  type ContentRow,
  type ContentSection,
  type ContentsTable,
} from '../../types/game-data'
import { periodOf, type EffectivePeriod } from '../boss/boss-profit-period'
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

export type { ContentCheckType, ContentSection }

/** 카드 그림의 id 셋. 배경은 지도와 보스 초상 중 하나이고, 지역 아이콘은 지도 배경 카드 옆에 선다. */
export interface ContentBackground {
  map?: string
  portrait?: string
  regionIcon?: string
}

/** 컨텐츠 한 줄. API 응답(`NexonDailyContentWire` · `NexonWeeklyContentWire`)과 같은 모양에 표의 칸을 더했다. */
export interface ContentEntry extends EffectivePeriod {
  key: string
  /** API 이름. 매칭 기준이다. */
  content_name: string
  category: ContentCategoryKey
  /** 카드 · 관리 화면의 이름. */
  name: string
  /** today 남은 스케줄처럼 좁은 자리의 이름. 공유 컨텐츠는 today 공유 위젯의 글자다. */
  shortName: string
  background?: ContentBackground
  /** 관리 화면 참고 태그를 컨텐츠 단위로 덮는 글자. `null` 은 숨긴다. */
  countTag?: string | null
  type: 'contents' | 'quest'
  checkType: ContentCheckType
  registration_flag: 'true' | 'false'
  now_count: number
  /** 표의 최대 횟수. 횟수로 완료를 세지 않는 컨텐츠는 0 이다. */
  max_count: number
  quest_state: '0' | '1' | '2' | null
  requiredLevel?: number
}

const CYCLES = ['daily', 'weekly'] as const
const TYPES = ['contents', 'quest'] as const
const SHARE_SCOPES = ['character', 'world', 'account'] as const

function toCategory(row: Row): ContentCategoryRow | null {
  if (!isNonEmptyString(row.id) || !isOneOf(row.key, CONTENT_CATEGORY_KEYS) || !isNonEmptyString(row.name)) return null
  if (!isBoolean(row.hidesCountTag)) return null
  const countTag = optional(row.countTag, isNonEmptyString)
  const weeklyMaxCount = optional(row.weeklyMaxCount, isPositiveInteger)
  const sharedSortOrder = optional(row.sharedSortOrder, isNonNegativeInteger)
  if (countTag === false || weeklyMaxCount === false || sharedSortOrder === false) return null
  return compact({
    id: row.id,
    key: row.key,
    name: row.name,
    countTag,
    hidesCountTag: row.hidesCountTag,
    weeklyMaxCount,
    sharedSortOrder,
  })
}

function toContent(row: Row): ContentRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isOneOf(row.cycle, CYCLES)) return null
  if (!isNonEmptyString(row.apiName) || !isNonEmptyString(row.categoryId) || !isNonEmptyString(row.name)) return null
  if (!isNonEmptyString(row.shortName) || !isOneOf(row.type, TYPES) || !isOneOf(row.checkType, CONTENT_CHECK_TYPES)) return null
  if (!isOneOf(row.shareScope, SHARE_SCOPES)) return null
  const backgroundMapAssetId = optional(row.backgroundMapAssetId, isNonEmptyString)
  const backgroundPortraitAssetId = optional(row.backgroundPortraitAssetId, isNonEmptyString)
  const regionIconAssetId = optional(row.regionIconAssetId, isNonEmptyString)
  const countTag = optional(row.countTag, isNonEmptyString)
  const maxCount = optional(row.maxCount, isPositiveInteger)
  const requiredLevel = optional(row.requiredLevel, isPositiveInteger)
  const validFrom = optional(row.validFrom, isPeriodText)
  const validUntil = optional(row.validUntil, isPeriodText)
  if (
    backgroundMapAssetId === false ||
    backgroundPortraitAssetId === false ||
    regionIconAssetId === false ||
    countTag === false ||
    maxCount === false ||
    requiredLevel === false ||
    validFrom === false ||
    validUntil === false
  ) {
    return null
  }
  // 횟수로 완료를 세는 컨텐츠만 최대 횟수를 든다. 없으면 완료로 셀 횟수가 없고, 다른 컨텐츠가 들면 넥슨 값을 잘못 덮는다.
  if ((row.checkType === 'count_only') !== (maxCount !== undefined)) return null
  return compact({
    id: row.id,
    key: row.key,
    cycle: row.cycle,
    apiName: row.apiName,
    categoryId: row.categoryId,
    name: row.name,
    shortName: row.shortName,
    backgroundMapAssetId,
    backgroundPortraitAssetId,
    regionIconAssetId,
    countTag,
    type: row.type,
    checkType: row.checkType,
    maxCount,
    requiredLevel,
    validFrom,
    validUntil,
    shareScope: row.shareScope,
  })
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. 컨텐츠는 이 칸의 분류를 가리켜야 한다. */
export function parseContents(value: unknown): ContentsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const contentCategories = rowsOf(value.contentCategories, toCategory)
  const contents = rowsOf(value.contents, toContent)
  if (contentCategories === null || contents === null) return null
  if (!uniqueBy(contentCategories, (category) => category.key) || !uniqueBy(contentCategories, (category) => category.id)) {
    return null
  }
  if (!uniqueBy(contents, (content) => content.key) || !uniqueBy(contents, (content) => content.id)) return null
  const categoryIds = new Set(contentCategories.map((category) => category.id))
  if (contents.some((content) => !categoryIds.has(content.categoryId))) return null
  return { updatedAt, contentCategories, contents }
}

export const contentsTable = gameTable<ContentsTable>(
  'contents',
  { updatedAt: null, contentCategories: [], contents: [] },
  parseContents,
)

/** 줄 하나를 지금 코드가 읽는 모양으로. 수동 모드 기본값 셋은 표에 없고 `type` 이 정한다. */
function toEntry(row: ContentRow, category: ContentCategoryKey): ContentEntry {
  const background =
    row.backgroundMapAssetId === undefined && row.backgroundPortraitAssetId === undefined
      ? undefined
      : compact<ContentBackground>({
          map: row.backgroundMapAssetId,
          portrait: row.backgroundPortraitAssetId,
          regionIcon: row.regionIconAssetId,
        })
  return compact({
    key: row.key,
    content_name: row.apiName,
    category,
    name: row.name,
    shortName: row.shortName,
    background,
    countTag: row.countTag,
    type: row.type,
    checkType: row.checkType,
    registration_flag: 'false' as const,
    now_count: 0,
    max_count: row.maxCount ?? 0,
    quest_state: row.type === 'quest' ? ('0' as const) : null,
    requiredLevel: row.requiredLevel,
    ...periodOf(row),
  })
}

/** API 이름을 맞추는 규칙. 보스와 같다. NFC 로 맞추고 공백을 모두 지운다. */
function comparableName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '')
}

const index = derive(contentsTable, (table) => {
  const categoryKeyById = new Map(table.contentCategories.map((category) => [category.id, category.key]))
  const daily: ContentEntry[] = []
  const weekly: ContentEntry[] = []
  for (const row of table.contents) {
    const category = categoryKeyById.get(row.categoryId)
    // 계약 검사가 분류 줄이 있는지 지킨다. 그래도 없으면 줄을 세울 분류가 없다.
    if (category === undefined) continue
    ;(row.cycle === 'daily' ? daily : weekly).push(toEntry(row, category))
  }
  const all = [...daily, ...weekly]
  return {
    template: { daily, weekly } as Readonly<Record<ContentSection, readonly ContentEntry[]>>,
    entryByKey: new Map(all.map((entry) => [entry.key, entry])),
    sectionByKey: new Map<string, ContentSection>(table.contents.map((row) => [row.key, row.cycle])),
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

/** 컨텐츠의 분류. 표에 없는 key 는 `null` 이다. */
export function contentCategoryOf(key: string | null | undefined): ContentCategoryKey | null {
  return findContent(key)?.category ?? null
}

/**
 * 카드 · 관리 화면의 이름. 표 이름이고, 모르는 key 면 넘긴 이름이다.
 *
 * @example contentDisplayNameOf(content.contentKey, content.apiName)
 */
export function contentDisplayNameOf(key: string | null | undefined, fallbackName: string): string {
  return findContent(key)?.name ?? fallbackName
}

/** 완료를 가르는 방법. 표에 없는 key 는 `null` 이다. */
export function contentCheckTypeOf(key: string | null | undefined): ContentCheckType | null {
  return findContent(key)?.checkType ?? null
}

/** 좁은 자리의 이름. 표 이름이고, 모르는 key 면 넘긴 이름이다. */
export function contentShortNameOf(key: string | null | undefined, fallbackName: string): string {
  return findContent(key)?.shortName ?? fallbackName
}
