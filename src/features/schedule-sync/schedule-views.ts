/**
 * 두 스케줄러 뷰가 함께 쓰는 조각. 스냅샷에서 캐릭터 하나의 바탕을 만들고, 레벨 순서로 세운다.
 */
import { compareByName } from '../../lib/character-order'
import type { CachedCharacterBasicEntry } from '../../storage/character-basic-cache'
import type { CachedSchedulerEntry } from '../../storage/scheduler-cache'
import type { ScheduleSnapshot } from './use-schedule-queries'
import type { ScheduleOutcome } from './schedule-query'
import type { StrandedCharacter } from './stranded-characters'

/** 두 스케줄러 뷰가 공통으로 갖는 칸. */
export interface ScheduleViewBase {
  ocid: string
  characterName: string
  worldKey?: string | null
  level?: number | null
  imageUrl?: string | null
  isStale: boolean
  syncedAt: string | null
  error: ScheduleOutcome['error']
}

/** 캐릭터 하나의 재료. 셋 중 하나는 없을 수 있다. */
export interface ScheduleCharacterSource {
  ocid: string
  entry: CachedSchedulerEntry | null
  basic: CachedCharacterBasicEntry | null
  outcome: ScheduleOutcome | null
  stranded: StrandedCharacter | null
}

export function sourcesOf(snapshot: ScheduleSnapshot): ScheduleCharacterSource[] {
  const strandedByOcid = new Map((snapshot.round?.stranded ?? []).map((one) => [one.ocid, one]))
  return snapshot.ocids.map((ocid) => ({
    ocid,
    entry: snapshot.schedules.get(ocid) ?? null,
    basic: snapshot.basics.get(ocid) ?? null,
    outcome: snapshot.round?.outcomes[ocid] ?? null,
    stranded: strandedByOcid.get(ocid) ?? null,
  }))
}

/**
 * 공통 칸을 채운다. 스케줄도 없고 답하지 않은 캐릭터도 아니면 `null` 이다. 이름 없이 카드를 그릴 수 없고 ocid 는
 * 사용자에게 뜻이 없는 값이라 대신 넣지 않는다.
 */
export function baseViewOf(source: ScheduleCharacterSource): ScheduleViewBase | null {
  const { entry, basic, outcome, stranded } = source
  if (entry !== null) {
    return {
      ocid: source.ocid,
      characterName: entry.state.characterName,
      worldKey: entry.state.worldKey,
      level: basic?.profile.level ?? null,
      imageUrl: basic?.profile.imageUrl ?? null,
      // 회차가 아직 말한 적 없으면 캐시가 곧 지금 값이다. 그 표식을 남기면 탭을 옮길 때마다 스탈 토스트가 뜬다.
      isStale: outcome?.isStale ?? false,
      syncedAt: entry.syncedAt,
      error: outcome?.error ?? null,
    }
  }
  if (stranded !== null) {
    return {
      ocid: source.ocid,
      characterName: stranded.characterName,
      worldKey: stranded.worldKey,
      level: stranded.level,
      imageUrl: stranded.imageUrl,
      isStale: true,
      syncedAt: null,
      error: { kind: 'characterUnavailable' },
    }
  }
  return null
}

/** 조회할 수 없는 캐릭터인가. 내용을 비우고 모른다 로 그려야 한다. */
export function isUnavailable(base: ScheduleViewBase): boolean {
  return base.error?.kind === 'characterUnavailable'
}

/**
 * 레벨 내림차순, 같은 레벨은 이름순. 레벨을 모르는 캐릭터는 맨 뒤다. 화면은 이 위에 추적 목록 순서를 다시 얹는다
 * (`orderByTracked`).
 */
export function sortByLevel<T extends ScheduleViewBase>(views: T[]): T[] {
  return [...views].sort((a, b) => {
    const levelA = a.level ?? null
    const levelB = b.level ?? null
    if (levelA === null && levelB === null) return compareByName(a.characterName, b.characterName)
    if (levelA === null) return 1
    if (levelB === null) return -1
    if (levelB !== levelA) return levelB - levelA
    return compareByName(a.characterName, b.characterName)
  })
}
