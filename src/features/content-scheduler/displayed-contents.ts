/**
 * **표시 대상 컨텐츠** 판정 — 이 캐릭터가 실제로 챙기는 항목은 무엇인가.
 *
 * ## 왜 화면 밖에 있나
 *
 * 이 판정은 `ContentScreen.tsx` 의 지역 함수(`dailyContentsOf`·`weeklyContentsOf`)였다. 화면
 * 하나만 쓸 때는 그 자리가 맞았지만, `today` 의 캐릭터별 남은 스케줄이 같은 수를 세면서
 * **화면 밖에서 부를 방법이 필요해졌다**.
 *
 * 두 벌로 두면 반드시 갈라진다. 실제로 갈라졌다. today 가 처음 붙었을 때 이 필터 없이
 * `character.dailyContents` 를 통째로 셌고, 그 배열은 **캐릭터가 등록했든 안 했든 게임에 있는 일간
 * 컨텐츠 전부**라 모든 캐릭터가 똑같이 일퀘 18 로 나왔다(= `scheduler-content-template.json` 의
 * `daily` 길이). 보스 쪽은 같은 이유로 `displayedBosses` 가 이미 나와 있었고, 이 파일이 그 짝이다.
 *
 * ## 판정 자체
 *
 * - **수동 모드**: 게임 등록 여부가 아니라 사용자가 앱에서 관리하는 멤버십(`manualTrackedContent`)이
 *   목록을 정하고, 값은 동기화 결과 또는 템플릿에서 즉석 조회한다(`mergeManualContentList`).
 *   멤버십의 `kind`(`'daily'`/`'weekly'`)가 저장 시점에 확정돼 있어 각 축은 자기 kind 만 본다.
 * - **자동 모드**: `isRegistered` 인 항목만.
 * - 두 모드 다 **템플릿 순서**로 정렬한다. 순서가 화면마다 다르면 같은 목록으로 안 보인다.
 *
 * **캐릭터를 인자로 받는다**. 카드 목록과 레일의 링, 그리고 이제 today 의
 * 남은 개수가 **같은 함수**를 써야 세는 것 = 보이는 것 이 구조로 보장된다.
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
