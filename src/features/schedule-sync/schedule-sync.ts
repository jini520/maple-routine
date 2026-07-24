import { fetchCharacterBasic, fetchCharacterList } from '../../nexon/character'
import { NexonAuthError, NexonRateLimitError } from '../../nexon/errors'
import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import { mergeSchedulerState, type MergeOutput } from '../../lib/scheduler-merge'
import { getShareScope } from '../../lib/scheduler-content-scope'
import { getBackfillDateKeys } from '../../lib/reset-clock'
import { compareByName } from '../onboarding/representative-character'
import { getAuthConfig } from '../../storage/api-key'
import {
  getAllCachedCharacterBasicOcids,
  getCachedCharacterBasic,
  setCachedCharacterBasic,
} from '../../storage/character-basic-cache'
import { getCachedSchedulerState, setCachedSchedulerState } from '../../storage/scheduler-cache'
import {
  getAccountSharedProgress,
  getWorldSharedProgress,
  setAccountSharedProgressEntry,
  setWorldSharedProgressEntry,
} from '../../storage/shared-progress-cache'
import type { CharacterPickerEntry, MapleCharacter, SchedulerCharacterState, SharedProgressEntry } from '../../types'

export type ScheduleSyncError =
  | { kind: 'invalidApiKey' } // 401/403
  | { kind: 'rateLimited' } // 429
  | { kind: 'network' } // 그 외 네트워크/파싱 실패

export interface CharacterScheduleSync {
  ocid: string
  characterName: string
  // 스케줄러 드롭다운의 월드 엠블럼 표시용. character/list의 world를 그대로 담는다.
  world?: string
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
  accountId: string
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

  return { apiKey: authConfig.apiKey, accountId: authConfig.selectedAccountId, characters: account.characters }
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
    world: character.world,
    state: cached?.state ?? null,
    syncedAt: cached?.syncedAt ?? null,
    isStale: true,
    error,
  }
}

// ADR-034 추가 정정(2026-07-25): daily/weekly 섹션이 "완전히 비었는지(isXStale = length 0)"만으로는
// 부족하다 — 콜드 스타트에서 당일 응답이 월드공유 항목(몬스터파크)만 남기고 character 범위 항목을
// 통째로 누락시키면 length가 1이라 isDailyStale이 false가 되고, 로컬 캐시도 없어 항목 단위 병합이
// 복원할 previous가 없다. 그래서 "그 섹션에 character 범위 항목이 하나라도 있는가"로 stale을 판정한다.
// 캐릭터가 동기화되면 daily/weekly엔 항상 자기 범위 항목(일일/주간 퀘스트 등)이 들어오므로,
// 공유 항목만 남았으면 이 캐릭터의 그 섹션은 아직 신뢰할 수 없다는 뜻이다.
function hasCharacterScopeItem(items: { name: string }[]): boolean {
  return items.some((item) => getShareScope(item.name) === 'character')
}

// isXStale(완전 비었을 때)은 그대로 살리고, 비지 않았어도 character 범위 항목이 하나도 없으면
// 부분 누락으로 본다. length === 0이면 isXStale이 이미 잡으므로 두 번째 항은 length > 0에서만 의미가
// 있다 — 테스트 스텁처럼 dailyContents가 빈 배열인데 isDailyStale이 명시적으로 false인 상태를
// "누락"으로 오판하지 않도록 length 가드를 둔다.
function isDailySectionMissing(state: SchedulerCharacterState): boolean {
  return state.isDailyStale || (state.dailyContents.length > 0 && !hasCharacterScopeItem(state.dailyContents))
}

function isWeeklySectionMissing(state: SchedulerCharacterState): boolean {
  return state.isWeeklyStale || (state.weeklyContents.length > 0 && !hasCharacterScopeItem(state.weeklyContents))
}

// ADR-034 정정(2026-07-23) + 추가 정정(2026-07-25): 4개 섹션(daily/weekly/weeklyBoss/monthlyBoss) 중
// 하나라도 stale이면(리셋 이후 미접속) 과거 날짜 조회로 항목 단위 선채움을 시도한다. daily/weekly는
// character 범위 항목 유무로 stale을 판정한다.
function needsBackfill(state: SchedulerCharacterState): boolean {
  return (
    isDailySectionMissing(state) ||
    isWeeklySectionMissing(state) ||
    state.isWeeklyBossStale ||
    state.isMonthlyBossStale
  )
}

// ADR-034 정정(2026-07-23): 당일 응답에서 stale이었던 섹션을, [[getBackfillDateKeys]]가 주는
// 날짜(평소 -1일부터, 자정 직후 불안정 구간엔 -2일부터) 목록을 하루씩 순서대로 조회하며
// 항목(이름 또는 이름+난이도) 단위로 채운다. 각 날짜 응답을 previous로 삼아
// mergeSchedulerState(ADR-030 + ADR-034 항목 단위 정정)를 한 번씩 더 태우되, world/account
// 원장은 이 루프의 범위 밖이라( previous가 아니라 "마지막 활성 캐릭터" 오염을 피하려 원장을
// 신뢰해야 하므로, ADR-030) 4개 플래그를 모두 true로 강제해 character 범위 항목 병합만
// 일어나게 한다. 그 날짜 응답 자체가(원래 stale이었던 섹션 기준으로) 더 이상 stale이
// 아니면 그 시점에 멈추고, 끝까지 못 찾으면 -13일까지 다 써보고 그동안 누적된 결과를
// best-effort로 그대로 쓴다. 특정 날짜 조회가 실패해도(네트워크 등) 그 날짜만 건너뛰고
// 다음 날짜로 계속한다.
async function fillMissingSections(
  apiKey: string,
  ocid: string,
  stage1: MergeOutput,
  worldLedger: Record<string, SharedProgressEntry>,
  accountLedger: Record<string, SharedProgressEntry>,
  now: Date,
): Promise<MergeOutput> {
  if (!needsBackfill(stage1.characterState)) {
    return stage1
  }

  const originallyStale = {
    daily: isDailySectionMissing(stage1.characterState),
    weekly: isWeeklySectionMissing(stage1.characterState),
    weeklyBoss: stage1.characterState.isWeeklyBossStale,
    monthlyBoss: stage1.characterState.isMonthlyBossStale,
  }
  const mergedWorldLedger = { ...worldLedger, ...stage1.worldLedgerUpdates }
  const mergedAccountLedger = { ...accountLedger, ...stage1.accountLedgerUpdates }

  let acc = stage1

  for (const dateKey of getBackfillDateKeys(now)) {
    let dayResponse: SchedulerCharacterState
    try {
      dayResponse = await fetchSchedulerCharacterState(apiKey, ocid, dateKey)
    } catch {
      continue
    }

    const dayMerge = mergeSchedulerState({
      previous: dayResponse,
      fresh: {
        ...acc.characterState,
        isDailyStale: true,
        isWeeklyStale: true,
        isWeeklyBossStale: true,
        isMonthlyBossStale: true,
      },
      worldLedger: mergedWorldLedger,
      accountLedger: mergedAccountLedger,
      now,
    })

    acc = {
      characterState: dayMerge.characterState,
      worldLedgerUpdates: { ...acc.worldLedgerUpdates, ...dayMerge.worldLedgerUpdates },
      accountLedgerUpdates: { ...acc.accountLedgerUpdates, ...dayMerge.accountLedgerUpdates },
    }

    const resolved =
      (!originallyStale.daily || !isDailySectionMissing(dayResponse)) &&
      (!originallyStale.weekly || !isWeeklySectionMissing(dayResponse)) &&
      (!originallyStale.weeklyBoss || !dayResponse.isWeeklyBossStale) &&
      (!originallyStale.monthlyBoss || !dayResponse.isMonthlyBossStale)

    if (resolved) {
      break
    }
  }

  return acc
}

// ADR-030: fetch 자체는 성공했지만 캐릭터가 리셋 이후 미접속이라 daily/weekly/boss 섹션이
// 비어있을 수 있고, 몬스터파크·에픽 던전처럼 월드/계정 전체가 공유하는 콘텐츠도 있다 — 이 두
// 문제를 mergeSchedulerState(순수 함수, lib/scheduler-merge)가 흡수한 "실효 상태"를 캐싱·반환한다.
async function syncOneCharacter(
  apiKey: string,
  character: MapleCharacter,
  accountId: string,
): Promise<CharacterScheduleSync> {
  try {
    const fresh = await fetchSchedulerCharacterState(apiKey, character.ocid)
    const [previousCache, worldLedger, accountLedger] = await Promise.all([
      getCachedSchedulerState(character.ocid),
      getWorldSharedProgress(fresh.world),
      getAccountSharedProgress(accountId),
    ])

    const now = new Date()
    const stage1 = mergeSchedulerState({
      previous: previousCache?.state ?? null,
      fresh,
      worldLedger,
      accountLedger,
      now,
    })

    const { characterState, worldLedgerUpdates, accountLedgerUpdates } = await fillMissingSections(
      apiKey,
      character.ocid,
      stage1,
      worldLedger,
      accountLedger,
      now,
    )

    const syncedAt = new Date().toISOString()

    await Promise.all([
      setCachedSchedulerState(character.ocid, { state: characterState, syncedAt }),
      ...Object.entries(worldLedgerUpdates).map(([name, entry]) =>
        setWorldSharedProgressEntry(characterState.world, name, entry),
      ),
      ...Object.entries(accountLedgerUpdates).map(([name, entry]) =>
        setAccountSharedProgressEntry(accountId, name, entry),
      ),
    ])

    return {
      ocid: character.ocid,
      characterName: character.name,
      world: character.world,
      state: characterState,
      syncedAt,
      isStale: false,
      error: null,
    }
  } catch (error) {
    return buildFallbackResult(character, toScheduleSyncError(error))
  }
}

// ADR-008 (2026-07-17 정정): 첫 캐릭터를 프리플라이트로 먼저 호출해 401/403·429처럼 모든
// 캐릭터에 동일하게 적용되는 전역 실패인지 확인한다. 전역 실패면 나머지 캐릭터는 API를 더
// 호출하지 않고 캐시 폴백만 수행한다. 전역 실패가 아니면(성공 또는 캐릭터 개별 네트워크
// 실패) 나머지 캐릭터는 서로 기다리지 않고 병렬로 호출한다 — 서비스 단계 키(초당 500건)라
// 병렬 호출이 한도와 충돌하지 않는다. 병렬 구간에서 개별 캐릭터가 401/429를 반환해도 이미
// 동시에 발사된 형제 호출은 막을 수 없으므로 그 캐릭터만 개별 폴백 처리한다.
//
// ocids로 지정된 캐릭터만 동기화한다 — 계정의 전체 캐릭터를 대상으로 호출하면
// 추적 대상이 아닌 캐릭터까지 불필요하게 호출하게 되어 로딩이 느려진다.
export async function syncSchedules(
  ocids: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<CharacterScheduleSync[]> {
  if (ocids.length === 0) {
    return []
  }

  const { apiKey, accountId, characters } = await resolveRegisteredCharacters()
  const targetCharacters = characters.filter((character) => ocids.includes(character.ocid))
  const total = targetCharacters.length

  onProgress?.(0, total)

  const [first, ...rest] = targetCharacters
  const firstResult = await syncOneCharacter(apiKey, first, accountId)
  let completed = 1
  onProgress?.(completed, total)

  const isGlobalFailure = firstResult.error?.kind === 'invalidApiKey' || firstResult.error?.kind === 'rateLimited'

  if (isGlobalFailure) {
    const fallbackRest = await Promise.all(
      rest.map((character) => buildFallbackResult(character, firstResult.error as ScheduleSyncError)),
    )
    completed += fallbackRest.length
    onProgress?.(completed, total)
    return [firstResult, ...fallbackRest]
  }

  const restResults = await Promise.all(
    rest.map(async (character) => {
      const result = await syncOneCharacter(apiKey, character, accountId)
      completed += 1
      onProgress?.(completed, total)
      return result
    }),
  )

  return [firstResult, ...restResults]
}
