// 컨텐츠 카드가 공유하는 라벨 표와 상태 판정 (로 화면에서 분리).
//
// 배지 자체는 여기 없다. 그리는 것은 `components/atoms/Badge` 하나이고,
// 여기 남은 것은 어떤 라벨과 어떤 variant 를 고를지 정하는 도메인 데이터다.

import type { WeeklyContent } from '../../types'

import { Badge, type BadgeVariant } from '../../components/atoms'

// 무릉도장은 quest_state가 아니라 참여 시 도달한 층수(1~100+)가 now_count에 그대로 기록된다.
// 성실한 조사에 대한 보답은 quest_state=1일 때 now_count/max_count(0~2)로 완료 횟수를 따로
// 세므로, quest_state 뱃지 대신 "N회 완료"를 보여주다가 now_count===max_count에서 완료로
// 전환한다(2026-07-21, 사용자 지시. 두 항목 모두 weekly-quest-regions.json의 backgroundSlug로 구분).
export const MU_LUNG_DOJO_BACKGROUND_SLUG = 'muruengRaid'
export const FAITHFUL_INVESTIGATION_BACKGROUND_SLUG = 'roadOfVanishing'
export const GUILD_PREFIX = '[길드] '

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

export function renderWeeklyQuestStatus(content: WeeklyContent, backgroundSlug: string | null): React.ReactNode {
  if (backgroundSlug === MU_LUNG_DOJO_BACKGROUND_SLUG) {
    return content.nowCount > 0 ? (
      <Badge variant="neutral">{`${content.nowCount}층`}</Badge>
    ) : (
      <Badge variant={QUEST_STATE_VARIANT[0]}>{QUEST_STATE_LABELS[0]}</Badge>
    )
  }

  if (backgroundSlug === FAITHFUL_INVESTIGATION_BACKGROUND_SLUG) {
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

export function stripGuildPrefix(name: string): string {
  return name.startsWith(GUILD_PREFIX) ? name.slice(GUILD_PREFIX.length) : name
}
