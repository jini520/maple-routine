import type { CacheDataGroupId, CacheDataSelection } from '../../storage/cache-data'
import { clearCacheData, getCacheDataSizes } from '../../storage/cache-data'
import { setPendingNotice } from '../../storage/pending-notice'
import { closeBossProfitDb } from '../../storage/sqlite/db'
import { showSplashScreen } from '../../native/splash-screen'

// 캐시 데이터 삭제의 오케스트레이션. 화면에서 이리로 옮겼다.
//
// 화면이 `storage/cache-data`·`storage/pending-notice`·`storage/sqlite/db`·`native/splash-screen`
// 을 직접 부르고 있었다. 화면은 `features/` 를 거치고 저장소·네이티브 접근은 어댑터가 맡는다.
// 화면에는 UI 상태(모달 열림·삭제 중·용량 표시)만 남는다.

/** 삭제가 끝나지 않아도(hang) 모달이 "삭제 중"에 갇히지 않도록 경쟁시키는 상한. */
const CLEAR_TIMEOUT_MS = 10_000

export type CacheDataSizes = Record<CacheDataGroupId, number>

/** 그룹별 캐시 용량. 실패는 호출부가 자리표시(`- KB`)로 처리하도록 그대로 던진다. */
export async function loadCacheDataSizes(): Promise<CacheDataSizes> {
  return getCacheDataSizes()
}

/**
 * 선택한 그룹을 지우고 앱을 다시 띄운다.
 *
 * **항상 리로드한다**. 실패·타임아웃이어도. 지운 데이터가 화면 곳곳에 이미 반영돼 있어,
 * 어중간한 상태로 두는 것이 더 나쁘다.
 *
 * @param reload 리로드 실행부. 테스트가 주입할 수 있게 인자로 받는다.
 */
export async function clearCacheDataAndReload(
  selection: CacheDataSelection,
  reload: () => void,
): Promise<void> {
  // 실패를 삼키지 않는다. 다만 리로드가 화면 신호를 파괴하므로 여기서 토스트를 띄울 수 없다.
  // 플래그를 남기고 부팅 후에 띄운다. 타임아웃(응답 없음)도 삭제됐는지 알 수 없으므로 같이 알린다.
  const outcome = await Promise.race([
    clearCacheData(selection).then(
      () => 'ok' as const,
      () => 'failed' as const,
    ),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), CLEAR_TIMEOUT_MS)),
  ])
  if (outcome !== 'ok') {
    setPendingNotice('cacheClearFailed')
  }
  // 리로드가 JS 컨텍스트를 파괴하기 전에 SQLite 커넥션을 먼저 정상 종료한다. 안 그러면 네이티브
  // 쪽에 stale 커넥션이 남아 리로드 후 보스 수익 과거 기간 조회가 실패한다. 닫기는 던지지 않고
  // 5초 안에 끝난다.
  await closeBossProfitDb()
  // 리로드 동안 네이티브 배경색이 깜빡 드러나므로 앱 실행 때처럼 스플래시로 덮고 리로드한다.
  // 리로드된 앱의 부팅 흐름이 스플래시를 내린다. 실패해도 리로드는 진행한다.
  //
  // 커버가 닫기 뒤인 것이 이 순서의 요점이다. 먼저 올리면 닫기가 매달리는 동안 사용자가 브랜드
  // 주황 화면에 갇히고 그 화면에서는 터치도 죽는다.
  await showSplashScreen().catch(() => {})
  reload()
}
