/**
 * 이 캐릭터가 실제로 챙기는 컨텐츠를 내는 판정. `displayedBosses` 의 짝이다.
 *
 * 화면 밖에 있는 것은 today 의 남은 스케줄이 같은 수를 세기 때문이다. 두 벌로 두면 반드시
 * 갈라진다. 실제로 갈라졌다. today 가 처음 붙었을 때 이 필터 없이 `character.dailyContents` 를
 * 통째로 세서 **모든 캐릭터가 똑같이 일퀘 18** 로 나왔다. 그 배열은 등록 여부와 무관하게 게임에
 * 있는 일간 컨텐츠 전부다.
 *
 * 수동 모드는 사용자가 앱에서 관리하는 멤버십이 목록을 정하고, 자동 모드는 게임 등록 여부가 정한다.
 */

import { categorizeContentEntries, WEEKLY_CATEGORY_ORDER } from '../../lib/scheduler/content-category'
import { mergeManualContentList, orderContentsByTemplate } from '../../lib/scheduler/manual-content-merge'
import { CONTENT_TEMPLATE } from '../../lib/scheduler/scheduler-content-template'
import type { ManualTrackedItem } from '../../storage/manual-tracked-content'
import type { TrackingMode } from '../../storage/tracking-mode'
import type { DailyContent, WeeklyContent } from '../../types'

/**
 * 관리 페이지와 같은 `categorizeContentEntries` 평탄화 순서로 미리 정렬해 둔 템플릿
 * (일간은 첫 등장 순서, 주간은 `WEEKLY_CATEGORY_ORDER`).
 * 캐릭터와 무관한 상수라 모듈 레벨에서 1회 계산한다.
 */
const ORDERED_DAILY_TEMPLATE = categorizeContentEntries(CONTENT_TEMPLATE.daily).flatMap((group) =>
  group.items.map((item) => item.entry),
)

const ORDERED_WEEKLY_TEMPLATE = categorizeContentEntries(
  CONTENT_TEMPLATE.weekly,
  WEEKLY_CATEGORY_ORDER,
).flatMap((group) => group.items.map((item) => item.entry))

/** 한 캐릭터의 컨텐츠 목록과 그 캐릭터의 수동 멤버십. 화면이 스토어에서 꺼내 그대로 넘긴다. */
export interface DisplayedContentsInput {
  dailyContents: DailyContent[]
  weeklyContents: WeeklyContent[]
  manualItems: ManualTrackedItem[]
}

export function displayedDailyContents(
  input: DisplayedContentsInput,
  mode: TrackingMode,
): DailyContent[] {
  if (mode === 'manual') {
    return mergeManualContentList(
      input.manualItems.filter((item) => item.kind === 'daily'),
      input.dailyContents,
      ORDERED_DAILY_TEMPLATE,
    )
  }

  return orderContentsByTemplate(
    input.dailyContents.filter((content) => content.isRegistered),
    ORDERED_DAILY_TEMPLATE,
  )
}

export function displayedWeeklyContents(
  input: DisplayedContentsInput,
  mode: TrackingMode,
): WeeklyContent[] {
  if (mode === 'manual') {
    return mergeManualContentList(
      input.manualItems.filter((item) => item.kind === 'weekly'),
      input.weeklyContents,
      ORDERED_WEEKLY_TEMPLATE,
    ) as WeeklyContent[]
  }

  return orderContentsByTemplate(
    input.weeklyContents.filter((content) => content.isRegistered),
    ORDERED_WEEKLY_TEMPLATE,
  )
}
