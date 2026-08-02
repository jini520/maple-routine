import { fetchCharacterBasic, fetchCharacterList } from '../../nexon/character'
import { NexonAuthError, NexonBadRequestError, NexonRateLimitError } from '../../nexon/errors'
import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import { mergeSchedulerState, type MergeOutput } from '../../lib/scheduler-merge'
import { getBackfillDateKeys } from '../../lib/reset-clock'
import {
  isDailySectionMissing,
  isWeeklySectionMissing,
  toProbeObservation,
  type SchedulerSectionPresence,
} from '../../lib/scheduler-activity'
import { compareByName } from '../onboarding/representative-character'
import { getAuthConfig } from '../../storage/api-key'
import {
  getAllCachedCharacterBasicOcids,
  getCachedCharacterBasic,
  setCachedCharacterBasic,
} from '../../storage/character-basic-cache'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getCachedSchedulerState, setCachedSchedulerState } from '../../storage/scheduler-cache'
import {
  getScheduleProbeLedger,
  markScheduleProbeUnavailable,
  recordScheduleProbe,
} from '../../storage/schedule-probe-ledger'
import {
  getAccountSharedProgress,
  getWorldSharedProgress,
  setAccountSharedProgressEntry,
  setWorldSharedProgressEntry,
} from '../../storage/shared-progress-cache'
import type { CharacterPickerEntry, MapleCharacter, SchedulerCharacterState, SharedProgressEntry } from '../../types'
import {
  readKnownEligibility,
  resolveCharacterEligibility,
  type CharacterEligibility,
} from './character-eligibility'

// ADR-067 결정 1: 400 하나에 처방이 전혀 다른 세 실패가 들어 있어(nexon-api.md "에러 코드")
// 종류를 갈라 담는다. 재시도 가능성이 셋 다 다르다 — characterUnavailable은 영구,
// notCollected는 나중에 자동으로 풀리고, periodOutOfRange는 그 날짜에 대해 영구다.
export type ScheduleSyncError =
  | { kind: 'invalidApiKey' } // 401/403
  | { kind: 'rateLimited' } // 429
  | { kind: 'characterUnavailable' } // 400 OPENAPI00003 — 이 ocid를 조회할 수 없다(영구)
  | { kind: 'periodOutOfRange' } // 400 OPENAPI00004 — 그 날짜를 조회할 수 없다(원인은 호출 측이 날짜로 판정)
  | { kind: 'notCollected' } // 400 OPENAPI00009 — 아직 집계 전(시간이 지나면 풀린다)
  | { kind: 'network' } // 그 외 네트워크/파싱 실패 + 코드를 모르는 400

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

// 호출부가 reject를 원인으로 변환할 수 있게 export한다([[ADR-062]] 결정 2) — 피커·온보딩 스텝이
// getCharacterPickerRoster의 catch에서 이걸 통과시켜 loadError로 내려준다.
export function toScheduleSyncError(error: unknown): ScheduleSyncError {
  if (error instanceof NexonAuthError) {
    return { kind: 'invalidApiKey' }
  }
  if (error instanceof NexonRateLimitError) {
    return { kind: 'rateLimited' }
  }
  // 코드를 아는 400만 갈라내고, 모르는 코드·본문 없는 400은 network로 degrade한다 —
  // 넥슨이 코드 체계를 바꿔도 최악의 경우 지금 동작(재시도 유도)으로 떨어지게 하는 안전판이다
  // ([[ADR-067]] 트레이드오프).
  if (error instanceof NexonBadRequestError) {
    if (error.code === 'OPENAPI00003') {
      return { kind: 'characterUnavailable' }
    }
    if (error.code === 'OPENAPI00004') {
      return { kind: 'periodOutOfRange' }
    }
    if (error.code === 'OPENAPI00009') {
      return { kind: 'notCollected' }
    }
  }
  return { kind: 'network' }
}

// ADR-086 결정 6: 설정의 계정 변경은 커밋 전에 **후보 계정**으로 예열·후보 목록을 돌린다 —
// 그래서 저장된 selectedAccountId 대신 인자로 받은 계정을 쓸 수 있어야 한다. 인자가 없으면
// 지금까지처럼 저장된 값이다.
async function resolveAccountContext(accountIdOverride?: string): Promise<{
  apiKey: string
  accountId: string
}> {
  const authConfig = await getAuthConfig()
  const accountId = accountIdOverride ?? authConfig?.selectedAccountId ?? null
  if (authConfig === null || accountId === null) {
    throw new Error(
      'getRegisteredCharacters: 온보딩이 완료되지 않았습니다 (API 키 또는 선택된 계정 없음)',
    )
  }
  return { apiKey: authConfig.apiKey, accountId }
}

async function resolveRegisteredCharacters(accountIdOverride?: string): Promise<{
  apiKey: string
  accountId: string
  characters: MapleCharacter[]
}> {
  const { apiKey, accountId } = await resolveAccountContext(accountIdOverride)

  const accounts = await fetchCharacterList(apiKey)
  const account = accounts.find((candidate) => candidate.accountId === accountId)
  if (account === undefined) {
    throw new Error('getRegisteredCharacters: 선택된 계정을 찾을 수 없습니다')
  }

  return { apiKey, accountId, characters: account.characters }
}

export async function getRegisteredCharacters(): Promise<MapleCharacter[]> {
  const { characters } = await resolveRegisteredCharacters()
  return characters
}

// 조회 불가 항목은 레벨과 무관하게 **맨 뒤로** 보낸다([[ADR-068]] 결정 4) — 고를 수 없는 후보가
// 고를 수 있는 후보를 밀어내지 않아야 한다. 그 안에서는 기존 규칙(레벨 내림차순, 동레벨은 이름순).
function sortPickerEntries(entries: CharacterPickerEntry[]): CharacterPickerEntry[] {
  return [...entries].sort((a, b) => {
    const aUnavailable = a.unavailable === true
    const bUnavailable = b.unavailable === true
    if (aUnavailable !== bUnavailable) return aUnavailable ? 1 : -1
    return b.level !== a.level ? b.level - a.level : compareByName(a.name, b.name)
  })
}

// ADR-016 결정 4: 캐시 우선 표시(Stale-While-Revalidate) — 캐시가 있으면 즉시 그 값으로 첫
// onUpdate를 호출해 화면을 비우지 않고, 그 뒤 character/basic을 캐릭터별로 병렬 호출해 하나씩
// 끝나는 대로(Promise.all로 뭉쳐 기다리지 않고) 값을 patch하며 onUpdate를 다시 호출한다.
// 401/429는 전역 실패로 보고 던지고, 그 외 개별 실패는 이미 있던 캐시 값을 그대로 둔다.
//
// ADR-086 결정 3: 목록에 넣을지는 **자격**이 정한다(access_flag 단독 게이트 폐기). 자격이 없어도
// 추적 중이면 남긴다 — 빼면 trackedOcids에 남은 그 ocid를 해제할 방법이 없다(이슈 #78 A-1).
// 뒤집으면 추적 중이 아닌 자격 X 캐릭터는 넣지 않는다(ADR-068 결정 4의 "조회 불가는 항상 남긴다"
// 정정 — 남기는 목적이 해제 경로였으므로 추적 중이 아니면 남길 이유가 없다).
function shouldShowEntry(
  eligibility: CharacterEligibility | 'unknown',
  isTracked: boolean,
): boolean {
  return isTracked || eligibility === 'eligible'
}

export interface CharacterPickerRosterOptions {
  // ADR-086 결정 6: 설정의 계정 변경이 커밋 전에 후보 계정으로 목록을 그릴 때 쓴다.
  accountId?: string
}

// ADR-053 결정 2 (2026-07-29): 확인되지 않은 캐릭터는 목록에 넣지 않는다 — 확인 경로는
// character-basic-cache/조회 원장 또는 character/basic 응답뿐이고, 그 값이 없는 character/list
// 응답으로 목록을 채우지 않는다. 그래서 ①에서 보여줄 stub이 한 건도 없는 콜드 스타트(캐시 삭제·
// 재설치 직후)에는 흘릴 중간 결과가 추측뿐이므로 ②·③의 중간 onUpdate를 억제하고, 모든
// character/basic이 끝난 뒤 1회만 방출한다(그동안 호출부는 스피너를 보여준다). 반대로 stub을
// 한 건이라도 방출했다면 위 ADR-016 SWR 동작이 그대로 유지된다 — 즉시 표시 + 개별 patch.
export async function getCharacterPickerRoster(
  onUpdate: (entries: CharacterPickerEntry[]) => void,
  options?: CharacterPickerRosterOptions,
): Promise<void> {
  const now = new Date()
  // 계정과 추적 목록은 로컬 읽기라 stub 단계(네트워크 이전)에서도 알 수 있다.
  const { apiKey, accountId } = await resolveAccountContext(options?.accountId)
  const trackedOcids = new Set((await getTrackedCharacterOcids()) ?? [])

  // ADR-053 결정 2: 판정 기준은 "캐시 인덱스가 비었는가"가 아니라 "①에서 실제로 사용자에게
  // 보여줄 것을 방출했는가"다 — 인덱스에 ocid가 있어도 전부 자격 미확인이면 화면에 보여줄
  // 게 없는 것은 마찬가지이기 때문이다.
  let hasVisibleView = false

  // ADR-017 결정 6 (2026-07-12 재수정): character/list는 캐싱하지 않으므로(개명·전직·레벨업
  // 정확성 우선, ADR 2026-07-11 정정) 이 함수가 열릴 때마다 그 네트워크 응답을 기다려야 한다.
  // 그동안 character-basic-cache에 이미 있는 캐릭터는(추적 여부 무관 — 온보딩 예열이 계정
  // 전체 캐릭터를 채워둔다, ADR-016) 전부 즉시 후보 목록에 채워, 피커를 열 때마다 아직
  // 캐싱되지 않은 캐릭터를 뺀 나머지가 잠깐씩 비어 보이던 문제를 없앤다.
  // ADR-086 결정 9: 인덱스가 계정별이라 이 단계가 더 이상 이전 계정 캐릭터를 그리지 않는다.
  const cachedOcids = await getAllCachedCharacterBasicOcids(accountId)
  if (cachedOcids.length > 0) {
    const stubEntries = (
      await Promise.all(
        cachedOcids.map(async (ocid): Promise<CharacterPickerEntry | null> => {
          const cached = await getCachedCharacterBasic(ocid)
          if (cached === null) {
            return null
          }
          // 원장만 읽는 판정이라 네트워크 0회다 — stub 단계의 목적(즉시 표시)을 깨지 않는다.
          const known = await readKnownEligibility(ocid, cached.profile.accessFlag, now)
          if (!shouldShowEntry(known, trackedOcids.has(ocid))) {
            return null
          }
          return {
            ocid,
            name: cached.profile.name,
            level: cached.profile.level,
            imageUrl: cached.profile.imageUrl,
            world: cached.profile.world,
            ...(known === 'unavailable' ? { unavailable: true } : {}),
          }
        }),
      )
    ).filter((entry): entry is CharacterPickerEntry => entry !== null)

    if (stubEntries.length > 0) {
      onUpdate(sortPickerEntries(stubEntries))
      hasVisibleView = true
    }
  }

  const { characters } = await resolveRegisteredCharacters(options?.accountId)
  if (characters.length === 0) {
    onUpdate([])
    return
  }

  const liveEntries = new Map<string, CharacterPickerEntry>()

  await Promise.all(
    characters.map(async (character) => {
      const cached = await getCachedCharacterBasic(character.ocid)
      if (cached === null) {
        return
      }
      const known = await readKnownEligibility(character.ocid, cached.profile.accessFlag, now)
      if (!shouldShowEntry(known, trackedOcids.has(character.ocid))) {
        return
      }
      liveEntries.set(character.ocid, {
        ocid: character.ocid,
        name: cached.profile.name,
        level: cached.profile.level,
        imageUrl: cached.profile.imageUrl,
        world: character.world,
        ...(known === 'unavailable' ? { unavailable: true } : {}),
      })
    }),
  )
  if (hasVisibleView) {
    onUpdate(sortPickerEntries(Array.from(liveEntries.values())))
  }

  let globalError: unknown = null

  await Promise.all(
    characters.map(async (character) => {
      if (globalError !== null) {
        return
      }

      try {
        const profile = await fetchCharacterBasic(apiKey, character.ocid)
        await setCachedCharacterBasic(accountId, character.ocid, {
          profile,
          cachedAt: new Date().toISOString(),
        })
        // ADR-086 결정 5: 여기서 스윕이 일어난다. 예열이 이미 훑었으면 원장이 채워져 있어
        // 추가 호출이 없고, 예열이 중간에 끊겼으면 이 경로가 이어서 완성한다.
        const eligibility = await resolveCharacterEligibility(
          apiKey,
          character.ocid,
          profile.accessFlag,
          now,
        )
        if (shouldShowEntry(eligibility, trackedOcids.has(character.ocid))) {
          liveEntries.set(character.ocid, {
            ocid: character.ocid,
            name: profile.name,
            level: profile.level,
            imageUrl: profile.imageUrl,
            world: character.world,
            ...(eligibility === 'unavailable' ? { unavailable: true } : {}),
          })
        } else {
          liveEntries.delete(character.ocid)
        }
        if (hasVisibleView) {
          onUpdate(sortPickerEntries(Array.from(liveEntries.values())))
        }
      } catch (error) {
        if (error instanceof NexonAuthError || error instanceof NexonRateLimitError) {
          globalError = error
          return
        }
        // ADR-068 결정 4 + ADR-086 결정 3: 조회 불가(400 OPENAPI00003)는 **추적 중일 때만** 남긴다.
        // basic만 실패한 것이므로 character/list가 준 이름·레벨·월드는 쓸 수 있다(이미지는 없다).
        if (toScheduleSyncError(error).kind === 'characterUnavailable') {
          await markScheduleProbeUnavailable(character.ocid)
          if (trackedOcids.has(character.ocid)) {
            liveEntries.set(character.ocid, {
              ocid: character.ocid,
              name: character.name,
              level: character.level,
              imageUrl: null,
              world: character.world,
              unavailable: true,
            })
          } else {
            liveEntries.delete(character.ocid)
          }
          if (hasVisibleView) {
            onUpdate(sortPickerEntries(Array.from(liveEntries.values())))
          }
          return
        }
        // 그 외 개별 실패 — 이미 있던 캐시 값을 그대로 유지
      }
    }),
  )

  if (globalError !== null) {
    throw globalError
  }

  // ADR-053 결정 2: 조회가 모두 끝난 뒤의 최종 방출. 콜드 스타트에선 이게 유일한 방출이고,
  // 웜 경로에선 마지막 patch와 같은 값이라 무해하다. 전역 실패(위에서 throw)일 때는 불완전한
  // 목록을 "완성된 결과"처럼 내보내지 않는다.
  onUpdate(sortPickerEntries(Array.from(liveEntries.values())))
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

// ADR-086 결정 4: 이미 조회한 날짜를 **다시 부를 가치가 있는가**. 원장은 그 날짜에 각 섹션의
// 내용이 있었는지만 기억하므로(값은 기억하지 않는다), 지금 비어 있는 섹션 중 하나라도 그 날짜에
// 있었다면 값을 가져오러 다시 부른다. 하나도 없었다면 불러봐야 같은 0건이라 건너뛴다 —
// 보스 0건 캐릭터가 매번 13일을 소진하던 고리가 여기서 끊긴다.
function canResolveAnyStaleSection(
  originallyStale: SchedulerSectionPresence,
  known: { kind: 'observed'; sections: SchedulerSectionPresence } | { kind: 'outOfRange' },
): boolean {
  if (known.kind === 'outOfRange') {
    return false
  }
  return (
    (originallyStale.daily && known.sections.daily) ||
    (originallyStale.weekly && known.sections.weekly) ||
    (originallyStale.weeklyBoss && known.sections.weeklyBoss) ||
    (originallyStale.monthlyBoss && known.sections.monthlyBoss)
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

  // ADR-086 결정 4(= ADR-067 결정 5): 이미 조회한 날짜를 다시 부르지 않는다. 보스가 0건인
  // 캐릭터(특수 월드·저레벨)는 과거 날짜도 0건이라 이 루프가 13일을 다 쓰고도 해결하지
  // 못했고, 상태가 변하지 않아 **매 동기화 14회 호출이 영구 반복**됐다(이슈 #87 문제 1).
  const probeLedger = await getScheduleProbeLedger(ocid, now)
  if (probeLedger.unavailable) {
    return stage1
  }

  let acc = stage1

  for (const dateKey of getBackfillDateKeys(now)) {
    const known = probeLedger.dates[dateKey]
    if (known !== undefined && !canResolveAnyStaleSection(originallyStale, known)) {
      continue
    }

    let dayResponse: SchedulerCharacterState
    try {
      dayResponse = await fetchSchedulerCharacterState(apiKey, ocid, dateKey)
    } catch (error) {
      const kind = toScheduleSyncError(error).kind
      if (kind === 'characterUnavailable') {
        await markScheduleProbeUnavailable(ocid)
        break
      }
      if (kind === 'periodOutOfRange') {
        await recordScheduleProbe(ocid, dateKey, { kind: 'outOfRange' })
      }
      // notCollected(집계 전)·네트워크는 기록하지 않는다 — 나중에 다시 시도한다.
      continue
    }

    await recordScheduleProbe(ocid, dateKey, { kind: 'observed', ...toProbeObservation(dayResponse) })

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
