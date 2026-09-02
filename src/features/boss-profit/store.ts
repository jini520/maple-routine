import { create } from 'zustand'
import {
  containsInProgressWeek,
  getAdjacentPeriodKey,
  getCurrentBossProfitPeriod,
  getWeeklyPeriodKeysInMonth,
  isLatestPeriod,
  isPeriodQueryable,
  resolvePagePeriodState,
  resolvePeriodDataState,
  type PeriodDataState,
  type PeriodQueryOutcome,
} from '../../lib/boss/boss-profit-period'
import {
  fillMissingRecordWorlds,
  getBossProfitRecords,
  upsertBossProfitRecord,
  type BossProfitRecord,
} from '../../storage/boss-profit'
import { getBossDropRecords, replaceBossDropRecords } from '../../storage/boss-drops'
import { sumDropPayout } from '../../lib/drop/drop-price'
import type { RecordedDrop } from '../../types/drops'
import { isPeriodChecked } from '../../storage/boss-profit-period-checks'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getManualTrackedContent, type ManualTrackedItem } from '../../storage/manual-tracked-content'
import { getCachedSchedulerState } from '../../storage/scheduler-cache'
import { getTrackingMode } from '../../storage/tracking-mode'
import { type BossCycle } from '../../types'
import { compareByName } from '../onboarding/representative-character'
import { syncSchedules, toScheduleSyncError, type ScheduleSyncError } from '../schedule-sync/schedule-sync'
import { hasSyncAttemptedThisRun } from '../schedule-sync/sync-run-state'
import { isSyncFresh } from '../../lib/scheduler/sync-freshness'
import {
  appendRecordOnlyRows,
  buildBossProfitRow,
  buildRowFromRecord,
  dropRowKey,
  filterRowsForTab,
  matchesRowKey,
  mergeRecordsIntoRows,
  selectProfitDisplayBosses,
  sortRowsByOcidOrder,
  sumRowsPayout,
  toProfileSnapshot,
  toRecordedDrop,
  } from './rows'
import type { BossProfitRow, BossProfitRowKey, CharacterProfileInfo, SortedCharacterInfo } from './rows'
// 행 타입의 정의 위치는 rows.ts 지만 공개 경로는 그대로 둔다(ADR-094 결정 7) — 화면과 테스트가
// store 에서 가져오고, 옮긴 것은 구현 위치일 뿐이다.
export type { BossProfitRow } from './rows'
// 화면이 기존 경로로 계속 import 한다 — 옮긴 것은 구현 위치이지 공개 API 가 아니다.
export { dropRowKey } from './rows'
import { withSqliteFallback } from './sqlite-guards'
import { autoRecordRows } from './auto-record'
import { resolveDefeatDates } from './defeat-dates'
import { loadDropsByRowKey } from './drops-loader'
import { sweepOrphanDrops } from './orphan-drops'
import { useToastStore } from '../toast/store'
import { backfillTarget, buildBackfillTargets, canReachPreviousPeriod, loadPreviousPeriodTotal } from './backfill'
import type { BackfillTarget } from './backfill'


/**
 * 월간 탭 주차 행의 상태. 기간 6상태에 이 화면 고유의 두
 * 상태를 더한다 — `inProgress`(지금 진행 중인 주)와 `upcoming`(아직 시작하지 않은 주).
 *
 * 전에는 `confirmed | inProgress | upcoming | unavailable` 넷이었고, **조회한 적 없는 주가
 * `confirmed` 0메소로 위장**됐다(`기록 없음 + isPeriodQueryable` → confirmed). 백필은 과거 달로
 * 이동할 때만 그 달의 주들을 대상에 넣으므로, 현재 달의 지난 주는 사용자가 그 주로 직접 이동한
 * 적이 없으면 영영 조회되지 않는다 — 그 주에는 `notChecked` 로 **조회 버튼**을 준다.
 */
export type WeeklySubtotalState = PeriodDataState | 'inProgress' | 'upcoming'

export interface BossProfitWeeklySubtotal {
  ocid: string
  characterName: string
  imageUrl: string | null
  periodKey: string
  totalMeso: number
  /**
   * 그 주에 기록된 드롭(정정). `totalMeso` 에 이미 환산돼 들어 있다.
   *
   * **합이 아니라 목록으로 들고 있는 이유**: 월간 탭에서는 주간 수익이 소계에서만 나오므로
   * ① 총 수익에서 결정석/아이템을 가르는 데 쓰이고(합이면 충분했다) ② 주차 소계 행의 내역
   * 팝오버가 **아이템을 낱개로** 보여줘야 한다(2026-08-10 사용자 요청). 합만 들고 있으면 ②를
   * 할 수 없어 이 짚은 월간 탭의 한계가 그대로 남는다.
   */
  drops: RecordedDrop[]
  state: WeeklySubtotalState
}

export type BossProfitStatus = 'idle' | 'loading' | 'loaded' | 'error'

// ADR-097 결정 4: "강제"가 기본값이고 게이트가 예외다. force 인자를 두면 강제해야 할 호출부를
// 하나라도 빠뜨리는 순간 그 자리가 조용히 게이트에 걸리므로, 자동 진입 경로인 loadTrackedOcids()만
// auto: true 를 넘긴다. 화면(헤더 버튼·당겨서 새로고침·재시도)은 인자를 안 넘겨 자동으로 강제 경로다.
// 컨텐츠·보스 스케줄러 스토어와 같은 이름·같은 모양이다 — 이 스토어의 refresh 는 onProgress 를
// 받지 않는다는 기존 차이만 그대로 둔다.
export interface RefreshOptions {
  auto?: boolean
}

export interface BossProfitState {
  status: BossProfitStatus
  tab: BossCycle
  periodKey: string // 현재 tab 기준으로 선택된 기간
  rows: BossProfitRow[] // 선택된 (tab, periodKey)의 보스 row. monthly 탭이면 그 달의 monthly-cycle 보스만
  /**
   * **지금 `rows`·`weeklySubtotals` 에 담겨 있는 데이터가 어느 (tab, periodKey) 의 것인가**
   * . 위의 `tab`·`periodKey` 는 "사용자가 보려고 누른 기간"이라 데이터보다
   * 먼저 바뀐다(기간 라벨·네비게이션의 반응성) — 그 사이 한 커밋 동안 화면은 **새 기간 키 +
   * 옛 기간 금액**을 그린다.
   *
   * 카운트업 identity 를 이 값으로 만들어야 identity 와 금액이 **같은 커밋에 도착**한다. 목표
   * 기간으로 만들면 위의 중간 커밋이 새 identity 슬롯에 옛 금액을 기억으로 써넣어, 커밋 타이밍에
   * 따라 굴러가기도 안 굴러가기도 한다(정정 1의 실기기 관측).
   *
   * 그래서 **반드시 `rows` 와 같은 `set()` 안에서** 갱신한다.
   */
  loadedTab: BossCycle
  loadedPeriodKey: string
  /**
   * **«지금 기간» 의 행 전부**(주간·월간 두 주기가 함께 들어 있다) — 위의 `rows` 와 **뜻이 다른
   * 값**이다.
   *
   * `rows` 는 `filterRowsForTab` 이 `cycle` 까지 걸러 낸 «사용자가 보고 있는 (탭, 기간)» 한
   * 조각이라, 이 화면의 네비게이션을 따라 움직인다. **today 위젯은 그것을 읽으면 안 된다** — 그
   * 화면은 언제나 «이번 주» 를 그리므로, 사용자가 여기서 월간 탭으로 옮기는 것만으로 주간 보스
   * 수익과 주간 결정석 한도가 함께 비었다(사용자 보고 2026-08-19).
   *
   * 내용은 `latestSyncSnapshot.rows` 와 같다 — **모든 커밋이 그 스냅샷을 함께 싣기 때문에**(아래
   * `create` 의 `set` 래퍼) 둘이 어긋날 수 없다. **기간 이동(`loadPeriod`)은 이 값을 건드리지
   * 않는다.** 자르는 것은 읽는 쪽 몫이다(today 는 종전대로 `cycle === 'weekly' && periodKey ===
   * 이번 주` 로 자른다).
   */
  currentPeriodRows: BossProfitRow[]
  dropsByRowKey: Record<string, RecordedDrop[]> // 보스 행별 기록된 드롭(ADR-038). 키는 dropRowKey(ocid|boss|difficulty|periodKey). rows와 독립 상태라 탭 전환 시 loadPeriod가 DB에서 재로드
  weeklySubtotals: BossProfitWeeklySubtotal[] // monthly 탭에서만 채워짐(주차별 합계). weekly 탭에서는 항상 []
  isPeriodLoading: boolean // periodKey 이동 후 백필(과거 기간 재조회) 진행 중
  // 이 기간을 화면이 어떻게 말해야 하는지(표현은). 전에는
  // periodUnavailable(boolean) 하나로 "집계 전"과 "그 외 실패"를 같은 문구로 말했다.
  periodState: PeriodDataState
  /**
   * 직전 기간의 총 수익 — 증감 칩의 비교 기준.
   *
   * **기록 합만 담는다.** 조회한 적 없는 기간도 0이다(사용자 결정) — 그래서 이 값은 기간 상태
   * 기계(`periodState`)와 무관하고, 화면은 이 숫자 하나만 보고 칩을 그린다. 그 대가로 "0메소였다"와
   * "모른다"가 구분되지 않는다(의도된 손실, ADR-087 트레이드오프).
   */
  previousPeriodTotalMeso: number
  canGoPreviousPeriod: boolean // 현재 선택된 기간에서 한 칸 더 과거로 이동할 수 있는지(#29) — 이전 기간이 지금 조회 가능하거나 이미 캐시된 기록이 있을 때만 true. 조회 불가·레코드 없는 기간에 착지하는 것을 막는다.
  error: ScheduleSyncError | null
  staleCharacterNames: string[]
  /**
   * 동기화가 실패한 캐릭터의 카드에 붙일 표식. 키는 ocid —
   * `staleCharacterNames`(토스트용 이름 목록)만으로는 어느 **카드**인지 알 수 없다.
   *   `unavailable` 400 OPENAPI00003 — 이 캐릭터는 조회할 수 없다(영구)
   *   `failed`      그 외 실패(네트워크·타임아웃 등)
   */
  characterIssues: Record<string, 'unavailable' | 'failed'>
  trackedOcids: string[] | null
  lastSyncedAt: string | null // 페이지 전체 기준 마지막으로 성공한 실시간 동기화 시각(ISO 8601). 컨텐츠/보스 스케줄러의 formatSyncedAt과 동일하게 새로고침 아이콘 옆에 표시
}


export interface BossProfitStore extends BossProfitState {
  loadTrackedOcids(): Promise<void>
  refresh(ocids: string[], options?: RefreshOptions): Promise<void>
  setTab(tab: BossCycle): Promise<void>
  goToPreviousPeriod(): Promise<void>
  goToNextPeriod(): Promise<void>
  /**
   * 지금 보고 있는 (tab, periodKey)를 다시 로드한다. 재시도(`failed`)와
   * 조회(`notChecked`) 두 상태가 사용자에게 주는 행동이 이것뿐이고 둘 다 같은 일을 한다 —
   * 그 기간의 미확인 target을 다시 백필한다. `refresh` 로는 대신할 수 없다(현재 기간으로 되돌린다).
   */
  retryPeriod(): Promise<void>
  setPartySize(row: BossProfitRowKey, partySize: number): Promise<void>
  setBossDrops(row: BossProfitRowKey, drops: RecordedDrop[]): Promise<void>
  /**
   * **다른 화면이 같은 그룹을 DB에 쓴 뒤** 이 스토어의 스냅샷만 맞춘다(쓰기 없음).
   *
   * 가격 기록 화면(`drop-price-store`)이 부른다 — 두 스토어가 같은 `boss_drop_records` 를 각자
   * 캐시하는데, 이 화면은 스택 왕복에도 마운트를 유지하므로 알려주지 않으면 **옛
   * 스냅샷을 계속 그린다**(사용자 보고 2026-08-10: "새로고침해야 반영된다").
   *
   * `setBossDrops` 를 쓸 수 없는 이유가 둘이다: DB 에 **두 번 쓰게 되고**, 그 함수는 현재 로드된
   * `rows` 에서 행을 찾는데 가격 화면은 **다른 기간**을 열고 있을 수 있다.
   */
  applyExternalDropEdit(
    ocid: string,
    boss: string,
    difficulty: string,
    periodKey: string,
    drops: RecordedDrop[],
  ): void
}


// refresh()가 가장 최근에 계산한 "현재 기간" 전체(모든 cycle) row와 그 시점의 캐릭터 정보를 담아둔다.
// setTab/goToPreviousPeriod/goToNextPeriod가 "현재 기간"으로 되돌아올 때 네트워크 호출 없이
// 이 스냅샷에서 슬라이스하기 위한 용도다(ADR-023 "로컬 우선 캐싱").
interface LatestSyncSnapshot {
  ocids: string[]
  rows: BossProfitRow[]
  characterProfiles: Map<string, CharacterProfileInfo>
}

let latestSyncSnapshot: LatestSyncSnapshot | null = null

// refresh()/setTab()/goToPreviousPeriod()/goToNextPeriod()는 전부 비동기라 여러 호출이 동시에
// 진행 중일 수 있다(예: 사용자가 ‹ ›를 빠르게 연타). 나중에 시작된 호출이 먼저 끝나고, 먼저
// 시작됐지만 느린(백필 등) 호출이 뒤늦게 끝나면 그 stale한 결과로 최신 화면을 덮어써버리는
// 문제가 있었다. 액션을 시작할 때마다 이 카운터를 증가시켜 자신만의 세대(generation)를
// 캡처해두고, set() 직전에 "여전히 최신 세대인지" 확인해 stale한 결과는 조용히 버린다.
let requestGeneration = 0



// ADR-017 결정 2와 동일한 원칙 — 캐시 단계(trackedOcids 저장 순서)와 동기화 단계(Nexon
// character/list 응답 순서)가 서로 달라 캐릭터 목록 위치가 API 응답 이후 갑자기 바뀌어 보이던
// 문제를 없앤다. 레벨 내림차순(동레벨이면 이름순)으로 항상 같은 순서를 계산해, 캐시 우선 표시
// 단계부터 실시간 동기화·과거 기간 조회까지 전부 이 순서를 그대로 따르게 한다. character-basic-cache를
// 이미 조회하는 김에 아바타용 imageUrl과 월드(world_name)도 함께 반환한다 — 같은 profile 객체에
// 들어 있어 추가 조회 비용이 0이다. 캐릭터명은 반환하지 않는다 — rows의
// characterName은 character/list·스케줄러 캐시가 출처이고 character-basic-cache의 이름은 갱신
// 시점이 달라 신뢰도가 낮다(ADR-017). world는 정렬에 참여하지 않는다.
async function getSortedCharacterInfo(ocids: string[]): Promise<SortedCharacterInfo[]> {
  const withProfile = await Promise.all(
    ocids.map(async (ocid) => {
      const cached = await getCachedCharacterBasic(ocid)
      return {
        ocid,
        level: cached?.profile.level ?? null,
        // 정렬용 이름은 캐시가 없을 때 ''로 떨어뜨린다(compareByName이 문자열을 요구한다). 바깥으로
        // 내보내는 characterName은 아래에서 null로 갈라 "캐시 없음"을 보존한다(ADR-078 결정 2).
        name: cached?.profile.name ?? '',
        characterName: cached?.profile.name ?? null,
        imageUrl: cached?.profile.imageUrl ?? null,
        // profile.world는 옵셔널(string | undefined)이라 imageUrl과 같은 규약으로 null 정규화한다 —
        // 화면이 부재를 두 가지 형태로 구분할 이유가 없다.
        world: cached?.profile.world ?? null,
      }
    }),
  )

  return withProfile
    .sort((a, b) => {
      if (a.level === null && b.level === null) return compareByName(a.name, b.name)
      if (a.level === null) return 1
      if (b.level === null) return -1
      if (b.level !== a.level) return b.level - a.level
      return compareByName(a.name, b.name)
    })
    .map(({ ocid, imageUrl, world, characterName }) => ({ ocid, imageUrl, world, characterName }))
}













// tab이 'monthly'일 때 그 달에 포함된 weekly periodKey들을 주차별로 합산한다. 지난 주는 로컬
// 기록을 조회하고, 아직 시작하지 않은 미래 주는 0/'upcoming'으로 채우며, 진행 중인 주는
// liveRows(방금 refresh/캐시가 계산해둔 값)에서 바로 합산한다 — 단 **liveRows가 있을 때만**이다.
//
// ADR-075: liveRows는 "이번 달을 보고 있을 때"만 채워진다(지난 달을 여는 loadPeriod 분기는 []를
// 넘긴다 — 그 화면의 행은 기록이 원천이므로, ADR-067 결정 4). 평소엔 진행 중인 주가 언제나 이번
// 달 안에 있어 두 조건이 같은 말이지만, 한 주가 달 경계를 걸치면(7월 5주차 = 7/30~8/5) 8월 1일부터
// "아직 진행 중인데 그 주가 속한 달은 이미 지난 달"이 되어 갈라진다. 그때는 지난 주와 똑같이
// 기록에서 합산한다 — 그러지 않으면 DB에 기록이 있는데도 0메소로 굳는다(사용자 보고 2026-08-02).
// 판정을 liveRows가 비었는지로 대신하지 말 것 — "이 주에 아무것도 안 잡았다"(정상적인 0)와
// 구분되지 않아 정상적인 0을 기록으로 덮어쓴다.
async function buildWeeklySubtotalsForMonth(
  ocids: string[],
  monthPeriodKey: string,
  liveRows: BossProfitRow[],
  knownProfiles: Map<string, CharacterProfileInfo>,
  now: Date,
  // 이번 로드에서 그 주를 백필해 본 결과(영속되지 않는다) — 키는 `${ocid}|${cycle}|${periodKey}`.
  outcomes?: Map<string, PeriodQueryOutcome | null>,
): Promise<BossProfitWeeklySubtotal[]> {
  if (ocids.length === 0) {
    return []
  }

  const weekKeys = getWeeklyPeriodKeysInMonth(monthPeriodKey)
  const currentWeeklyPeriodKey = getCurrentBossProfitPeriod('weekly', now).periodKey
  // 진행 중인 주의 금액을 liveRows에서 읽을 수 있는가(= 이번 달을 보고 있는가). ADR-075.
  const hasLiveSource = monthPeriodKey === getCurrentBossProfitPeriod('monthly', now).periodKey
  const pastWeekKeys = weekKeys.filter((key) => key < currentWeeklyPeriodKey)
  // 라이브가 없는 화면에서는 진행 중인 주의 기록도 함께 읽는다(ADR-075).
  const recordWeekKeys =
    !hasLiveSource && weekKeys.includes(currentWeeklyPeriodKey)
      ? [...pastWeekKeys, currentWeeklyPeriodKey]
      : pastWeekKeys
  const records =
    recordWeekKeys.length > 0 ? await withSqliteFallback(getBossProfitRecords(ocids, recordWeekKeys), []) : []

  // ADR-068 결정 2: 지난 주의 상태를 6상태로 판정하려면 **확인 기록**이 필요하다 — 기록이 없는 주가
  // "조회해서 0건을 확인한 주"인지 "조회한 적 없는 주"인지는 그것만이 갈라준다.
  const checkedKeys = new Set<string>()
  await Promise.all(
    ocids.flatMap((ocid) =>
      pastWeekKeys.map(async (weekKey) => {
        if (await withSqliteFallback(isPeriodChecked(ocid, 'weekly', weekKey), false)) {
          checkedKeys.add(`${ocid}|${weekKey}`)
        }
      }),
    ),
  )

  // 아이템 수익도 소계에 넣는다 — 안 넣으면 **주간 탭과 월간 탭의 같은 주가
  // 다른 숫자**가 된다(주간 탭은 보스 행에 더해 보여주므로). 주차 전체를 한 번에 읽어 접는다.
  const weekDrops = await withSqliteFallback(getBossDropRecords(ocids, weekKeys), [])
  const dropsByOcidWeek = new Map<string, RecordedDrop[]>()
  for (const record of weekDrops) {
    const key = `${record.ocid}|${record.periodKey}`
    const list = dropsByOcidWeek.get(key) ?? []
    list.push(toRecordedDrop(record))
    dropsByOcidWeek.set(key, list)
  }

  const subtotals: BossProfitWeeklySubtotal[] = []

  for (const ocid of ocids) {
    const known = knownProfiles.get(ocid)
    const cachedProfile = known === undefined ? (await getCachedCharacterBasic(ocid))?.profile : undefined
    const characterName = known?.characterName ?? cachedProfile?.name ?? null
    const imageUrl = known?.imageUrl ?? cachedProfile?.imageUrl ?? null
    if (characterName === null) {
      continue
    }

    for (const weekKey of weekKeys) {
      if (weekKey > currentWeeklyPeriodKey) {
        subtotals.push({ ocid, characterName, imageUrl, periodKey: weekKey, totalMeso: 0, drops: [], state: 'upcoming' })
        continue
      }

      const matchingRecords = records.filter(
        (record) => record.ocid === ocid && record.cycle === 'weekly' && record.periodKey === weekKey,
      )
      const recordedMeso = matchingRecords.reduce((sum, record) => sum + record.payoutMeso, 0)

      if (weekKey === currentWeeklyPeriodKey) {
        // 진행 중인 주. 라이브 원천이 있으면 그쪽이 최신이고(자동 기록이 건너뛰어진 처치까지
        // 담는다), 없으면 이미 쌓인 기록에서 읽는다(ADR-075 — 달 경계를 걸친 주).
        const crystalMeso = hasLiveSource
          ? sumRowsPayout(
              liveRows.filter((row) => row.ocid === ocid && row.cycle === 'weekly' && row.periodKey === weekKey),
            )
          : recordedMeso
        const drops = dropsByOcidWeek.get(`${ocid}|${weekKey}`) ?? []
        subtotals.push({
          ocid,
          characterName,
          imageUrl,
          periodKey: weekKey,
          totalMeso: crystalMeso + sumDropPayout(drops),
          drops,
          state: 'inProgress',
        })
        continue
      }

      // 판정을 화면·백필과 공유하는 한 함수에 맡긴다 — 전에는 여기서
      // "기록 없음 + 조회 가능"을 confirmed로 떨어뜨려 **조회한 적 없는 주를 0메소로 위장**했다.
      const state = resolvePeriodDataState({
        isCurrentPeriod: false,
        hasRecords: matchingRecords.length > 0,
        isChecked: checkedKeys.has(`${ocid}|${weekKey}`),
        isQueryable: isPeriodQueryable('weekly', weekKey, now),
        lastOutcome: outcomes?.get(`${ocid}|weekly|${weekKey}`) ?? null,
      })
      const drops = dropsByOcidWeek.get(`${ocid}|${weekKey}`) ?? []
      subtotals.push({
        ocid,
        characterName,
        imageUrl,
        periodKey: weekKey,
        totalMeso: recordedMeso + sumDropPayout(drops),
        drops,
        state,
      })
    }
  }

  return subtotals
}

// 과거 기간의 rows를 로컬 기록만으로 구성한다(캐릭터명은 character-basic-cache에서 조회, 캐시가
// 없는 ocid는 결과에서 제외).
async function buildRowsFromRecords(
  ocids: string[],
  cycle: BossCycle,
  periodKey: string,
  now: Date,
  // ADR-078 결정 2: 호출부가 이미 읽어둔 프로필. 여기 있는 ocid는 캐시를 다시 읽지 않는다.
  // 없는 ocid는 종전대로 직접 읽는다 — 이 함수가 호출부의 조회 범위에 묶이지 않게 한다.
  knownProfiles: Map<string, CharacterProfileInfo>,
): Promise<BossProfitRow[]> {
  if (ocids.length === 0) {
    return []
  }

  const records = (await withSqliteFallback(getBossProfitRecords(ocids, [periodKey]), [])).filter(
    (record) => record.cycle === cycle,
  )
  if (records.length === 0) {
    return []
  }

  const profileCache = new Map<string, CharacterProfileInfo | null>(knownProfiles)
  const rows: BossProfitRow[] = []

  for (const record of records) {
    if (!profileCache.has(record.ocid)) {
      const cached = await getCachedCharacterBasic(record.ocid)
      profileCache.set(
        record.ocid,
        cached === null
          ? null
          : {
              characterName: cached.profile.name,
              imageUrl: cached.profile.imageUrl,
              world: cached.profile.world ?? null,
            },
      )
    }
    const profile = profileCache.get(record.ocid) ?? null
    if (profile === null) {
      continue
    }
    rows.push(buildRowFromRecord(record, profile, now))
  }

  return rows
}






/**
 * 정리 결과를 알린다 — **조용히 지우지 않는다**.
 *
 * `showInfo`(자동 소멸)다: 실패가 아니라 규칙 안내라 이 한도 토스트에 고른
 * 변형과 같다. 지운 것이 없으면 말할 것도 없다(멱등한 회차마다 토스트가 뜨면 소음이 된다).
 */
function notifyOrphanDropCleanup(removedDrops: number): void {
  if (removedDrops === 0) return
  useToastStore
    .getState()
    .showInfo(`잡지 않은 보스의 아이템 기록 ${removedDrops}건을 정리했어요`)
}

type BossProfitSetter = (partial: Partial<BossProfitState>) => void

/**
 * 드롭 맵이 담을 행 — **보고 있는 기간 ∪ 지금 기간**.
 *
 * `dropsByRowKey` 는 사본을 만들지 않는다. 키(`dropRowKey`)에 `periodKey` 가 들어 있어 두 기간이 한
 * 맵에 있어도 충돌하지 않고, 사본을 두면 드롭 편집 경로(`setBossDrops`·`applyExternalDropEdit`)가
 * 둘로 갈려 «today 에만 반영이 안 되는» 결함이 아이템 수익 쪽에서 되풀이된다.
 *
 * 조회는 늘어나지 않는다 — `loadDropsByRowKey` 가 기간 키를 모아 **한 번에** 읽는다. 행이 겹쳐도
 * 무해하다(그 함수의 정리 루프는 멱등이다).
 */
function withCurrentPeriodRows(rows: BossProfitRow[]): BossProfitRow[] {
  return latestSyncSnapshot === null ? rows : [...rows, ...latestSyncSnapshot.rows]
}





async function loadPeriod(
  set: BossProfitSetter,
  tab: BossCycle,
  periodKey: string,
  ocids: string[],
  now: Date,
  generation: number,
): Promise<void> {
  const currentPeriodKey = getCurrentBossProfitPeriod(tab, now).periodKey
  // buildWeeklySubtotalsForMonth의 캐릭터별 행 순서를 항상 동일하게 유지하기 위해 여기서도
  // 같은 정렬 규칙을 적용한다(refresh()와 동일한 이유 — API 응답 순서에 좌우되지 않도록).
  const sortedCharacterInfo = await getSortedCharacterInfo(ocids)
  const sortedOcids = sortedCharacterInfo.map((info) => info.ocid)
  // ADR-078 결정 2: 위 조회가 이미 캐릭터당 한 번씩 프로필을 읽었다. 그 결과를 아래 두 함수에
  // 넘겨 같은 캐시를 다시 읽지 않게 한다(캐릭터 6명 기준 18회 → 6회).
  const profileSnapshot = toProfileSnapshot(sortedCharacterInfo)

  if (periodKey === currentPeriodKey) {
    const rows =
      latestSyncSnapshot === null ? [] : filterRowsForTab(latestSyncSnapshot.rows, tab, periodKey)
    const weeklySubtotals =
      tab === 'monthly'
        ? await buildWeeklySubtotalsForMonth(
            sortedOcids,
            periodKey,
            latestSyncSnapshot?.rows ?? [],
            latestSyncSnapshot?.characterProfiles ?? new Map(),
            now,
          )
        : []
    // 서로 독립인 SQLite 조회라 병렬로 던진다. 직렬로 두면 조회 하나가 지연될 때마다
    // withSqliteFallback 의 5초 타임아웃이 줄줄이 더해진다(ADR-078 결정 1과 같은 이유).
    const [canGoPreviousPeriod, dropsByRowKey, previousPeriodTotalMeso] = await Promise.all([
      canReachPreviousPeriod(tab, periodKey, ocids, now),
      loadDropsByRowKey(ocids, withCurrentPeriodRows(rows), now),
      loadPreviousPeriodTotal(ocids, tab, periodKey),
    ])
    if (generation !== requestGeneration) return
    // loadPeriod는 항상 로컬 데이터(스냅샷/기록)로만 뷰를 정착시키고 실시간 동기화를 하지 않는다.
    // 또한 이 함수는 항상 requestGeneration을 올린 네비게이션 뒤에만 실행되므로, 진행 중이던
    // refresh의 'loading'은 이미 무효화된 상태다. 여기서 status를 'loaded'로 확정하지 않으면,
    // refresh 도중 기간을 이동했다가 돌아왔을 때 refresh의 최종 'loaded' set이 세대 가드에 막혀
    // status가 'loading'에 영구히 갇히는 버그가 생긴다(사용자 보고 — "조회 중..." 무한 진행).
    set({
      status: 'loaded',
      rows,
      loadedTab: tab,
      loadedPeriodKey: periodKey,
      dropsByRowKey,
      weeklySubtotals,
      isPeriodLoading: false,
      // 현재 기간은 실시간 동기화가 원천이라 recorded/confirmedEmpty뿐이다.
      periodState: resolvePeriodDataState({
        isCurrentPeriod: true,
        hasRecords: rows.length > 0,
        isChecked: false,
        isQueryable: false,
        lastOutcome: null,
      }),
      canGoPreviousPeriod,
      previousPeriodTotalMeso,
    })
    return
  }

  // 각 target(캐릭터×기간)의 상태를 모아 이 화면의 상태를 정한다.
  // 조회 불가(구간 밖) target은 **호출하지도, checked로 굳히지도 않는다** — 날짜만 보면 언제든
  // 다시 판정할 수 있고, 굳히면 "0건 확정"과 구분이 사라진다(결정 3).
  // ADR-078 결정 1: target별 조회는 서로 독립이라 병렬로 던진다. 직렬 await 이면 월간 탭에서
  // `캐릭터 수 × (1 + 그 달의 주차 수)` 만큼 네이티브 왕복이 줄줄이 늘어서고, 그동안 화면은
  // 중간 상태(옛 기간 행 + 새 기간 라벨)에 머문다. buildWeeklySubtotalsForMonth가 같은 조회를
  // 이미 Promise.all 로 묶고 있다.
  const targets = buildBackfillTargets(tab, periodKey, ocids, now)
  const checkedFlags = await Promise.all(
    targets.map((target) =>
      withSqliteFallback(isPeriodChecked(target.ocid, target.cycle, target.periodKey), false),
    ),
  )
  const checkedByTarget = new Map<BackfillTarget, boolean>()
  const uncheckedTargets: BackfillTarget[] = []
  // 순회는 targets 순서 그대로다 — 뒤따르는 백필 루프가 순차 실행이라(ADR-067 결정 3, 호출 절약)
  // 이 순서가 곧 화면이 채워지는 순서다.
  targets.forEach((target, index) => {
    const checked = checkedFlags[index]
    checkedByTarget.set(target, checked)
    if (!checked && isPeriodQueryable(target.cycle, target.periodKey, now)) {
      uncheckedTargets.push(target)
    }
  })

  const outcomeByTarget = new Map<BackfillTarget, PeriodQueryOutcome | null>()

  if (uncheckedTargets.length > 0) {
    if (generation !== requestGeneration) return
    set({ isPeriodLoading: true })
    for (const target of uncheckedTargets) {
      outcomeByTarget.set(target, await backfillTarget(target, now))
    }
  }

  const rows = sortRowsByOcidOrder(
    await buildRowsFromRecords(ocids, tab, periodKey, now, profileSnapshot),
    sortedOcids,
  )
  const weeklySubtotals =
    tab === 'monthly'
      ? await buildWeeklySubtotalsForMonth(sortedOcids, periodKey, [], profileSnapshot, now)
      : []
  // **지난 기간의 고아 드롭을 지운다**(— 셋째 경로). 과거 기간은 기록이 곧
  // 사실이라(`buildRowsFromRecords`) 동기화 신선도를 따질 것이 없다 — 백필된 적 없는 주는 행이
  // 통째로 비어 안전 장치 ②가 알아서 막는다.
  //
  // **정리 → 읽기 순서는 지키되 다른 둘과는 나란히 간다** — 지운 것이 화면 맵에
  // 남지 않으려면 `loadDropsByRowKey` 보다 앞이어야 하지만, 앞줄에 세워 직렬로 두면 기간을 옮길
  // 때마다 왕복이 하나 더 얹힌다. 그래서 **그 갈래 안에서만** 이어 붙인다.
  const [canGoPreviousPeriod, dropsByRowKey, previousPeriodTotalMeso] = await Promise.all([
    canReachPreviousPeriod(tab, periodKey, ocids, now),
    sweepOrphanDrops({
      ocids,
      rows,
      trustedOcids: new Set(ocids),
      // **보고 있는 기간 하나뿐**이다 — `withCurrentPeriodRows` 가 섞어 넣는 지금 기간 행은 이
      // 회차가 판정할 대상이 아니다(그쪽은 동기화 경로가 자기 신선도를 알고 판정한다).
      knownPeriodKeys: new Set([periodKey]),
      now,
    }).then((removedDrops) => {
      notifyOrphanDropCleanup(removedDrops)
      return loadDropsByRowKey(ocids, withCurrentPeriodRows(rows), now)
    }),
    loadPreviousPeriodTotal(ocids, tab, periodKey),
  ])

  // target별 상태 → 이 화면의 상태. 기록 유무는 방금 읽은 rows에서 본다(같은 조회를 두 번 하지 않는다).
  const recordedOcids = new Set(rows.map((row) => row.ocid))
  const periodState = resolvePagePeriodState(
    targets.map((target) =>
      resolvePeriodDataState({
        isCurrentPeriod: false,
        hasRecords: recordedOcids.has(target.ocid),
        isChecked: checkedByTarget.get(target) ?? false,
        isQueryable: isPeriodQueryable(target.cycle, target.periodKey, now),
        lastOutcome: outcomeByTarget.get(target) ?? null,
      }),
    ),
  )

  if (generation !== requestGeneration) return
  // status를 'loaded'로 확정한다 — 위 "현재 기간" 분기와 같은 이유(중단된 refresh의 'loading'이
  // 세대 가드로 갇히는 것 방지).
  set({
    status: 'loaded',
    rows,
    loadedTab: tab,
    loadedPeriodKey: periodKey,
    dropsByRowKey,
    weeklySubtotals,
    isPeriodLoading: false,
    periodState,
    canGoPreviousPeriod,
    previousPeriodTotalMeso,
  })
}

const initialState: BossProfitState = {
  status: 'idle',
  previousPeriodTotalMeso: 0,
  tab: 'weekly',
  periodKey: getCurrentBossProfitPeriod('weekly', new Date()).periodKey,
  rows: [],
  loadedTab: 'weekly',
  loadedPeriodKey: getCurrentBossProfitPeriod('weekly', new Date()).periodKey,
  currentPeriodRows: [],
  dropsByRowKey: {},
  weeklySubtotals: [],
  isPeriodLoading: false,
  periodState: 'confirmedEmpty',
  canGoPreviousPeriod: false,
  error: null,
  staleCharacterNames: [],
  characterIssues: {},
  trackedOcids: null,
  lastSyncedAt: null,
}

// ADR-101 결정 4: 부팅 선하이드레이션(`features/prehydrate`)과 화면 마운트가 같은 회차를 부르므로,
// 진행 중인 회차가 있으면 그 Promise 를 그대로 돌려준다. **"평생 한 번"이 아니라 "동시에 하나만"**
// 이다 — 끝나면 잊는다. 영구 메모로 만들면 진입 재조회의 10분 TTL이 죽는다.
let hydration: Promise<void> | null = null

export const useBossProfitStore = create<BossProfitStore>()((rawSet, get) => {
  /**
   * **이 스토어의 모든 커밋은 «지금 기간» 을 함께 싣는다**.
   *
   * `currentPeriodRows` 의 내용은 `latestSyncSnapshot.rows` 와 같다. 그것을 «갱신하는 자리마다
   * 잊지 않고 함께 쓴다» 로 두면 사본 둘이 언젠가 어긋나고(그 어긋남은 `setPartySize` 에서 실제로
   * 한 번 터졌다 — 2026-07-22), 반대로 스냅샷을 바꿀 때마다 `set` 을 한 번씩 더 부르면 «건너뛴
   * 진입의 커밋은 1회» 가 깨진다(— 그 계약은 화면 깜빡임을 막는다).
   *
   * 그래서 **커밋 자체에 얹는다** — 커밋 수는 그대로이고, 어느 커밋에서 보든 상태와 스냅샷이 같다.
   * 대신 스냅샷 대입은 **그것을 화면에 반영할 `set` 보다 앞**에 와야 한다(지금 네 자리 모두 그렇다).
   */
  const set: BossProfitSetter = (partial) => {
    rawSet({ ...partial, currentPeriodRows: latestSyncSnapshot?.rows ?? [] })
  }

  return {
  ...initialState,

  loadTrackedOcids() {
    // ADR-101 결정 4: 동시 호출은 한 회차로 합친다(위 `hydration` 주석).
    hydration ??= (async () => {
      const ocids = await getTrackedCharacterOcids()
      set({ trackedOcids: ocids })
      if (ocids !== null) {
        // ADR-097 결정 4: 자동 진입 경로는 여기 하나뿐이라 게이트를 놓칠 자리가 생기지 않는다.
        await get().refresh(ocids, { auto: true })
      }
    })().finally(() => {
      hydration = null
    })
    return hydration
  },

  async refresh(ocids, options) {
    const myGeneration = ++requestGeneration
    const tab = get().tab
    const now = new Date()
    const currentPeriodKey = getCurrentBossProfitPeriod(tab, now).periodKey

    // ADR-076: 보고 있는 기간이 "진행 중인 주를 품은 지난 달"(7월 5주차 = 7/30~8/5)이면 그 화면에서
    // 새로고침할 수 있고, 그때는 **보던 기간을 유지**한다 — 동기화·자동 기록·스냅샷 갱신은 그대로
    // 하고(진행 중인 주의 기록은 그 길로만 만들어진다) 화면 반영만 loadPeriod에 넘긴다.
    const viewedPeriodKey = get().periodKey
    const refreshInPlace = containsInProgressWeek(tab, viewedPeriodKey, now)

    // 직전 기간 합계는 이 새로고침이 **바꾸지 않는 값**이다 — 자동 기록(upsert)은 현재 기간에만
    // 쓰므로 직전 기간의 기록은 그대로다. 그래서 한 번만 읽고 두 단계(캐시·동기화 완료)가 나눠 쓴다.
    // 여기서 미리 던져 다른 조회와 겹치게 한다 — 단계 사이에 끼워 넣으면 SQLite 지연 시
    // withSqliteFallback 의 5초 창이 직렬로 하나 더 붙는다.
    const previousPeriodTotalPromise = loadPreviousPeriodTotal(ocids, tab, currentPeriodKey)

    if (ocids.length === 0) {
      latestSyncSnapshot = { ocids: [], rows: [], characterProfiles: new Map() }
      if (myGeneration !== requestGeneration) return
      set({
        status: 'loaded',
        periodKey: currentPeriodKey,
        rows: [],
        loadedTab: tab,
        loadedPeriodKey: currentPeriodKey,
        dropsByRowKey: {},
        weeklySubtotals: [],
        isPeriodLoading: false,
        periodState: 'confirmedEmpty',
        canGoPreviousPeriod: false,
        error: null,
        staleCharacterNames: [],
        characterIssues: {},
      })
      return
    }

    // 캐시 우선 표시·실시간 동기화 양쪽에서 항상 같은 캐릭터 순서(레벨 내림차순, 동레벨은
    // 이름순)를 쓰도록 미리 계산해둔다 — trackedOcids 저장 순서와 Nexon character/list 응답
    // 순서가 달라 API 응답 이후 캐릭터 목록 위치가 바뀌어 보이던 문제를 없앤다. 아바타 이미지도
    // 이 조회에 함께 실려 온다(character-basic-cache의 character_image, ADR-023).
    const sortedCharacterInfo = await getSortedCharacterInfo(ocids)
    const sortedOcids = sortedCharacterInfo.map((info) => info.ocid)
    const imageUrlByOcid = new Map(sortedCharacterInfo.map((info) => [info.ocid, info.imageUrl]))
    // 월드도 같은 조회 결과에서 그대로 꺼내 행까지 흘린다.
    const worldByOcid = new Map(sortedCharacterInfo.map((info) => [info.ocid, info.world]))

    // ADR-069 결정 3: `world` 컬럼을 새로 더했으므로 그전 기록에는 월드가 없다. 지금 아는 월드로
    // 채운다 — `world IS NULL` 조건이 멱등성을 보장하므로 리프 후에 다시 실행돼도 과거 스냅샷을
    // 덮어쓰지 않는다. 실사용자가 없는 지금만 할 수 있는 선택이다(배포 후엔 리프한 캐릭터의 과거를
    // 잘못 고정하게 된다).
    const knownWorlds = new Map<string, string>()
    for (const [ocid, world] of worldByOcid) {
      if (world !== null) knownWorlds.set(ocid, world)
    }
    await withSqliteFallback(fillMissingRecordWorlds(knownWorlds), undefined)

    // refresh는 항상 "현재 기간"을 보여주므로, 여기서 한 칸 더 과거로 갈 수 있는지도 함께 계산해
    // 이전 버튼 게이트(#29)를 세운다. refresh는 현재 기간만 갱신하고 이전 기간의 기록은 건드리지
    // 않으므로 아래 캐시·라이브 두 set() 모두 같은 값을 쓴다. 현재 기간의 이전 기간은 대개 롤링
    // 윈도우 안이라 이 계산은 보통 DB 조회 없이 즉시 끝난다(canReachPreviousPeriod 참고).
    const canGoPreviousPeriod = await canReachPreviousPeriod(tab, currentPeriodKey, ocids, now)

    // ADR-035 결정 21: 수동 모드에서는 게임 등록/처치가 아니라 사용자 멤버십(manualTrackedContent)이 표시 목록을
    // 결정하므로 캐시·라이브 브랜치 양쪽에서 참조할 수동 목록을 미리 조회해둔다(#33). 자동 모드는 이 조회를 하지
    // 않는다 — 자동 동작은 트래킹과 완전히 독립이다.
    // ADR-086 결정 2: 미선택(null)은 '자동'으로 동작한다 — 동작 기본값은 그대로다(ADR-035 결정 2).
    // null을 "아직 안 골랐다"로 읽는 곳은 온보딩 게이트 하나뿐이다.
    const mode = (await getTrackingMode()) ?? 'auto'
    const manualItemsByOcid = new Map<string, ManualTrackedItem[]>()
    if (mode === 'manual') {
      await Promise.all(
        ocids.map(async (ocid) => {
          manualItemsByOcid.set(ocid, await getManualTrackedContent(ocid))
        }),
      )
    }

    // 캐시 엔트리 한 캐릭터분. 행뿐 아니라 게이트 판정값(syncedAt)과 **프로필**도 함께 나른다 —
    // 프로필이 행에만 실려 있으면 행이 0인 캐릭터에서 그것을 꺼낼 방법이 없다.
    interface CachedCharacterEntry {
      syncedAt: string | null
      profile: CharacterProfileInfo | null
      rows: BossProfitRow[]
    }

    // ADR-017 결정 1: 캐시 우선 표시 — 재검증(syncSchedules) 전에 마지막으로 성공한
    // 스케줄 캐시가 있으면 완료된 보스만 걸러 화면을 먼저 채운다. 이미 저장된 기록이
    // 있으면 함께 조회해 partySize/payoutMeso도 바로 보여준다(단순 읽기이므로 안전) —
    // 다만 기록이 없는 조합에 대한 자동 기록(upsert)은 **재검증하는 진입에서는** 이 단계에서
    // 하지 않는다. 낡은 캐시를 기준으로 잘못된 파티원 수를 기록해버리는 걸 막기 위해, 그
    // 경로의 자동 기록은 지금처럼 실제 재검증(syncSchedules) 이후에만 수행한다.
    // ADR-111 결정 1: **재조회를 건너뛰는 진입**(skipSync)은 예외다 — 이 단계가 곧 최종 화면이라
    // 여기서 기록하지 않으면 화면이 계산되지 않은 채로 선다(아래 autoRecordRows 호출).
    // ADR-097 결정 4: 재조회 게이트의 판정값(syncedAt)도 이 단계에서 함께 모은다 — 이 조회가
    // 이미 추적 캐릭터 전원의 캐시 엔트리를 읽으므로 판정용 저장소 조회가 0회다. **캐릭터 단위**
    // 배열이다: 한 캐릭터가 여러 행을 만들므로 행 배열로 세면 개수가 틀어진다.
    const cachedByOcid = await Promise.all(
      ocids.map(async (ocid): Promise<CachedCharacterEntry> => {
        const cached = await getCachedSchedulerState(ocid)
        if (cached === null) {
          return { syncedAt: null, profile: null, rows: [] }
        }
        // 자동 모드: 완료된 보스뿐 아니라 등록만 되고 아직 처치 전인 보스도 미완료 placeholder로 함께
        // 보여준다(ADR-032) — selectBossProfitBosses가 그룹(같은 apiName)당 "실제로 처치한"
        // 난이도(ownComplete)를 우선하고, 없으면 등록 난이도를 미완료 placeholder로 대신
        // 고른다. boss-scheduler의 selectDisplayBosses(등록 여부 우선)와 달리, 등록 난이도와
        // 실제 처치 난이도가 다를 수 있어 가격 계산에는 반드시 실제 처치 난이도를
        // 써야 한다. 수동 모드는 사용자 멤버십을 병합해 표시한다(ADR-035 결정 21).
        const displayBosses = selectProfitDisplayBosses(cached.state.bossContents, mode, manualItemsByOcid.get(ocid) ?? [])
        const profile: CharacterProfileInfo = {
          characterName: cached.state.characterName,
          imageUrl: imageUrlByOcid.get(ocid) ?? null,
          world: worldByOcid.get(ocid) ?? null,
        }
        return {
          syncedAt: cached.syncedAt,
          profile,
          rows: displayBosses.map((boss) => buildBossProfitRow(ocid, profile, boss, now)),
        }
      }),
    )
    const cachedRows = cachedByOcid.flatMap((entry) => entry.rows)

    // ADR-111 결정 6: 프로필 맵은 **행이 아니라 캐시 엔트리**에서 만든다. 행에서 만들면 축약 응답으로
    // 행이 0인 캐릭터는 프로필이 없고, appendRecordOnlyRows 가 그 캐릭터를 통째로 건너뛴다 —
    // 정확히 그 복원이 겨누는 시나리오가 프로필 부재로 다시 막힌다. 캐시 엔트리 자체가 없는 ocid는
    // 여전히 제외한다(이름을 모르면 행을 만들 수 없다).
    const cachedCharacterProfiles = new Map<string, CharacterProfileInfo>()
    ocids.forEach((ocid, index) => {
      const profile = cachedByOcid[index].profile
      if (profile !== null) cachedCharacterProfiles.set(ocid, profile)
    })

    // ADR-097 결정 1~3: 화면 진입 자동 재조회는 데이터가 신선하면 건너뛴다. 캐시가 없는 캐릭터는
    // 여기서 빠지므로 isSyncFresh 가 개수 불일치로 만료 판정한다(새 캐릭터가 빈 채 남지 않는다).
    const cachedSyncedAts = cachedByOcid
      .map((entry) => entry.syncedAt)
      .filter((syncedAt): syncedAt is string => syncedAt !== null)
    const skipSync =
      options?.auto === true && hasSyncAttemptedThisRun() && isSyncFresh(cachedSyncedAts, ocids.length, now)
    // 결정 5: 건너뛴 진입의 "n분 전"은 판정에 쓴 **가장 오래된 캐시 syncedAt** 이다 — 지금 시각으로
    // 채우면 하지 않은 동기화를 했다고 말하게 되고, 그대로 두면(null) 신선한 데이터를 보여주면서
    // "동기화 기록 없음"이라 말하게 된다.
    const oldestCachedSyncedAt = cachedSyncedAts.reduce<string | null>(
      (oldest, syncedAt) =>
        oldest === null || new Date(syncedAt).getTime() < new Date(oldest).getTime() ? syncedAt : oldest,
      null,
    )

    // ADR-111 결정 6: 캐시 행에서 파생한 키만 쓰면 **행이 없는 기간의 기록을 조회조차 하지 않아**
    // 되살릴 재료가 애초에 없다(축약 응답으로 월간 행이 통째로 빠지는 경로가 실측됐다 —
    // ). 동기화 분기와 같이 현재 주·달 키를 항상 포함한다.
    const cachedPeriodKeys = Array.from(
      new Set([
        ...cachedRows.map((row) => row.periodKey),
        getCurrentBossProfitPeriod('weekly', now).periodKey,
        getCurrentBossProfitPeriod('monthly', now).periodKey,
      ]),
    )
    // 폴백을 []가 아니라 null로 둬 "조회 실패"와 "기록 없음"을 구분한다 — 아래 자동 기록이
    // 실패를 "없음"으로 읽으면 사용자가 저장한 파티원 수가 1로 덮인다(
    // -④). 캐시 행이 0인 진입에서도 조회한다 — 그 진입(축약 응답으로 행이 전부
    // 사라진 경우)이 정확히 아래 복원이 겨누는 시나리오라, 행 개수로 막으면 재료가 사라진다.
    const cachedRecords = await withSqliteFallback<BossProfitRecord[] | null>(
      getBossProfitRecords(ocids, cachedPeriodKeys),
      null,
    )
    const cachedMergedRows = mergeRecordsIntoRows(cachedRows, cachedRecords ?? [])

    // ADR-111 결정 2·3: 이 행의 출처 캐시가 **보스 리셋 경계를 넘었는지**만 본다. `buildBossProfitRow`
    // 가 periodKey를 now로 계산하므로 그 경우에만 지난 기간의 처치가 이번 기간 수익으로 굳는다 —
    // 한 기간 안에서는 "처치 완료"가 되돌아가지 않아 다른 손해 시나리오가 없다. 판정 기준은 캐시의
    // syncedAt이다(API 응답의 asOf가 아니다) — row.periodKey를 계산한 now와 **같은 기기 시계**여야
    // 하고, 게이트(isSyncFresh)가 이미 그 값을 쓰므로 기준이 하나로 남는다.
    const syncedAtByOcid = new Map(ocids.map((ocid, index) => [ocid, cachedByOcid[index].syncedAt]))
    const isCachedRowCurrent = (row: BossProfitRow): boolean => {
      const syncedAt = syncedAtByOcid.get(row.ocid) ?? null
      if (syncedAt === null) return false
      const syncedAtDate = new Date(syncedAt)
      if (Number.isNaN(syncedAtDate.getTime())) return false
      // cycle로 갈라야 주간 행은 주간 리셋(목요일 00:00), 월간 행은 월간 리셋(1일 00:00)으로 본다 —
      // 두 주기의 경계 시점이 다르므로 한쪽으로 뭉뚱그리면 반대쪽이 조용히 틀린다.
      return getCurrentBossProfitPeriod(row.cycle, syncedAtDate).periodKey === row.periodKey
    }

    // ADR-111 결정 1·4: 건너뛴 진입은 이 캐시 단계가 곧 최종 화면이다 — 건너뛰는 것은 네트워크
    // 재조회뿐이고, 수익의 "계산"인 자동 기록·드롭 이관은 여기서 한다. 자리는 아래 set()보다 앞이라
    // 총 수익이 0으로 그려졌다가 점프하지 않고, refreshInPlace 분기보다도 앞이라 두 분기가 함께
    // 덮인다. 건너뛰지 않는 진입은 종전대로 하지 않는다 — 그 캐시는 낡았을 수 있고 곧 실제 동기화가
    // 오므로의 방어가 설 자리는 정확히 거기다(결정 5-②).
    const cachedDropRecordsForMigration =
      skipSync && cachedRecords !== null
        ? await withSqliteFallback(getBossDropRecords(ocids, cachedPeriodKeys), [])
        : []
    // loadDropsByRowKey보다 반드시 먼저다 — 이관이 드롭의 난이도 키를 옮기므로, 먼저 읽으면
    // 이관 전 상태가 화면에 남는다.
    const cachedAutoRecordedRows = skipSync
      ? await autoRecordRows({
          rows: cachedMergedRows,
          records: cachedRecords,
          dropRecords: cachedDropRecordsForMigration,
          now,
          isSourceCurrent: isCachedRowCurrent,
        })
      : cachedMergedRows

    // ADR-111 결정 6: 기록만 있는 조합을 행으로 되살린다(의 캐시 단계 누락 보완).
    // **자동 기록 뒤**여야 한다 — 복원 행은 기록에서 나와 partySize 가 이미 채워져 있어 자동 기록
    // 대상이 아니고, 앞에 두면 그 루프가 헛돈다(동기화 분기도 같은 순서다). **skipSync 여부와
    // 무관하게** 캐시 단계 일반에 적용한다 — 두 경로가 다른 화면을 그리면 그것이 다음 결함이 된다.
    // 정렬은 여기서 한 번만 한다 — 복원 행이 정렬 밖에 남으면 캐릭터 아코디언 순서가 흔들린다.
    const cachedSortedRows = sortRowsByOcidOrder(
      appendRecordOnlyRows(cachedAutoRecordedRows, cachedRecords ?? [], cachedCharacterProfiles, now),
      sortedOcids,
    )

    // latestSyncSnapshot을 캐시 데이터로 즉시 채워둔다 — 이후 syncSchedules가 실패해도(네트워크
    // 등) 이 스냅샷이 null로 남지 않아야, 그 상태에서 tab 전환/기간 이동(loadPeriod)을 해도
    // 캐시 우선 표시(ADR-016/017)가 계속 유지된다. 실시간 동기화가 성공하면 아래에서 다시
    // 최신 데이터로 덮어쓴다.
    latestSyncSnapshot = {
      ocids: [...ocids],
      rows: cachedSortedRows,
      characterProfiles: cachedCharacterProfiles,
    }

    // 제자리 새로고침(ADR-076 결정 2)은 캐시 우선 표시의 **화면 반영만** 건너뛴다 — 이 단계가
    // 그리는 것은 현재 기간의 캐시 행이라, 그대로 두면 7월 화면에 8월 데이터가 한 프레임 스친다.
    // 화면은 이미 그 기간을 그리고 있으므로 새로 그릴 것도 없다. 바로 위의 latestSyncSnapshot
    // 갱신은 그대로 한다(동기화가 실패해도 현재 기간으로 돌아갔을 때 캐시 우선 표시가 유지돼야 한다).
    if (refreshInPlace) {
      if (myGeneration !== requestGeneration) return
      // ADR-097: 건너뛰는 진입도 이 분기의 규약을 그대로 따른다 — 화면 반영은 loadPeriod가 하고
      // (그 함수가 status/rows/periodState를 정한다) 여기서는 실패 표식만 비운다. 건너뛰는 것은
      // syncSchedules(와 그에 딸린 자동 기록)뿐이고, loadPeriod의 기록 조회·백필 규칙은 무변경이다.
      if (skipSync) {
        set({
          error: null,
          staleCharacterNames: [],
          characterIssues: {},
          lastSyncedAt: oldestCachedSyncedAt,
        })
        await loadPeriod(set, tab, viewedPeriodKey, ocids, now, myGeneration)
        return
      }
      set({ status: 'loading', error: null, staleCharacterNames: [], characterIssues: {} })
    } else {
      // monthly 탭의 주차별 합계도 캐시 단계에서 미리 채운다 — 지난 주차 합계는 로컬 기록
      // (getBossProfitRecords) 조회만으로 구해지는 값이라 API 재검증을 기다릴 이유가 없다.
      // 이걸 생략하면 매번 화면 진입 시 이미 확정된 지난 주차 합계까지 잠깐 사라졌다가
      // syncSchedules 완료 후에야 다시 채워지는 것처럼 보인다.
      const cachedWeeklySubtotals =
        tab === 'monthly'
          ? await buildWeeklySubtotalsForMonth(
              sortedOcids,
              currentPeriodKey,
              cachedSortedRows,
              cachedCharacterProfiles,
              now,
            )
          : []

      // 캐시 단계가 그릴 것이 없으면 총 수익 헤드라인도 없으므로 그 비교 기준을 기다릴 이유가 없다
      // (값 자체는 아래 동기화 완료 단계가 쓴다). 판정은 **복원까지 끝낸 최종 행**으로 한다
      // 캐시 행이 0이어도 기록에서 되살아난 행이 있으면 헤드라인이 있다.
      // ADR-097: 건너뛰는 진입에는 이 값을 다시 채울 동기화 완료 단계가 없다 — 행이 하나도 없어도
      // (예: 주간 리셋 직후) 직전 기간 합계를 읽어야 증감 칩이 0으로 굳지 않는다.
      const [cachedDropsByRowKey, previousPeriodTotalMeso] = await Promise.all([
        loadDropsByRowKey(ocids, cachedSortedRows, now),
        cachedSortedRows.length > 0 || skipSync ? previousPeriodTotalPromise : Promise.resolve(0),
      ])

      // 이 호출보다 나중에 시작된 refresh/setTab/goToXPeriod가 이미 있다면(연타 등) 이 시점의
      // 캐시 우선 표시조차 화면에 반영하지 않는다 — 더 최신 액션이 이미 진행 중이므로 그 결과가
      // 우선한다.
      if (myGeneration !== requestGeneration) return

      set({
        // ADR-097: 건너뛰는 진입은 이 set 하나로 마감한다 — loading을 거쳐 두 번 set 하면
        // 로딩이 한 프레임 번쩍인다. 이 분기가 이미 화면에 필요한 값을 전부 채운다.
        status: skipSync ? 'loaded' : 'loading',
        periodKey: currentPeriodKey,
        rows: filterRowsForTab(cachedSortedRows, tab, currentPeriodKey),
        loadedTab: tab,
        loadedPeriodKey: currentPeriodKey,
        dropsByRowKey: cachedDropsByRowKey,
        weeklySubtotals: cachedWeeklySubtotals,
        isPeriodLoading: false,
        periodState: cachedSortedRows.length > 0 ? 'recorded' : 'confirmedEmpty',
        canGoPreviousPeriod,
        previousPeriodTotalMeso,
        error: null,
        staleCharacterNames: [],
        characterIssues: {},
        ...(skipSync ? { lastSyncedAt: oldestCachedSyncedAt } : {}),
      })
      if (skipSync) return
    }

    let results: Awaited<ReturnType<typeof syncSchedules>>
    try {
      results = await syncSchedules(ocids)
    } catch (error) {
      // syncSchedules 자체가 던지는 에러(온보딩 미완료 등)는
      // 캐릭터별 에러가 아니라 전체 조회 자체의 실패다.
      // 원인은 toScheduleSyncError로 살린다.
      if (myGeneration === requestGeneration) {
        set({ status: 'error', error: toScheduleSyncError(error) })
      }
      return
    }

    // ADR-097 결정 7 후단(이슈 #139): 방금 끝난 syncSchedules 가 대상 캐릭터의 character/basic 도
    // 함께 받아 character-basic-cache 를 갱신했다(편승 갱신). 이 화면만 프로필을 동기화 **이전에**
    // 읽으므로(위 sortedCharacterInfo — 캐시 우선 표시가 즉시 그리려면 그래야 한다), 여기서 다시
    // 읽지 않으면 갱신된 레벨·이미지가 이 회차 화면에 반영되지 않고 다음 진입으로 밀린다.
    // character-basic-cache 를 읽는 로컬 조회라 네트워크는 0회다. 캐시 우선 표시 단계는 위의 옛
    // 값을 그대로 쓴다 — 거기서 새 값을 기다리면 첫 페인트가 그만큼 늦어진다.
    // 레벨이 바뀌어 캐릭터 순서가 바뀌는 것은 의도된 결과다(정렬 규칙은 ADR-017 결정 2 그대로).
    const syncedCharacterInfo = await getSortedCharacterInfo(ocids)
    const syncedOcids = syncedCharacterInfo.map((info) => info.ocid)
    const syncedImageUrlByOcid = new Map(syncedCharacterInfo.map((info) => [info.ocid, info.imageUrl]))
    const syncedWorldByOcid = new Map(syncedCharacterInfo.map((info) => [info.ocid, info.world]))

    const rows: BossProfitRow[] = []
    const staleCharacterNames: string[] = []
    const characterIssues: Record<string, 'unavailable' | 'failed'> = {}
    // 동기화가 실패한 캐릭터. buildFallbackResult가 **마지막 캐시 상태를 그대로** 돌려주므로
    // (schedule-sync.ts) 그 state의 완료 여부는 "지금"의 사실이 아니다 — 자동 기록에서 제외한다
    // . 표시는 캐시 우선 표시 규약을 그대로 따르고, 그 카드에
    // 표식을 붙이는 것은의 몫이다.
    const staleOcids = new Set<string>()
    const characterProfiles = new Map<string, CharacterProfileInfo>()

    for (const result of results) {
      const profile: CharacterProfileInfo = {
        characterName: result.characterName,
        imageUrl: syncedImageUrlByOcid.get(result.ocid) ?? null,
        world: syncedWorldByOcid.get(result.ocid) ?? null,
      }
      characterProfiles.set(result.ocid, profile)

      if (result.isStale) {
        staleCharacterNames.push(result.characterName)
        staleOcids.add(result.ocid)
        // 영구(조회 불가)와 일시(그 외)를 카드에서도 갈라 말한다 — 전자는
        // 재시도가 무의미하고 할 수 있는 것이 추적 해제뿐이다.
        characterIssues[result.ocid] =
          result.error?.kind === 'characterUnavailable' ? 'unavailable' : 'failed'
      }

      const displayBosses = selectProfitDisplayBosses(
        result.state?.bossContents ?? [],
        mode,
        manualItemsByOcid.get(result.ocid) ?? [],
      )

      for (const boss of displayBosses) {
        rows.push(buildBossProfitRow(result.ocid, profile, boss, now))
      }
    }

    // 행에서 파생한 기간 키만 쓰면 **행이 없는 기간의 기록을 조회조차 하지 않는다** — 축약 응답으로
    // 월간 행이 사라지면 그 달 기록을 찾지 못해 화면에서 금액이 사라졌다(ADR-067 결정 4). 현재
    // 주·달 키를 항상 포함해 "기록만 있는 조합"을 아래 합집합이 되살릴 수 있게 한다.
    const periodKeys = Array.from(
      new Set([
        ...rows.map((row) => row.periodKey),
        getCurrentBossProfitPeriod('weekly', now).periodKey,
        getCurrentBossProfitPeriod('monthly', now).periodKey,
      ]),
    )
    // 폴백을 []가 아니라 null로 둬 "조회 실패"와 "기록 없음"을 구분한다 — 실패를 "없음"으로 읽으면
    // 아래 자동 기록이 사용자가 저장한 파티원 수를 1로 덮어쓴다.
    const records = await withSqliteFallback<BossProfitRecord[] | null>(
      getBossProfitRecords(ocids, periodKeys),
      null,
    )
    const mergedRows = mergeRecordsIntoRows(rows, records ?? [])

    // ADR-069 결정 4: 완료 행의 드롭 이관에 쓴다(자동 기록과 같은 순회를 쓴다 — auto-record.ts).
    const dropRecordsForMigration =
      records === null
        ? []
        : await withSqliteFallback(getBossDropRecords(ocids, periodKeys), [])

    // 동기화가 실패한 캐릭터의 행은 낡은 캐시에서 나온 것이라 기록·이관에서 제외한다
    // 이 경로가 술어에 넣는 "지금의 사실" 판정이다.
    const autoRecordedRows = await autoRecordRows({
      rows: mergedRows,
      records,
      dropRecords: dropRecordsForMigration,
      now,
      isSourceCurrent: (row) => !staleOcids.has(row.ocid),
    })

    // 기록만 있는 조합을 행으로 되살린다(ADR-067 결정 4 — 위 appendRecordOnlyRows 주석).
    const unionRows = appendRecordOnlyRows(autoRecordedRows, records ?? [], characterProfiles, now)
    const sortedRows = sortRowsByOcidOrder(unionRows, syncedOcids)
    latestSyncSnapshot = { ocids: [...ocids], rows: sortedRows, characterProfiles }

    // **잡지 않은 보스의 드롭을 지운다** — 주간 한도 마감으로 행이 걷힌 자리,
    // 추적에서 빠진 보스, 영영 미처치로 굳은 기간이 전부 여기로 온다(술어는 하나다).
    //
    // 자리가 여기인 이유 셋: ① `autoRecordRows` 의 **난이도 이관 뒤**여야 한다(안 그러면 옮겨질
    // 기록을 고아로 오인한다 — 결정 5 안전 장치 ①) ② `loadDropsByRowKey` **앞**이어야 방금 지운
    // 것이 화면 맵에 남지 않는다 ③ `refreshInPlace` 분기보다 앞이라 두 갈래가 함께 탄다.
    //
    // `records === null` 이면 건너뛴다 — 기록 조회 자체가 실패한 것이라 «행이 없다» 가 아무것도
    // 뜻하지 않는다(이 자동 기록을 멈추는 것과 같은 이유).
    if (records !== null) {
      const removedDrops = await sweepOrphanDrops({
        ocids,
        rows: sortedRows,
        // 동기화가 실패한 캐릭터의 행은 낡은 캐시에서 나온 것이라 판정 근거가 못 된다.
        trustedOcids: new Set(ocids.filter((ocid) => !staleOcids.has(ocid))),
        // 이 회차가 «사실» 을 아는 기간은 동기화가 덮은 지금 기간 둘뿐이다.
        knownPeriodKeys: new Set([
          getCurrentBossProfitPeriod('weekly', now).periodKey,
          getCurrentBossProfitPeriod('monthly', now).periodKey,
        ]),
        now,
      })
      notifyOrphanDropCleanup(removedDrops)
    }

    // 실시간 동기화가 실제로 성공했으므로 "마지막 동기화 시각"을 기록한다 — 세대 가드보다 앞에서
    // 갱신해야 한다. 그 사이 다른 기간으로 이동해(세대가 바뀌어) 아래 최종 set()이 건너뛰어지더라도,
    // latestSyncSnapshot(모듈 스코프)은 이미 신선한 데이터로 갱신되므로 현재 기간으로 돌아오면 그
    // 데이터가 보인다. 이때 lastSyncedAt만 함께 갱신되지 않으면 "신선한 데이터를 보여주면서도
    // 동기화 기록 없음"이라고 표시되는 불일치가 생긴다(사용자 보고). lastSyncedAt은 새로고침이
    // 가능한 기간에서만 노출되므로(#30, ADR-076) 완전히 닫힌 과거 기간을 보는 동안 이 set이
    // 일어나도 화면에는 영향이 없다.
    set({ lastSyncedAt: new Date().toISOString() })

    // **처치 날짜를 캔다** — 자동 기록이 방금 만든 행까지 대상에 든다.
    //
    // 기다리지 않는다. 이 화면은 `defeated_on` 을 **안 쓰므로**(쓰는 곳은 가계부 캘린더 하나다)
    // 결과가 화면을 바꾸지 않고, 기다리면 캘 것이 있는 첫 회차마다 동기화가 조회 수만큼 길어진다.
    // 실패해도 삼킨다 — 못 캔 것은 «칸이 덜 채워진다» 이지 이 동기화의 실패가 아니다.
    void resolveDefeatDates(ocids, now).catch(() => undefined)

    // ADR-076 결정 2: 동기화·자동 기록은 위에서 다 끝났다. 보던 기간(지난 달)의 화면 반영은
    // loadPeriod에 넘긴다 — 그 함수가 이미 "과거 기간은 기록이 원천"을 알고 있어(ADR-067 결정 4)
    // 새 렌더 경로를 만들 이유가 없다. status/rows/weeklySubtotals/periodState/canGoPreviousPeriod는
    // 전부 loadPeriod가 정한다.
    if (refreshInPlace) {
      if (myGeneration !== requestGeneration) return
      set({ staleCharacterNames, characterIssues })
      await loadPeriod(set, tab, viewedPeriodKey, ocids, now, myGeneration)
      return
    }

    const weeklySubtotals =
      tab === 'monthly'
        ? await buildWeeklySubtotalsForMonth(syncedOcids, currentPeriodKey, sortedRows, characterProfiles, now)
        : []

    const [liveDropsByRowKey, livePreviousPeriodTotalMeso] = await Promise.all([
      loadDropsByRowKey(ocids, sortedRows, now),
      previousPeriodTotalPromise,
    ])

    if (myGeneration !== requestGeneration) return

    set({
      status: 'loaded',
      periodKey: currentPeriodKey,
      rows: filterRowsForTab(sortedRows, tab, currentPeriodKey),
      loadedTab: tab,
      loadedPeriodKey: currentPeriodKey,
      dropsByRowKey: liveDropsByRowKey,
      weeklySubtotals,
      isPeriodLoading: false,
      periodState: sortedRows.length > 0 ? 'recorded' : 'confirmedEmpty',
      canGoPreviousPeriod,
      previousPeriodTotalMeso: livePreviousPeriodTotalMeso,
      error: null,
      staleCharacterNames,
      characterIssues,
      // lastSyncedAt은 위에서 세대 가드보다 먼저 갱신했다(중단돼도 시각이 남도록).
    })
  },

  async setTab(tab) {
    const myGeneration = ++requestGeneration
    const now = new Date()
    const periodKey = getCurrentBossProfitPeriod(tab, now).periodKey
    const ocids = latestSyncSnapshot?.ocids ?? get().trackedOcids ?? []
    set({ tab, periodKey })
    await loadPeriod(set, tab, periodKey, ocids, now, myGeneration)
  },

  async goToPreviousPeriod() {
    const { tab, periodKey, canGoPreviousPeriod } = get()
    // 화면 이전 버튼과 동일한 플래그로 게이트한다(#29) — 착지할 이전 기간이 조회 불가능하고
    // 캐시 기록도 없으면 이동하지 않는다. 이 플래그는 매 기간 로드 시 canReachPreviousPeriod로
    // 계산해 저장해둔 값이다.
    if (!canGoPreviousPeriod) {
      return
    }
    const myGeneration = ++requestGeneration
    const now = new Date()
    const newPeriodKey = getAdjacentPeriodKey(tab, periodKey, 'prev')
    const ocids = latestSyncSnapshot?.ocids ?? get().trackedOcids ?? []
    set({ periodKey: newPeriodKey })
    await loadPeriod(set, tab, newPeriodKey, ocids, now, myGeneration)
  },

  async goToNextPeriod() {
    const { tab, periodKey } = get()
    const now = new Date()
    if (isLatestPeriod(tab, periodKey, now)) {
      return
    }
    const myGeneration = ++requestGeneration
    const newPeriodKey = getAdjacentPeriodKey(tab, periodKey, 'next')
    const ocids = latestSyncSnapshot?.ocids ?? get().trackedOcids ?? []
    set({ periodKey: newPeriodKey })
    await loadPeriod(set, tab, newPeriodKey, ocids, now, myGeneration)
  },

  async retryPeriod() {
    const { tab, periodKey } = get()
    const myGeneration = ++requestGeneration
    const ocids = latestSyncSnapshot?.ocids ?? get().trackedOcids ?? []
    await loadPeriod(set, tab, periodKey, ocids, new Date(), myGeneration)
  },

  async setPartySize(rowKey, partySize) {
    const row = get().rows.find((candidate) => matchesRowKey(candidate, rowKey))
    if (row === undefined) {
      throw new Error('setPartySize: 존재하지 않는 보스 행입니다')
    }

    if (!Number.isInteger(partySize) || partySize < 1 || partySize > row.maxPartySize) {
      throw new Error(`setPartySize: 파티원 수는 1 이상 ${row.maxPartySize} 이하의 정수여야 합니다`)
    }

    const payoutMeso = row.priceMeso === null ? null : Math.floor(row.priceMeso / partySize)

    if (row.priceMeso !== null) {
      await upsertBossProfitRecord({
        ocid: row.ocid,
        boss: row.boss,
        difficulty: row.difficulty,
        cycle: row.cycle,
        periodKey: row.periodKey,
        partySize,
        priceMeso: row.priceMeso,
        payoutMeso: payoutMeso as number,
        recordedAt: new Date().toISOString(),
        world: row.world,
      })
    }

    const applyEdit = (candidate: BossProfitRow): BossProfitRow =>
      matchesRowKey(candidate, rowKey) ? { ...candidate, partySize, payoutMeso } : candidate

    // latestSyncSnapshot(모듈 스코프 캐시)도 함께 갱신해야 한다 — 그렇지 않으면 이 수정 후
    // 탭을 전환했다가 돌아오거나 기간을 이동했다 복귀할 때, loadPeriod의 "현재 기간" 분기가
    // 이 스냅샷에서 그대로 슬라이스하므로 방금 수정한 값이 낡은 스냅샷 값으로 되돌아가 보인다
    // (2026-07-22 재현 — "파티원 수를 고쳐도 다시 파티관리 기본값으로 돌아간다"로 보고된 증상의
    // 실제 원인).
    //
    // **set 보다 앞이어야 한다** — 아래 set 이 이 스냅샷을 그대로 실어
    // `currentPeriodRows` 를 만든다. 뒤에 두면 이 수정이 today 위젯에 한 커밋 늦게 닿는다.
    if (latestSyncSnapshot !== null) {
      latestSyncSnapshot = { ...latestSyncSnapshot, rows: latestSyncSnapshot.rows.map(applyEdit) }
    }

    set({ rows: get().rows.map(applyEdit) })
  },

  async setBossDrops(rowKey, drops) {
    const row = get().rows.find((candidate) => matchesRowKey(candidate, rowKey))
    if (row === undefined) {
      throw new Error('setBossDrops: 존재하지 않는 보스 행입니다')
    }

    // 한 보스/기간의 드롭 집합을 통째로 교체한다(ADR-038, replace-all).
    await replaceBossDropRecords(
      row.ocid,
      row.boss,
      row.difficulty,
      row.periodKey,
      drops,
      new Date().toISOString(),
    )

    // dropsByRowKey는 rows와 독립된 상태라 setPartySize와 달리 latestSyncSnapshot 이중 갱신이
    // 필요 없다 — 탭 전환/기간 이동 시 loadPeriod가 DB(방금 replace한 결과)에서 다시 로드한다.
    const key = dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)
    set({ dropsByRowKey: { ...get().dropsByRowKey, [key]: drops } })
  },

  applyExternalDropEdit(ocid, boss, difficulty, periodKey, drops) {
    set({
      dropsByRowKey: {
        ...get().dropsByRowKey,
        [dropRowKey(ocid, boss, difficulty, periodKey)]: drops,
      },
    })
  },
  }
})
