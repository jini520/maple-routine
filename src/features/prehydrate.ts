/**
 * 탭 화면이 그릴 것을 부팅 때 미리 받는 함수.
 *
 * 안 하면 탭 첫 진입이 조회를 사용자가 보는 앞에서 치른다. 스플래시 최소 표시 시간 덕에 사용자가 탭을 누를 무렵엔
 * 회차가 이미 돌았고 첫 페인트가 곧 목록이다.
 *
 * 저장된 쿼리 캐시가 다 올라온 뒤에 돈다. 그 전에 회차를 돌리면 복원이 그 결과보다 옛 값을 들고 와도 덮지는 않지만,
 * 회차가 옛 캐시를 못 보고 빈 캐시로 판단한다.
 *
 * 보스 수익의 이번 주는 회차 뒤에 읽는다. 회차가 쓴 기록까지 든 값이어야 today 의 위젯이 한 번에 선다.
 */
import { prefetchCurrentWeekProfit } from './boss-profit/period-query'
import { useCharacterSelectionStore } from './character-selection/store'
import { whenQueryCacheRestored } from './query/persist'
import { prefetchSchedules } from './schedule-sync/schedule-query'

// 실패해도 던지지 않는다. 이건 예열이지 부팅 절차가 아니다. 어느 단계가 넘어져도 나머지는
// 계속 예열하고, 사용자가 그 탭에 들어가면 화면이 평소대로 자기 몫을 다시 부른다.
export async function prehydrateTabStores(): Promise<void> {
  await whenQueryCacheRestored()
  const steps: ReadonlyArray<() => Promise<void>> = [
    () => useCharacterSelectionStore.getState().hydrate(),
    prefetchSchedules,
    prefetchCurrentWeekProfit,
  ]
  for (const step of steps) {
    try {
      await step()
    } catch {
      // 예열 실패는 조용히 넘긴다. 화면 진입이 같은 경로를 다시 밟는다.
    }
  }
}
