import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import { mergeSchedulerState, type MergeOutput } from '../../lib/scheduler/scheduler-merge'
import { getBackfillDateKeys } from '../../lib/scheduler/reset-clock'
import {
  isDailySectionMissing,
  isWeeklySectionMissing,
  toProbeObservation,
  type SchedulerSectionPresence,
} from '../../lib/scheduler/scheduler-activity'
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
import type { MapleCharacter, SchedulerCharacterState, SharedProgressEntry } from '../../types'

import { toScheduleSyncError } from './errors'
import type { ScheduleSyncError } from './errors'
import { fetchCharacterBasicCached } from './character-basic-fetch'
import { resolveTrackedCharacterContext } from './character-roster'
import type { TrackedCharacterContext } from './character-roster'
import { markSyncAttemptedThisRun } from './sync-run-state'
// 공개 API 는 그대로 둔다. 옮긴 것은 구현 위치이지 호출부가 알 바가 아니다.
export { toScheduleSyncError } from './errors'
export type { ScheduleSyncError } from './errors'

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
export { getCharacterPickerRoster } from './character-roster'
export type { CharacterPickerRosterOptions } from './character-roster'










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

// 정정(2026-07-23) + 추가 정정(2026-07-25): 4개 섹션(daily/weekly/weeklyBoss/monthlyBoss) 중
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

// 이미 조회한 날짜를 **다시 부를 가치가 있는가**. 원장은 그 날짜에 각 섹션의
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

// 정정(2026-07-23): 당일 응답에서 stale이었던 섹션을, [[getBackfillDateKeys]]가 주는
// 날짜(평소 -1일부터, 자정 직후 불안정 구간엔 -2일부터) 목록을 조회하며 항목(이름 또는
// 이름+난이도) 단위로 채운다. 각 날짜 응답을 previous로 삼아 mergeSchedulerState(+
// 항목 단위 정정)를 한 번씩 더 태우되, world/account 원장은 이 루프의 범위 밖이라
// (previous가 아니라 "마지막 활성 캐릭터" 오염을 피하려 원장을 신뢰해야 하므로)
// 4개 플래그를 모두 true로 강제해 character 범위 항목 병합만 일어나게 한다. 그 날짜 응답
// 자체가(원래 stale이었던 섹션 기준으로) 더 이상 stale이 아니면 그 시점에 멈추고, 끝까지 못
// 찾으면 -13일까지 다 써보고 그동안 누적된 결과를 best-effort로 그대로 쓴다. 특정 날짜 조회가
// 실패해도(네트워크 등) 그 날짜만 건너뛰고 다음 날짜로 계속한다.
//
// **조회와 병합이 갈렸다**. 날짜는 한꺼번에 나가고(결정 1), 접는 것은 그대로 날짜
// 순 폴드다(결정 2). 순서가 결과를 정하는 것은 조회가 아니라 병합이었으므로 `resolved` 중단을
// 포함해 아래 루프의 의미는 한 글자도 안 바뀐다.
//
// 그 갈림이 만드는 새 사실 하나: 폴드가 일찍 멈춰도 **뒷 날짜 응답은 이미 손에 있다.** 그것을
// 버리면 원장이 안 차 다음 동기화가 같은 13일을 다시 훑고 이슈 #87 문제 1이 되살아나므로,
// 기록은 폴드가 아니라 **발사 지점**에서 한다(결정 3 — 최적화가 아니라 병렬화의 성립 조건).
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

  // 결정 4(=): 이미 조회한 날짜를 다시 부르지 않는다. 보스가 0건인
  // 캐릭터(특수 월드·저레벨)는 과거 날짜도 0건이라 이 루프가 13일을 다 쓰고도 해결하지
  // 못했고, 상태가 변하지 않아 **매 동기화 14회 호출이 영구 반복**됐다(이슈 #87 문제 1).
  const probeLedger = await getScheduleProbeLedger(ocid, now)
  if (probeLedger.unavailable) {
    return stage1
  }

  const dateKeys = getBackfillDateKeys(now).filter((dateKey) => {
    const known = probeLedger.dates[dateKey]
    return known === undefined || canResolveAnyStaleSection(originallyStale, known)
  })

  // 발사와 기록이 여기 함께 있다. 실패 종류별 기록 정책은 그대로다.
  const fetched = await Promise.all(
    dateKeys.map(async (dateKey) => {
      try {
        const response = await fetchSchedulerCharacterState(apiKey, ocid, dateKey)
        await recordScheduleProbe(ocid, dateKey, { kind: 'observed', ...toProbeObservation(response) })
        return { response, failure: null }
      } catch (error) {
        const failure = toScheduleSyncError(error).kind
        if (failure === 'characterUnavailable') {
          await markScheduleProbeUnavailable(ocid)
        } else if (failure === 'periodOutOfRange') {
          await recordScheduleProbe(ocid, dateKey, { kind: 'outOfRange' })
        }
        // notCollected(집계 전)·네트워크는 기록하지 않는다. 나중에 다시 시도한다.
        return { response: null, failure }
      }
    }),
  )

  let acc = stage1

  for (const { response: dayResponse, failure } of fetched) {
    // 조회 불가는 캐릭터 단위 확정이라 남은 날짜를 접을 이유가 없다(종전 `break` 그대로).
    if (failure === 'characterUnavailable') {
      break
    }
    if (dayResponse === null) {
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

// 결정 7 (이슈 #139): 스케줄 동기화가 **실제로 도는 회차에** 그 대상 캐릭터의
// character/basic 을 함께 받아 캐시를 갱신한다. 지금까지 이 갱신의 상시 경로는 피커 하나뿐이라
//  레벨·외형이 "피커를 마지막으로 연 시점"의 스냅샷으로 굳었다.
//
// 이 그 결정의 "별도 TTL 은 두지 않는다"를 정정했다. 이제 네 호출부가 공유하는
// 5분 TTL 가드를 통과한다. **이 함수가 불리는 조건(~4)은 그대로 서고**, 가드가
// 하나 더 앞에 붙을 뿐이다: 동기화가 실제로 도는 회차인데 basic 만 5분 가드에 걸려 건너뛰는
// 구간이 생기고, 그 구간은 최대 5분이며 다음 동기화가 받는다(가드 5분 < 동기화 TTL 10분).
//
// 절대 throw 하지 않는다. 실패는 그 캐릭터의 기존 캐시를 그대로 두는 것으로 끝나고 사용자에게
// 알리지도 않는다. 부가 작업이라 실패해도 기존 캐시로 화면이 정상 동작한다. syncOneCharacter 의
// try 안이 아니라 별도 경로인 이유도 같다: 거기 넣으면 basic 실패가 catch 로 떨어져 **스케줄
// 조회는 성공했는데도** 그 캐릭터가 isStale: true 가 된다.
//
// 자격(eligibility) 스윕은 하지 않는다. 추가 호출을 낳고, 추적 캐릭터는 사용자가 이미 고른
// 대상이라 판정이 필요 없다. 그 스윕은 피커 경로의 몫이다.
async function refreshCharacterBasics(
  apiKey: string,
  targets: TrackedCharacterContext[],
): Promise<void> {
  // 라운드 하나가 기준 시각 하나를 공유한다. 캐릭터마다 새로 읽으면 같은 라운드 안에서 TTL
  // 판정 기준이 흔들린다.
  const now = new Date()

  await Promise.all(
    targets.map(async ({ character, accountId }) => {
      try {
        // accountId 는 **그 캐릭터가 사는 계정**이다. 캐시 인덱스가 계정별이라
        //  틀리면 다른 계정 인덱스를 오염시킨다. jobClass 는 character/list 가
        // 준 값을 그대로 실어 보낸다.
        await fetchCharacterBasicCached(apiKey, accountId, character.ocid, now, character.jobClass)
      } catch {
        // best-effort — 기존 캐시를 그대로 둔다.
      }
    }),
  )
}

// fetch 자체는 성공했지만 캐릭터가 리셋 이후 미접속이라 daily/weekly/boss 섹션이
// 비어있을 수 있고, 몬스터파크·에픽 던전처럼 월드/계정 전체가 공유하는 콘텐츠도 있다. 이 두
// 문제를 mergeSchedulerState(순수 함수, lib/scheduler/scheduler-merge)가 흡수한 "실효 상태"를 캐싱·반환한다.
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

//  (2026-07-17 정정): 첫 캐릭터를 프리플라이트로 먼저 호출해 401/403·429처럼 모든
// 캐릭터에 동일하게 적용되는 전역 실패인지 확인한다. 전역 실패면 나머지 캐릭터는 API를 더
// 호출하지 않고 캐시 폴백만 수행한다. 전역 실패가 아니면(성공 또는 캐릭터 개별 네트워크
// 실패) 나머지 캐릭터는 서로 기다리지 않고 병렬로 호출한다. 서비스 단계 키(초당 500건)라
// 병렬 호출이 한도와 충돌하지 않는다. 병렬 구간에서 개별 캐릭터가 401/429를 반환해도 이미
// 동시에 발사된 형제 호출은 막을 수 없으므로 그 캐릭터만 개별 폴백 처리한다.
//
// ocids로 지정된 캐릭터만 동기화한다. 계정의 전체 캐릭터를 대상으로 호출하면
// 추적 대상이 아닌 캐릭터까지 불필요하게 호출하게 되어 로딩이 느려진다.
async function runSyncRound(
  ocids: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<CharacterScheduleSync[]> {
  // 여기서부터 실제 네트워크가 나간다. 성공이 아니라 "시도"를 표시하므로 실패해도
  // 표시한다. 오프라인에서 탭을 옮길 때마다 실패 호출이 반복되지 않게. 화면 진입 재조회 말고
  // 추적 목록 저장·수동 모드 시드에서 들어온 회차도 같은 대상이다(동기화가 일어난 사실은 같고,
  // 캐릭터별 신선도는 isSyncFresh 가 따로 본다).
  markSyncAttemptedThisRun()

  // 추적 목록이 메이플 ID 경계를 넘으므로 "선택 계정의 캐릭터"를 받아 거르지
  // 않는다. 전 계정에서 찾고, 각 캐릭터가 **자기 계정**을 들고 다닌다(계정 공유 원장·캐시
  // 인덱스가 그 값을 쓴다). 단일 계정에서는 결과가 완전히 같다.
  const { apiKey, characters: targets } = await resolveTrackedCharacterContext(ocids)
  const total = targets.length

  onProgress?.(0, total)

  const [first, ...rest] = targets
  const firstResult = await syncOneCharacter(apiKey, first.character, first.accountId)
  let completed = 1
  onProgress?.(completed, total)

  const isGlobalFailure = firstResult.error?.kind === 'invalidApiKey' || firstResult.error?.kind === 'rateLimited'

  if (isGlobalFailure) {
    const fallbackRest = await Promise.all(
      rest.map(({ character }) => buildFallbackResult(character, firstResult.error as ScheduleSyncError)),
    )
    completed += fallbackRest.length
    onProgress?.(completed, total)
    return [firstResult, ...fallbackRest]
  }

  // character/basic 편승 갱신을 스케줄 병렬 구간과 **같은 Promise.all** 로 묶어
  // 동시에 내보낸다. 체감 대기 시간이 늘지 않는다. 자리는 isGlobalFailure 를 걸러 낸 **뒤**여야
  // 한다(순서 보존 — 401/429 인데 캐릭터 수만큼 호출을 낭비하지 않는다). 대상은
  // targets 전체다: 프리플라이트로 이미 동기화한 첫 캐릭터도 basic 갱신 대상이다.
  const [restResults] = await Promise.all([
    Promise.all(
      rest.map(async ({ character, accountId }) => {
        const result = await syncOneCharacter(apiKey, character, accountId)
        completed += 1
        onProgress?.(completed, total)
        return result
      }),
    ),
    refreshCharacterBasics(apiKey, targets),
  ])

  return [firstResult, ...restResults]
}

// 결정 4 (= 이 "today 에 내용이 붙는 시점"을 기한으로 열어 둔 구멍):
// 진행 중인 회차가 있으면 새 회차를 시작하지 않고 그 프라미스를 함께 기다린다.
//
// 게이트는 "이번 실행에서 시도함 AND 캐시가 10분 안"인데, 플래그는 호출이
// **시작될 때** 서고 신선도는 호출이 **끝나야** 갱신된다. 그 사이에 다른 화면이 진입하면
// `시도함 = true` · `신선함 = false`를 보고 같은 호출을 한 번 더 낸다. today 가 첫 화면이라
// 실행당 첫 동기화를 대개 그 화면이 내므로, 이 경로는 예외가 아니라 지배 경로다.
// prehydrate.ts 의 순차 루프는 그 창을 순서로 피해 왔지만 today 는 그 순차 밖의 트리거다.
//
// **키는 "회차" 하나다. ocid 집합이 아니다.** 스케줄러 셋과 today 가 같은 추적 목록을 보므로
// 집합이 늘 같고, 집합별 슬롯을 두면 목록이 조금 다른 조합에서 같은 캐릭터가 여전히 두 번 나간다.
//
// **다만 합류에는 자격이 있다. 진행 중인 회차가 요청 ocid 를 전부 덮어야 한다**.
// 결정 4 는 이걸 대가 ①("자기가 요청한 캐릭터가 그 안에 없을 수 있다")로 적고 창이 좁다고 봤는데,
// 수동 모드 시드는 **자기가 자기와 부딪쳐** 그 창이 100% 였다: ocid 마다 회차를 동시에 내면 첫
// 호출이 슬롯을 잡고 나머지가 전부 거기 합류해, 추적 캐릭터 전원이 첫 캐릭터의 스케줄로 시드됐다.
// 못 덮는 요청은 그 회차가 **정산된 뒤에** 자기 회차를 잇는다. 동시에 둘을 내보내면 단일 비행이
// 막으려던 중복이 되살아난다. 키는 그대로 회차이므로 집합이 늘 같은 today·스케줄러 셋은 한 회차다.
//
// **대가**: 합류한 호출의 `onProgress` 는 불리지 않는다. 진행률은 회차를 소유한 호출이 받는다.
let inFlightRound: { ocids: ReadonlySet<string>; promise: Promise<CharacterScheduleSync[]> } | null =
  null

// 호출부 여섯이 전부 결과를 "내가 물어본 캐릭터들"로 취급해 map 하므로, 회차가
// 더 많이 물어봤더라도 초과분은 돌려주지 않는다(스케줄러 저장 경로에서는 그 초과분이 keptViews 와
// 겹쳐 중복 행이 된다). 순서는 회차 순서 그대로다. 표시 순서는 화면 셀렉터의 몫이다.
function pickRequested(round: CharacterScheduleSync[], ocids: string[]): CharacterScheduleSync[] {
  const wanted = new Set(ocids)
  return round.filter((result) => wanted.has(result.ocid))
}

export async function syncSchedules(
  ocids: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<CharacterScheduleSync[]> {
  if (ocids.length === 0) {
    return []
  }

  while (inFlightRound !== null) {
    const current = inFlightRound
    if (ocids.every((ocid) => current.ocids.has(ocid))) {
      return pickRequested(await current.promise, ocids)
    }
    // 실패도 정산이다. 앞 회차의 실패를 내 요청의 실패로 삼지 않고 내 회차를 새로 낸다.
    await current.promise.catch(() => undefined)
  }

  const round = runSyncRound(ocids, onProgress)
  inFlightRound = { ocids: new Set(ocids), promise: round }
  try {
    return pickRequested(await round, ocids)
  } finally {
    // 성공·실패와 무관하게 정산되면 즉시 비운다. 실패한 회차를 들고 있으면 네트워크가 돌아와도
    // 다음 진입이 그 실패를 다시 받는다.
    inFlightRound = null
  }
}

// 테스트 전용. 모듈 수준 상태라 테스트끼리 오염되므로 beforeEach 에서 부른다.
// 프로덕션 코드에서 부르지 말 것. 진행 중인 회차를 잊어버려 그 순간 단일 비행이 무너진다.
export function resetSyncSingleFlightForTests(): void {
  inFlightRound = null
}
