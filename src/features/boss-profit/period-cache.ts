/**
 * 기기 DB 기록의 **판**. 보스 기록과 드롭 기록의 판을 하나로 묶는다.
 *
 * 무효화 목록을 손으로 걷지 않는다. 이 쓰기는 어느 기간을 무르게 하나를 세면 다음에 생기는 쓰기 경로가 그것을 빠뜨린다.
 * 아이템 가격 화면 · 가격 미입력 수 · 월간 결정석 집계가 같은 값을 본다. 기간 스냅샷은 쿼리 캐시가 들고
 * (`period-query.ts`) 결정 6 이 판으로 무효화한다.
 */
import { getBossDropRecordsRevision, subscribeBossDropRecordsRevision } from '../../storage/boss-drops'
import { getBossProfitRecordsRevision, subscribeBossProfitRecordsRevision } from '../../storage/boss-profit'

export function bossRecordsStamp(): string {
  return `${getBossProfitRecordsRevision()}|${getBossDropRecordsRevision()}`
}

/**
 * 판이 바뀔 때 부를 함수를 건다. 풀 함수를 돌려준다.
 *
 * @example
 * const stamp = useSyncExternalStore(subscribeBossRecordsStamp, bossRecordsStamp)
 */
export function subscribeBossRecordsStamp(listener: () => void): () => void {
  const unsubscribeProfit = subscribeBossProfitRecordsRevision(listener)
  const unsubscribeDrops = subscribeBossDropRecordsRevision(listener)
  return () => {
    unsubscribeProfit()
    unsubscribeDrops()
  }
}
