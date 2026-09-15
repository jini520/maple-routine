/**
 * 컨텐츠 항목의 완료 판정. 초상화 레일의 진행 링이 세는 규칙의 출처.
 *
 * 이 규칙이 카드 렌더러 열몇 곳에 흩어져 있었고, 링이 그것을 다시 구현하면 두 벌이 되어 반드시
 * 갈라진다. 그래서 출처를 여기 하나로 옮긴다.
 *
 * **카드는 아직 이 함수를 안 쓴다.** 렌더러의 분기가 완료·미완료보다 넓어서(진행 중 · 시작 안함 ·
 * N층 · N점 · N회 완료) 판정만 떼어 쓰면 분기가 두 겹이 된다. 렌더러를 이 함수 위로 다시 세우는
 * 것은 별건이고, 그때까지 여기가 읽어야 할 한 곳이다.
 *
 * 무릉도장처럼 `다 했다` 가 정의되지 않는 항목은 `unmeasurable` 이고 링의 분모에서 빠진다.
 * 영원히 안 차는 칸을 넣으면 링이 항상 미완료를 말한다.
 */
import { isClosedByWeeklyLimit } from '../../lib/scheduler/group-weekly-limit'
import { isContentBlocked } from '../../lib/scheduler/required-level'
import { findContent } from '../../lib/scheduler/contents'
import type { DailyContent, WeeklyContent } from '../../types'

import {
  FAITHFUL_INVESTIGATION_KEY,
  MU_LUNG_DOJO_KEY,
  isWeeklyQuestContent,
  isWeeklyRegionalContent,
} from './content-badges'
import {
  GUILD_FLAG_RACE_KEY,
  GUILD_MISSION_POINTS_KEY,
  GUILD_UNDERGROUND_WATERWAY_KEY,
  MONSTER_PARK_EXTREME_KEY,
} from './WeeklyContentCards'

/** `'unmeasurable'` = 끝이 없는 항목. 완료도 미완료도 아니라 세지 않는다. */
export type ContentCompletion = 'complete' | 'incomplete' | 'unmeasurable'

/** 카운트형. `maxCount` 가 0이면 채울 것이 없다 라 완료로 치지 않는다(0/0을 100%로 읽지 않는다). */
function byCount(content: { nowCount: number; maxCount: number }): ContentCompletion {
  if (content.maxCount <= 0) return 'incomplete'
  return content.nowCount >= content.maxCount ? 'complete' : 'incomplete'
}

function byQuestState(content: { questState: 0 | 1 | 2 | null }): ContentCompletion {
  return content.questState === 2 ? 'complete' : 'incomplete'
}

/**
 * 한 번이라도 했으면 완료인 항목. 카드가 `nowCount > 0` 을 완료 배지로 그린다.
 *
 * 에픽 던전은 `maxCount` 가 총 스테이지 수(5)이고 `nowCount` 가 깬 스테이지 수라 한 스테이지라도
 * 깨면 완료로 친다. 플래그 레이스는 참여 여부만 안다.
 */
function byParticipation(content: { nowCount: number }): ContentCompletion {
  return content.nowCount > 0 ? 'complete' : 'incomplete'
}

/**
 * 일간 항목. `renderDailyContentCard` 의 갈래와 같다.
 *
 * `kind: 'quest'` → 일일 퀘스트 카드가 `questState` 배지를 그린다.
 * 그 밖(몬스터파크·폴백) → 진행률 바라 카운트가 답이다.
 */
export function dailyContentCompletion(content: DailyContent): ContentCompletion {
  return content.kind === 'quest' ? byQuestState(content) : byCount(content)
}

/**
 * 주간 항목. `renderWeeklyContentCard` 의 **갈래를 같은 순서로** 따른다. 표에 없는 항목은 폴백 카드다.
 */
export function weeklyContentCompletion(content: WeeklyContent): ContentCompletion {
  // 점수가 0 이 아니면 완료다. 점수에 상한이 없어 다 했다 를 카운트로는 못 재지만 그 주에
  // 참여했는가 는 잴 수 있고, 그것이 링이 물어야 할 것이다. 카드는 그대로 `n점` 배지다.
  if (content.contentKey === GUILD_UNDERGROUND_WATERWAY_KEY) return byParticipation(content)
  if (content.contentKey === GUILD_MISSION_POINTS_KEY) return byCount(content)
  if (content.contentKey === GUILD_FLAG_RACE_KEY) return byParticipation(content)

  const entry = findContent(content.contentKey)
  if (entry?.category === 'epic_dungeon') return byParticipation(content)

  if (isWeeklyRegionalContent(entry)) {
    // 익스트림 몬스터파커만 실제 `quest_state` 를 준다(`WeeklyRegionalContentCard` 의 같은 분기).
    return content.contentKey === MONSTER_PARK_EXTREME_KEY ? byQuestState(content) : byCount(content)
  }

  if (entry?.category === 'maple_union') return byQuestState(content)

  if (isWeeklyQuestContent(entry)) {
    // `renderWeeklyQuestStatus` 의 두 예외.
    if (content.contentKey === MU_LUNG_DOJO_KEY) return 'unmeasurable'
    if (content.contentKey === FAITHFUL_INVESTIGATION_KEY) return byCount(content)
    return byQuestState(content)
  }

  // 폴백 카드는 진행률 바다.
  return byCount(content)
}

export interface ContentProgress {
  /** 완료한 항목 수. */
  completed: number
  /** 셀 수 있는 항목 수(= `unmeasurable` 을 뺀 나머지). 0이면 링은 트랙만 그린다. */
  total: number
}

function tally(completions: ContentCompletion[]): ContentProgress {
  const measurable = completions.filter((completion) => completion !== 'unmeasurable')
  return {
    completed: measurable.filter((completion) => completion === 'complete').length,
    total: measurable.length,
  }
}

/**
 * **요구 레벨에 못 미치는 항목은 분모에서도 뺀다**.
 *
 * 남겨 두면 그 캐릭터의 링이 100%에 **절대 도달하지 못하고**, today 남은 스케줄의 숫자도 영원히
 * 안 줄어든다. 판정은 `lib/scheduler/required-level` 한 곳이 갖는다. 이 화면과 today 가 **같은 함수**를
 * 봐야(*"한 글자도 다르면 안 된다"*)이 성립한다.
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
