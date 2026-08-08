import { getAuthConfig } from '../../storage/api-key'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getTrackingMode, setTrackingMode } from '../../storage/tracking-mode'
import type { ResumableOnboardingStatus } from './state'

export type ResumeTarget =
  | { status: 'awaitingApiKey' }
  | { status: 'selectingAccount'; apiKey: string }
  | { status: ResumableOnboardingStatus; selectedAccountId: string }
  | { status: 'completed'; selectedAccountId: string }

/**
 * 저장된 값에서 재개 지점을 파생한다(ADR-086 결정 1). 부팅(restoreFromStorage)과 키 재입력
 * (submitApiKey) 두 경로가 이 함수 하나를 공유한다(ADR-115 결정 4) — 두 벌이 되면 재개 규칙의
 * 진실이 둘이 되는데, 그것이 결정 1이 진행 상태 전용 키를 거부한 바로 그 이유다.
 *
 * 뒤 두 단계 판정은 로컬 읽기뿐이다 — 예열(ADR-016)을 다시 돌리지 않는다. selectingAccount의
 * character/list 재조회는 스토어가 맡으므로 그 키를 타깃에 실어 보낸다.
 */
export async function deriveResumeTarget(): Promise<ResumeTarget> {
  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    return { status: 'awaitingApiKey' }
  }

  if (authConfig.selectedAccountId === null) {
    return { status: 'selectingAccount', apiKey: authConfig.apiKey }
  }

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
