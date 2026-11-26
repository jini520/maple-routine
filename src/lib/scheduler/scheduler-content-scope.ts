/**
 * 컨텐츠의 공유 범위 · 완료 방법에서 따라 나오는 규칙 · 표의 최대 횟수 · 분류 주간 한도. 전부 컨텐츠 표(`contents` 칸)에서 읽는다.
 *
 * 등록을 이번 응답으로 정하는 컨텐츠, 최근 활동에서 빼는 컨텐츠, 공유 위젯에 그리는 컨텐츠를 따로 적은 칸 없이 공유 범위와
 * 완료 방법(`checkType`)으로 가른다.
 */
import type { ContentCategoryKey, ContentCheckType, ContentRow, ContentSection, ShareScope } from '../../types/game-data'
import { periodOf, type EffectivePeriod } from '../boss/boss-profit-period'
import { compact } from '../game-data/contract'
import { derive } from '../game-data/table'
import { contentCategoryOf, contentsTable } from './contents'

export type { ShareScope }

export interface ContentCatalogEntry {
  contentKey: string
  scope: 'world' | 'account'
}

const index = derive(contentsTable, (table) => {
  const categoryById = new Map(table.contentCategories.map((category) => [category.id, category]))
  return {
    byKey: new Map(table.contents.map((content) => [content.key, content])),
    categoryById,
    categoryByKey: new Map(table.contentCategories.map((category) => [category.key, category])),
    /** 캐릭터 범위가 아닌 줄. 표의 차례(일일 뒤 주간) 그대로다. */
    shared: table.contents.filter((content) => content.shareScope !== 'character'),
  }
})

function rowOf(contentKey: string | null): ContentRow | undefined {
  return contentKey === null ? undefined : index().byKey.get(contentKey)
}

/** 공유 범위. 컨텐츠 key 가 없는(표에 없는) 항목은 캐릭터 범위다. */
export function getShareScope(contentKey: string | null): ShareScope {
  return rowOf(contentKey)?.shareScope ?? 'character'
}

/**
 * 병합이 이 항목의 등록을 **이번 응답의 `registration_flag`** 로 정하는가. 공유 범위가 캐릭터가 아니고 퀘스트 상태만 확인하는
 * 컨텐츠(메이플 유니온 드래곤 퇴치 둘)다.
 *
 * 나머지 공유 항목은 원장의 `active` 가 한 번 참이면 계속 참이다. 이 둘을 그렇게 두면 등록을 풀어도 컨텐츠 스케줄러의 공유
 * 탭에 계속 남는다.
 */
export function trustsRegistrationFlag(contentKey: string | null): boolean {
  const row = rowOf(contentKey)
  return row !== undefined && row.shareScope !== 'character' && row.checkType === 'state_only'
}

/** 분류의 주간 완료 한도(분류 줄의 `weeklyMaxCount`). 한도가 없는 분류면 `null`. */
export function getGroupWeeklyLimit(category: ContentCategoryKey): number | null {
  return index().categoryByKey.get(category)?.weeklyMaxCount ?? null
}

/**
 * 점수로 완료를 가르는 컨텐츠인가(지하 수로 · 플래그 레이스 · 무릉도장).
 *
 * 최근 활동 판정만 이것을 따로 본다. 지하 수로의 점수는 주간 리셋 뒤에도 줄지 않아 `한 번이라도 해본 적 있음` 과 `최근 14일에
 * 했음` 을 구분하지 못한다(실측 : `[길드] 지하 수로` 73635 → 75889 → 79579, 07-30 리셋 통과에도 감소 없음).
 */
export function isScoreContent(contentKey: string | null): boolean {
  return rowOf(contentKey)?.checkType === 'score'
}

/** 표의 최대 횟수. 있으면 넥슨이 준 최대 횟수 대신 쓴다. 횟수로 완료를 세지 않는 컨텐츠와 표에 없는 컨텐츠는 `null`. */
export function contentMaxCountOf(contentKey: string | null): number | null {
  return rowOf(contentKey)?.maxCount ?? null
}

/** 공유 항목 하나. 컨텐츠 줄에서 위젯 글자 · 분류 · 기간을 모았다. `from` · `until` 은 그 줄이 서는 기간이다. */
export interface SharedContentEntry extends EffectivePeriod {
  contentKey: string
  /** 화면에 그리는 짧은 이름. 분류명이 위에 있어 그것을 뺀 나머지다. */
  shortName: string
  category: ContentCategoryKey
  section: ContentSection
  scope: 'world' | 'account'
}

export interface SharedContentGroup {
  category: ContentCategoryKey
  entries: readonly SharedContentEntry[]
}

/** 공유 위젯이 그리는 완료 방법. 횟수를 확인하는 컨텐츠만 그린다. 퀘스트 상태만 확인하는 드래곤 퇴치 둘은 빠진다. */
const WIDGET_CHECK_TYPES: readonly ContentCheckType[] = ['count_only', 'both']

/**
 * 공유 컨텐츠를 분류별로 묶은 목록. today 의 계정 및 메이플 ID 공유 컨텐츠 위젯이 읽는다. 횟수를 확인하는 컨텐츠만 든다.
 *
 * ## 월드/계정이 축이 아니다
 *
 * 월드 공유와 계정 공유를 **합쳐서** 분류로 가른다. 월드 공유는 응답이 마지막 접속 월드 것이라 월드로 가를
 * 수 없고, 분류로 묶으면 그 축을 화면이 아예 주장하지 않게 된다. `scope` 는
 * 그래도 나른다. 그리는 데 안 쓰지만 다계정 처리(열린 질문)가 오면 필요한 값이다.
 *
 * ## 순서의 출처가 둘이다
 *
 * - **분류 순서**는 분류 줄의 `sharedSortOrder` 다. 컨텐츠 줄을 읽은 첫 등장 순서와 지금은 같지만 그것에 맡기지
 *   않는다. 계정 공유 컨텐츠가 하나 붙는 날 화면 순서가 조용히 바뀐다.
 * - **분류 안의 항목 순서**는 컨텐츠 표의 차례(일일 뒤 주간, 주기 안은 관리 화면 차례) 그대로다.
 *
 * `sharedSortOrder` 가 없는 분류는 **버리지 않고 뒤에 붙인다**. 항목을 더하고 순서를 안 적었을 때 화면에서 조용히
 * 사라지는 것보다 순서가 어긋나는 편이 낫다.
 */
export function getSharedContentGroups(): SharedContentGroup[] {
  const { shared, categoryById } = index()
  const groups = new Map<ContentCategoryKey, SharedContentEntry[]>()
  for (const row of shared) {
    const category = categoryById.get(row.categoryId)?.key
    if (category === undefined || !WIDGET_CHECK_TYPES.includes(row.checkType)) continue
    const entry: SharedContentEntry = compact({
      contentKey: row.key,
      shortName: row.shortName,
      category,
      section: row.cycle,
      scope: row.shareScope === 'account' ? ('account' as const) : ('world' as const),
      ...periodOf(row),
    })
    groups.set(category, [...(groups.get(category) ?? []), entry])
  }

  const order = sharedCategoryOrder()
  const rankOf = (category: ContentCategoryKey): number => {
    const rank = order.indexOf(category)
    return rank === -1 ? order.length : rank
  }
  const ordered = [...groups.keys()].sort((a, b) => rankOf(a) - rankOf(b))

  return ordered.map((category) => ({ category, entries: groups.get(category) ?? [] }))
}

/**
 * 공유 컨텐츠를 묶는 분류의 차례. 분류 줄의 `sharedSortOrder` 차례이고, 그 값이 없는 분류는 표의 차례로 뒤에 붙는다.
 * today 공유 위젯과 컨텐츠 스케줄러의 공유 탭 · 관리 화면이 같은 차례를 쓴다.
 */
export function sharedCategoryOrder(): ContentCategoryKey[] {
  const categories = [...index().categoryById.values()]
  const rankOf = (sortOrder: number | null | undefined): number => sortOrder ?? Number.MAX_SAFE_INTEGER
  return [...categories]
    .sort((a, b) => rankOf(a.sharedSortOrder) - rankOf(b.sharedSortOrder))
    .map((category) => category.key)
}

export function getContentCatalogEntries(section: ContentSection): ContentCatalogEntry[] {
  return index()
    .shared.filter((row) => row.cycle === section)
    .map((row): ContentCatalogEntry => ({ contentKey: row.key, scope: row.shareScope === 'account' ? 'account' : 'world' }))
}

/** 컨텐츠의 분류. 컨텐츠 표에서 찾는다. 표에 없는 컨텐츠는 `null` 이다. */
export { contentCategoryOf }
