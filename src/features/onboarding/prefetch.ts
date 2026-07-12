import { fetchCharacterBasic } from '../../nexon/character'
import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import { setCachedCharacterBasic } from '../../storage/character-basic-cache'
import { setCachedSchedulerState } from '../../storage/scheduler-cache'
import type { MapleCharacter } from '../../types'

export interface PrefetchProgress {
  completed: number
  total: number
}

// ADR-016: 온보딩 완료 직전 계정의 전체 캐릭터를 예열한다. 캐릭터별 파이프라인(character/basic →
// access_flag가 true인 경우만 scheduler/character-state)을 병렬로 돌리되, Promise.all로 결과를
// 한꺼번에 모아서 처리하지 않는다 — 각 파이프라인이 끝나는 대로 즉시 캐시에 쓰고 진행률을 보고한다.
// 개별 실패(네트워크·401·429 포함)는 그 캐릭터만 캐시 없이 넘어가고 나머지 진행을 막지 않는다.
export async function prefetchAccountData(
  apiKey: string,
  characters: MapleCharacter[],
  onProgress: (progress: PrefetchProgress) => void,
): Promise<void> {
  if (characters.length === 0) {
    onProgress({ completed: 0, total: 0 })
    return
  }

  const progress: PrefetchProgress = { completed: 0, total: characters.length * 2 }
  onProgress({ ...progress })

  function emit(delta: { completed: number; total?: number }): void {
    progress.completed += delta.completed
    if (delta.total !== undefined) {
      progress.total += delta.total
    }
    onProgress({ ...progress })
  }

  await Promise.all(
    characters.map(async (character) => {
      let profile
      try {
        profile = await fetchCharacterBasic(apiKey, character.ocid)
        await setCachedCharacterBasic(character.ocid, { profile, cachedAt: new Date().toISOString() })
      } catch {
        // 개별 실패 — 캐시 없이 넘어간다 (ADR-016)
        emit({ completed: 1, total: -1 })
        return
      }

      if (!profile.accessFlag) {
        emit({ completed: 1, total: -1 })
        return
      }

      emit({ completed: 1 })

      try {
        const state = await fetchSchedulerCharacterState(apiKey, character.ocid)
        await setCachedSchedulerState(character.ocid, { state, syncedAt: new Date().toISOString() })
      } catch {
        // 개별 실패 — 캐시 없이 넘어간다 (ADR-016)
      }
      emit({ completed: 1 })
    }),
  )
}
