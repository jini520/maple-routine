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

export async function resolveRegisteredCharacters(accountIdOverride?: string): Promise<{
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
        // ADR-113 결정 1: 캐시 쓰기까지 공유 경로 안이다. 온보딩 한 바퀴(프로브 → 예열 → 피커)가
        // 5분 안에 끝나면 여기서는 네트워크가 나가지 않고 방금 채워진 캐시를 그대로 쓴다.
        const profile = await fetchCharacterBasicCached(apiKey, accountId, character.ocid, now)
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
