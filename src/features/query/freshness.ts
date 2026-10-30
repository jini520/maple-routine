/**
 * 스케줄 회차가 얼마나 오래 신선한가. `staleTime` 함수가 이 값을 돌려준다.
 *
 * 둘 중 먼저 오는 쪽까지다. 받은 지 10분(`SYNC_TTL_MS`), 또는 받은 뒤 처음 오는 KST 자정. 일간 초기화가 매일
 * 자정이고 주간(목요일) · 월간(1일) 초기화도 자정이라, 자정 하나만 보면 셋을 다 넘긴다. 나이만 보면 23:55 에
 * 받은 어제 완료가 00:05 에도 신선한 값으로 선다.
 */
import { SYNC_TTL_MS } from '../../lib/scheduler/sync-freshness'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** `atMs` 뒤에 처음 오는 KST 자정(epoch ms). 자정 그 순간이면 다음 자정이다. */
export function nextKstMidnightAfter(atMs: number): number {
  const kstDayStart = Math.floor((atMs + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS
  return kstDayStart + DAY_MS
}

/**
 * @param dataUpdatedAt 회차가 끝난 시각(epoch ms). 받은 적이 없으면 0
 * @param coveredOcids 그 회차가 덮은 캐릭터
 * @param trackedOcids 지금 추적 목록. 아직 안 읽었으면 `null`
 * @returns 0 이면 지금 바로 만료다
 */
export function scheduleStaleTime(
  dataUpdatedAt: number,
  coveredOcids: readonly string[],
  trackedOcids: readonly string[] | null,
): number {
  if (dataUpdatedAt <= 0) return 0
  // 새로 추적한 캐릭터가 조회 없이 빈 채로 남지 않게. 회차가 더 넓게 덮은 것은 상관없다.
  if (trackedOcids !== null) {
    const covered = new Set(coveredOcids)
    if (trackedOcids.some((ocid) => !covered.has(ocid))) return 0
  }
  return Math.max(0, Math.min(SYNC_TTL_MS, nextKstMidnightAfter(dataUpdatedAt) - dataUpdatedAt))
}
