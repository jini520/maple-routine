import { getAuthConfig } from '../../storage/api-key'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getMvpOnboardingPending } from '../../storage/mvp-grade-prefs'

/**
 * 온보딩을 어디까지 끝냈는가.
 *
 * `ready` 만 탭과 하위 페이지 전체를 연다. 그 앞이면 온보딩 화면 넷이 한 스택에 쌓이고, 이 값은 부팅 때 그 스택을
 * 어디까지 다시 놓을지를 정한다. 앞으로 가는 것은 화면이 다음 화면을 밀어서 한다.
 */
export type EntryStage = 'signIn' | 'characterSetup' | 'mvpGrade' | 'ready'

/**
 * 저장된 값에서 진입 단계를 파생한다. 부팅과 로그인 직후 두 경로가 이 함수 하나를 공유한다.
 * 두 벌이 되면 규칙의 진실이 둘이 된다.
 *
 * 로컬 읽기뿐이다. 네트워크를 타지 않는다.
 *
 * 진행 상태 전용 키를 두지 않는 것은 각 단계의 산출물이 이미 영속화돼 있어서다. 따로 쓰면 진실이
 * 둘이 되고 한쪽만 써진 채 앱이 죽는 순간 어긋난다.
 */
export async function deriveEntryStage(): Promise<EntryStage> {
  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    return 'signIn'
  }

  const trackedOcids = await getTrackedCharacterOcids()

  // trackedCharacters가 빈 배열이면 미완료다. "최소 1명"이 있으므로 빈 배열은
  // 사용자 의도가 아니라 끝내지 않은 단계다(저장 레이어의 null vs [] 구분은 그대로 둔다).
  if (trackedOcids === null || trackedOcids.length === 0) {
    return 'characterSetup'
  }

  // MVP 단계만 전용 표시로 되살린다. 산출물(등급 이력)이 없는 것만으로는 온보딩 중인 사용자와 업데이트한 기존
  // 사용자를 못 가른다. 기존 사용자는 today 위 모달로 묻는다.
  if (await getMvpOnboardingPending()) {
    return 'mvpGrade'
  }

  return 'ready'
}
