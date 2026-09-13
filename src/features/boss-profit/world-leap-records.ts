/**
 * 월드 리프한 기간에 같은 처치가 옛 ocid 와 새 ocid 로 한 번씩 선 기록의 짝짓기.
 *
 * 리프 전 완료가 새 ocid 로 넘어와 자동 기록이 같은 처치를 한 번 더 쓴다. 기록 키가 ocid 를 품어
 * upsert 가 그 중복을 못 막으므로, 짝을 찾아 옛 기록을 지우고 새 기록 하나로 센다.
 */
import type { BossProfitRecord } from '../../storage/boss-profit'
import type { BossCycle } from '../../types'

export interface WorldLeapRecordPair {
  /** 지울 옛 기록 */
  stale: BossProfitRecord
  /** 남길 새 기록. 파티원 수를 옛 값으로 덮었으면 바뀐 `partySize`·`payoutMeso` 를 든다 */
  kept: BossProfitRecord
  /** `kept` 를 다시 써야 하는가 */
  keptChanged: boolean
}

export interface WorldLeapRecordPairsInput {
  fromOcid: string
  toOcid: string
  /**
   * 새 ocid 의 주기별 가장 이른 기록 기간(`getEarliestBossProfitPeriodKeys`). 리프한 주와 그 달이다.
   *
   * 새 ocid 는 리프 전 날짜를 못 불러 그 앞 기간 기록을 가질 수 없다. 짝을 이 기간에서만 찾는 것은
   * 연결이 틀렸을 때 다른 기간의 기록을 지키기 위해서다.
   */
  leapPeriodKeys: Partial<Record<BossCycle, string>>
  records: readonly BossProfitRecord[]
}

/**
 * 옛 기록을 지우고 새 기록을 남길 짝들.
 *
 * 새 기록의 파티원 수는 **1 일 때만** 옛 값으로 덮는다. 새 ocid 는 설정이 없어 대개 기본값 1 로
 * 기록되고, 2 이상은 사용자가 새 카드에서 고친 값이다.
 */
export function planWorldLeapRecordPairs(input: WorldLeapRecordPairsInput): WorldLeapRecordPair[] {
  const inLeapPeriod = (record: BossProfitRecord): boolean =>
    input.leapPeriodKeys[record.cycle] === record.periodKey

  const pairs: WorldLeapRecordPair[] = []
  for (const stale of input.records) {
    if (stale.ocid !== input.fromOcid || !inLeapPeriod(stale)) continue

    const kept = input.records.find(
      (candidate) =>
        candidate.ocid === input.toOcid &&
        candidate.boss === stale.boss &&
        candidate.difficulty === stale.difficulty &&
        candidate.periodKey === stale.periodKey,
    )
    if (kept === undefined) continue

    if (kept.partySize === 1 && stale.partySize !== 1) {
      const partySize = stale.partySize
      pairs.push({
        stale,
        kept: { ...kept, partySize, payoutMeso: Math.floor(kept.priceMeso / partySize) },
        keptChanged: true,
      })
      continue
    }
    pairs.push({ stale, kept, keptChanged: false })
  }
  return pairs
}
