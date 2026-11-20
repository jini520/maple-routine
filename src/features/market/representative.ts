/**
 * 소비 월드 고르개의 처음 값이 쓰는 대표 캐릭터의 월드. 앱의 대표 캐릭터 하나다(today 맨 위 위젯 · 머리 얼굴의 캐릭터).
 * 메이플 ID 가 여럿이어도 그 하나라 고를 것이 없다. 대표를 안 골랐으면 today 처럼 추적 목록의 첫 캐릭터다.
 */
import { resolveDisplayRepresentative } from '../character-manage/derivations'
import { useCharacterSelectionStore } from '../character-selection/store'
import { useCharacterProfiles, useTrackedOcids } from '../schedule-sync/use-schedule-queries'

/** 월드 key. 대표 캐릭터가 없거나 그 프로필을 아직 모르면 `null` */
export function useRepresentativeWorldKey(): string | null {
  const trackedOcids = useTrackedOcids()
  const profiles = useCharacterProfiles()
  const stored = useCharacterSelectionStore((state) => state.representativeOcid)
  const ocid = resolveDisplayRepresentative(trackedOcids ?? [], stored)
  return ocid === null ? null : (profiles[ocid]?.worldKey ?? null)
}
