/**
 * 컨텐츠 카드가 공유하는 라벨 표와 상태 판정 (화면에서 분리).
 *
 * 배지 자체는 여기 없다. 그리는 것은 `components/atoms/Badge` 하나이고,
 * 여기 남은 것은 어떤 라벨과 어떤 variant 를 고를지 정하는 도메인 데이터다.
 */

import type { ContentEntry } from '../../lib/scheduler/contents'
import type { WeeklyContent } from '../../types'

import { Badge, type BadgeVariant } from '../../components/atoms'

// 무릉도장은 quest_state 가 아니라 참여 시 도달한 층수(1~100+)가 now_count 에 그대로 기록된다.
// 성실한 조사에 대한 보답은 quest_state=1 일 때 now_count/max_count(0~2)로 완료 횟수를 따로
// 세므로, quest_state 배지 대신 `N회 완료` 를 보여주다가 now_count === max_count 에서 완료로
// 전환한다. 두 항목 모두 컨텐츠 key 로 구분한다.
export const MU_LUNG_DOJO_KEY = 'mu_lung_dojo'
export const FAITHFUL_INVESTIGATION_KEY = 'weekly_quest_faithful_investigation_reward'

/** 지역 배경 + 완료 배지 카드의 대상. 아케인리버 지역 컨텐츠 여섯과 익스트림 몬스터파커다. */
export function isWeeklyRegionalContent(entry: ContentEntry | null): boolean {
  return entry?.category === 'monster_park' || (entry?.category === 'arcane_river_quest' && entry.type === 'contents')
}

/**
 * 지역 배경 + 주간 퀘스트 상태 카드의 대상. 주간 퀘스트 · 무릉도장 · 성실한 조사에 대한 보답이다.
 *
 * 성실한 조사에 대한 보답은 아케인리버 갈래의 퀘스트라 `type` 으로 지역 컨텐츠와 가른다.
 */
export function isWeeklyQuestContent(entry: ContentEntry | null): boolean {
  return (
    entry?.category === 'weekly_quest' ||
    entry?.category === 'mu_lung_dojo' ||
    (entry?.category === 'arcane_river_quest' && entry.type === 'quest')
  )
}

export const QUEST_STATE_LABELS: Record<0 | 1 | 2, string> = {
  0: '시작 안함',
  1: '진행 중',
  2: '완료',
}
export const QUEST_STATE_VARIANT: Record<0 | 1 | 2, BadgeVariant> = {
  0: 'muted',
  1: 'neutral',
  2: 'secondary',
}

export function renderWeeklyQuestStatus(content: WeeklyContent): React.ReactNode {
  if (content.contentKey === MU_LUNG_DOJO_KEY) {
    return content.nowCount > 0 ? (
      <Badge variant="neutral">{`${content.nowCount}층`}</Badge>
    ) : (
      <Badge variant={QUEST_STATE_VARIANT[0]}>{QUEST_STATE_LABELS[0]}</Badge>
    )
  }

  if (content.contentKey === FAITHFUL_INVESTIGATION_KEY) {
    if (content.nowCount === content.maxCount && content.maxCount > 0) {
      return <Badge variant={QUEST_STATE_VARIANT[2]}>{QUEST_STATE_LABELS[2]}</Badge>
    }
    if (content.questState === 1) {
      return <Badge variant="neutral">{`${content.nowCount}회 완료`}</Badge>
    }
  }

  return content.questState !== null ? (
    <Badge variant={QUEST_STATE_VARIANT[content.questState]}>
      {QUEST_STATE_LABELS[content.questState]}
    </Badge>
  ) : null
}
