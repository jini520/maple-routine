import type { DailyContent, WeeklyContent } from '../types'
import type { ManualTrackedItem } from '../storage/manual-tracked-content'

// scheduler-content-template.json의 항목 shape — Nexon wire 응답(NexonDailyContentWire/
// NexonWeeklyContentWire)과 동일하다(ADR-035 결정 8). 값은 개발자가 직접 채운다(ADR-006).
export interface SchedulerContentTemplateEntry {
  content_name: string
  type: 'contents' | 'quest'
  registration_flag: 'true' | 'false'
  now_count: number
  max_count: number
  quest_state: '0' | '1' | '2' | null
}

function parseQuestState(raw: '0' | '1' | '2' | null): 0 | 1 | 2 | null {
  if (raw === '0') return 0
  if (raw === '1') return 1
  if (raw === '2') return 2
  return null
}

// ADR-035 결정 6·8: 수동 모드 표시 목록은 멤버십(tracked)만으로 결정하고, 실제 값은 항상
// 동기화 결과(synced) 또는 그것이 없으면 템플릿 기본값에서 즉석 조회한다 — 값을 멤버십에
// 복제하지 않아 모드 전환/재동기화 시 값이 어긋나지 않는다.
//
// - tracked: 해당 탭의 kind('daily' 또는 'weekly')인 manualTrackedContent 항목만 넘긴다
//   (호출부에서 필터링, ADR-035 결정 19 — 일간/주간 구분은 저장 시점에 확정돼 있다).
// - synced: 이 캐릭터의 dailyContents 또는 weeklyContents(schedulerCache 기반 최신 동기화 결과).
// - template: scheduler-content-template.json의 daily 또는 weekly 배열(캐릭터 무관 default).
// 반환 순서는 tracked 배열 순서를 그대로 따른다(사용자가 추가한 순서 유지).
export function mergeManualContentList(
  tracked: ManualTrackedItem[],
  synced: DailyContent[] | WeeklyContent[],
  template: SchedulerContentTemplateEntry[],
): DailyContent[] {
  return tracked.map((item): DailyContent => {
    // 등록 여부(isRegistered)는 수동 모드에서 아예 무시한다 — synced에 이름이 있으면 그 값을 쓴다.
    const syncedMatch = synced.find((content) => content.name === item.contentName)
    if (syncedMatch !== undefined) {
      return {
        name: item.contentName,
        kind: syncedMatch.kind,
        isRegistered: true,
        nowCount: syncedMatch.nowCount,
        maxCount: syncedMatch.maxCount,
        questState: syncedMatch.questState,
      }
    }

    // 한 번도 동기화된 적 없는 항목은 템플릿 기본값으로 채운다(ADR-035 결정 8).
    const templateMatch = template.find((entry) => entry.content_name === item.contentName)
    if (templateMatch !== undefined) {
      return {
        name: item.contentName,
        kind: templateMatch.type,
        isRegistered: true,
        nowCount: templateMatch.now_count,
        maxCount: templateMatch.max_count,
        questState: parseQuestState(templateMatch.quest_state),
      }
    }

    // 방어적: synced에도 template에도 없어도(템플릿 갱신 누락 등) 항목을 버리지 않고
    // 안전한 기본값으로 채운다(크래시 금지, ADR-008 원칙과 동일한 정신).
    return {
      name: item.contentName,
      kind: 'contents',
      isRegistered: true,
      nowCount: 0,
      maxCount: 0,
      questState: null,
    }
  })
}
