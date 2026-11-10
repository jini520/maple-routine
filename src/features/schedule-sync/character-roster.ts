/**
 * 캐릭터 로스터 조회. 계정 컨텍스트 해석부터 피커 목록 방출까지.
 *
 * `schedule-sync.ts` 에서 분리했다. 그 파일은 여기(로스터)와 동기화 오케스트레이션 두 가지
 * 일을 하고 있었고, 둘 사이 참조는 한 방향뿐이라(동기화 → 로스터) 경계가 뚜렷했다.
 */

import { credentialsOfOcids, currentCredentials } from '../auth/current-credential'
import type { NexonCredential } from '../../types/auth'
import { worldKeyOfApiName } from '../../lib/world/worlds'
import { fetchCharacterBasic } from '../../nexon/character'
import { fetchCharacterListsCached, type CredentialCharacterList } from '../mvp-grade/character-list'
import { NexonAuthError, NexonRateLimitError } from '../../nexon/errors'
import { getCharacterAccountSightings } from '../../storage/character-accounts'
import { accountOfOcid } from '../../lib/mvp/membership'
import { apiKeyValueOf, isSameCredential } from '../../lib/nexon-credential'
import { getCharacterProfiles } from '../../storage/character-profiles'
import type { CharacterProfileSnapshot } from '../../storage/character-profiles'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getScheduleProbeLedger, markScheduleProbeUnavailable } from '../../storage/schedule-probe-ledger'
import type { CharacterPickerEntry, MapleCharacter } from '../../types'
import { compareByName } from '../../lib/character-order'
import { detectWorldLeap } from '../character-manage/world-leap'
import type { StrandedCharacter } from '../character-manage/world-leap'
import { useWorldLeapStore } from '../character-manage/world-leap-store'
import { linkWorldLeapsByNameAndJob } from '../boss-profit/world-leap-link'
import { fetchCharacterBasicCached } from './character-basic-fetch'
import { readCachedBasicOcids, readCharacterBasic } from './read-schedule'
import { readKnownEligibility, resolveCharacterEligibility } from './character-eligibility'
import type { CharacterEligibility } from './character-eligibility'
import { CredentialFailure, toScheduleSyncError } from './errors'

/** 목록을 못 받은 넥슨 계정의 추적 캐릭터 하나와 그 실패. */
export interface UnlistedTrackedCharacter {
  ocid: string
  credential: NexonCredential
  error: unknown
}

/**
 * 넥슨 계정마다 받은 목록과, 목록 밖 추적 캐릭터를 물을 자격. 회차와 후보 목록이 함께 쓴다.
 *
 * 캐릭터는 그 캐릭터가 속한 넥슨 계정의 자격으로만 부를 수 있다. 한 계정의 목록을 못 받아도 다른 계정은 그대로 간다.
 */
interface RosterContext {
  lists: CredentialCharacterList[]
  /** 목록을 받은 모든 넥슨 계정의 캐릭터를 편 것. 월드 리프는 메이플 ID 경계를 넘을 수 있어 전부 본다. */
  allCharacters: MapleCharacter[]
  /**
   * 목록 밖 추적 캐릭터를 물을 자격. 그 캐릭터가 속한 넥슨 계정의 자격이다.
   *
   * 목록을 못 받은 계정의 캐릭터와 부를 자격이 없는 캐릭터는 `null` 이라 묻지 않는다. 목록을 못 받은 것이지 캐릭터가 사라진
   * 것이 아니라, 묻지 않고 조회 불가로 판정하면 멀쩡한 캐릭터에 표식이 선다.
   */
  probeCredentialOf: (ocid: string) => NexonCredential | null
  /** 목록을 못 받은 넥슨 계정의 추적 캐릭터. 회차가 캐시로 폴백한다. */
  unlisted: UnlistedTrackedCharacter[]
  /** 부를 자격이 없는 추적 캐릭터. 그 계정의 키를 지웠다. */
  uncallable: string[]
}

/** 넥슨 계정 하나의 목록 실패를 그 키와 함께 올린다. 알림이 그 키만 지운다. */
function failureOf(list: CredentialCharacterList): CredentialFailure {
  return new CredentialFailure(list.error, apiKeyValueOf(list.credential))
}

/**
 * 넥슨 계정마다 목록을 받는다. 계정이 하나도 없으면 던지고, 모든 계정의 목록을 못 받으면 첫 계정의 실패를 던진다.
 *
 * @param trackedOcids 목록 밖이면 물어볼 추적 캐릭터
 */
async function resolveRosterContext(trackedOcids: readonly string[]): Promise<RosterContext> {
  const credentials = await currentCredentials()
  if (credentials.length === 0) {
    throw new Error('resolveRosterContext: 부를 수 있는 넥슨 계정이 없습니다')
  }

  const [lists, owners] = await Promise.all([fetchCharacterListsCached(credentials), credentialsOfOcids(trackedOcids)])
  const received = lists.filter((list) => list.accounts !== null)
  const firstFailure = lists.find((list) => list.accounts === null)
  if (received.length === 0 && firstFailure !== undefined) {
    throw failureOf(firstFailure)
  }

  const allCharacters = received.flatMap((list) => (list.accounts ?? []).flatMap((account) => account.characters))
  const listed = new Set(allCharacters.map((character) => character.ocid))
  const probe = new Map<string, NexonCredential>()
  const unlisted: UnlistedTrackedCharacter[] = []
  const uncallable: string[] = []
  for (const ocid of trackedOcids) {
    if (listed.has(ocid)) continue
    const credential = owners.get(ocid) ?? null
    if (credential === null) {
      uncallable.push(ocid)
      continue
    }
    const failed = lists.find((list) => list.accounts === null && isSameCredential(list.credential, credential))
    if (failed === undefined) probe.set(ocid, credential)
    else unlisted.push({ ocid, credential, error: failed.error })
  }

  return { lists, allCharacters, probeCredentialOf: (ocid) => probe.get(ocid) ?? null, unlisted, uncallable }
}

/**
 * 메이플 ID 하나에 사는 캐릭터와, 그 메이플 ID 가 속한 넥슨 계정의 자격.
 *
 * 계정은 반드시 인자로 온다. 부르는 쪽(캐릭터 관리의 계정 드롭다운)이 어느 계정을 여는지 알고 있고, 모르면 그것은 버그이지
 * 폴백으로 덮을 상태가 아니다.
 *
 * @param trackedOcids 목록 밖이면 물어볼 추적 캐릭터
 */
export async function resolveRegisteredCharacters(
  accountId: string | undefined,
  trackedOcids: readonly string[] = [],
): Promise<{
  credential: NexonCredential
  accountId: string
  characters: MapleCharacter[]
  /**
   * **모든 넥슨 계정의** 캐릭터를 편 것. 같은 응답에서 나오므로 호출이 안 는다.
   *
   * 위 `characters` 와 묻는 것이 다르다. 그쪽은 지금 연 메이플 ID 에 누가 사는가 이고 이쪽은 조회되는 캐릭터가 전부 누구인가
   * 다. 추적 목록이 계정 경계를 넘을 수 있어, 목록 밖 추적 ocid 를 가릴 때 한 계정만 보면 다른 계정 캐릭터가 전원 조회 불가가 된다.
   */
  allCharacters: MapleCharacter[]
  probeCredentialOf: (ocid: string) => NexonCredential | null
}> {
  if (accountId === undefined) {
    throw new Error('resolveRegisteredCharacters: 계정을 지정하지 않았습니다')
  }

  const context = await resolveRosterContext(trackedOcids)
  for (const list of context.lists) {
    const account = list.accounts?.find((candidate) => candidate.accountId === accountId)
    if (account !== undefined) {
      return {
        credential: list.credential,
        accountId,
        characters: account.characters,
        allCharacters: context.allCharacters,
        probeCredentialOf: context.probeCredentialOf,
      }
    }
  }

  // 그 메이플 ID 가 목록을 못 받은 넥슨 계정에 있을 수 있다. 그 실패를 올려야 화면이 그 키의 문제를 알린다.
  const failed = context.lists.find((list) => list.accounts === null)
  if (failed !== undefined) throw failureOf(failed)
  throw new Error('resolveRegisteredCharacters: 지정한 계정을 응답에서 찾을 수 없습니다')
}

/** 추적 캐릭터 하나와 **그 캐릭터가 사는 메이플 ID**, 그리고 그 캐릭터를 부를 넥슨 계정의 자격. 셋은 함께 다녀야 한다. */
export interface TrackedCharacterContext {
  character: MapleCharacter
  accountId: string
  credential: NexonCredential
}

/**
 * 추적 ocid 를 모든 넥슨 계정의 목록에서 찾아 각자의 메이플 ID · 자격과 함께 낸 목록.
 *
 * 위 `resolveRegisteredCharacters` 와 묻는 것이 다르다. 그쪽은 이 메이플 ID 에 누가 사는가 이고 이쪽은 이 ocid 들이 어디에
 * 사는가 다. 추적 목록이 메이플 ID 경계를 넘으면 전자로는 다른 계정 캐릭터가 필터에서 조용히 빠지고, 계정 공유 원장도 지금
 * 고른 계정 키를 써서 에픽 던전 완료가 계정을 넘어 번진다.
 *
 * 응답에 없는 ocid 는 `characters` 에서 빠진다. 목록을 못 받은 계정의 캐릭터는 `unlisted`, 부를 자격이 없는 캐릭터는
 * `uncallable` 로 따로 낸다. 순서는 계정의 차례와 `character/list` 응답 순서를 따른다. 표시 순서를 다시 세우는 일은 화면
 * 셀렉터의 몫이다.
 */
export async function resolveTrackedCharacterContext(ocids: string[]): Promise<{
  characters: TrackedCharacterContext[]
  /**
   * **모든 넥슨 계정의** 캐릭터를 편 것. 같은 응답에서 나오므로 호출이 안 는다.
   *
   * 동기화가 월드 리프 판정에 쓴다. 목록 밖으로 사라진 ocid 의 새 자리를 찾으려면 지금 연 계정만으로는 모자란다.
   */
  allCharacters: MapleCharacter[]
  probeCredentialOf: (ocid: string) => NexonCredential | null
  unlisted: UnlistedTrackedCharacter[]
  uncallable: string[]
}> {
  const context = await resolveRosterContext(ocids)
  const wanted = new Set(ocids)
  const characters = context.lists.flatMap(({ credential, accounts }) =>
    (accounts ?? []).flatMap((account) =>
      account.characters
        .filter((character) => wanted.has(character.ocid))
        .map((character) => ({ character, accountId: account.accountId, credential })),
    ),
  )

  return {
    characters,
    allCharacters: context.allCharacters,
    probeCredentialOf: context.probeCredentialOf,
    unlisted: context.unlisted,
    uncallable: context.uncallable,
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
  // 판정을 보류한 캐릭터는 자격이 없다고 확인된 것이 아니다. 빼면 조회 실패만으로 활동 중인 캐릭터가 사라진다.
  return isTracked || eligibility === 'eligible' || eligibility === 'undetermined'
}

/**
 * 모달을 안 거친 월드 리프를 이름·직업으로 잇는다. 방향을 `character/list` 응답이 정해 그 응답을 받은
 * 자리(로스터 조회 · `runSyncRound`)에서만 부른다.
 *
 * 던지지 않는다. 연결은 기록 뒷정리라 못 남겨도 목록과 동기화는 끝나야 하고, 다음 회차가 다시 잇는다.
 */
export async function linkWorldLeapsFromRoster(allCharacters: readonly MapleCharacter[], now: Date): Promise<void> {
  try {
    await linkWorldLeapsByNameAndJob(allCharacters, now)
  } catch {
    // 다음 회차가 다시 잇는다.
  }
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
  credentialOf: (ocid: string) => NexonCredential | null,
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
      // 그 캐릭터가 속한 넥슨 계정의 자격으로 묻는다. 없으면 물을 수 없어 판정하지 않는다.
      const credential = credentialOf(ocid)
      if (credential === null) {
        return
      }
      try {
        await fetchCharacterBasic(credential, ocid, worldKeyOfApiName)
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

  // 판정 재료는 **지워지지 않는 스냅샷**이 먼저다.
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
  const cached = readCharacterBasic(ocid)
  const name = snapshot?.name ?? cached?.profile.name ?? null
  if (name === null || name === '') {
    return null
  }

  return {
    ocid,
    name,
    world: snapshot?.world ?? cached?.profile.world ?? null,
    worldKey: snapshot?.worldKey ?? cached?.profile.worldKey ?? null,
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
  // 계정은 반드시 인자로 온다. 부르는 쪽(캐릭터 관리의 계정 드롭다운)이 어느 계정을 여는지 알고 있고, 모르면 그것은 버그이지
  // 폴백으로 덮을 상태가 아니다. 추적 목록은 로컬 읽기라 stub 단계(네트워크 이전)에서도 알 수 있다.
  const accountId = options?.accountId
  if (accountId === undefined) {
    throw new Error('getCharacterPickerRoster: 계정을 지정하지 않았습니다')
  }
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

  // `character/list` 를 기다리는 동안 쿼리 캐시에 이미 있는 캐릭터를 먼저 후보로 세운다. 안 그러면 피커를 열 때마다
  // 목록이 잠깐 빈다. 이 계정의 캐릭터만 세우려고 소속 기록(`character-accounts`)으로 거른다. 안 거르면 계정을
  // 바꿨을 때 이전 계정 캐릭터가 먼저 그려진다.
  //
  // 그중에서도 **마지막으로 받은 목록에 있던 캐릭터만** 세운다. 소속 기록은 목록을 받을 때마다 그 날을 적으므로, 월드
  // 리프로 목록에서 빠진 캐릭터는 마지막 본 날이 이 계정의 가장 최근 날보다 앞선다. 그 캐릭터를 세우면 열 때마다 떴다가
  // 목록 응답 뒤에 사라진다.
  const sightings = await getCharacterAccountSightings().catch(() => [])
  const mine = sightings.filter((sighting) => sighting.accountId === accountId)
  const latestSeenOn = mine.reduce((best, sighting) => (sighting.lastSeenOn > best ? sighting.lastSeenOn : best), '')
  const listedLately = new Set(mine.filter((sighting) => sighting.lastSeenOn === latestSeenOn).map((sighting) => sighting.ocid))
  const cachedOcids = readCachedBasicOcids().filter(
    (ocid) => listedLately.has(ocid) && accountOfOcid(sightings, ocid) === accountId,
  )
  if (cachedOcids.length > 0) {
    const stubEntries = (
      await Promise.all(
        cachedOcids.map(async (ocid): Promise<CharacterPickerEntry | null> => {
          const cached = readCharacterBasic(ocid)
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
            worldKey: cached.profile.worldKey,
            ...(cached.profile.jobClass === undefined ? {} : { jobClass: cached.profile.jobClass }),
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

  // 이 메이플 ID 의 캐릭터는 그 메이플 ID 가 속한 넥슨 계정의 자격으로 부른다.
  const { credential, characters, allCharacters, probeCredentialOf } = await resolveRegisteredCharacters(accountId, [
    ...trackedOcids,
  ])

  // 목록 밖 추적 ocid 확정. 로스터 방출과 섞이지 않게 먼저 끝낸다 - 이 단계가 원장에 표식을
  // 남기고, 아래 `readKnownEligibility` 가 그 원장을 읽는다.
  await probeStrandedTrackedCharacters(probeCredentialOf, trackedOcids, allCharacters, now)
  await linkWorldLeapsFromRoster(allCharacters, now)
  if (characters.length === 0) {
    onUpdate([])
    return
  }

  await Promise.all(
    characters.map(async (character) => {
      const cached = readCharacterBasic(character.ocid)
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
        worldKey: character.worldKey,
        jobClass: character.jobClass,
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
        const profile = await fetchCharacterBasicCached(credential, character.ocid, now, character.jobClass)
        // 여기서 스윕이 일어난다. 예열이 이미 훑었으면 원장이 채워져 있어
        // 추가 호출이 없고, 예열이 중간에 끊겼으면 이 경로가 이어서 완성한다.
        const eligibility = await resolveCharacterEligibility(
          credential,
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
            worldKey: character.worldKey,
            jobClass: character.jobClass,
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
              worldKey: character.worldKey,
              jobClass: character.jobClass,
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
    // 어느 키의 실패인지 싣는다. 안 실으면 알림이 키를 전부 지워 다른 넥슨 계정의 키까지 잃는다.
    throw new CredentialFailure(globalError, apiKeyValueOf(credential))
  }

  // 조회가 모두 끝난 뒤의 최종 방출. 콜드 스타트에선 방출이 이것뿐이고 웜 경로에선 마지막 patch
  // 와 같은 값이라 무해하다. 전역 실패일 때는 불완전한 목록을 완성된 결과처럼 내보내지 않는다.
  onUpdate(sortPickerEntries(Array.from(liveEntries.values())))
}
