import type { CacheDataGroupId, CacheDataSelection } from '../../storage/cache-data'
import { clearCacheData, getCacheDataSizes } from '../../storage/cache-data'
import { setPendingNotice } from '../../storage/pending-notice'
import { closeBossProfitDb } from '../../storage/sqlite/db'
import { showSplashScreen } from '../../native/splash-screen'

// 캐시 데이터 삭제의 **오케스트레이션** — 화면에서 이리로 옮겼다(ADR-094 결정 6).
//
// 원래 `app/settings/CacheDataSection.tsx` 가 `storage/cache-data` · `storage/pending-notice` ·
// `storage/sqlite/db` · `native/splash-screen` 을 직접 불렀다. CLAUDE.md 의 CRITICAL 규칙과
// [[ADR-003]]·[[ADR-005]] 가 정한 레이어(화면은 `features/` 를 거치고, 저장소·네이티브 접근은
// 어댑터가 맡는다)를 어기는 유일하게 남은 자리였다 — 다른 `app/*` → `storage/` import 는 전부
// type-only 라 무해하다.
//
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
 * **항상 리로드한다** — 실패·타임아웃이어도. 지운 데이터가 화면 곳곳에 이미 반영돼 있어,
 * 어중간한 상태로 두는 것이 더 나쁘다.
 *
 * @param reload 리로드 실행부. 테스트가 주입할 수 있게 인자로 받는다.
 */
export async function clearCacheDataAndReload(
  selection: CacheDataSelection,
  reload: () => void,
): Promise<void> {
  // ADR-065 결정 3: 실패를 더는 삼키지 않는다. 다만 리로드가 화면 신호를 파괴하므로 여기서
  // 토스트를 띄울 수 없다 — 플래그를 남기고 부팅 후에 띄운다. 타임아웃(응답 없음)도 삭제됐는지
  // 알 수 없으므로 같이 알린다(타임아웃과 실패를 구분하는 안은 채택하지 않았다).
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
  // 리로드가 JS 컨텍스트를 파괴하기 전에 SQLite 커넥션을 먼저 정상 종료한다 — 안 그러면
  // OTA 적용(native/live-update.ts)과 같은 이유로 네이티브 쪽에 stale 커넥션이 남아, 리로드
  // 후 보스 수익 과거 기간 조회가 "이 기간을 불러오지 못했습니다"로 실패한다(사용자 보고).
  // 닫기는 던지지 않고 5초 안에 끝난다(ADR-117 결정 5) — 여기서 또 감싸지 않는다.
  await closeBossProfitDb()
  // 리로드 동안 웹뷰 네이티브 배경색(브랜드 주황)이 깜빡 드러나므로, 앱 실행 때처럼 스플래시로
  // 덮고 리로드한다 — 리로드된 앱의 부팅 흐름이 스플래시를 내린다. 실패해도 리로드는 진행.
  //
  // 커버가 닫기 **뒤**인 것이 이 순서의 요점이다(ADR-117 결정 8). 먼저 올리면 닫기가 매달리는
  // 동안 사용자가 브랜드 주황 화면에 갇히고 그 화면에서는 터치도 죽는다 — 이슈 #175(OTA 적용)와
  // 증상이 같고 트리거만 다른 두 번째 문이었다. 커버가 떠 있는 구간을 실제 리로드 직전으로 좁혀
  // 그 문을 닫는다. native/live-update.ts 의 applyDownloadedLiveUpdate 와 같은 순서다.
  await showSplashScreen().catch(() => {})
  reload()
}
