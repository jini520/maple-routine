/**
 * 스케줄 스냅샷을 보스 스케줄러의 캐릭터 뷰로 바꾸는 순수 함수. 화면 훅과 React 밖 읽기(계산기)가 같은 함수를 쓴다.
 */
import {
  countClearedWeeklyBosses,
  matchBossContent,
  WEEKLY_BOSS_CLEAR_LIMIT,
  type MatchedBoss,
} from '../../lib/boss/boss-matching'
import type { ScheduleSyncError } from '../schedule-sync/errors'
import { baseViewOf, isUnavailable, sortByLevel, sourcesOf } from '../schedule-sync/schedule-views'
import { readScheduleSnapshot } from '../schedule-sync/read-schedule'
import type { ScheduleSnapshot } from '../schedule-sync/use-schedule-queries'

export interface BossCharacterView {
  ocid: string
  characterName: string
  /** 월드 key. 시즌 보스를 보일지 가른다 */
  worldKey?: string | null
  /** 초상화 레일이 쓰는 둘. 컨텐츠 스케줄러 뷰와 같은 규약이다(`null` 은 아직 모름). */
  level?: number | null
  imageUrl?: string | null
  weeklyBosses: MatchedBoss[]
  monthlyBosses: MatchedBoss[]
  /** `null` 은 모른다 다. `0/12` 는 안 잡았다는 단정이라 조회할 수 없는 캐릭터에 쓰지 않는다. */
  weeklyBossClearCount: number | null
  weeklyBossClearLimitCount: number | null
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export function buildBossViews(snapshot: ScheduleSnapshot): BossCharacterView[] {
  const views: BossCharacterView[] = []
  for (const source of sourcesOf(snapshot)) {
    const base = baseViewOf(source)
    if (base === null) continue
    const known = source.entry !== null && !isUnavailable(base)
    const bosses = known ? source.entry!.state.bossContents.map(matchBossContent) : []
    views.push({
      ...base,
      weeklyBosses: bosses.filter((boss) => boss.cycle === 'weekly'),
      monthlyBosses: bosses.filter((boss) => boss.cycle === 'monthly'),
      weeklyBossClearCount: known ? countClearedWeeklyBosses(bosses) : null,
      weeklyBossClearLimitCount: known ? WEEKLY_BOSS_CLEAR_LIMIT : null,
    })
  }
  return sortByLevel(views)
}

/** React 밖에서 지금 캐시로 만든 뷰. 계산기 스토어가 쓴다. */
export function readBossCharacters(): BossCharacterView[] {
  return buildBossViews(readScheduleSnapshot())
}
