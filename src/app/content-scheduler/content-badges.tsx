// 컨텐츠 카드가 공유하는 **배지·라벨 조각**([[ADR-094]] 결정 7로 화면에서 분리).
//
// 완료/미완료 상태, 카테고리 구분, 진행 카운트를 카드마다 같은 모양으로 찍는다.
// 자기 상자 안에서 끝나 화면의 고정 헤더와 무관하다.
//
// ── RN 으로 옮기며 갈린 것 셋 ─────────────────────────────────────────────────────
//
// ① `<span>` → `<Text>`. 클래스 문자열은 그대로다.
// ② **`Badge` atom 을 쓰지 않는다.** 그 atom 이 덮는 것은 `*-tint`/`*-ink` 쌍을 `font-semibold` 로
//    쓰는 자리뿐이고([[ADR-094]] 결정 3 이 "좁게 만든다"로 정한 범위), 여기 셋은 전부 그 밖이다 —
//    완료(2)는 `font-bold`, 나머지 둘은 `bg-surface-2` 위의 `text-text`/`text-text-muted`,
//    카테고리는 테마 토큰이 아닌 고정 hex 다. 웹에서도 같은 이유로 인라인이었다.
// ③ **카테고리 배지의 `/20` 은 클래스로 남는다.** NativeWind 가 투명도 접미사를 못 만드는 것은
//    `var()` 로 들어온 색일 때이고(`lib/color-alpha.ts`), 이 셋은 리터럴 hex 라 빌드 시점에
//    `rgba()` 로 접힌다. **조용히 사라지는 종류의 실패**라 테스트가 배경색이 실제로 붙는지 본다.

import type { WeeklyContent } from '../../types'

import { BlockedBadge } from '../../components/atoms/BlockedBadge/BlockedBadge'
import { Text } from '../../components/atoms/Text/Text'

// 무릉도장은 quest_state가 아니라 참여 시 도달한 층수(1~100+)가 now_count에 그대로 기록된다.
// 성실한 조사에 대한 보답은 quest_state=1일 때 now_count/max_count(0~2)로 완료 횟수를 따로
// 세므로, quest_state 뱃지 대신 "N회 완료"를 보여주다가 now_count===max_count에서 완료로
// 전환한다(2026-07-21, 사용자 지시 — 두 항목 모두 weekly-quest-regions.json의 backgroundSlug로 구분).
export const MU_LUNG_DOJO_BACKGROUND_SLUG = 'muruengRaid'
export const FAITHFUL_INVESTIGATION_BACKGROUND_SLUG = 'roadOfVanishing'
export const GUILD_PREFIX = '[길드] '

export const QUEST_STATE_LABELS: Record<0 | 1 | 2, string> = {
  0: '시작 안함',
  1: '진행 중',
  2: '완료',
}
export const QUEST_STATE_BADGE_CLASSES: Record<0 | 1 | 2, string> = {
  0: 'bg-surface-2 text-text-muted',
  1: 'bg-surface-2 text-text',
  2: 'bg-secondary-tint text-secondary-ink',
}
// 카테고리별 배지 색(2026-07-21, 사용자 지시) — 에픽 던전은 아르카누스 배경의 푸른 전기빛과
// 맞춘 기존 색 유지, 메이플 유니온은 노란색 계열, 길드는 빨간색 계열로 구분.
export const CATEGORY_BADGE_COLORS = {
  epicDungeon: 'bg-[#4DD2FF]/20 text-[#4DD2FF]',
  mapleUnion: 'bg-[#FFC93C]/20 text-[#FFC93C]',
  guild: 'bg-[#FF5C5C]/20 text-[#FF5C5C]',
} as const

export function QuestStateBadge(props: { questState: 0 | 1 | 2 }): React.JSX.Element {
  const fontWeight = props.questState === 2 ? 'font-bold' : 'font-semibold'
  return (
    <Text
      className={`rounded-full px-2.5 py-1 text-xs ${fontWeight} ${QUEST_STATE_BADGE_CLASSES[props.questState]}`}
    >
      {QUEST_STATE_LABELS[props.questState]}
    </Text>
  )
}

export function CategoryBadge(props: {
  label: string
  variant: keyof typeof CATEGORY_BADGE_COLORS
}): React.JSX.Element {
  return (
    <Text className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CATEGORY_BADGE_COLORS[props.variant]}`}>
      {props.label}
    </Text>
  )
}

// 진행 중(1) 뱃지와 같은 톤의 중립 라벨 — "N층"·"N회 완료"처럼 0/1/2 상태가 아닌 진행 수치를
// 보여줘야 하는 카드에서 QuestStateBadge 대신 쓴다(2026-07-21, 사용자 지시).
export function CountLabelBadge(props: { label: string }): React.JSX.Element {
  return <Text className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text">{props.label}</Text>
}

export function renderWeeklyQuestStatus(content: WeeklyContent, backgroundSlug: string | null): React.ReactNode {
  if (backgroundSlug === MU_LUNG_DOJO_BACKGROUND_SLUG) {
    return content.nowCount > 0 ? <CountLabelBadge label={`${content.nowCount}층`} /> : <QuestStateBadge questState={0} />
  }

  if (backgroundSlug === FAITHFUL_INVESTIGATION_BACKGROUND_SLUG) {
    if (content.nowCount === content.maxCount && content.maxCount > 0) {
      return <QuestStateBadge questState={2} />
    }
    if (content.questState === 1) {
      return <CountLabelBadge label={`${content.nowCount}회 완료`} />
    }
  }

  return content.questState !== null ? <QuestStateBadge questState={content.questState} /> : null
}

export function stripGuildPrefix(name: string): string {
  return name.startsWith(GUILD_PREFIX) ? name.slice(GUILD_PREFIX.length) : name
}

/** 카드들이 상태 배지와 **같은 자리에서** 가져다 쓰도록 다시 내보낸다([[ADR-162]] 결정 3). */
export { BlockedBadge }
