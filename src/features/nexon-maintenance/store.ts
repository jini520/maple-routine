/**
 * 넥슨이 점검 중인가. 화면 맨 위의 점검 배너(`app/NexonMaintenanceBanner`)가 이것을 구독한다.
 *
 * **앱 전체에 하나다.** 점검은 화면이 아니라 넥슨의 사실이라, 한 화면이 받은 점검을 다른 화면도 말한다.
 * `nexon/http.ts` 가 점검 응답과 성공 응답을 알린다(`nexonMaintenanceReporter` 를 부팅이 꽂는다).
 */
import { create } from 'zustand'

import type { MaintenanceReporter } from '../../nexon/http'
import type { NexonMaintenanceScope } from '../../nexon/errors'

interface NexonMaintenanceState {
  /** 배너가 말할 점검. 점검이 아니거나 닫았으면 `null`. */
  scope: NexonMaintenanceScope | null
  /** 이번 점검 동안 배너를 닫는다. 점검이 끝난 뒤 다음 점검에는 다시 선다. */
  dismiss: () => void
}

/**
 * 메이플스토리 API 점검으로 막힌 경로. **이것이 다 비어야 메이플스토리 API 점검이 끝난 것이다.**
 *
 * `character/list` 처럼 메이플스토리 API 점검 중에도 200 인 경로가 있어서, 아무 성공으로나 내리면 점검 중에 배너가 사라진다.
 */
const gameBlockedPaths = new Set<string>()
/** Open API 점검. 모든 경로가 막히는 점검이라 어느 성공이든 끝을 뜻한다. */
let apiBlocked = false
/** 닫은 점검. 다른 점검이 오거나 점검이 끝나면 걷힌다. */
let dismissedScope: NexonMaintenanceScope | null = null

/** Open API 점검을 앞에 둔다. 더 넓게 막힌 쪽이다. */
function activeScope(): NexonMaintenanceScope | null {
  if (apiBlocked) return 'api'
  return gameBlockedPaths.size > 0 ? 'game' : null
}

function publish(): void {
  const active = activeScope()
  if (active === null) dismissedScope = null
  const scope = active === dismissedScope ? null : active
  // 성공 응답마다 불린다. 값이 같으면 안 써야 구독한 화면이 요청마다 다시 그려지지 않는다.
  if (useNexonMaintenanceStore.getState().scope !== scope) useNexonMaintenanceStore.setState({ scope })
}

export const useNexonMaintenanceStore = create<NexonMaintenanceState>()(() => ({
  scope: null,
  dismiss() {
    dismissedScope = activeScope()
    publish()
  },
}))

/** `nexon/http.ts` 에 꽂는 것. 부팅이 `setMaintenanceReporter` 로 넘긴다. */
export const nexonMaintenanceReporter: MaintenanceReporter = {
  maintenance(scope, path) {
    if (scope === 'api') apiBlocked = true
    else gameBlockedPaths.add(path)
    publish()
  },
  succeeded(path) {
    apiBlocked = false
    gameBlockedPaths.delete(path)
    publish()
  },
}

export function resetNexonMaintenanceForTest(): void {
  gameBlockedPaths.clear()
  apiBlocked = false
  dismissedScope = null
  useNexonMaintenanceStore.setState({ scope: null })
}
