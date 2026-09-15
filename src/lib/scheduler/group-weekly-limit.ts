/**
 * 갈래의 주간 진행 한도 판정. today 공유 컨텐츠 위젯 · 컨텐츠 카드 · 진행 링이 이 한 곳을 부른다.
 *
 * 세는 것은 등록 여부와 무관하게 그 갈래에서 완료한 항목 수다. 한도는 등록이 아니라 진행 횟수를 막는다.
 * 완료 판정은 호출부가 넘긴다. 그 판정(`weeklyContentCompletion`)은 화면 쪽에 있다.
 */
import type { ContentCategoryKey } from './content-categories'
import { contentCategoryOf } from './contents'
import { getGroupWeeklyLimit } from './scheduler-content-scope'

/** 한도 판정에 쓰는 항목 하나. 컨텐츠 표에 없는 항목(key 가 없다)은 어느 갈래에도 안 든다. */
export interface LimitedContent {
  readonly contentKey: string | null
  readonly isComplete: boolean
}

/** 한 갈래의 이번 주 완료 수와 한도. */
export interface GroupWeeklyLimit {
  readonly completed: number
  readonly limit: number
}

/** 갈래의 한도 진행. 한도가 없는 갈래면 `null`. */
export function groupWeeklyLimitOf(
  category: ContentCategoryKey,
  contents: readonly LimitedContent[],
): GroupWeeklyLimit | null {
  const limit = getGroupWeeklyLimit(category)
  if (limit === null) return null

  // 같은 컨텐츠가 두 번 들어와도(캐릭터 응답과 원장 복원) 한 번만 센다.
  const completed = new Set(
    contents
      .filter((content) => content.isComplete && contentCategoryOf(content.contentKey) === category)
      .map((content) => content.contentKey),
  ).size
  return { completed, limit }
}

/** 갈래의 한도가 차서 더 진행할 수 없는 미완료 항목인가. 완료한 항목은 막힌 것이 아니다. */
export function isClosedByWeeklyLimit(content: LimitedContent, contents: readonly LimitedContent[]): boolean {
  if (content.isComplete) return false
  const category = contentCategoryOf(content.contentKey)
  if (category === null) return false
  const progress = groupWeeklyLimitOf(category, contents)
  return progress !== null && progress.completed >= progress.limit
}
