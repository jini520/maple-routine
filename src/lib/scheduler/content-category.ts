import {
  WEEKLY_CATEGORY_ORDER,
  contentCategoryNameOf,
  contentCategoryTagOf,
  type ContentCategoryKey,
} from './content-categories'
import type { ContentEntry } from './contents'

export { WEEKLY_CATEGORY_ORDER }

export interface ContentCategoryItem {
  entry: ContentEntry
  /** 표시용 이름(표의 `displayName`). 토글 · 저장은 `entry.key` 로 한다. */
  displayName: string
}

export interface ContentCategoryGroup {
  /** 갈래 key. 헤더 아이콘 등을 고르는 데 쓴다. */
  category: ContentCategoryKey
  /** 카테고리 헤더 라벨(갈래 표의 글자). */
  label: string
  items: ContentCategoryItem[]
}

// 관리 페이지 행 우측의 참고 태그 문구(없으면 null). 컨텐츠의 `countTag` → 갈래의 태그 → 기본 규칙(카운트형이고
// 상한이 있으면 "최대 N회") 순이다. 리셋 · 제한 규칙(월드당 · ID당 등)이라 확인된 값만 표에 적는다.
export function contentCountTag(entry: ContentEntry): string | null {
  if (entry.countTag !== undefined) return entry.countTag
  const categoryTag = contentCategoryTagOf(entry.category)
  if (categoryTag !== undefined) return categoryTag
  return entry.type === 'contents' && entry.max_count > 0 ? `최대 ${entry.max_count}회` : null
}

export const GUILD_CATEGORY: ContentCategoryKey = 'guild'

// 길드 가입 여부로 선택을 막을 대상 판정. 컨텐츠를 코드에 나열하지 않고 표의 갈래로 가른다. 길드 컨텐츠가
// 추가돼도 템플릿만 갱신하면 따라온다.
export function isGuildContent(entry: Pick<ContentEntry, 'category'> | null): boolean {
  return entry?.category === GUILD_CATEGORY
}

// 갈래 첫 등장 순서를 보존해 묶고, categoryOrder 가 있으면 그 갈래를 그 순서로 앞세운다.
export function categorizeContentEntries(
  entries: readonly ContentEntry[],
  categoryOrder?: readonly ContentCategoryKey[],
): ContentCategoryGroup[] {
  const order: ContentCategoryKey[] = []
  const groups = new Map<ContentCategoryKey, ContentCategoryGroup>()

  for (const entry of entries) {
    let group = groups.get(entry.category)
    if (group === undefined) {
      group = { category: entry.category, label: contentCategoryNameOf(entry.category), items: [] }
      groups.set(entry.category, group)
      order.push(entry.category)
    }
    group.items.push({ entry, displayName: entry.displayName })
  }

  const result = order.map((key) => groups.get(key)!)
  if (categoryOrder === undefined) return result

  // categoryOrder에 있는 갈래를 그 순서로 앞세운다. 목록에 없는 갈래는 동일 순위라 안정 정렬 덕에 첫 등장
  // 순서를 유지하며 뒤에 온다.
  const rankOf = (category: ContentCategoryKey): number => {
    const index = categoryOrder.indexOf(category)
    return index === -1 ? categoryOrder.length : index
  }
  return [...result].sort((a, b) => rankOf(a.category) - rankOf(b.category))
}
