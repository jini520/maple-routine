import { BOSS_DIFFICULTIES, type ManualTrackedItem } from '../../types/scheduler'
import type { BossContent, BossCycle, BossDifficulty } from '../../types'
import {
  WEEKLY_BOSS_CLEAR_LIMIT,
  bossCycleOf,
  bossPortraitSlugOf,
  bossReferenceOrder,
  isSeasonBoss,
} from './bosses'

export { WEEKLY_BOSS_CLEAR_LIMIT, WEEKLY_CRYSTAL_SALE_LIMIT } from './bosses'

export interface MatchedBoss {
  /** 보스 key. API 이름이 보스 표에 없으면 `null` 이다. */
  bossKey: string | null
  apiName: string
  difficulty: BossDifficulty
  cycle: BossCycle
  isRegistered: boolean
  isComplete: boolean
  ownComplete: boolean // 승격 없는 원본 완료 여부. selectBossProfitBosses가 실제 처치 난이도를 판정할 때 사용
  portraitSlug: string | null
  isSeasonBoss: boolean
}

/** `compareBossOrder` 가 읽는 것. 보스와 난이도뿐이다(행이든 카드든 타일이든 이 둘은 있다). */
export interface BossOrderKey {
  /** 보스 key. 표에 없는 보스(스케줄러 카드에만 서는 항목)는 API 원문을 넘긴다. */
  boss: string
  /** 없거나 표 밖 값이면 같은 보스 안에서 맨 앞이다(`indexOf` 가 -1). 보스 항목엔 늘 있다. */
  difficulty?: string
}

/**
 * 앱 전체의 보스 순서. 보스 표 차례 → 난이도 → 보스 key.
 *
 * 네 소비자가 함께 쓴다.
 *
 * - `lib/boss/manual-boss-merge`(수동 목록)
 * - `features/boss-scheduler/displayed-bosses`(스케줄러 카드 · today 남은 스케줄 펼침)
 * - `features/boss-profit/rows`(`sortRowsByOcidOrder` 의 2차 키)
 * - `features/cashbook/records`(펼친 결정석 줄의 보스 타일)
 *
 * 완전 결정적이다. 표에 없는 보스는 맨 뒤로 가되 그들끼리도 난이도 · 글자로 갈린다. 안정 정렬에
 * 기대면 입력 순서가 계약이 되는데, 그 입력이 `ORDER BY` 없는 조회나 Map 삽입 순서다.
 */
export function compareBossOrder(a: BossOrderKey, b: BossOrderKey): number {
  const referenceDiff = bossReferenceOrder(a.boss) - bossReferenceOrder(b.boss)
  if (referenceDiff !== 0) return referenceDiff

  const difficultyDiff =
    BOSS_DIFFICULTIES.indexOf(a.difficulty as BossDifficulty) -
    BOSS_DIFFICULTIES.indexOf(b.difficulty as BossDifficulty)
  if (difficultyDiff !== 0) return difficultyDiff

  return a.boss < b.boss ? -1 : a.boss > b.boss ? 1 : 0
}

// 수동 추적 항목 중 "주간 12개 한도에 잡히는" 보스 수. 관리 화면의 주간 섹션은
// weekly와 eventWeekly를 합쳐 출처 구분을 잃고, 저장 배열은 월간 보스까지 kind: 'boss'로
// 함께 담으므로, 주기와 시즌 여부를 보스 표에서 되찾아야 한다. 제외 규칙은
// countClearedWeeklyBosses와 같아야 한다. 어긋나면 선택은 12/12인데
// 처치 카운트는 11/12로 표시되는 모순이 생긴다.
export function countManualWeeklyBosses(items: ManualTrackedItem[]): number {
  return items.filter(
    (item) => item.kind === 'boss' && bossCycleOf(item.bossKey) === 'weekly' && !isSeasonBoss(item.bossKey),
  ).length
}

export function matchBossContent(content: BossContent): MatchedBoss {
  return {
    bossKey: content.bossKey,
    apiName: content.apiName,
    difficulty: content.difficulty,
    cycle: content.cycle,
    isRegistered: content.isRegistered,
    isComplete: content.isComplete,
    ownComplete: content.ownComplete,
    portraitSlug: bossPortraitSlugOf(content.bossKey),
    isSeasonBoss: isSeasonBoss(content.bossKey),
  }
}

/** 같은 보스끼리 묶는다. 표에 없는 보스는 API 원문으로 묶는다. 두 모양이 섞여도 겹치지 않게 앞에 표지를 붙인다. */
function groupByBoss(bosses: MatchedBoss[]): Map<string, MatchedBoss[]> {
  const groups = new Map<string, MatchedBoss[]>()
  for (const boss of bosses) {
    const identity = boss.bossKey !== null ? `key:${boss.bossKey}` : `api:${boss.apiName}`
    const group = groups.get(identity) ?? []
    group.push(boss)
    groups.set(identity, group)
  }
  return groups
}

// 등록 여부와 무관하게 시즌 보스를 제외한 주간 보스 중 완료된(content_name 기준) 보스 수를
// 센다. 등록 없이 잡은 보스도 포함하되, 같은 보스를 여러 난이도로
// 동시에 완료해도 1로만 센다.
export function countClearedWeeklyBosses(bosses: MatchedBoss[]): number {
  const weeklyBosses = bosses.filter((boss) => boss.cycle === 'weekly' && !boss.isSeasonBoss)
  let count = 0
  for (const group of groupByBoss(weeklyBosses).values()) {
    if (group.some((boss) => boss.isComplete)) {
      count += 1
    }
  }
  return count
}

/**
 * **이번 주 주간 보스 한도(12)를 채웠는가**.
 *
 * 세는 규칙을 새로 쓰지 않고 `countClearedWeeklyBosses`를 그대로 쓴다.
 * 시즌 보스 제외·월간 제외·같은 보스의 여러 난이도는 1, 세 규칙이 여기서도 그대로여야
 * 선택은 12/12 인데 처치는 11/12 같은 모순이 안 생긴다(이미 겪은 것).
 *
 * 판정이 여기 있는 이유는 `WEEKLY_BOSS_CLEAR_LIMIT` 과 세는 함수를 **이 파일이 소유**하기
 * 때문이다. 소비자(스케줄러 카드 · today 남은 스케줄 · 보스 수익)가 각자 `>= 12` 를 쓰면
 * 같은 규칙이 세 벌이 되고, 그때부터 화면마다 다른 말을 한다.
 *
 * **넥슨의 `weekly_boss_clear_count` 는 안 쓴다**. 그 필드는 타입에만 있고 제품 코드는 처음부터
 * 앱이 센 값을 쓴다. 대가는 동기화가 낡으면 판정도 낡는다 이고, 다음 동기화가 스스로 고친다.
 */
export function isWeeklyClearLimitReached(bosses: MatchedBoss[]): boolean {
  return countClearedWeeklyBosses(bosses) >= WEEKLY_BOSS_CLEAR_LIMIT
}

// 보스 카드 목록에 표시할 항목을 content_name 그룹별로 고른다. 등록된
// 난이도가 있으면 그것만 보여주고(중복 카드 방지), 없으면 완료된 난이도를 대신 보여준다.
export function selectDisplayBosses(bosses: MatchedBoss[]): MatchedBoss[] {
  const result: MatchedBoss[] = []
  for (const group of groupByBoss(bosses).values()) {
    const registered = group.filter((boss) => boss.isRegistered)
    if (registered.length > 0) {
      result.push(...registered)
      continue
    }
    result.push(...group.filter((boss) => boss.isComplete))
  }
  return result
}

// 보스 수익 계산기 전용 선택 로직. selectDisplayBosses(카드 표시용, 등록 여부 우선)와
// 달리 "실제로 처치했는가"(ownComplete, 승격 없는 원본 완료 여부)를 우선한다. 등록한 난이도와
// 실제로 처치한 난이도가 다를 수 있어, 수익 계산은 반드시 진짜 처치한 난이도의
// 가격을 써야 한다. 같은 content_name·같은 cycle(weekly/monthly) 안에서는 게임 룰상 한
// 캐릭터가 여러 난이도를 동시에 완료할 수 없으므로(사용자 확인) ownComplete: true인
// 항목은 그룹당 최대 1개다. 그 이상이면(예: 서로 다른 cycle 그룹이 우연히 같은 content_name을
// 쓰는 경우) 전부 실제 완료이므로 데이터를 숨기지 않고 그대로 보여준다.
//
// 보스 표에 없는 보스(key 가 없다)는 고르지 않는다. 결정석 가격도 기록할 key 도 없어 수익 행이 될 수 없다.
export function selectBossProfitBosses(bosses: MatchedBoss[]): MatchedBoss[] {
  const result: MatchedBoss[] = []
  for (const group of groupByBoss(bosses.filter((boss) => boss.bossKey !== null)).values()) {
    const actuallyComplete = group.filter((boss) => boss.ownComplete)
    if (actuallyComplete.length > 0) {
      result.push(...actuallyComplete)
      continue
    }
    const registered = group.find((boss) => boss.isRegistered)
    if (registered !== undefined) {
      result.push(registered) // 미완료 placeholder. 등록 난이도로 표시
    }
  }
  return result
}
