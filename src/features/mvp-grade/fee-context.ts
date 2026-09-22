import type { FeeRateContext } from '../../lib/mvp/fees'
import { getCharacterAccountSightings } from '../../storage/character-accounts'
import { getRepresentativeCharacter, getTrackedCharacterOcids } from '../../storage/character-selection'
import { getMvpGradeHistories } from '../../storage/mvp-grades'

export interface LoadedFeeContext extends FeeRateContext {
  /** 캐릭터 없는 옛 수입 기록이 쓰는 캐릭터. 대표가 목록에서 빠졌으면 추적 목록의 첫 캐릭터 */
  fallbackOcid: string | null
}

/** 자동 수수료를 셀 때 읽는 것 전부. 등급 이력 · 캐릭터 소속 · 대표 캐릭터. */
export async function loadFeeContext(): Promise<LoadedFeeContext> {
  const [histories, sightings, representative, trackedOcids] = await Promise.all([
    getMvpGradeHistories(),
    getCharacterAccountSightings(),
    getRepresentativeCharacter(),
    getTrackedCharacterOcids(),
  ])
  return { histories, sightings, fallbackOcid: representative ?? trackedOcids?.[0] ?? null }
}
