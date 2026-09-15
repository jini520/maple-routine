import { isEffectiveIn } from '../boss/boss-profit-period'
import type { ContentEntry } from './contents'

export { CONTENT_TEMPLATE, TEMPLATE_DAILY_KEYS, TEMPLATE_WEEKLY_KEYS } from './contents'

/**
 * 이 주간 기간에 서는 템플릿 줄. 출시 전인 컨텐츠를 고르거나 그리지 않게 거른다.
 *
 * 위의 key 집합은 기간을 안 본다. 레거시 추적 항목 재분류가 그 집합 밖의 항목을 버리기 때문이다.
 *
 * @param weeklyPeriodKey 지금 주간 기간 키(리셋 목요일)
 */
export function effectiveTemplateEntries(
  entries: readonly ContentEntry[],
  weeklyPeriodKey: string,
): ContentEntry[] {
  return entries.filter((entry) => isEffectiveIn(entry, weeklyPeriodKey))
}
