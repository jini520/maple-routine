/**
 * 캐릭터 하나의 남은 스케줄을 세는 함수. today 의 남은 스케줄 타일과 미완료 스케줄 알림이 같이 부른다.
 *
 * 판정은 새로 쓰지 않고 스케줄러 화면의 함수를 부른다. 표시 대상 · 완료 · 요구 레벨 · 주간 한도가 화면과 한 글자라도
 * 다르면 알림이 말하는 것과 화면이 말하는 것이 갈린다.
 */
import { bossNameOf } from '../../lib/boss/bosses'
import { contentShortNameOf } from '../../lib/scheduler/contents'
import { isBossBlocked, isContentBlocked } from '../../lib/scheduler/required-level'
import { getShareScope } from '../../lib/scheduler/scheduler-content-scope'
import type { TrackingMode } from '../../storage/tracking-mode'
import type { BossCycle, BossDifficulty } from '../../types'
import type { ManualTrackedItem } from '../../types/scheduler'
import { displayedBosses } from '../boss-scheduler/displayed-bosses'
import type { BossCharacterView } from '../boss-scheduler/store'
import { dailyContentCompletion, weeklyContentCompletion } from '../content-scheduler/content-completion'
import { displayedDailyContents, displayedWeeklyContents } from '../content-scheduler/displayed-contents'
import type { ContentCharacterView } from '../content-scheduler/store'

/** 남은 보스 한 줄 */
export interface RemainingBossView {
  /** 보스 key. 보스 표에 없는 보스는 `null` 이고 그때 `name` 이 API 원문이다. */
  bossKey: string | null
  /** 보이는 이름. 보스 표의 이름, 표에 없으면 API 원문. */
  name: string
  difficulty: BossDifficulty
}

export interface RemainingScheduleInput {
  /** 컨텐츠 스케줄러의 캐릭터 뷰. 없으면 컨텐츠는 비어 있다 */
  content: ContentCharacterView | undefined
  /** 보스 스케줄러의 캐릭터 뷰. 없으면 보스는 비어 있다 */
  boss: BossCharacterView | undefined
  trackingMode: TrackingMode
  /** 이 캐릭터의 수동 추적 컨텐츠 */
  manualContentItems: ManualTrackedItem[]
  manualBossByOcid: Record<string, ManualTrackedItem[]> | null
  /** 사용자가 직접 적은 완료(`bossKey|difficulty`) */
  manualCompletedByOcid: Record<string, readonly string[]>
  /** 지금 주간 기간 키 */
  weeklyPeriodKey: string
  now: Date
}

/** 개수가 아니라 이름 목록이다. 접힌 수와 펼친 이름이 같은 배열을 본다. */
export interface RemainingSchedule {
  dailyNames: string[]
  weeklyNames: string[]
  weeklyBosses: RemainingBossView[]
  monthlyBosses: RemainingBossView[]
}

export function remainingScheduleOf(input: RemainingScheduleInput): RemainingSchedule {
  const { content, boss } = input
  // 표시 대상으로 먼저 거른다. `dailyContents` 는 등록 여부와 무관하게 게임에 있는 항목 전부라 그냥 세면 모든 캐릭터가
  // 카탈로그 길이로 같아진다. 공유 항목은 진행이 캐릭터 단위가 아니라 여기서 뺀다. 요구 레벨 미달은 이 캐릭터로는
  // 못 하므로 남은 것이 아니다.
  const contentsInput = {
    dailyContents: content?.dailyContents ?? [],
    weeklyContents: content?.weeklyContents ?? [],
    manualItems: input.manualContentItems,
  }
  const characterLevel = content?.level ?? boss?.level ?? null
  const dailyNames = displayedDailyContents(contentsInput, input.trackingMode, input.weeklyPeriodKey)
    .filter((item) => getShareScope(item.contentKey) === 'character')
    .filter((item) => !isContentBlocked(characterLevel, item.contentKey))
    .filter((item) => dailyContentCompletion(item) === 'incomplete')
    .map((item) => contentShortNameOf(item.contentKey, item.apiName))
  const weeklyNames = displayedWeeklyContents(contentsInput, input.trackingMode, input.weeklyPeriodKey)
    .filter((item) => getShareScope(item.contentKey) === 'character')
    .filter((item) => !isContentBlocked(characterLevel, item.contentKey))
    .filter((item) => weeklyContentCompletion(item) === 'incomplete')
    .map((item) => contentShortNameOf(item.contentKey, item.apiName))

  return {
    dailyNames,
    weeklyNames,
    weeklyBosses: remainingBosses(input, 'weekly', characterLevel),
    monthlyBosses: remainingBosses(input, 'monthly', characterLevel),
  }
}

function remainingBosses(input: RemainingScheduleInput, cycle: BossCycle, characterLevel: number | null): RemainingBossView[] {
  if (input.boss === undefined) return []
  return displayedBosses(input.boss, cycle, input.trackingMode, input.manualBossByOcid, input.manualCompletedByOcid, input.now)
    .filter((matched) => !isBossBlocked(characterLevel, matched.bossKey, matched.difficulty))
    .filter((matched) => !matched.isComplete)
    // 주간 한도를 채우면 남은 것이 아니다. 판정은 `displayedBosses` 가 실어 보낸다.
    .filter((matched) => !matched.isWeeklyLimitClosed)
    .map((matched) => ({ bossKey: matched.bossKey, name: bossNameOf(matched.bossKey, matched.apiName), difficulty: matched.difficulty }))
}
