/**
 * 컨텐츠 카드가 공유하는 라벨 표와 상태 판정 (화면에서 분리).
 *
 * 배지 자체는 여기 없다. 그리는 것은 `components/atoms/Badge` 하나이고,
 * 여기 남은 것은 어떤 라벨과 어떤 variant 를 고를지 정하는 도메인 데이터다.
 */

import type { WeeklyContent } from '../../types'
import {
  FAITHFUL_INVESTIGATION_KEY,
  MU_LUNG_DOJO_KEY,
  isWeeklyQuestContent,
  isWeeklyRegionalContent,
} from '../../lib/scheduler/content-kinds'

import { Badge, type BadgeVariant } from '../../components/atoms'

export { FAITHFUL_INVESTIGATION_KEY, MU_LUNG_DOJO_KEY, isWeeklyQuestContent, isWeeklyRegionalContent }

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

  // 조사 2회(2/2)도 퀘스트는 진행 중이라 `2회 완료` 다. 완료는 다른 주간 퀘스트처럼 상태 2 다.
  if (content.contentKey === FAITHFUL_INVESTIGATION_KEY && content.questState === 1) {
    return <Badge variant="neutral">{`${content.nowCount}회 완료`}</Badge>
  }

  return content.questState !== null ? (
    <Badge variant={QUEST_STATE_VARIANT[content.questState]}>
      {QUEST_STATE_LABELS[content.questState]}
    </Badge>
  ) : null
}
