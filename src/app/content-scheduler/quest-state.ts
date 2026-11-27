import type { BadgeVariant } from '../../components/atoms'

/** 퀘스트 진행 상태(`quest_state` 0 · 1 · 2)의 배지 글자. 일일 · 주간 카드가 함께 쓴다. */
export const QUEST_STATE_LABELS: Record<0 | 1 | 2, string> = {
  0: '시작 안함',
  1: '진행 중',
  2: '완료',
}

/** 같은 상태의 배지 색. */
export const QUEST_STATE_VARIANT: Record<0 | 1 | 2, BadgeVariant> = {
  0: 'muted',
  1: 'neutral',
  2: 'secondary',
}
