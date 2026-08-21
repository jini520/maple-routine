import { getAuthConfig } from '@core/storage/api-key'
import { getTrackedCharacterOcids } from '@core/storage/character-selection'
import { getTrackingMode, setTrackingMode } from '@core/storage/tracking-mode'
import { getOnboardingAccountScope } from './flow'
import type { ResumableOnboardingStatus } from './state'

/**
 * `selectedAccountId` 가 `string | null` 인 것은 **계정 범위 'all'(RN) 때문이다**([[ADR-143]]
 * 결정 8) — 그 앱은 계정을 고르지 않으므로 실을 값이 없다. `'single'` 에서는 여전히 문자열이
 * 보장되고, 그것을 지키는 것은 타입이 아니라 **분기**다: 그 범위에서 `null` 이면 아래에서
 * `selectingAccount` 로 돌아나가 이 변형에 도달하지 못한다.
 */
export type ResumeTarget =
  | { status: 'awaitingApiKey' }
  | { status: 'selectingAccount'; apiKey: string }
  | { status: ResumableOnboardingStatus; selectedAccountId: string | null }
  | { status: 'completed'; selectedAccountId: string | null }

/**
 * 저장된 값에서 재개 지점을 파생한다(ADR-086 결정 1). 부팅(restoreFromStorage)과 키 재입력
 * (submitApiKey) 두 경로가 이 함수 하나를 공유한다(ADR-115 결정 4) — 두 벌이 되면 재개 규칙의
 * 진실이 둘이 되는데, 그것이 결정 1이 진행 상태 전용 키를 거부한 바로 그 이유다.
 *
 * 뒤 두 단계 판정은 로컬 읽기뿐이다 — 예열(ADR-016)을 다시 돌리지 않는다. selectingAccount의
 * character/list 재조회는 스토어가 맡으므로 그 키를 타깃에 실어 보낸다.
 *
 * ADR-143 결정 8: 계정 범위가 'all'이면 표에서 **그 한 행만** 빠진다. 리듀서도 상태 이름도 손대지
 * 않는다 — `selectingAccount`·`prefetching`은 그 앱에서 도달할 수 없는 상태가 될 뿐이다.
 */
export async function deriveResumeTarget(): Promise<ResumeTarget> {
  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    return { status: 'awaitingApiKey' }
  }

  if (getOnboardingAccountScope() === 'single' && authConfig.selectedAccountId === null) {
    return { status: 'selectingAccount', apiKey: authConfig.apiKey }
  }

  // 'all'에서는 읽지 않는 값이지만(ADR-143 결정 7) 저장돼 있으면 있는 그대로 싣는다 — 웹뷰 앱을
  // 쓰다 넘어온 설치본에는 남아 있고, 지어내지도 지우지도 않는 것이 그 결정의 태도다.
  const selectedAccountId = authConfig.selectedAccountId
  const [trackingMode, trackedOcids] = await Promise.all([
    getTrackingMode(),
    getTrackedCharacterOcids(),
  ])
  const hasTrackedCharacters = trackedOcids !== null && trackedOcids.length > 0

  // ADR-086 결정 2 마이그레이션(1회): ADR-035 이전 설치본에서 완주한 사용자는 trackingMode
  // 키가 없다 — 그대로 두면 정상 사용자가 온보딩으로 되돌려진다.
  if (trackingMode === null && hasTrackedCharacters) {
    await setTrackingMode('auto')
    return { status: 'completed', selectedAccountId }
  }

  if (trackingMode === null) {
    return { status: 'selectingTrackingMode', selectedAccountId }
  }

  // trackedCharacters가 빈 배열이면 미완료다 — "최소 1명"(ADR-086 결정 7)이 있으므로 빈 배열은
  // 사용자 의도가 아니라 끝내지 않은 단계다(저장 레이어의 null vs [] 구분은 그대로 둔다).
  if (!hasTrackedCharacters) {
    return { status: 'selectingContentCharacters', selectedAccountId }
  }

  return { status: 'completed', selectedAccountId }
}
