/**
 * 카드가 종류를 가르는 컨텐츠 key 와 종류 판정. 카드 · 완료 판정 · 미완료 스케줄 알림이 같이 본다.
 */
import type { ContentEntry } from './contents'

// 무릉도장은 quest_state 가 아니라 참여 시 도달한 층수(1~100+)가 now_count 에 그대로 기록된다.
// 성실한 조사에 대한 보답은 quest_state=1 일 때 now_count/max_count(0~2)로 완료 횟수를 따로
// 세므로, quest_state 배지 대신 `N회 완료` 를 보여주다가 now_count === max_count 에서 완료로
// 전환한다. 두 항목 모두 컨텐츠 key 로 구분한다.
export const MU_LUNG_DOJO_KEY = 'mu_lung_dojo'
export const FAITHFUL_INVESTIGATION_KEY = 'weekly_quest_faithful_investigation_reward'

// 주간 탭 카테고리 분류 상수. 길드 셋은 같은 갈래인데 카드가 저마다 달라 컨텐츠 key 로 가른다.
export const GUILD_MISSION_POINTS_KEY = 'guild_weekly_mission_points'
export const GUILD_UNDERGROUND_WATERWAY_KEY = 'guild_underground_waterway'
export const GUILD_FLAG_RACE_KEY = 'guild_flag_race'
export const MONSTER_PARK_EXTREME_KEY = 'monster_park_extreme'

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
