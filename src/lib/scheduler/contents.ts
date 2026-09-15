/**
 * 컨텐츠 마스터 표(`src/data/scheduler-content-template.json`) 조회. 컨텐츠를 key 로 찾는 자리는 전부 이 모듈을
 * 거친다.
 *
 * 캐시 · 추적 목록 · 공유 원장 · 카탈로그는 컨텐츠 key 를 들고, 이름 · 갈래 · 그림 · 요구 레벨은 이 표에서 찾는다.
 * API 이름에서 key 를 얻는 규칙도 여기 하나다(`contentKeyOfApiName`).
 */
import schedulerContentTemplate from '../../data/scheduler-content-template.json'
import type { EffectivePeriod } from '../boss/boss-profit-period'
import type { ContentCategoryKey } from './content-categories'

/** 카드 그림. 지도 배경 slug 또는 보스 초상 slug 다. */
export interface ContentBackground {
  map?: string
  portrait?: string
}

/** 템플릿 한 줄. API 응답(`NexonDailyContentWire` · `NexonWeeklyContentWire`)과 같은 모양에 표의 칸을 더했다. */
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

export type ContentSection = 'daily' | 'weekly'

const data = schedulerContentTemplate as { daily: ContentEntry[]; weekly: ContentEntry[] }

/** 섹션별 줄. **차례가 곧 관리 화면의 차례**다. */
export const CONTENT_TEMPLATE: Readonly<Record<ContentSection, readonly ContentEntry[]>> = {
  daily: data.daily,
  weekly: data.weekly,
}

const sectionByKey = new Map<string, ContentSection>([
  ...data.daily.map((entry) => [entry.key, 'daily'] as const),
  ...data.weekly.map((entry) => [entry.key, 'weekly'] as const),
])
const entryByKey = new Map([...data.daily, ...data.weekly].map((entry) => [entry.key, entry]))

/** API 이름을 맞추는 규칙. 보스와 같다. NFC 로 맞추고 공백을 모두 지운다. */
function comparableName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '')
}

const keyByComparableName = new Map(
  [...data.daily, ...data.weekly].map((entry) => [comparableName(entry.content_name), entry.key]),
)

/** 표의 한 줄. 모르는 key 와 key 없음은 `null` 이다. */
export function findContent(key: string | null | undefined): ContentEntry | null {
  return key == null ? null : (entryByKey.get(key) ?? null)
}

/** API 이름에서 key. 표에 없으면 `null` 이다. */
export function contentKeyOfApiName(name: string): string | null {
  return keyByComparableName.get(comparableName(name)) ?? null
}

/** 컨텐츠가 속한 섹션. 표에 없는 key 는 `null` 이다. */
export function contentSectionOf(key: string | null | undefined): ContentSection | null {
  return key == null ? null : (sectionByKey.get(key) ?? null)
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

/** 섹션의 key 집합. 수동 추적 멤버십은 늘 이 집합의 부분집합이다. */
export const TEMPLATE_DAILY_KEYS: ReadonlySet<string> = new Set(data.daily.map((entry) => entry.key))
export const TEMPLATE_WEEKLY_KEYS: ReadonlySet<string> = new Set(data.weekly.map((entry) => entry.key))
