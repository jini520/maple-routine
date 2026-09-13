import schedulerContentTemplate from '../../data/scheduler-content-template.json'
import { isEffectiveIn } from '../boss/boss-profit-period'
import type { SchedulerContentTemplateEntry } from './manual-content-merge'

// scheduler-content-template.json의 타입 캐스팅과 일간/주간 이름 셋을 한곳에 모은다.
// 수동 추적 멤버십은 항상 이 템플릿의 부분집합이다. 시드·저장소 마이그레이션·
// 관리 페이지가 모두 같은 셋으로 판정해 어긋나지 않게 한다.
export const CONTENT_TEMPLATE = schedulerContentTemplate as {
  daily: SchedulerContentTemplateEntry[]
  weekly: SchedulerContentTemplateEntry[]
}

export const TEMPLATE_DAILY_NAMES: ReadonlySet<string> = new Set(
  CONTENT_TEMPLATE.daily.map((entry) => entry.content_name),
)

export const TEMPLATE_WEEKLY_NAMES: ReadonlySet<string> = new Set(
  CONTENT_TEMPLATE.weekly.map((entry) => entry.content_name),
)

/**
 * 이 주간 기간에 서는 템플릿 줄. 출시 전인 컨텐츠를 고르거나 그리지 않게 거른다.
 *
 * 위의 이름 집합은 기간을 안 본다. 레거시 추적 항목 재분류가 그 집합 밖의 이름을 버리기 때문이다.
 *
 * @param weeklyPeriodKey 지금 주간 기간 키(리셋 목요일)
 */
export function effectiveTemplateEntries(
  entries: readonly SchedulerContentTemplateEntry[],
  weeklyPeriodKey: string,
): SchedulerContentTemplateEntry[] {
  return entries.filter((entry) => isEffectiveIn(entry, weeklyPeriodKey))
}
