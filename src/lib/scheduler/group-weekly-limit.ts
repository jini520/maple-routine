/**
 * 계열의 주간 진행 한도 판정. today 공유 컨텐츠 위젯 · 컨텐츠 카드 · 진행 링이 이 한 곳을 부른다.
 *
 * 세는 것은 등록 여부와 무관하게 그 계열에서 완료한 항목 수다. 한도는 등록이 아니라 진행 횟수를 막는다.
 * 완료 판정은 호출부가 넘긴다. 그 판정(`weeklyContentCompletion`)은 화면 쪽에 있다.
 */
import { getContentGroup, getGroupWeeklyLimit } from './scheduler-content-scope'

/** 한도 판정에 쓰는 항목 하나. */
export interface LimitedContent {
  readonly name: string
  readonly isComplete: boolean
}

/** 한 계열의 이번 주 완료 수와 한도. */
export interface GroupWeeklyLimit {
  readonly completed: number
  readonly limit: number
}

/** 계열의 한도 진행. 한도가 없는 계열이면 `null`. */
export function groupWeeklyLimitOf(group: string, contents: readonly LimitedContent[]): GroupWeeklyLimit | null {
  const limit = getGroupWeeklyLimit(group)
  if (limit === null) return null

  const completed = new Set(
    contents
      .filter((content) => content.isComplete && getContentGroup(content.name) === group)
      .map((content) => content.name.replace(/\s+/g, '')),
  ).size
  return { completed, limit }
}

/** 계열의 한도가 차서 더 진행할 수 없는 미완료 항목인가. 완료한 항목은 막힌 것이 아니다. */
export function isClosedByWeeklyLimit(content: LimitedContent, contents: readonly LimitedContent[]): boolean {
  if (content.isComplete) return false
  const group = getContentGroup(content.name)
  if (group === null) return false
  const progress = groupWeeklyLimitOf(group, contents)
  return progress !== null && progress.completed >= progress.limit
}
