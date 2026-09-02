import { useBossProfitStore } from '../../features/boss-profit/store'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'

/**
 * 설정에서 무언가 바뀐 뒤 탭 스토어를 다시 읽히는 **한 자리**(+ 그 정정).
 *
 * 화면을 옮길 때마다 `loadTrackedOcids()` 가 저장소를
 * 다시 읽었다. RN 의 탭 화면은 한 번 뜨면 마운트된 채 남아 스스로 다시 읽지 않으므로, 설정이
 * 명시적으로 부르지 않으면 다른 탭이 옛 값을 들고 있게 된다. 그 어긋남이 두 모양으로 나타났다.
 * 추적 목록을 저장했을 때(결정 5)와 스케줄 관리 방법을 바꿨을 때(그 정정, 2026-08-16).
 *
 * 호출부가 **대상을 고른다**. 추적 목록 저장은 컨텐츠 스토어가 저장의 주체라 이미 최신이므로 뒤의
 * 둘만 읽히고, 모드 전환은 셋을 모두 낡게 만든다(수동 모드의 표시 목록을 정하는 것은 저장소가 아니라
 * 스토어 메모리의 사본이고, 그것을 채우는 자리가 `refresh()` 하나다).
 */
export type TabStoreName = 'content' | 'boss' | 'profit'

const LOADERS: Record<TabStoreName, () => Promise<void>> = {
  content: () => useContentSchedulerStore.getState().loadTrackedOcids(),
  boss: () => useBossSchedulerStore.getState().loadTrackedOcids(),
  profit: () => useBossProfitStore.getState().loadTrackedOcids(),
}

/**
 * 넘긴 순서대로 **순차** 재로드한다. 병렬이 아닌 이유는 `prehydrateTabStores` 와 같다.
 *  게이트의 신선도는 앞 회차가 캐시를 **다 쓴 뒤에야** 참이 되므로, 동시에 띄우면 전부
 * 옛 `syncedAt` 을 보고 같은 응답을 여러 번 받는다.
 *
 * **기다리지 않는다**(반환값이 없는 이유다). 사용자가 고른 일은 이미 끝났고, 뒤따르는 회차는 그 탭에
 * 들어가면 어차피 돌 재조회를 미리 도는 것뿐이다. 실패도 삼킨다. 그 탭에 들어가면 화면이 자기 몫을
 * 다시 부르고, 그때 실패하면 그 화면의 에러 경로가 정상적으로 돈다.
 */
export function reloadTabStores(names: readonly TabStoreName[]): void {
  void (async () => {
    for (const name of names) {
      try {
        await LOADERS[name]()
      } catch {
        // 예열 실패는 조용히 넘긴다(`features/prehydrate` 와 같은 이유).
      }
    }
  })()
}
