import { useBossProfitStore } from '../../features/boss-profit/store'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import { prefetchSchedules } from '../../features/schedule-sync/schedule-query'

/**
 * 설정에서 무언가 바뀐 뒤 탭이 그릴 것을 다시 읽히는 한 자리.
 *
 * 스케줄은 쿼리 캐시가 들어 추적 목록을 저장하면 보는 화면이 함께 바뀐다. 여기서 더 하는 것은 만료된 회차를 미리
 * 받는 것과, 모드가 바뀌어 낡은 기기 값(수동 추적 · 직접 완료)을 다시 읽히는 것이다. 보스 수익은 아직 자기 스토어가
 * 받는다.
 */
export type TabStoreName = 'content' | 'boss' | 'profit'

const LOADERS: Record<TabStoreName, () => Promise<void>> = {
  content: () => useContentSchedulerStore.getState().reloadLocal(),
  boss: () => useBossSchedulerStore.getState().reloadLocal(),
  profit: () => useBossProfitStore.getState().loadTrackedOcids(),
}

/**
 * 넘긴 순서대로 도는 순차 재로드. 스케줄 회차 뒤에 보스 수익이 와야 그쪽 게이트가 방금 받은 캐시를 신선하다고 본다.
 *
 * **기다리지 않는다**(반환값이 없는 이유다). 사용자가 고른 일은 이미 끝났고, 뒤따르는 회차는 그 탭에
 * 들어가면 어차피 돌 재조회를 미리 도는 것뿐이다. 실패도 삼킨다. 그 탭에 들어가면 화면이 자기 몫을
 * 다시 부르고, 그때 실패하면 그 화면의 에러 경로가 정상적으로 돈다.
 */
export function reloadTabStores(names: readonly TabStoreName[]): void {
  void (async () => {
    // 스케줄러 둘이 같은 회차를 보므로 회차는 한 번만 미리 받는다. 둘 다 부르면 첫 회차가 실패했을 때 두 번째가 다시 나간다.
    if (names.includes('content') || names.includes('boss')) {
      await prefetchSchedules().catch(() => undefined)
    }
    for (const name of names) {
      try {
        await LOADERS[name]()
      } catch {
        // 예열 실패는 조용히 넘긴다(`features/prehydrate` 와 같은 이유).
      }
    }
  })()
}
