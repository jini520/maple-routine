/**
 * 주간 퀘스트 카드의 상태 배지. `quest_state` 를 그대로 읽지 않는 두 예외(무릉도장 · 성실한 조사)를 여기서 가른다.
 *
 * 배지 자체는 `components/atoms/Badge` 하나가 그리고, 글자와 색 표는 `quest-state.ts` 에 있다.
 */
import type { WeeklyContent } from '../../types'
import { FAITHFUL_INVESTIGATION_KEY, MU_LUNG_DOJO_KEY } from '../../lib/scheduler/content-kinds'

import { Badge } from '../../components/atoms'
import { QUEST_STATE_LABELS, QUEST_STATE_VARIANT } from './quest-state'

export function WeeklyQuestStatus(props: { content: WeeklyContent }): React.JSX.Element | null {
  const { content } = props

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
