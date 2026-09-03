import { getAuthConfig } from '../../storage/api-key'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import type { ResumableOnboardingStatus } from './state'

/** 재개 지점. 계정도 스케줄 관리 방법도 고르는 단계가 없어 실어 보낼 값이 없다. */
export type ResumeTarget =
  | { status: 'awaitingApiKey' }
  | { status: ResumableOnboardingStatus }
  | { status: 'completed' }

/**
 * 저장된 값에서 파생하는 재개 지점. 부팅(restoreFromStorage)과 키 재입력(submitApiKey) 두
 * 경로가 이 함수 하나를 공유한다. 두 벌이 되면 재개 규칙의 진실이 둘이 된다.
 *
 * 로컬 읽기뿐이다. 네트워크를 타지 않는다.
 *
 * `trackingMode` 는 읽지 않는다. 그 값의 `null` 과 `'auto'` 를 구분하던 곳이 여기 하나였고
 * (다른 소비처는 전부 `?? 'auto'` 로 흡수한다), 그 구분을 쓰던 단계가 없어졌다.
 */
export async function deriveResumeTarget(): Promise<ResumeTarget> {
  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    return { status: 'awaitingApiKey' }
  }

  const trackedOcids = await getTrackedCharacterOcids()

  // trackedCharacters가 빈 배열이면 미완료다. "최소 1명"이 있으므로 빈 배열은
  // 사용자 의도가 아니라 끝내지 않은 단계다(저장 레이어의 null vs [] 구분은 그대로 둔다).
  if (trackedOcids === null || trackedOcids.length === 0) {
    return { status: 'selectingContentCharacters' }
  }

  return { status: 'completed' }
}
