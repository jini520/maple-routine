/**
 * 탭 화면 스토어를 부팅 때 미리 하이드레이션하는 함수.
 *
 * 안 하면 탭 첫 진입이 저장소 읽기를 사용자가 보는 앞에서 치른다(실기기에서 목록보다 먼저 로딩
 * 카드가 한 프레임 스쳤다). 스플래시 최소 표시 시간 덕에 사용자가 탭을 누를 무렵엔 세 스토어가
 * 이미 메모리에 있고 첫 페인트가 곧 목록이다.
 *
 * ⚠️ **순차다. 병렬로 바꾸지 말 것.** 게이트가 캐시 신선도를 함께 보는데 그 값은 앞 회차가 캐시를
 * 다 쓴 뒤에야 참이 된다. 셋을 동시에 띄우면 셋 다 옛 `syncedAt` 을 보고 게이트를 통과해 같은
 * 응답을 세 번 받는다. 순서는 사용자가 실제로 밟는 순서다.
 */
const LOADERS: ReadonlyArray<() => Promise<{ loadTrackedOcids(): Promise<void> }>> = [
  async () => (await import('./content-scheduler/store')).useContentSchedulerStore.getState(),
  async () => (await import('./boss-scheduler/store')).useBossSchedulerStore.getState(),
  async () => (await import('./boss-profit/store')).useBossProfitStore.getState(),
]

// 실패해도 던지지 않는다. 이건 예열이지 부팅 절차가 아니다. 어떤 스토어가 넘어져도 나머지는
// 계속 예열하고, 사용자가 그 탭에 들어가면 화면이 평소대로 자기 몫을 다시 부른다(그때 실패하면
// 그 화면의 에러 경로가 정상적으로 돈다).
export async function prehydrateTabStores(): Promise<void> {
  for (const load of LOADERS) {
    try {
      await (await load()).loadTrackedOcids()
    } catch {
      // 예열 실패는 조용히 넘긴다. 화면 진입이 같은 경로를 다시 밟는다.
    }
  }
}
