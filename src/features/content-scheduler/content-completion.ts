/**
 * 컨텐츠 항목의 완료 판정. 카드의 완료 배지 · 진행 링 · today 의 남은 스케줄 · 미완료 스케줄 알림이 같이 보는 출처.
 *
 * 카드는 진행 중 · N층 · N점 · N회 완료 같은 상태를 스스로 그리고, 완료인지만 여기에 묻는다. 카드가 완료를
 * 따로 계산하면 같은 응답을 카드와 링이 다르게 읽는다.
 *
 * 무엇으로 완료를 가르는지는 컨텐츠 표의 `checkType` 이 정한다. 컨텐츠 key 로 가르지 않는다. 표에 없는 컨텐츠(넥슨이 새로 냈고
 * 관리 화면에 줄을 더하기 전)는 넥슨의 `type` 으로 가른다.
 */
import { isClosedByWeeklyLimit } from '../../lib/scheduler/group-weekly-limit'
import { isContentBlocked } from '../../lib/scheduler/required-level'
import { contentCheckTypeOf } from '../../lib/scheduler/contents'
import type { DailyContent, WeeklyContent } from '../../types'

export type ContentCompletion = 'complete' | 'incomplete'

/**
 * 횟수. 지금 횟수가 최대 횟수에 닿으면 완료다. 최대 횟수는 표에 있으면 표의 값이고(병합이 덮는다), 없으면 넥슨 값이다.
 * `maxCount` 가 0이면 채울 것이 없어서 완료로 치지 않는다(0/0을 100%로 읽지 않는다).
 */
function byCount(content: { nowCount: number; maxCount: number }): ContentCompletion {
  if (content.maxCount <= 0) return 'incomplete'
  return content.nowCount >= content.maxCount ? 'complete' : 'incomplete'
}

/** 퀘스트 상태. 2 면 완료다. 횟수와 상태를 함께 주는 컨텐츠도 완료는 상태로 가린다. 퀘스트를 끝내면 횟수가 0/0 으로 돌아간다. */
function byQuestState(content: { questState: 0 | 1 | 2 | null }): ContentCompletion {
  return content.questState === 2 ? 'complete' : 'incomplete'
}

/** 점수. 0 보다 크면 그 주에 참여한 것이라 완료다. 무릉도장은 층수, 지하 수로와 플래그 레이스는 점수가 `nowCount` 에 온다. */
function byScore(content: { nowCount: number }): ContentCompletion {
  return content.nowCount > 0 ? 'complete' : 'incomplete'
}

function completionOf(content: DailyContent | WeeklyContent): ContentCompletion {
  switch (contentCheckTypeOf(content.contentKey)) {
    case 'state_only':
    case 'both':
      return byQuestState(content)
    case 'count_only':
      return byCount(content)
    case 'score':
      return byScore(content)
    case null:
      return content.kind === 'quest' ? byQuestState(content) : byCount(content)
  }
}

export function dailyContentCompletion(content: DailyContent): ContentCompletion {
  return completionOf(content)
}

export function weeklyContentCompletion(content: WeeklyContent): ContentCompletion {
  return completionOf(content)
}

export interface ContentProgress {
  /** 완료한 항목 수. */
  completed: number
  /** 센 항목 수. 0이면 링은 트랙만 그린다. */
  total: number
}

function tally(completions: ContentCompletion[]): ContentProgress {
  return {
    completed: completions.filter((completion) => completion === 'complete').length,
    total: completions.length,
  }
}

/**
 * **요구 레벨에 못 미치는 항목은 분모에서도 뺀다**.
 *
 * 남겨 두면 그 캐릭터의 링이 100%에 **절대 도달하지 못하고**, today 남은 스케줄의 숫자도 영원히
 * 안 줄어든다. 판정은 `lib/scheduler/required-level` 한 곳이 갖는다. 이 화면과 today 가 **같은 함수**를
 * 봐야 링과 남은 스케줄의 숫자가 맞는다.
 */
function progressible<T extends { contentKey: string | null }>(contents: T[], characterLevel: number | null): T[] {
  return contents.filter((content) => !isContentBlocked(characterLevel, content.contentKey))
}

export function dailyContentProgress(
  contents: DailyContent[],
  characterLevel: number | null,
): ContentProgress {
  return tally(progressible(contents, characterLevel).map(dailyContentCompletion))
}

/**
 * 계열 주간 한도가 차서 더 진행할 수 없는 미완료 항목의 컨텐츠 key 들. 카드의 `마감` 과 링이 같은 값을 본다.
 *
 * 넘기는 목록은 표시 목록이 아니라 **그 캐릭터의 병합된 목록 전체**다. 등록 안 한 던전의 완료도 한도를 채운다.
 */
export function weeklyLimitClosedKeys(contents: WeeklyContent[]): ReadonlySet<string> {
  const limited = contents.map((content) => ({
    contentKey: content.contentKey,
    isComplete: weeklyContentCompletion(content) === 'complete',
  }))
  return new Set(
    limited.flatMap((content) =>
      content.contentKey !== null && isClosedByWeeklyLimit(content, limited) ? [content.contentKey] : [],
    ),
  )
}

/**
 * `마감` 은 분자에 든다. 이번 주 일이 끝난 것이라, 안 넣으면 링이 100% 에 절대 못 닿는다.
 *
 * @param closedKeys `weeklyLimitClosedKeys` 의 결과
 */
export function weeklyContentProgress(
  contents: WeeklyContent[],
  characterLevel: number | null,
  closedKeys: ReadonlySet<string>,
): ContentProgress {
  return tally(
    progressible(contents, characterLevel).map((content) =>
      content.contentKey !== null && closedKeys.has(content.contentKey) ? 'complete' : weeklyContentCompletion(content),
    ),
  )
}
