/**
 * 이 캐릭터가 실제로 챙기는 컨텐츠를 내는 판정. `displayedBosses` 의 짝이다.
 *
 * 화면 밖에 있는 것은 today 의 남은 스케줄이 같은 수를 세기 때문이다. 두 벌로 두면 반드시
 * 갈라진다. 이 필터 없이 `character.dailyContents` 를 통째로 세면 모든 캐릭터가 똑같이 일퀘
 * 18 로 나온다. 그 배열은 등록 여부와 무관하게 게임에 있는 일간 컨텐츠 전부다.
 *
 * 수동 모드는 사용자가 앱에서 관리하는 멤버십이 목록을 정하고, 자동 모드는 게임 등록 여부가
 * 정한다.
 */

import { categorizeContentEntries, weeklyCategoryOrder } from '../../lib/scheduler/content-category'
import type { ContentEntry } from '../../lib/scheduler/contents'
import { mergeManualContentList, orderContentsByTemplate } from '../../lib/scheduler/manual-content-merge'
import { contentTemplate, effectiveTemplateEntries } from '../../lib/scheduler/scheduler-content-template'
import type { ManualTrackedItem } from '../../storage/manual-tracked-content'
import type { ManualTrackedContentItem } from '../../types/scheduler'
import type { TrackingMode } from '../../storage/tracking-mode'
import type { DailyContent, WeeklyContent } from '../../types'

/**
 * 관리 페이지와 같은 `categorizeContentEntries` 평탄화 순서로 정렬한 템플릿
 * (일간은 첫 등장 순서, 주간은 갈래 표의 차례).
 * 컨텐츠 표가 켜는 동안 서버 응답으로 덮일 수 있어 부를 때 읽는다. 줄이 41 이라 값이 싸다.
 */
function orderedDailyTemplate(): ContentEntry[] {
  return categorizeContentEntries(contentTemplate().daily).flatMap((group) => group.items.map((item) => item.entry))
}

function orderedWeeklyTemplate(): ContentEntry[] {
  return categorizeContentEntries(contentTemplate().weekly, weeklyCategoryOrder()).flatMap((group) =>
    group.items.map((item) => item.entry),
  )
}

/** 한 캐릭터의 컨텐츠 목록과 그 캐릭터의 수동 멤버십. 화면이 스토어에서 꺼내 그대로 넘긴다. */
export interface DisplayedContentsInput {
  dailyContents: DailyContent[]
  weeklyContents: WeeklyContent[]
  manualItems: ManualTrackedItem[]
}

/**
 * 그 주간 기간에 그릴 수동 추적 항목. 시작 기간 전인 템플릿 줄만 뺀다.
 *
 * 저장된 추적 목록은 그대로 둔다. 출시 전에 고른 항목을 지우면 출시 뒤에 다시 골라야 한다.
 * 템플릿 자체를 거르면 `mergeManualContentList` 가 그 항목을 템플릿 밖 항목으로 뒤에 붙인다.
 */
function trackedInPeriod(
  items: ManualTrackedItem[],
  kind: ManualTrackedContentItem['kind'],
  template: readonly ContentEntry[],
  weeklyPeriodKey: string,
): ManualTrackedContentItem[] {
  const effective = new Set(effectiveTemplateEntries(template, weeklyPeriodKey))
  const hidden = new Set(template.filter((entry) => !effective.has(entry)).map((entry) => entry.key))
  return items.filter(
    (item): item is ManualTrackedContentItem => item.kind === kind && !hidden.has(item.contentKey),
  )
}

/** @param weeklyPeriodKey 지금 주간 기간 키. 수동 모드가 시작 기간 전인 항목을 거르는 기준 */
export function displayedDailyContents(
  input: DisplayedContentsInput,
  mode: TrackingMode,
  weeklyPeriodKey: string,
): DailyContent[] {
  const template = orderedDailyTemplate()
  if (mode === 'manual') {
    return mergeManualContentList(
      trackedInPeriod(input.manualItems, 'daily', template, weeklyPeriodKey),
      input.dailyContents,
      template,
    )
  }

  return orderContentsByTemplate(
    input.dailyContents.filter((content) => content.isRegistered),
    template,
  )
}

/** @param weeklyPeriodKey 지금 주간 기간 키. 수동 모드가 시작 기간 전인 항목을 거르는 기준 */
export function displayedWeeklyContents(
  input: DisplayedContentsInput,
  mode: TrackingMode,
  weeklyPeriodKey: string,
): WeeklyContent[] {
  const template = orderedWeeklyTemplate()
  if (mode === 'manual') {
    return mergeManualContentList(
      trackedInPeriod(input.manualItems, 'weekly', template, weeklyPeriodKey),
      input.weeklyContents,
      template,
    ) as WeeklyContent[]
  }

  return orderContentsByTemplate(
    input.weeklyContents.filter((content) => content.isRegistered),
    template,
  )
}
