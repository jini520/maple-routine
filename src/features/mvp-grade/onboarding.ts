import { getCharacterAccountSightings } from '../../storage/character-accounts'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getMvpGradeHistories } from '../../storage/mvp-grades'
import { trackedAccountIdsOf } from './accounts'

/**
 * 캐릭터 설정을 마친 온보딩이 MVP 등급 화면으로 갈지. 추적 캐릭터가 속한 메이플 ID 가운데 등급 이력이 없는 것이 있으면 간다.
 * 다 있으면(캐시를 지운 뒤 다시 온보딩하는 사용자) 곧장 앱을 연다.
 */
export async function needsMvpOnboarding(): Promise<boolean> {
  const [tracked, sightings, histories] = await Promise.all([
    getTrackedCharacterOcids(),
    getCharacterAccountSightings(),
    getMvpGradeHistories(),
  ])
  return trackedAccountIdsOf(tracked, sightings).some((accountId) => (histories.get(accountId)?.length ?? 0) === 0)
}
