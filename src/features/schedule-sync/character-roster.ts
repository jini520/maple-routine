// 캐릭터 **로스터 조회** — 계정 컨텍스트 해석부터 피커 목록 방출까지(ADR-094 결정 7).
//
// `schedule-sync.ts` 에서 분리했다. 그 파일은 580줄에 **두 가지 일**을 하고 있었다 —
// 여기(로스터)와 동기화 오케스트레이션. 둘 사이 참조는 한 방향뿐이라(동기화 → 로스터)
// 경계가 뚜렷했다.

import { fetchCharacterList } from '../../nexon/character'
import { NexonAuthError, NexonRateLimitError } from '../../nexon/errors'
import { getAllCachedCharacterBasicOcids, getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getAuthConfig } from '../../storage/api-key'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { markScheduleProbeUnavailable } from '../../storage/schedule-probe-ledger'
import type { CharacterPickerEntry, MapleCharacter } from '../../types'
import { compareByName } from '../onboarding/representative-character'
import { fetchCharacterBasicCached } from './character-basic-fetch'
import { readKnownEligibility, resolveCharacterEligibility } from './character-eligibility'
import type { CharacterEligibility } from './character-eligibility'
import { toScheduleSyncError } from './errors'
// **계정은 반드시 인자로 온다**([[ADR-143]] 결정 7) — 저장된 «고른 계정» 이라는 것이 없어졌다.
// 부르는 쪽(캐릭터 관리의 계정 드롭다운)이 어느 계정을 여는지 알고 있고, 모르면 그것은 버그이지
// 폴백으로 덮을 상태가 아니다.
async function resolveAccountContext(accountId?: string): Promise<{
  apiKey: string
  accountId: string
}> {
  const authConfig = await getAuthConfig()
  if (authConfig === null || accountId === undefined) {
    throw new Error(
      'resolveRegisteredCharacters: API 키가 없거나 계정을 지정하지 않았습니다',
    )
  }
  return { apiKey: authConfig.apiKey, accountId }
}

export async function resolveRegisteredCharacters(accountId?: string): Promise<{
  apiKey: string
  accountId: string
  characters: MapleCharacter[]
}> {
  const { apiKey, accountId: resolved } = await resolveAccountContext(accountId)

  const accounts = await fetchCharacterList(apiKey)
  const account = accounts.find((candidate) => candidate.accountId === resolved)
  if (account === undefined) {
    throw new Error('resolveRegisteredCharacters: 지정한 계정을 응답에서 찾을 수 없습니다')
  }

  return { apiKey, accountId: resolved, characters: account.characters }
}

/** 추적 캐릭터 하나와 **그 캐릭터가 사는 계정**. 둘은 함께 다녀야 한다([[ADR-143]] 결정 6). */
export interface TrackedCharacterContext {
  character: MapleCharacter
  accountId: string
}

/**
 * 추적 ocid 를 **전 계정에서** 찾아 각자의 계정과 함께 돌려준다([[ADR-143]] 결정 6).
 *
 * 위 `resolveRegisteredCharacters` 와 묻는 것이 다르다 — 그쪽은 «이 계정에 누가 사는가»(피커
 * 로스터·예열이 계정 하나를 그릴 때, [[ADR-086]] 결정 6)이고 이쪽은 «이 ocid 들이 어느 계정에
 * 사는가» 다. 추적 목록이 메이플 ID 경계를 넘으면 전자로는 다른 계정 캐릭터가 필터에서 조용히
 * 빠지고, 계정 공유 원장([[ADR-030]])도 «지금 고른 계정» 키를 써서 에픽 던전 완료가 계정을
 * 넘어 번진다.
 *
 * **`selectedAccountId` 를 읽지 않는다**([[ADR-143]] 결정 7) — RN 에는 계정을 고르는 단계가 없어
 * 그 값이 영영 `null` 이다. 응답에 없는 ocid 는 결과에서 빠진다(캐릭터 삭제·월드 이전 경로 —
 * 지금 동작 그대로다). 순서는 `character/list` 응답 순서를 그대로 따른다: 표시 순서를 다시
 * 세우는 일은 이 함수가 아니라 화면 셀렉터의 몫이다([[ADR-143]] 결정 3).
 */
export async function resolveTrackedCharacterContext(ocids: string[]): Promise<{
  apiKey: string
  characters: TrackedCharacterContext[]
}> {
  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    throw new Error('resolveTrackedCharacterContext: 온보딩이 완료되지 않았습니다 (API 키 없음)')
  }

  const wanted = new Set(ocids)
  const accounts = await fetchCharacterList(authConfig.apiKey)
  const characters = accounts.flatMap((account) =>
    account.characters
      .filter((character) => wanted.has(character.ocid))
      .map((character) => ({ character, accountId: account.accountId })),
  )

  return { apiKey: authConfig.apiKey, characters }
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

// ADR-053 결정 1 (2026-07-29): 확인되지 않은 캐릭터는 목록에 넣지 않는다 — 확인 경로는
// character-basic-cache/조회 원장 또는 character/basic 응답뿐이고, 그 값이 없는 character/list
// 응답으로 목록을 채우지 않는다.
//
// ADR-149 가 그 결정의 **결정 2**(콜드 스타트에서는 ②·③의 중간 방출을 억제하고 완료 후 1회만)를
// 정정했다. 억제의 근거는 «콜드 스타트의 중간 결과는 추측이거나 튀는 레이아웃» 이었는데, 그것은
// 캐시로 채우는 ②에만 맞았다 — ③에 담기는 항목은 character/basic 응답과 자격 판정을 통과한
// **확인된** 것이라 결정 1 이 요구하는 조건을 이미 만족한다. 형제가 안 끝났다는 이유로 그것을
// 붙들고 있으면 45명 중 40명이 확인됐는데 가장 느린 1명이 화면 전체를 잡는다(ADR-016 이 막으려던
// 바로 그 그림이다).
//
// 그래서 단계별 분기가 사라지고 아래 `emit` 의 조건 둘로 접힌다.
export async function getCharacterPickerRoster(
  onUpdate: (entries: CharacterPickerEntry[]) => void,
  options?: CharacterPickerRosterOptions,
): Promise<void> {
  const now = new Date()
  // 계정과 추적 목록은 로컬 읽기라 stub 단계(네트워크 이전)에서도 알 수 있다.
  const { apiKey, accountId } = await resolveAccountContext(options?.accountId)
  const trackedOcids = new Set((await getTrackedCharacterOcids()) ?? [])

  // 한 번이라도 사용자에게 보여줄 것을 흘렸는가. 인덱스에 ocid가 있어도 전부 자격 미확인이면
  // 아직 거짓이다 — 판정 기준은 "캐시 인덱스가 비었는가"가 아니라 "실제로 방출했는가"다.
  let hasVisibleView = false
  // 401/403·429 는 모든 캐릭터에 같이 적용되는 실패다. 아래 `emit` 이 방출 직전에 이 값을 본다.
  let globalError: unknown = null

  const liveEntries = new Map<string, CharacterPickerEntry>()

  /**
   * 중간 방출의 **유일한 문**([[ADR-149]]).
   *
   * - **전역 실패가 확정된 뒤에는 흘리지 않는다**(결정 3) — 부분 목록이 «완성된 결과» 로 오해된다.
   *   이미 흘린 것은 되돌리지 않고, 호출부가 reject 를 받아 실패 경로를 그린다([[ADR-062]] 결정 4).
   * - **참는 것은 「빈 목록」이지 「짧은 목록」이 아니다**(결정 2) — 한 건도 확인하지 못한 채
   *   방출하면 화면이 «모두 조회할 수 없어요» 를 그린다([[ADR-143]] 결정 10 · [[ADR-101]] 결정 1).
   *   한 건이라도 흘린 뒤에는 **줄어드는 방출도 통과**시킨다 — 자격 미달로 빠진 항목이 화면에
   *   남아 있으면 안 된다.
   */
  function emit(): void {
    if (globalError !== null) {
      return
    }
    if (!hasVisibleView && liveEntries.size === 0) {
      return
    }
    hasVisibleView = true
    onUpdate(sortPickerEntries(Array.from(liveEntries.values())))
  }

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
  emit()

  await Promise.all(
    characters.map(async (character) => {
      // 여기서 globalError 를 봐도 조기 중단은 안 된다 — 이 본문은 첫 await 전까지 전부 동기로
      // 돌아 첫 401 이 도착할 때 이미 전원이 지나간 뒤다. 그래서 판정은 `emit()` 안으로 옮겼다
      // ([[ADR-149]] 결정 3) — 발사는 못 막아도 «실패 확정 후 방출» 은 막는다.
      try {
        // ADR-113 결정 1: 캐시 쓰기까지 공유 경로 안이다. 온보딩 한 바퀴(프로브 → 예열 → 피커)가
        // 5분 안에 끝나면 여기서는 네트워크가 나가지 않고 방금 채워진 캐시를 그대로 쓴다.
        const profile = await fetchCharacterBasicCached(
          apiKey,
          accountId,
          character.ocid,
          now,
          character.jobClass,
        )
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
        emit()
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
          emit()
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
