/**
 * 보고 있는 주의 가격 미입력 건수. 아이템 가격 입력 버튼의 배지가 읽는다.
 *
 * @see docs/features/boss-profit.md 의 `아이템 가격 입력으로 가는 문은 떠 있는 버튼이다`
 */
import { useEffect, useSyncExternalStore } from 'react'

import { useDropPriceStore } from './drop-price-store'
import { bossRecordsStamp, subscribeBossRecordsStamp } from './period-cache'

/**
 * 그 주 창을 채우고 판이 바뀔 때마다 다시 채우는 훅. 모르는 수(아직 못 읽음 · 읽기 실패 · 다시
 * 채우는 중)는 `null` 이다.
 *
 * @example
 * const unpriced = useUnpricedDropCount(periodKey)
 */
export function useUnpricedDropCount(periodKey: string): number | null {
  const stamp = useSyncExternalStore(subscribeBossRecordsStamp, bossRecordsStamp)

  useEffect(() => {
    void useDropPriceStore.getState().warmWindow(periodKey)
  }, [periodKey, stamp])

  const entry = useDropPriceStore((state) => state.unpricedCounts[periodKey])
  return entry !== undefined && entry.stamp === stamp ? entry.count : null
}
