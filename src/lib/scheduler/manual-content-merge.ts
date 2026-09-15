import type { DailyContent, WeeklyContent } from '../../types'
import type { ManualTrackedContentItem } from '../../types/scheduler'
import type { ContentEntry } from './contents'

function parseQuestState(raw: '0' | '1' | '2' | null): 0 | 1 | 2 | null {
  if (raw === '0') return 0
  if (raw === '1') return 1
  if (raw === '2') return 2
  return null
}

// 수동 모드 표시 목록은 멤버십(tracked)만으로 결정하고, 실제 값은 항상
// 동기화 결과(synced) 또는 그것이 없으면 템플릿 기본값에서 즉석 조회한다. 값을 멤버십에
// 복제하지 않아 모드 전환/재동기화 시 값이 어긋나지 않는다.
//
// - tracked: 해당 탭의 kind('daily' 또는 'weekly')인 manualTrackedContent 항목만 넘긴다
//  (호출부에서 필터링. 일간/주간 구분은 저장 시점에 확정돼 있다).
// - synced: 이 캐릭터의 dailyContents 또는 weeklyContents(schedulerCache 기반 최신 동기화 결과).
// - template: 표시 순서 겸 값 default 소스. 호출부는 컨텐츠 관리 페이지와 동일한 정렬
//  (categorizeContentEntries 평탄화)로 넘긴다.
// 반환 순서는 tracked(추가/삭제 순서)가 아니라 template 순서를 따른다. 항목을 추가·제거해도
// 순서가 흔들리지 않고 컨텐츠 관리 화면과 동일하게 고정된다. 모두 컨텐츠 key 로 잇는다.
export function mergeManualContentList(
  tracked: ManualTrackedContentItem[],
  synced: DailyContent[] | WeeklyContent[],
  template: readonly ContentEntry[],
): DailyContent[] {
  function resolve(contentKey: string): DailyContent {
    // 등록 여부(isRegistered)는 수동 모드에서 아예 무시한다. synced에 그 key 가 있으면 그 값을 쓴다.
    const syncedMatch = (synced as DailyContent[]).find((content) => content.contentKey === contentKey)
    if (syncedMatch !== undefined) {
      return {
        contentKey,
        apiName: syncedMatch.apiName,
        kind: syncedMatch.kind,
        isRegistered: true,
        nowCount: syncedMatch.nowCount,
        maxCount: syncedMatch.maxCount,
        questState: syncedMatch.questState,
      }
    }

    // 한 번도 동기화된 적 없는 항목은 템플릿 기본값으로 채운다.
    const templateMatch = template.find((entry) => entry.key === contentKey)
    if (templateMatch !== undefined) {
      return {
        contentKey,
        apiName: templateMatch.content_name,
        kind: templateMatch.type,
        isRegistered: true,
        nowCount: templateMatch.now_count,
        maxCount: templateMatch.max_count,
        questState: parseQuestState(templateMatch.quest_state),
      }
    }

    // 방어적: synced에도 template에도 없어도(템플릿 갱신 누락 등) 항목을 버리지 않고
    // 안전한 기본값으로 채운다(크래시 금지 원칙과 동일한 정신).
    return {
      contentKey,
      apiName: contentKey,
      kind: 'contents',
      isRegistered: true,
      nowCount: 0,
      maxCount: 0,
      questState: null,
    }
  }

  const trackedKeys = new Set(tracked.map((item) => item.contentKey))
  const templateKeys = new Set(template.map((entry) => entry.key))

  // 1) template(=컨텐츠 관리 순서)에서 추적 중인 항목을 그 순서대로.
  const ordered = template.filter((entry) => trackedKeys.has(entry.key)).map((entry) => resolve(entry.key))

  // 2) 방어적: template에 없는 추적 항목은 버리지 않고 뒤에 tracked 순서로 붙인다.
  const extras = tracked.filter((item) => !templateKeys.has(item.contentKey)).map((item) => resolve(item.contentKey))

  return [...ordered, ...extras]
}

// auto 모드 표시 목록을 수동 모드(mergeManualContentList)와 동일한 template(=컨텐츠 관리) 순서로
// 맞춘다. template에 없는 항목(컨텐츠 key 가 없거나 표에 없는 key)은 rank가 같아(= template.length) 안정
// 정렬 덕에 원래(병합) 순서를 유지하며 뒤로 온다.
export function orderContentsByTemplate<T extends { contentKey: string | null }>(
  contents: T[],
  template: readonly ContentEntry[],
): T[] {
  const rank = new Map(template.map((entry, index) => [entry.key, index]))
  const rankOf = (content: T): number =>
    content.contentKey === null ? template.length : (rank.get(content.contentKey) ?? template.length)
  return [...contents].sort((a, b) => rankOf(a) - rankOf(b))
}
