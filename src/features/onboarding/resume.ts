import { getAuthConfig } from '../../storage/api-key'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getTrackingMode, setTrackingMode } from '../../storage/tracking-mode'
import type { ResumableOnboardingStatus } from './state'

/** 재개 지점. 계정을 고르는 단계가 없으므로 실어 보낼 계정 값도 없다. */
export type ResumeTarget =
  | { status: 'awaitingApiKey' }
  | { status: ResumableOnboardingStatus }
  | { status: 'completed' }

/**
 * 저장된 값에서 재개 지점을 파생한다(ADR-086 결정 1). 부팅(restoreFromStorage)과 키 재입력
 * (submitApiKey) 두 경로가 이 함수 하나를 공유한다(ADR-115 결정 4). 두 벌이 되면 재개 규칙의
 * 진실이 둘이 되는데, 그것이 결정 1이 진행 상태 전용 키를 거부한 바로 그 이유다.
 *
 * 뒤 두 단계 판정은 로컬 읽기뿐이다. 네트워크를 타지 않는다.
 *
 * ADR-143 결정 7: 계정 선택 단계가 없으므로 재개 표에서 그 행이 빠졌다.
 */
export async function deriveResumeTarget(): Promise<ResumeTarget> {
  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    return { status: 'awaitingApiKey' }
  }

  const [trackingMode, trackedOcids] = await Promise.all([
    getTrackingMode(),
    getTrackedCharacterOcids(),
  ])
  const hasTrackedCharacters = trackedOcids !== null && trackedOcids.length > 0

  // ADR-086 결정 2 마이그레이션(1회): ADR-035 이전 설치본에서 완주한 사용자는 trackingMode
  // 키가 없다. 그대로 두면 정상 사용자가 온보딩으로 되돌려진다.
  if (trackingMode === null && hasTrackedCharacters) {
    await setTrackingMode('auto')
    return { status: 'completed' }
  }

  if (trackingMode === null) {
    return { status: 'selectingTrackingMode' }
  }

  // trackedCharacters가 빈 배열이면 미완료다. "최소 1명"(ADR-086 결정 7)이 있으므로 빈 배열은
  // 사용자 의도가 아니라 끝내지 않은 단계다(저장 레이어의 null vs [] 구분은 그대로 둔다).
  if (!hasTrackedCharacters) {
    return { status: 'selectingContentCharacters' }
  }

  return { status: 'completed' }
}
