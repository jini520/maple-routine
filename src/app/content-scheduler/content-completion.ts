/**
 * 컨텐츠 항목의 **완료 판정**. 초상화 레일의 진행 링이 세는 규칙.
 *
 * ## 왜 이 파일이 생겼나
 *
 * 이 규칙은 지금까지 **카드 렌더러 열몇 곳에 흩어져** 있었다(`DailyContentCards`·`WeeklyContentCards`
 * ·`content-badges`). 카드는 **무슨 배지를 그릴까** 를 정하느라 그 판정을 각자 인라인으로 갖고 있었고,
 * 링이 그것을 **다시** 구현하면 두 벌이 되어 반드시 갈라진다. 그래서 규칙의 **출처**를 여기로 옮긴다.
 *
 * **카드는 아직 이 함수를 쓰지 않는다.** 렌더러의 분기는 완료/미완료보다 넓어서(진행 중 · 시작 안함 ·
 * N층 · N점 · N회 완료) 판정만 떼어 쓰면 그 분기가 두 겹이 된다. 렌더러를 이 함수 위로 다시 세우는
 * 것은 별건이고, 그때까지 이 파일이 **읽어야 할 한 곳**이다(그래서 아래 표가 카드 파일의 어느 줄에서
 * 왔는지 함께 적는다).
 *
 * ## `끝이 없는 항목`
 *
 * 무릉도장(층수)은 **다 했다 가 정의되지 않는다**. 카드도 완료 배지 대신 층수를 보여준다. 이런
 * 항목은 `'unmeasurable'` 이고 링의 분모에서도 빠진다: 영원히 안 차는 칸을 넣으면 링이 **항상
 * 미완료** 를 말한다. 목록에서 빼는 것이 아니라 **세지 않는** 것뿐이다.
 *
 * **길드 지하 수로는 여기 있다가 나갔다**. 점수에 상한이 없는 것은 같지만,
 * **0점이 아니면 완료** 라는 답이 있었다(사용자 지시). 상한이 없다고 판정이 불가능한 것은 아니다.
 */
import { isContentBlocked } from '../../lib/scheduler/required-level'
import {
  matchWeeklyQuestRegionSlug,
  matchWeeklyRegionalQuestSlug,
  stripWeeklyQuestPrefix,
} from '../../lib/scheduler/quest-region-matching'
import type { DailyContent, WeeklyContent } from '../../types'

import {
  FAITHFUL_INVESTIGATION_BACKGROUND_SLUG,
  MU_LUNG_DOJO_BACKGROUND_SLUG,
} from './content-badges'
import { MONSTER_PARK_BACKGROUND_SLUG } from './DailyContentCards'
import {
  EPIC_DUNGEON_PREFIX,
  GUILD_FLAG_RACE_NAME,
  GUILD_MISSION_POINTS_NAME,
  GUILD_UNDERGROUND_WATERWAY_NAME,
  MAPLE_UNION_PREFIX,
} from './WeeklyContentCards'

/** `'unmeasurable'` = 끝이 없는 항목(파일 머리). 완료도 미완료도 아니라 세지 않는다. */
export type ContentCompletion = 'complete' | 'incomplete' | 'unmeasurable'

/** 카운트형. `maxCount` 가 0이면 채울 것이 없다 라 완료로 치지 않는다(0/0을 100%로 읽지 않는다). */
function byCount(content: { nowCount: number; maxCount: number }): ContentCompletion {
  if (content.maxCount <= 0) return 'incomplete'
  return content.nowCount >= content.maxCount ? 'complete' : 'incomplete'
}

function byQuestState(content: { questState: 0 | 1 | 2 | null }): ContentCompletion {
  return content.questState === 2 ? 'complete' : 'incomplete'
}

/** 참여 여부만 아는 항목(에픽 던전·플래그 레이스). 카드가 `nowCount > 0` 을 완료 배지로 그린다. */
function byParticipation(content: { nowCount: number }): ContentCompletion {
  return content.nowCount > 0 ? 'complete' : 'incomplete'
}

/**
 * 일간 항목. `renderDailyContentCard` 의 갈래와 같다.
 *
 * · `kind: 'quest'` → 일일 퀘스트 카드가 `questState` 배지를 그린다.
 * · 그 밖(몬스터파크·폴백) → 진행률 바라 카운트가 답이다.
 */
export function dailyContentCompletion(content: DailyContent): ContentCompletion {
  return content.kind === 'quest' ? byQuestState(content) : byCount(content)
}

/**
 * 주간 항목. `renderWeeklyContentCard` 의 **갈래 순서를 그대로** 따른다. 순서가 곧 규칙이라
 * (이름 일치가 접두사 일치보다 앞이다) 재배열하면 판정이 달라진다.
 */
export function weeklyContentCompletion(content: WeeklyContent): ContentCompletion {
  // **점수가 0이 아니면 완료다**(사용자 지시). 점수에 상한이 없어 **다 했다** 를
  // 카운트로는 못 재지만, 그 주에 **참여했는가** 는 잴 수 있고 그것이 링이 물어야 할 것이다.
  // 카드는 그대로 `n점` 배지다. 얼마나 했는지는 값이 말하고, 링은 했는지만 센다.
  if (content.name === GUILD_UNDERGROUND_WATERWAY_NAME) return byParticipation(content)
  if (content.name === GUILD_MISSION_POINTS_NAME) return byCount(content)
  if (content.name === GUILD_FLAG_RACE_NAME) return byParticipation(content)
  if (content.name.startsWith(EPIC_DUNGEON_PREFIX)) return byParticipation(content)

  const regionalSlug = matchWeeklyRegionalQuestSlug(content.name)
  if (regionalSlug !== null) {
    // 익스트림 몬스터파커만 실제 `quest_state` 를 준다(`WeeklyRegionalContentCard` 의 같은 분기).
    return regionalSlug === MONSTER_PARK_BACKGROUND_SLUG ? byQuestState(content) : byCount(content)
  }

  if (content.name.startsWith(MAPLE_UNION_PREFIX)) return byQuestState(content)

  const questSlug = matchWeeklyQuestRegionSlug(stripWeeklyQuestPrefix(content.name))
  if (questSlug !== null) {
    // `renderWeeklyQuestStatus` 의 두 예외.
    if (questSlug === MU_LUNG_DOJO_BACKGROUND_SLUG) return 'unmeasurable'
    if (questSlug === FAITHFUL_INVESTIGATION_BACKGROUND_SLUG) return byCount(content)
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
function progressible<T extends { name: string }>(contents: T[], characterLevel: number | null): T[] {
  return contents.filter((content) => !isContentBlocked(characterLevel, content.name))
}

export function dailyContentProgress(
  contents: DailyContent[],
  characterLevel: number | null,
): ContentProgress {
  return tally(progressible(contents, characterLevel).map(dailyContentCompletion))
}

export function weeklyContentProgress(
  contents: WeeklyContent[],
  characterLevel: number | null,
): ContentProgress {
  return tally(progressible(contents, characterLevel).map(weeklyContentCompletion))
}
