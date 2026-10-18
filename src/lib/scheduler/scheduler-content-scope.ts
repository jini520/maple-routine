/**
 * 컨텐츠의 공유 범위 · 누적 점수 · API 오류 덮기 · 갈래 주간 한도. 전부 컨텐츠 표(`contents` 칸)의 칸이다.
 *
 * 옛 카탈로그 파일이 들던 것을 컨텐츠 줄과 갈래 줄이 든다. 조회 함수의 이름과 뜻은 그대로다.
 */
import type { ContentCategoryKey, ContentRow, ContentSection, ShareScope } from '../../types/game-data'
import type { EffectivePeriod } from '../boss/boss-profit-period'
import { compact } from '../game-data/contract'
import { derive } from '../game-data/table'
import { contentCategoryOf, contentsTable } from './contents'

export type { ShareScope }

export interface ContentCatalogEntry {
  contentKey: string
  scope: 'world' | 'account'
}

const index = derive(contentsTable, (table) => ({
  byKey: new Map(table.contents.map((content) => [content.key, content])),
  categoryByKey: new Map(table.categories.map((category) => [category.key, category])),
  /** 캐릭터 범위가 아닌 줄. 표의 차례(일간 뒤 주간) 그대로다. */
  shared: table.contents.filter((content) => content.shareScope !== 'character'),
}))

function rowOf(contentKey: string | null): ContentRow | undefined {
  return contentKey === null ? undefined : index().byKey.get(contentKey)
}

/** 공유 범위. 컨텐츠 key 가 없는(표에 없는) 항목은 캐릭터 범위다. */
export function getShareScope(contentKey: string | null): ShareScope {
  return rowOf(contentKey)?.shareScope ?? 'character'
}

/**
 * 병합이 이 항목의 등록을 **이번 응답의 `registration_flag`** 로 정하는가. 메이플 유니온 두 항목만 참이다.
 *
 * 나머지 공유 항목은 원장의 `active` 가 한 번 참이면 계속 참이다.
 */
export function trustsRegistrationFlag(contentKey: string | null): boolean {
  return rowOf(contentKey)?.trustRegistrationFlag === true
}

/** 갈래의 주간 진행 한도(갈래 줄의 `weeklyLimit`). 한도가 없는 갈래면 `null`. */
export function getGroupWeeklyLimit(category: ContentCategoryKey): number | null {
  return index().categoryByKey.get(category)?.weeklyLimit ?? null
}

/**
 * 리셋 없이 계속 누적되는 **개인** 점수인가.
 *
 * 공유 여부와는 다른 축이다. 이 항목들은 캐릭터 개인 기록이 맞고 저장·표시도 그대로다.
 * 다르게 다뤄야 하는 곳은 **후보 자격 판정** 하나뿐이다: `now_count` 가 주간 리셋을 넘어서도
 * 줄지 않아 "한 번이라도 해본 적 있음"과 "최근 14일에 했음"을 구분하지 못한다
 * (실측 : `[길드] 지하 수로` 73635 → 75889 → 79579, 07-30 리셋 통과에도 감소 없음).
 */
export function isCumulativeScore(contentKey: string | null): boolean {
  return rowOf(contentKey)?.cumulativeScore === true
}

export function getMaxCountOverride(contentKey: string | null): number | null {
  return rowOf(contentKey)?.maxCountOverride ?? null
}

/** 공유 항목 하나. 컨텐츠 줄에서 위젯 글자 · 갈래 · 기간을 모았다. `from` · `until` 은 그 줄이 서는 기간이다. */
export interface SharedContentEntry extends EffectivePeriod {
  contentKey: string
  /** 화면에 그리는 짧은 이름. 갈래명이 위에 있어 그것을 뺀 나머지다. */
  shortName: string
  category: ContentCategoryKey
  section: ContentSection
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
  category: ContentCategoryKey
  entries: readonly SharedContentEntry[]
}

function toSharedEntry(row: ContentRow): SharedContentEntry {
  return compact({
    contentKey: row.key,
    // 공유 줄은 위젯 글자를 든다(서버 쓰기 검사). 없으면 좁은 자리 이름으로 선다.
    shortName: row.sharedShortName ?? row.shortName,
    category: row.category,
    section: row.section,
    scope: row.shareScope === 'account' ? ('account' as const) : ('world' as const),
    onlyWhenScheduled: row.onlyWhenScheduled,
    from: row.from,
    until: row.until,
  })
}

/**
 * 공유 컨텐츠를 갈래별로 묶은 목록. today 의 계정 및 메이플 ID 공유 컨텐츠 위젯이 읽는다.
 *
 * ## 월드/계정이 축이 아니다
 *
 * 월드 공유와 계정 공유를 **합쳐서** 갈래로 가른다. 월드 공유는 응답이 마지막 접속 월드 것이라 월드로 가를
 * 수 없고, 갈래로 묶으면 그 축을 화면이 아예 주장하지 않게 된다. `scope` 는
 * 그래도 나른다. 그리는 데 안 쓰지만 다계정 처리(열린 질문)가 오면 필요한 값이다.
 *
 * ## 순서의 출처가 둘이다
 *
 * - **갈래 순서**는 갈래 줄의 `sharedOrder` 다. 컨텐츠 줄을 읽은 첫 등장 순서와 지금은 같지만 그것에 맡기지
 *   않는다. 계정 공유 컨텐츠가 하나 붙는 날 화면 순서가 조용히 바뀐다.
 * - **갈래 안의 항목 순서**는 컨텐츠 표의 차례(일간 뒤 주간, 섹션 안은 관리 화면 차례) 그대로다.
 *
 * `sharedOrder` 가 없는 갈래는 **버리지 않고 뒤에 붙인다**. 항목을 더하고 순서를 안 적었을 때 화면에서 조용히
 * 사라지는 것보다 순서가 어긋나는 편이 낫다.
 */
export function getSharedContentGroups(): SharedContentGroup[] {
  const { shared, categoryByKey } = index()
  const groups = new Map<ContentCategoryKey, SharedContentEntry[]>()
  for (const row of shared) {
    const bucket = groups.get(row.category)
    if (bucket === undefined) groups.set(row.category, [toSharedEntry(row)])
    else bucket.push(toSharedEntry(row))
  }

  const rankOf = (category: ContentCategoryKey): number =>
    categoryByKey.get(category)?.sharedOrder ?? Number.MAX_SAFE_INTEGER
  const ordered = [...groups.keys()].sort((a, b) => rankOf(a) - rankOf(b))

  return ordered.map((category) => ({ category, entries: groups.get(category) ?? [] }))
}

export function getContentCatalogEntries(section: ContentSection): ContentCatalogEntry[] {
  return index()
    .shared.filter((row) => row.section === section)
    .map((row): ContentCatalogEntry => ({ contentKey: row.key, scope: row.shareScope === 'account' ? 'account' : 'world' }))
}

/** 컨텐츠의 갈래. 컨텐츠 표에서 찾는다. 표에 없는 컨텐츠는 `null` 이다. */
export { contentCategoryOf }
