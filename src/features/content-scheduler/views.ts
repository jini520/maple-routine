/**
 * 스케줄 스냅샷을 컨텐츠 스케줄러의 캐릭터 뷰로 바꾸는 순수 함수. 화면 훅과 React 밖 읽기가 같은 함수를 쓴다.
 */
import type { DailyContent, WeeklyContent } from '../../types'
import type { ScheduleSyncError } from '../schedule-sync/errors'
import { baseViewOf, isUnavailable, sortByLevel, sourcesOf } from '../schedule-sync/schedule-views'
import type { ScheduleSnapshot } from '../schedule-sync/use-schedule-queries'

export interface ContentCharacterView {
  ocid: string
  characterName: string
  /** 월드 key. 시즌 보스를 보일지 가른다 */
  worldKey?: string | null
  /** 길드명. `null` 은 미가입(길드 컨텐츠 잠금 근거), `undefined` 는 모름(잠그지 않음). */
  guildName?: string | null
  /** 초상화 레일이 쓰는 둘. `null` 은 기본 정보를 아직 모른다는 뜻이고 레일은 그때 레벨 호를 비운다. */
  level?: number | null
  imageUrl?: string | null
  dailyContents: DailyContent[]
  weeklyContents: WeeklyContent[]
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export function buildContentViews(snapshot: ScheduleSnapshot): ContentCharacterView[] {
  const views: ContentCharacterView[] = []
  for (const source of sourcesOf(snapshot)) {
    const base = baseViewOf(source)
    if (base === null) continue
    // 조회할 수 없는 캐릭터는 내용을 비운다. 빈 배열은 0개 가 아니라 그릴 것이 없다 이고 `error` 가 그 사실을 말한다.
    const known = source.entry !== null && !isUnavailable(base)
    views.push({
      ...base,
      guildName: source.basic?.profile.guildName,
      dailyContents: known ? source.entry!.state.dailyContents : [],
      weeklyContents: known ? source.entry!.state.weeklyContents : [],
    })
  }
  return sortByLevel(views)
}
