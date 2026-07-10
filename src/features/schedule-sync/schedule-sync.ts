import { fetchCharacterList, fetchSchedulerCharacterState } from '../../nexon/client'
import { NexonAuthError, NexonRateLimitError } from '../../nexon/errors'
import { getAuthConfig } from '../../storage/api-key'
import { getCachedSchedulerState, setCachedSchedulerState } from '../../storage/scheduler-cache'
import type { MapleCharacter, SchedulerCharacterState } from '../../types'

export type ScheduleSyncError =
  | { kind: 'invalidApiKey' } // 401/403
  | { kind: 'rateLimited' } // 429
  | { kind: 'network' } // 그 외 네트워크/파싱 실패

export interface CharacterScheduleSync {
  ocid: string
  characterName: string
  state: SchedulerCharacterState | null
  syncedAt: string | null
  isStale: boolean
  error: ScheduleSyncError | null
}

function toScheduleSyncError(error: unknown): ScheduleSyncError {
  if (error instanceof NexonAuthError) {
    return { kind: 'invalidApiKey' }
  }
  if (error instanceof NexonRateLimitError) {
    return { kind: 'rateLimited' }
  }
  return { kind: 'network' }
}

async function resolveRegisteredCharacters(): Promise<{
  apiKey: string
  characters: MapleCharacter[]
}> {
  const authConfig = await getAuthConfig()
  if (authConfig === null || authConfig.selectedAccountId === null) {
    throw new Error(
      'getRegisteredCharacters: 온보딩이 완료되지 않았습니다 (API 키 또는 선택된 계정 없음)',
    )
  }

  const accounts = await fetchCharacterList(authConfig.apiKey)
  const account = accounts.find((candidate) => candidate.accountId === authConfig.selectedAccountId)
  if (account === undefined) {
    throw new Error('getRegisteredCharacters: 선택된 계정을 찾을 수 없습니다')
  }

  return { apiKey: authConfig.apiKey, characters: account.characters }
}

export async function getRegisteredCharacters(): Promise<MapleCharacter[]> {
  const { characters } = await resolveRegisteredCharacters()
  return characters
}

async function buildFallbackResult(
  character: MapleCharacter,
  error: ScheduleSyncError,
): Promise<CharacterScheduleSync> {
  const cached = await getCachedSchedulerState(character.ocid)
  return {
    ocid: character.ocid,
    characterName: character.name,
    state: cached?.state ?? null,
    syncedAt: cached?.syncedAt ?? null,
    isStale: true,
    error,
  }
}

// ADR-008: 키 무효(401/403)·rate limit(429)은 모든 캐릭터에 동일하게 적용되는 전역 실패라
// 첫 캐릭터에서 발생하면 이후 캐릭터는 API를 더 호출하지 않고 캐시 폴백만 수행한다.
// 그 외 네트워크 실패는 캐릭터마다 독립적으로 처리해 다음 캐릭터 조회를 막지 않는다.
export async function syncAllSchedules(): Promise<CharacterScheduleSync[]> {
  const { apiKey, characters } = await resolveRegisteredCharacters()

  const results: CharacterScheduleSync[] = []
  let globalError: ScheduleSyncError | null = null

  for (const character of characters) {
    if (globalError !== null) {
      results.push(await buildFallbackResult(character, globalError))
      continue
    }

    try {
      const state = await fetchSchedulerCharacterState(apiKey, character.ocid)
      const syncedAt = new Date().toISOString()
      await setCachedSchedulerState(character.ocid, { state, syncedAt })
      results.push({
        ocid: character.ocid,
        characterName: character.name,
        state,
        syncedAt,
        isStale: false,
        error: null,
      })
    } catch (error) {
      const scheduleError = toScheduleSyncError(error)
      if (error instanceof NexonAuthError || error instanceof NexonRateLimitError) {
        globalError = scheduleError
      }
      results.push(await buildFallbackResult(character, scheduleError))
    }
  }

  return results
}
