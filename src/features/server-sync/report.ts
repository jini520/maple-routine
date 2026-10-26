/**
 * 기록을 쓴 자리가 부르는 곳. 바뀐 기록을 대기 표에 넣고 전송을 깨운다. **던지지 않는다.**
 *
 * 넣는 함수와 깨우는 함수를 이 파일에서 묶는 이유는 순환 import 를 피하려는 것이다. 종류 파일이 `kick` 을 가져오면
 * `kick → run → registry → 종류` 로 돌아 registry 가 빈 처리 함수를 표에 넣는다.
 */
import type { BossProfitRecordKey } from '../../storage/boss-profit'
import { findBossPeriodIds } from '../../storage/server-sync-sources'
import { enqueueBossClears, enqueueBossClearsOf } from './boss-clear-sync'
import { enqueueCashbookEntries } from './cashbook-entry-sync'
import { kickServerSync } from './kick'

/** @param now 대기 표에 적는 시각. 테스트가 고정한다 */
export async function reportBossClears(periodIds: readonly string[], now: Date): Promise<void> {
  await enqueueBossClears(periodIds, now)
  if (periodIds.length > 0) void kickServerSync()
}

/** 키로 쓰는 자리용. 지운 기간은 키로 못 찾으므로 지우기 전에 부른다. */
export async function reportBossClearsOf(keys: readonly BossProfitRecordKey[], now: Date): Promise<void> {
  await enqueueBossClearsOf(keys, now)
  if (keys.length > 0) void kickServerSync()
}

export async function reportCashbookEntries(entryIds: readonly string[], now: Date): Promise<void> {
  await enqueueCashbookEntries(entryIds, now)
  if (entryIds.length > 0) void kickServerSync()
}

/**
 * 지우기 전에 기간 행 id 를 얻는다. 지운 뒤에는 키로 못 찾는다. 대기 표에는 지운 **뒤에** 넣어야 한다. 먼저 넣으면 전송이
 * 지우기보다 앞서 돌아 아직 남은 처치를 서버에 다시 적는다.
 */
export function bossPeriodIdsOf(keys: readonly BossProfitRecordKey[]): Promise<string[]> {
  return findBossPeriodIds(keys).catch(() => [])
}
