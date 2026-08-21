import schedulerContentTemplate from '../data/scheduler-content-template.json'
import type { SchedulerContentTemplateEntry } from './manual-content-merge'

// scheduler-content-template.json의 타입 캐스팅과 일간/주간 이름 셋을 한곳에 모은다 —
// 수동 추적 멤버십은 항상 이 템플릿의 부분집합이다(ADR-035 결정 11·19). 시드·저장소 마이그레이션·
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
