/**
 * 캐릭터 로스터 조회. 계정 컨텍스트 해석부터 피커 목록 방출까지.
 *
 * `schedule-sync.ts` 에서 분리했다. 그 파일은 여기(로스터)와 동기화 오케스트레이션 두 가지
 * 일을 하고 있었고, 둘 사이 참조는 한 방향뿐이라(동기화 → 로스터) 경계가 뚜렷했다.
 */

import { fetchCharacterBasic, fetchCharacterList } from '../../nexon/character'
import { NexonAuthError, NexonRateLimitError } from '../../nexon/errors'
import { getAllCachedCharacterBasicOcids, getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getAuthConfig } from '../../storage/api-key'
import { getCharacterProfiles } from '../../storage/character-profiles'
import type { CharacterProfileSnapshot } from '../../storage/character-profiles'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getScheduleProbeLedger, markScheduleProbeUnavailable } from '../../storage/schedule-probe-ledger'
import type { CharacterPickerEntry, MapleCharacter } from '../../types'
import { compareByName } from '../../lib/character-order'
import { detectWorldLeap } from '../character-manage/world-leap'
import type { StrandedCharacter } from '../character-manage/world-leap'
import { useWorldLeapStore } from '../character-manage/world-leap-store'
import { fetchCharacterBasicCached } from './character-basic-fetch'
import { readKnownEligibility, resolveCharacterEligibility } from './character-eligibility'
import type { CharacterEligibility } from './character-eligibility'
import { toScheduleSyncError } from './errors'
// 계정은 반드시 인자로 온다. 저장된 고른 계정 이라는 것이 없다. 부르는 쪽(캐릭터 관리의 계정
// 드롭다운)이 어느 계정을 여는지 알고 있고, 모르면 그것은 버그이지 폴백으로 덮을 상태가 아니다.
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
  /**
   * **전 계정** 캐릭터를 편 것. 같은 응답에서 나오므로 호출이 안 는다.
   *
   * 위 `characters` 와 묻는 것이 다르다. 그쪽은 지금 연 계정에 누가 사는가 이고 이쪽은 이 키로
   * 조회되는 캐릭터가 전부 누구인가 다. 추적 목록이 계정 경계를 넘을 수 있어, 목록 밖 추적
   * ocid 를 가릴 때 한 계정만 보면 다른 계정 캐릭터가 전원 조회 불가가 된다.
   */
  allCharacters: MapleCharacter[]
}> {
  const { apiKey, accountId: resolved } = await resolveAccountContext(accountId)

  const accounts = await fetchCharacterList(apiKey)
  const account = accounts.find((candidate) => candidate.accountId === resolved)
  if (account === undefined) {
    throw new Error('resolveRegisteredCharacters: 지정한 계정을 응답에서 찾을 수 없습니다')
  }

  return {
    apiKey,
    accountId: resolved,
    characters: account.characters,
    allCharacters: accounts.flatMap((candidate) => candidate.characters),
  }
}

/** 추적 캐릭터 하나와 **그 캐릭터가 사는 계정**. 둘은 함께 다녀야 한다. */
export interface TrackedCharacterContext {
  character: MapleCharacter
  accountId: string
}

/**
 * 추적 ocid 를 전 계정에서 찾아 각자의 계정과 함께 낸 목록.
 *
 * 위 `resolveRegisteredCharacters` 와 묻는 것이 다르다. 그쪽은 이 계정에 누가 사는가 이고
 * 이쪽은 이 ocid 들이 어느 계정에 사는가 다. 추적 목록이 메이플 ID 경계를 넘으면 전자로는 다른
 * 계정 캐릭터가 필터에서 조용히 빠지고, 계정 공유 원장도 지금 고른 계정 키를 써서 에픽 던전
 * 완료가 계정을 넘어 번진다.
 *
 * `selectedAccountId` 를 읽지 않는다. 계정을 고르는 단계가 없어 그 값이 영영 `null` 이다.
 * 응답에 없는 ocid 는 결과에서 빠진다. 순서는 `character/list` 응답 순서를 그대로 따른다.
 * 표시 순서를 다시 세우는 일은 화면 셀렉터의 몫이다.
 */
export async function resolveTrackedCharacterContext(ocids: string[]): Promise<{
  apiKey: string
  characters: TrackedCharacterContext[]
  /**
   * **전 계정** 캐릭터를 편 것. 같은 응답에서 나오므로 호출이 안 는다.
   *
   * 동기화가 월드 리프 판정에 쓴다. 목록 밖으로 사라진 ocid 의 새 자리를 찾으려면 지금 연
   * 계정만으로는 모자란다 - 리프가 계정 경계를 넘을 수 있다.
   */
  allCharacters: MapleCharacter[]
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

  return {
    apiKey: authConfig.apiKey,
    characters,
    allCharacters: accounts.flatMap((account) => account.characters),
  }
}

// 조회 불가 항목은 레벨과 무관하게 맨 뒤로 보낸다. 고를 수 없는 후보가 고를 수 있는 후보를
// 밀어내지 않아야 한다. 그 안에서는 레벨 내림차순, 동레벨은 이름순.
function sortPickerEntries(entries: CharacterPickerEntry[]): CharacterPickerEntry[] {
  return [...entries].sort((a, b) => {
    const aUnavailable = a.unavailable === true
    const bUnavailable = b.unavailable === true
    if (aUnavailable !== bUnavailable) return aUnavailable ? 1 : -1
    return b.level !== a.level ? b.level - a.level : compareByName(a.name, b.name)
  })
}

// 캐시 우선 표시(Stale-While-Revalidate). 캐시가 있으면 즉시 그 값으로 첫 onUpdate 를 호출해
// 화면을 비우지 않고, 그 뒤 character/basic 을 캐릭터별로 병렬 호출해 하나씩 끝나는 대로 값을
// patch 하며 onUpdate 를 다시 호출한다. 401/429 는 전역 실패로 보고 던지고, 그 외 개별 실패는
// 이미 있던 캐시 값을 그대로 둔다.
//
// 목록에 넣을지는 자격이 정한다. 자격이 없어도 추적 중이면 남긴다. 빼면 trackedOcids 에 남은
// 그 ocid 를 해제할 방법이 없다. 뒤집으면 추적 중이 아닌 자격 X 캐릭터는 넣지 않는다. 남기는
// 목적이 해제 경로였으므로 추적 중이 아니면 남길 이유가 없다.
function shouldShowEntry(
  eligibility: CharacterEligibility | 'unknown',
  isTracked: boolean,
): boolean {
  return isTracked || eligibility === 'eligible'
}

/**
 * `character/list` 에서 빠진 추적 ocid 를 **하나씩 물어** 조회 불가를 확정하고, 월드 리프로
 * 보이면 물어볼 후보를 세운다.
 *
 * 이 단계가 없으면 그 캐릭터는 아무도 안 부른다. 위 로스터 경로는 목록이 준 캐릭터만 돌고
 * 동기화(`resolveTrackedCharacterContext`)도 같아서, 목록에서 빠지는 순간 `character/basic` 이
 * 영영 안 나간다. 표식이 안 서고 화면은 로컬 캐시로 멀쩡한 행을 그린다.
 *
 * **목록에 없다는 것만으로 판정하지 않는다.** 그 판정은 계정을 바꾸는 순간 다른 계정 캐릭터를
 * 전원 죽은 것으로 만든다. 빠진 것은 물어볼 이유이지 답이 아니라, 넥슨에게 실제로 묻는다.
 *
 * 부르는 것은 `fetchCharacterBasicCached` 가 아니라 `fetchCharacterBasic` 이다. 캐시 인덱스가
 * 계정별이라, 다른 계정 ocid 를 지금 연 계정의 인덱스에 넣으면 stub 단계가 남의 계정 캐릭터를
 * 그린다. 여기서 필요한 것은 살아 있는가 하나뿐이라 캐시에 남길 것도 없다.
 *
 * 호출 수는 원장이 잡는다. 이미 조회 불가로 적힌 ocid 는 안 부르므로, 화면을 여닫아도 캐릭터
 * 하나당 성공하는 호출은 한 번뿐이다.
 *
 * **부르는 곳이 둘이다.** 아래 로스터 조회와 `runSyncRound`(부팅 포함). 묻는 자리가 캐릭터 관리
 * 화면 하나였을 때는 그 화면을 안 여는 사용자에게 표식만 붙고 고칠 길이 영영 안 닿았다. 판정을
 * 두 벌로 만들지 않으려고 그쪽이 이 함수를 그대로 부른다.
 */
export async function probeStrandedTrackedCharacters(
  apiKey: string,
  trackedOcids: ReadonlySet<string>,
  allCharacters: readonly MapleCharacter[],
  now: Date,
): Promise<void> {
  const listed = new Set(allCharacters.map((character) => character.ocid))
  const stranded = [...trackedOcids].filter((ocid) => !listed.has(ocid))
  if (stranded.length === 0) {
    return
  }

  const unavailable: string[] = []
  await Promise.all(
    stranded.map(async (ocid) => {
      if ((await getScheduleProbeLedger(ocid, now)).unavailable) {
        unavailable.push(ocid)
        return
      }
      try {
        await fetchCharacterBasic(apiKey, ocid)
      } catch (error) {
        // 401/429 는 여기서 안 던진다. 이 단계는 목록을 만드는 일이 아니라 곁다리 확정이라,
        // 전역 실패로 올리면 멀쩡히 그려진 로스터가 통째로 사라진다. 다음 회차가 다시 묻는다.
        if (toScheduleSyncError(error).kind !== 'characterUnavailable') {
          return
        }
        await markScheduleProbeUnavailable(ocid)
        unavailable.push(ocid)
      }
    }),
  )

  if (unavailable.length === 0) {
    return
  }

  // 판정 재료는 **지워지지 않는 스냅샷**이 먼저다. 5분 TTL 캐시만 보면 설정의 캐시 비우기 한
  // 번에 이 캐릭터를 영영 못 짚는다.
  const profiles = await getCharacterProfiles(unavailable)
  await Promise.all(
    unavailable.map(async (ocid) => {
      const stranded = await resolveStrandedCharacter(ocid, profiles.get(ocid))
      if (stranded === null) {
        return
      }
      const leap = detectWorldLeap(stranded, allCharacters, trackedOcids)
      if (leap !== null) {
        useWorldLeapStore.getState().noticeWorldLeap(leap)
      }
    }),
  )
}

/**
 * 판정이 쓸 마지막으로 아는 것 을 두 출처에서 모은다. 스냅샷이 먼저이고 빈 칸만 캐시가 메운다.
 *
 * 캐시를 보는 이유는 `job_class` 가 **이 기능과 함께 생긴 칸**이기 때문이다. 옛 기기의 행에는
 * 비어 있고, 채우는 경로는 `character/basic` 하나인데 이전으로 남겨진 ocid 는 그 호출이 영영
 * 성공하지 않는다. 그러면 정확히 이 기능이 겨냥한 캐릭터만 판정에서 빠진다. 5분 캐시에는 마지막
 * 성공 응답의 직업이 아직 들어 있다.
 *
 * 이름을 모르면 `null` 이다. 판정의 모든 조건이 이름에서 시작한다.
 */
async function resolveStrandedCharacter(
  ocid: string,
  snapshot: CharacterProfileSnapshot | undefined,
): Promise<StrandedCharacter | null> {
  const cached = await getCachedCharacterBasic(ocid).catch(() => null)
  const name = snapshot?.name ?? cached?.profile.name ?? null
  if (name === null || name === '') {
    return null
  }

  return {
    ocid,
    name,
    world: snapshot?.world ?? cached?.profile.world ?? null,
    jobClass: snapshot?.jobClass ?? cached?.profile.jobClass ?? null,
    level: snapshot?.level ?? cached?.profile.level ?? null,
  }
}

export interface CharacterPickerRosterOptions {
  // 설정의 계정 변경이 커밋 전에 후보 계정으로 목록을 그릴 때 쓴다.
  accountId?: string
}

// 확인되지 않은 캐릭터는 목록에 넣지 않는다. 확인 경로는 character-basic-cache·조회 원장 또는
// character/basic 응답뿐이고, 그 값이 없는 character/list 응답으로 목록을 채우지 않는다.
//
// 중간 방출을 억제하지는 않는다. 방출되는 항목은 character/basic 응답과 자격 판정을 통과한
// 확인된 것이라 위 조건을 이미 만족한다. 형제가 안 끝났다는 이유로 붙들고 있으면 45명 중
// 40명이 확인됐는데 가장 느린 1명이 화면 전체를 잡는다.
export async function getCharacterPickerRoster(
  onUpdate: (entries: CharacterPickerEntry[]) => void,
  options?: CharacterPickerRosterOptions,
): Promise<void> {
  const now = new Date()
  // 계정과 추적 목록은 로컬 읽기라 stub 단계(네트워크 이전)에서도 알 수 있다.
  const { apiKey, accountId } = await resolveAccountContext(options?.accountId)
  const trackedOcids = new Set((await getTrackedCharacterOcids()) ?? [])

  // 한 번이라도 사용자에게 보여줄 것을 흘렸는가. 인덱스에 ocid 가 있어도 전부 자격 미확인이면
  // 아직 거짓이다. 판정 기준은 캐시 인덱스가 비었는가 가 아니라 실제로 방출했는가 다.
  let hasVisibleView = false
  // 401/403·429 는 모든 캐릭터에 같이 적용되는 실패다. 아래 `emit` 이 방출 직전에 이 값을 본다.
  let globalError: unknown = null

  const liveEntries = new Map<string, CharacterPickerEntry>()

  /**
   * 중간 방출이 나가는 유일한 문.
   *
   * - 전역 실패가 확정된 뒤에는 흘리지 않는다. 부분 목록이 완성된 결과로 오해된다. 이미 흘린
   *   것은 되돌리지 않고, 호출부가 reject 를 받아 실패 경로를 그린다.
   * - 참는 것은 빈 목록이지 짧은 목록이 아니다. 한 건도 확인하지 못한 채 방출하면 화면이
   *   모두 조회할 수 없어요 를 그린다. 한 건이라도 흘린 뒤에는 줄어드는 방출도 통과시킨다.
   *   자격 미달로 빠진 항목이 화면에 남아 있으면 안 된다.
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

  // character/list 는 캐싱하지 않으므로(개명·전직·레벨업 정확성 우선) 이 함수가 열릴 때마다 그
  // 네트워크 응답을 기다려야 한다. 그동안 character-basic-cache 에 이미 있는 캐릭터는 전부 즉시
  // 후보 목록에 채워, 피커를 열 때마다 아직 캐싱되지 않은 캐릭터를 뺀 나머지가 잠깐씩 비어
  // 보이던 것을 없앤다. 인덱스가 계정별이라 이 단계가 이전 계정 캐릭터를 그리지 않는다.
  const cachedOcids = await getAllCachedCharacterBasicOcids(accountId)
  if (cachedOcids.length > 0) {
    const stubEntries = (
      await Promise.all(
        cachedOcids.map(async (ocid): Promise<CharacterPickerEntry | null> => {
          const cached = await getCachedCharacterBasic(ocid)
          if (cached === null) {
            return null
          }
          // 원장만 읽는 판정이라 네트워크 0회다. stub 단계의 목적(즉시 표시)을 깨지 않는다.
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

  const { characters, allCharacters } = await resolveRegisteredCharacters(options?.accountId)

  // 목록 밖 추적 ocid 확정. 로스터 방출과 섞이지 않게 먼저 끝낸다 - 이 단계가 원장에 표식을
  // 남기고, 아래 `readKnownEligibility` 가 그 원장을 읽는다.
  await probeStrandedTrackedCharacters(apiKey, trackedOcids, allCharacters, now)
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
      // 여기서 globalError 를 봐도 조기 중단은 안 된다. 이 본문은 첫 await 전까지 전부 동기로
      // 돌아 첫 401 이 도착할 때 이미 전원이 지나간 뒤다. 그래서 판정은 `emit()` 안에 있다.
      // 발사는 못 막아도 실패 확정 후 방출은 막는다.
      try {
        // 캐시 쓰기까지 공유 경로 안이다. 온보딩 한 바퀴(프로브 → 예열 → 피커)가 5분 안에 끝나면
        // 여기서는 네트워크가 나가지 않고 방금 채워진 캐시를 그대로 쓴다.
        const profile = await fetchCharacterBasicCached(
          apiKey,
          accountId,
          character.ocid,
          now,
          character.jobClass,
        )
        // 여기서 스윕이 일어난다. 예열이 이미 훑었으면 원장이 채워져 있어
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
        // 조회 불가(400 OPENAPI00003)는 추적 중일 때만 남긴다. basic 만 실패한 것이므로
        // character/list 가 준 이름·레벨·월드는 쓸 수 있다(이미지는 없다).
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
        // 그 외 개별 실패. 이미 있던 캐시 값을 그대로 유지
      }
    }),
  )

  if (globalError !== null) {
    throw globalError
  }

  // 조회가 모두 끝난 뒤의 최종 방출. 콜드 스타트에선 방출이 이것뿐이고 웜 경로에선 마지막 patch
  // 와 같은 값이라 무해하다. 전역 실패일 때는 불완전한 목록을 완성된 결과처럼 내보내지 않는다.
  onUpdate(sortPickerEntries(Array.from(liveEntries.values())))
}
