/**
 * 읽어 둔 기간의 **스냅샷 표**. 표에 있으면 다시 안 읽고 곧장 그린다.
 *
 * 표는 스토어 상태가 아니라 모듈 변수다. 화면이 여기서 직접 읽는 값이 하나도 없다 - 읽는 것은
 * 언제나 `set()` 이 평평하게 깐 `rows`·`dropsByRowKey` 다. 상태에 두면 프리페치가 한 칸 채울
 * 때마다 화면 전체가 다시 그려진다.
 *
 * **세션 동안 안 버린다.** 창 밖으로 나간 기간도 그대로 둔다. 버리면 되돌아올 때 다시 읽어야
 * 해서 그쪽이 더 비싸다.
 *
 * @see docs/features/boss-profit.md 의 `기간을 미리 들고 있는다`
 */
import { getBossDropRecordsRevision } from '../../storage/boss-drops'
import { getBossProfitRecordsRevision } from '../../storage/boss-profit'
import type { PeriodDataState } from '../../lib/boss/boss-profit-period'
import type { RecordedDrop } from '../../types/drops'
import type { BossCycle } from '../../types'
import type { BossProfitRow } from './rows'
import type { BossProfitWeeklySubtotal } from './store'

/** 한 기간에 대해 화면이 읽는 값 전부. `set()` 이 이것을 그대로 편다. */
export interface PeriodSnapshot {
  rows: BossProfitRow[]
  dropsByRowKey: Record<string, RecordedDrop[]>
  weeklySubtotals: BossProfitWeeklySubtotal[]
  periodState: PeriodDataState
  periodPendingAggregation: boolean
  previousPeriodTotalMeso: number
  canGoPreviousPeriod: boolean
}

interface CacheEntry {
  snapshot: PeriodSnapshot
  /** 어느 판에서 읽었나. 지금 판과 다르면 없는 것으로 친다 */
  stamp: string
}

const cache = new Map<string, CacheEntry>()

function cacheKey(tab: BossCycle, periodKey: string): string {
  return `${tab}|${periodKey}`
}

/**
 * 기기 DB 기록의 **판**. 이 값이 달라지면 표의 줄은 전부 낡는다.
 *
 * 무효화 목록을 손으로 걷지 않는다 - `이 쓰기는 어느 기간을 무르게 하나` 를 세면 다음에 생기는
 * 쓰기 경로가 그것을 빠뜨린다. 아이템 가격 화면도 같은 값을 본다.
 */
export function bossRecordsStamp(): string {
  return `${getBossProfitRecordsRevision()}|${getBossDropRecordsRevision()}`
}

/** 표에 있는 그 기간. 판이 다르거나 없으면 `null` 이다. */
export function readPeriodSnapshot(
  tab: BossCycle,
  periodKey: string,
  stamp: string,
): PeriodSnapshot | null {
  const entry = cache.get(cacheKey(tab, periodKey))
  return entry === undefined || entry.stamp !== stamp ? null : entry.snapshot
}

/**
 * 읽은 결과를 표에 넣는다.
 *
 * `stamp` 는 **읽기 전에 찍은 값**이어야 한다. 읽는 중에 들어온 변경을 본 것으로 표시하면 그
 * 변경을 영영 놓친다.
 */
export function writePeriodSnapshot(
  tab: BossCycle,
  periodKey: string,
  stamp: string,
  snapshot: PeriodSnapshot,
): void {
  cache.set(cacheKey(tab, periodKey), { snapshot, stamp })
}

/**
 * 표를 채우는 회차의 번호. **앞의 회차를 무르고** 새 번호를 준다.
 *
 * 표와 같은 모듈에 두는 것은 둘의 수명이 같아서다. 표를 비우는데 앞 회차가 살아 있으면 그것이
 * 비운 표에 옛 값을 다시 써넣는다.
 */
let prefetchToken = 0

export function nextPrefetchToken(): number {
  prefetchToken += 1
  return prefetchToken
}

/** 그 회차가 아직 최신인가. 아니면 채우던 것을 버린다 */
export function isPrefetchTokenCurrent(token: number): boolean {
  return token === prefetchToken
}

/** 표가 지금 들고 있는 줄들(`'{tab}|{periodKey}'`). 창이 다 찼는지 테스트가 이것으로 안다 */
export function cachedPeriodKeysForTests(): string[] {
  return [...cache.keys()]
}

export function clearPeriodCacheForTests(): void {
  cache.clear()
  nextPrefetchToken()
}
