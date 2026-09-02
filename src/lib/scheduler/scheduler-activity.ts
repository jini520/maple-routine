import type { DailyContent, SchedulerCharacterState, WeeklyContent } from '../../types'
import { matchBossContent, selectBossProfitBosses } from '../boss/boss-matching'
import { getShareScope, isCumulativeScore } from './scheduler-content-scope'

// 추가 정정(2026-07-25): daily/weekly 섹션이 "완전히 비었는지(isXStale = length 0)"만으로는
// 부족하다. 콜드 스타트에서 당일 응답이 월드공유 항목(몬스터파크)만 남기고 character 범위 항목을
// 통째로 누락시키면 length가 1이라 isDailyStale이 false가 되고, 로컬 캐시도 없어 항목 단위 병합이
// 복원할 previous가 없다. 그래서 "그 섹션에 character 범위 항목이 하나라도 있는가"로 stale을 판정한다.
// 캐릭터가 동기화되면 daily/weekly엔 항상 자기 범위 항목(일일/주간 퀘스트 등)이 들어오므로,
// 공유 항목만 남았으면 이 캐릭터의 그 섹션은 아직 신뢰할 수 없다는 뜻이다.
function hasCharacterScopeItem(items: { name: string }[]): boolean {
  return items.some((item) => getShareScope(item.name) === 'character')
}

// isXStale(완전 비었을 때)은 그대로 살리고, 비지 않았어도 character 범위 항목이 하나도 없으면
// 부분 누락으로 본다. length === 0이면 isXStale이 이미 잡으므로 두 번째 항은 length > 0에서만 의미가
// 있다. 테스트 스텁처럼 dailyContents가 빈 배열인데 isDailyStale이 명시적으로 false인 상태를
// "누락"으로 오판하지 않도록 length 가드를 둔다.
export function isDailySectionMissing(state: SchedulerCharacterState): boolean {
  return state.isDailyStale || (state.dailyContents.length > 0 && !hasCharacterScopeItem(state.dailyContents))
}

export function isWeeklySectionMissing(state: SchedulerCharacterState): boolean {
  return state.isWeeklyStale || (state.weeklyContents.length > 0 && !hasCharacterScopeItem(state.weeklyContents))
}

export interface SchedulerSectionPresence {
  daily: boolean
  weekly: boolean
  weeklyBoss: boolean
  monthlyBoss: boolean
}

/** 그 응답에 각 섹션의 캐릭터 범위 내용이 있었는가 — 조회 원장에 기록해 선채움이 재조회를 건너뛴다. */
export function getSectionPresence(state: SchedulerCharacterState): SchedulerSectionPresence {
  return {
    daily: !isDailySectionMissing(state),
    weekly: !isWeeklySectionMissing(state),
    weeklyBoss: !state.isWeeklyBossStale,
    monthlyBoss: !state.isMonthlyBossStale,
  }
}

// "완료"는 진행형 콘텐츠의 카운트가 올랐거나(nowCount > 0) 퀘스트가 완료(questState === 2)다.
// "등록만 하고 완료 안 함"은 활동 증거가 아니다.
//
// 정정 2(2026-08-03, 실측): **누적 점수 항목은 제외한다.** 그 항목의 now_count는 리셋을
// 넘어서도 줄지 않아 "한 번이라도 해본 적 있음"이 영원히 "최근 14일에 했음"으로 읽힌다 —
// `[길드] 지하 수로`(79579) 하나 때문에 그 콘텐츠를 해본 캐릭터 전원이 자격을 얻고 있었다.
function isCompletedContent(item: DailyContent | WeeklyContent): boolean {
  if (isCumulativeScore(item.name)) {
    return false
  }
  return item.nowCount > 0 || item.questState === 2
}

/**
 * 이 응답이 **이 캐릭터의** 활동 증거인가.
 *
 * 월드/계정 공유 항목(몬스터파크·에픽 던전)은 제외한다. 그 완료는 **다른 캐릭터가 만들었을 수
 * 있어**("마지막 활성 캐릭터" 오염) 이 캐릭터가 접속했다는 증거가 못 된다.
 * 보스는 공유 대상이 아니므로 범위 판정 없이 `ownComplete` 만 본다. 승격된 `isComplete` 는
 * 다른 난이도의 완료가 옮겨 붙은 값이라 쓰지 않는다.
 */
export function hasCharacterScopeCompletion(state: SchedulerCharacterState): boolean {
  const hasContentCompletion = [...state.dailyContents, ...state.weeklyContents].some(
    (item) => getShareScope(item.name) === 'character' && isCompletedContent(item),
  )
  return hasContentCompletion || state.bossContents.some((boss) => boss.ownComplete)
}

/** 원장에 남기는 그날 잡은 것 의 표기. 기록의 키와 **같은 이름·같은 난이도**여야 한다. */
export function bossCompletionKey(boss: string, difficulty: string): string {
  return `${boss}|${difficulty}`
}

/**
 * 그 응답이 말하는 **그날 완료된 보스**. 처치 날짜를 캐는 원재료다.
 *
 * `selectBossProfitBosses` 를 타는 이유는 **기록이 그것을 타기 때문**이다(`auto-record`·`backfill`).
 * 등록 난이도와 실제 처치 난이도가 다를 수 있어 그룹당 실제 처치 난이도 하나를 골라야
 * 원장의 이름과 기록의 키가 맞는다. 이름도 같은 규칙으로 정규화한다(`matchedBossName ?? apiName`).
 *
 * `ownComplete` 만 본다. 승격된 `isComplete` 는 다른 난이도의 완료가 옮겨 붙은 값이다.
 *
 * **섹션이 비면 빈 목록**이고, 그것이 곧 그날 아무것도 안 잡았다 로 읽힌다. 접속하지 않으면
 * 섹션이 통째로 비지만 **접속하지 않은 날에 보스를 잡을 수는 없으므로** 그 답이 맞다.
 */
export function completedBossKeys(state: SchedulerCharacterState): string[] {
  return selectBossProfitBosses(state.bossContents.map(matchBossContent))
    .filter((boss) => boss.ownComplete)
    .map((boss) => bossCompletionKey(boss.matchedBossName ?? boss.apiName, boss.difficulty))
}

/**
 * 조회 원장에 남길 관측 — 자격 판정(`character-eligibility`)과 선채움(`schedule-sync`) 둘 다
 * 이 함수로 기록을 만든다. 두 모듈이 서로를 import 하지 않도록 여기 둔다.
 *
 * 소비자가 셋이 됐다. 처치 날짜 캐기가 `bosses` 를 읽는다. 같은 관측 하나에
 * 실어 보내므로 **같은 날짜를 두 번 부르지 않는다**는 원장의 성질이 그대로 이어진다.
 */
export function toProbeObservation(state: SchedulerCharacterState): {
  hasCompletion: boolean
  sections: SchedulerSectionPresence
  bosses: string[]
} {
  return {
    hasCompletion: hasCharacterScopeCompletion(state),
    sections: getSectionPresence(state),
    bosses: completedBossKeys(state),
  }
}
