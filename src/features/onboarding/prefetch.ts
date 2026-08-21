import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import { setCachedSchedulerState } from '../../storage/scheduler-cache'
import { fetchCharacterBasicCached } from '../schedule-sync/character-basic-fetch'
import { resolveCharacterEligibility } from '../schedule-sync/character-eligibility'
import { markSyncAttemptedThisRun } from '../schedule-sync/sync-run-state'
import type { MapleCharacter } from '../../types'

export interface PrefetchProgress {
  completed: number
  total: number
}

// ADR-016: 온보딩 완료 직전 계정의 전체 캐릭터를 예열한다. 캐릭터별 파이프라인(character/basic →
// scheduler/character-state)을 병렬로 돌리되, Promise.all로 결과를 한꺼번에 모아서 처리하지 않는다 —
// 각 파이프라인이 끝나는 대로 즉시 캐시에 쓰고 진행률을 보고한다.
// 개별 실패(네트워크·401·429 포함)는 그 캐릭터만 캐시 없이 넘어가고 나머지 진행을 막지 않는다.
//
// ADR-086 결정 3·5: `access_flag: true` 인 캐릭터만 scheduler를 받던 게이트를 걷어냈다 — 계측
// (ADR-067)이 false여도 200임을 확인했으므로 그 게이트는 받을 수 있는 데이터를 안 받는 것이었다.
// 대신 후보 자격 판정을 여기서 함께 끝낸다. 자격이 미확인이면 과거 날짜를 거슬러 올라가며
// 활동 기록을 찾고, 그 관측이 조회 원장에 남아 이후 경로(피커·선채움)가 같은 날짜를 다시 부르지
// 않는다. 휴면 캐릭터 1명당 최대 13회가 더 들지만 **캐릭터당 평생 한 번**이다.
export async function prefetchAccountData(
  apiKey: string,
  accountId: string,
  characters: MapleCharacter[],
  onProgress: (progress: PrefetchProgress) => void,
): Promise<void> {
  if (characters.length === 0) {
    onProgress({ completed: 0, total: 0 })
    return
  }

  // ADR-097 결정 3: 예열도 이번 실행의 동기화로 친다. 여기서 계정 전체 캐릭터의 character/basic +
  // scheduler/character-state 를 받아 캐시에 쓰므로, 치지 않으면 온보딩 직후 첫 화면 진입이 방금
  // 받은 것을 그대로 다시 받는다.
  markSyncAttemptedThisRun()

  const now = new Date()
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
        // ADR-113 결정 1: 캐시 쓰기까지 공유 경로 안이다. 계정 선택 프로브가 방금 같은 캐릭터를
        // 받아 뒀으면(결정 2) 여기서는 네트워크가 나가지 않는다.
        profile = await fetchCharacterBasicCached(
          apiKey,
          accountId,
          character.ocid,
          now,
          character.jobClass,
        )
      } catch {
        // 개별 실패 — 캐시 없이 넘어간다 (ADR-016)
        emit({ completed: 1, total: -1 })
        return
      }

      emit({ completed: 1 })

      let todayState = null
      try {
        todayState = await fetchSchedulerCharacterState(apiKey, character.ocid)
        await setCachedSchedulerState(character.ocid, {
          state: todayState,
          syncedAt: new Date().toISOString(),
        })
      } catch {
        // 개별 실패 — 캐시 없이 넘어간다 (ADR-016)
      }

      // 오늘 응답을 넘겨 같은 호출을 두 번 하지 않는다(ADR-086 결정 5).
      await resolveCharacterEligibility(apiKey, character.ocid, profile.accessFlag, now, todayState)
      emit({ completed: 1 })
    }),
  )
}
