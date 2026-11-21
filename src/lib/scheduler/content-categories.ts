/**
 * 컨텐츠 분류 표(`contents` 칸의 `contentCategories`) 조회. 컨텐츠 줄은 분류를 줄 id 로 가리킨다.
 *
 * 코드가 이 값으로 카드 모양 · 길드 판정 · 계열 한도를 가르므로 key 집합은 코드가 든다(`CONTENT_CATEGORY_KEYS`).
 * 카드 라벨(`에픽 던전`) · today 공유 위젯의 계열 머리글 · 참고 태그 · 주간 목록의 차례는 표가 든다.
 */
import { CONTENT_CATEGORY_KEYS, type ContentCategoryKey } from '../../types/game-data'
import { derive } from '../game-data/table'
import { contentsTable } from './contents'

export { CONTENT_CATEGORY_KEYS, type ContentCategoryKey }

const categoryByKey = derive(contentsTable, (table) => new Map(table.contentCategories.map((category) => [category.key, category])))

/** 분류의 글자. 카드 라벨과 공유 위젯 머리글이 같은 글자를 쓴다. 표에 없는 분류는 key 그대로다. */
export function contentCategoryNameOf(key: ContentCategoryKey): string {
  return categoryByKey().get(key)?.name ?? key
}

/**
 * 분류의 참고 태그. `undefined` 는 분류가 태그를 정하지 않는다는 뜻이고(기본 규칙을 쓴다), `null` 은 숨긴다.
 */
export function contentCategoryTagOf(key: ContentCategoryKey): string | null | undefined {
  const category = categoryByKey().get(key)
  if (category === undefined) return undefined
  return category.hidesCountTag ? null : category.countTag
}

/** 관리 화면 주간 목록의 분류 차례. 분류 표의 배열 차례다. 여기 없는 분류는 뒤에 첫 등장 순서로 선다. */
export function weeklyCategoryOrder(): readonly ContentCategoryKey[] {
  return contentsTable.get().contentCategories.map((category) => category.key)
}
