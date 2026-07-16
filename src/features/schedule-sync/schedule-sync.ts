import { fetchCharacterBasic, fetchCharacterList } from '../../nexon/character'
import { NexonAuthError, NexonRateLimitError } from '../../nexon/errors'
import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import { compareByName } from '../onboarding/representative-character'
import { getAuthConfig } from '../../storage/api-key'
import {
  getAllCachedCharacterBasicOcids,
  getCachedCharacterBasic,
  setCachedCharacterBasic,
} from '../../storage/character-basic-cache'
import { getCachedSchedulerState, setCachedSchedulerState } from '../../storage/scheduler-cache'
import type { CharacterPickerEntry, MapleCharacter, SchedulerCharacterState } from '../../types'

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

function sortPickerEntries(entries: CharacterPickerEntry[]): CharacterPickerEntry[] {
  return [...entries].sort((a, b) => (b.level !== a.level ? b.level - a.level : compareByName(a.name, b.name)))
}

// ADR-016: 캐시 우선 표시(Stale-While-Revalidate) — 캐시가 있으면 즉시 그 값으로 첫 onUpdate를
// 호출해 화면을 비우지 않고, 그 뒤 character/basic을 캐릭터별로 병렬 호출해 하나씩 끝나는 대로
// (Promise.all로 뭉쳐 기다리지 않고) 값을 patch하며 onUpdate를 다시 호출한다. 401/429는 전역
// 실패로 보고 던지고, 그 외 개별 실패는 이미 있던 값(캐시 또는 character/list)을 그대로 둔다.
export async function getCharacterPickerRoster(
  onUpdate: (entries: CharacterPickerEntry[]) => void,
): Promise<void> {
  // ADR-017 결정 6 (2026-07-12 재수정): character/list는 캐싱하지 않으므로(개명·전직·레벨업
  // 정확성 우선, ADR 2026-07-11 정정) 이 함수가 열릴 때마다 그 네트워크 응답을 기다려야 한다.
  // 그동안 character-basic-cache에 이미 있는 캐릭터는(추적 여부 무관 — 온보딩 예열이 계정
  // 전체 캐릭터를 채워둔다, ADR-016) 전부 즉시 후보 목록에 채워, 피커를 열 때마다 아직
  // 캐싱되지 않은 캐릭터를 뺀 나머지가 잠깐씩 비어 보이던 문제를 없앤다. character/list
  // 응답이 도착하면(계정 전체 캐릭터 기준) 아래 기존 흐름이 그대로 이어져 최신 값으로
  // 교체한다 — 그 사이 개명되거나 삭제된 캐릭터가 있었다면 여기서 바로잡힌다(이 stub
  // 단계는 잠깐의 근사치일 뿐이다).
  const cachedOcids = await getAllCachedCharacterBasicOcids()
  if (cachedOcids.length > 0) {
    const stubEntries = (
      await Promise.all(
        cachedOcids.map(async (ocid): Promise<CharacterPickerEntry | null> => {
          const cached = await getCachedCharacterBasic(ocid)
          if (cached === null || !cached.profile.accessFlag) {
            return null
          }
          return {
            ocid,
            name: cached.profile.name,
            level: cached.profile.level,
            imageUrl: cached.profile.imageUrl,
            world: cached.profile.world,
          }
        }),
      )
    ).filter((entry): entry is CharacterPickerEntry => entry !== null)

    if (stubEntries.length > 0) {
      onUpdate(sortPickerEntries(stubEntries))
    }
  }

  const { apiKey, characters } = await resolveRegisteredCharacters()
  if (characters.length === 0) {
    onUpdate([])
    return
  }

  const liveEntries = new Map<string, CharacterPickerEntry>()

  await Promise.all(
    characters.map(async (character) => {
      const cached = await getCachedCharacterBasic(character.ocid)
      if (cached === null) {
        liveEntries.set(character.ocid, {
          ocid: character.ocid,
          name: character.name,
          level: character.level,
          imageUrl: null,
          world: character.world,
        })
      } else if (cached.profile.accessFlag) {
        liveEntries.set(character.ocid, {
          ocid: character.ocid,
          name: cached.profile.name,
          level: cached.profile.level,
          imageUrl: cached.profile.imageUrl,
          world: character.world,
        })
      }
      // cached !== null && !accessFlag: 캐시상 비공개로 알려진 캐릭터는 초기 렌더에서부터 제외
    }),
  )
  onUpdate(sortPickerEntries(Array.from(liveEntries.values())))

  let globalError: unknown = null

  await Promise.all(
    characters.map(async (character) => {
      if (globalError !== null) {
        return
      }

      try {
        const profile = await fetchCharacterBasic(apiKey, character.ocid)
        await setCachedCharacterBasic(character.ocid, { profile, cachedAt: new Date().toISOString() })
        if (profile.accessFlag) {
          liveEntries.set(character.ocid, {
            ocid: character.ocid,
            name: profile.name,
            level: profile.level,
            imageUrl: profile.imageUrl,
            world: character.world,
          })
        } else {
          liveEntries.delete(character.ocid)
        }
        onUpdate(sortPickerEntries(Array.from(liveEntries.values())))
      } catch (error) {
        if (error instanceof NexonAuthError || error instanceof NexonRateLimitError) {
          globalError = error
          return
        }
        // 개별 실패 — 이미 있던 값(캐시 또는 character/list)을 그대로 유지
      }
    }),
  )

  if (globalError !== null) {
    throw globalError
  }
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
//
// ocids로 지정된 캐릭터만 동기화한다 — 계정의 전체 캐릭터를 대상으로 순차 호출하면
// 추적 대상이 아닌 캐릭터까지 불필요하게 호출하게 되어 로딩이 느려진다.
export async function syncSchedules(
  ocids: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<CharacterScheduleSync[]> {
  if (ocids.length === 0) {
    return []
  }

  const { apiKey, characters } = await resolveRegisteredCharacters()
  const targetCharacters = characters.filter((character) => ocids.includes(character.ocid))
  const total = targetCharacters.length

  const results: CharacterScheduleSync[] = []
  let globalError: ScheduleSyncError | null = null

  onProgress?.(0, total)

  for (const character of targetCharacters) {
    if (globalError !== null) {
      results.push(await buildFallbackResult(character, globalError))
      onProgress?.(results.length, total)
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
    onProgress?.(results.length, total)
  }

  return results
}
