import { create } from 'zustand'
import { pruneUnobtainableDrops } from '../../lib/boss-drops'
import { DEFAULT_MAX_PARTY_SIZE, findPriceEntry } from '../../lib/boss-crystal-prices'
import { getBossReferenceOrder, matchBossContent, selectBossProfitBosses, type MatchedBoss } from '../../lib/boss-matching'
import { mergeManualBossList } from '../../lib/manual-boss-merge'
import {
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  getBackfillQueryDate,
  getCurrentBossProfitPeriod,
  getWeeklyPeriodKeysInMonth,
  isEarliestNavigablePeriod,
  isLatestPeriod,
  isPeriodQueryable,
} from '../../lib/boss-profit-period'
import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import { getAuthConfig } from '../../storage/api-key'
import { getBossPartySize } from '../../storage/boss-party-settings'
import { getBossProfitRecords, upsertBossProfitRecord, type BossProfitRecord } from '../../storage/boss-profit'
import { getBossDropRecords, replaceBossDropRecords } from '../../storage/boss-drops'
import type { RecordedDrop } from '../../types/drops'
import { isPeriodChecked, markPeriodChecked } from '../../storage/boss-profit-period-checks'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getManualTrackedContent, type ManualTrackedItem } from '../../storage/manual-tracked-content'
import { getCachedSchedulerState } from '../../storage/scheduler-cache'
import { getTrackingMode, type TrackingMode } from '../../storage/tracking-mode'
import { BOSS_DIFFICULTIES, type BossContent, type BossCycle, type BossDifficulty } from '../../types'
import { compareByName } from '../onboarding/representative-character'
import { syncSchedules, type ScheduleSyncError } from '../schedule-sync/schedule-sync'

export interface BossProfitRow {
  ocid: string
  characterName: string
  imageUrl: string | null // character/basic의 character_image(character-basic-cache 경유). 캐시가 없으면 null(이니셜 폴백)
  boss: string // matchedBossName ?? apiName (매핑 안 되면 원문 그대로, ADR-008)
  difficulty: BossDifficulty
  cycle: BossCycle
  periodKey: string
  periodLabel: string // formatBossProfitPeriodLabel(cycle, periodKey, now).primary — "이번 주"/"지난 주"/"이번 달"/"지난 달"/절대 표기
  priceMeso: number | null // 시세표에 없으면 null ("가격 미확정"). 기록이 있으면 기록값으로 복원(라이브 재계산 방지, ADR-023)
  maxPartySize: number
  partySize: number | null // 사용자가 아직 입력 안 했으면 null
  payoutMeso: number | null // partySize가 null이거나 priceMeso가 null이면 null
  isComplete: boolean // false면 보스 스케줄러에 등록만 되고 아직 처치 전(미완료 placeholder, ADR-032) — payoutMeso는 항상 0이고 DB에 기록되지 않는다
}

export type WeeklySubtotalState = 'confirmed' | 'inProgress' | 'upcoming' | 'unavailable'

export interface BossProfitWeeklySubtotal {
  ocid: string
  characterName: string
  imageUrl: string | null
  periodKey: string
  totalMeso: number
  state: WeeklySubtotalState
}

export type BossProfitStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface BossProfitState {
  status: BossProfitStatus
  tab: BossCycle
  periodKey: string // 현재 tab 기준으로 선택된 기간
  rows: BossProfitRow[] // 선택된 (tab, periodKey)의 보스 row. monthly 탭이면 그 달의 monthly-cycle 보스만
  dropsByRowKey: Record<string, RecordedDrop[]> // 보스 행별 기록된 드롭(ADR-038). 키는 dropRowKey(ocid|boss|difficulty|periodKey). rows와 독립 상태라 탭 전환 시 loadPeriod가 DB에서 재로드
  weeklySubtotals: BossProfitWeeklySubtotal[] // monthly 탭에서만 채워짐(주차별 합계). weekly 탭에서는 항상 []
  isPeriodLoading: boolean // periodKey 이동 후 백필(과거 기간 재조회) 진행 중
  periodUnavailable: boolean // 직전 백필 시도가 실패해 이 기간 일부를 지금 볼 수 없음(재시도 가능하도록 checked로 기록하지 않았다는 뜻)
  canGoPreviousPeriod: boolean // 현재 선택된 기간에서 한 칸 더 과거로 이동할 수 있는지(#29) — 이전 기간이 지금 조회 가능하거나 이미 캐시된 기록이 있을 때만 true. 조회 불가·레코드 없는 기간에 착지하는 것을 막는다.
  error: ScheduleSyncError | null
  staleCharacterNames: string[]
  trackedOcids: string[] | null
  lastSyncedAt: string | null // 페이지 전체 기준 마지막으로 성공한 실시간 동기화 시각(ISO 8601). 컨텐츠/보스 스케줄러의 formatSyncedAt과 동일하게 새로고침 아이콘 옆에 표시
}

type BossProfitRowKey = Pick<BossProfitRow, 'ocid' | 'boss' | 'difficulty' | 'cycle' | 'periodKey'>

export interface BossProfitStore extends BossProfitState {
  loadTrackedOcids(): Promise<void>
  refresh(ocids: string[]): Promise<void>
  setTab(tab: BossCycle): Promise<void>
  goToPreviousPeriod(): Promise<void>
  goToNextPeriod(): Promise<void>
  setPartySize(row: BossProfitRowKey, partySize: number): Promise<void>
  setBossDrops(row: BossProfitRowKey, drops: RecordedDrop[]): Promise<void>
}

interface CharacterProfileInfo {
  characterName: string
  imageUrl: string | null
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

interface SortedCharacterInfo {
  ocid: string
  imageUrl: string | null // character-basic-cache의 character_image. 아바타 렌더링용(ADR-023 "미확정" 해소)
}

// ADR-017 결정 2와 동일한 원칙 — 캐시 단계(trackedOcids 저장 순서)와 동기화 단계(Nexon
// character/list 응답 순서)가 서로 달라 캐릭터 목록 위치가 API 응답 이후 갑자기 바뀌어 보이던
// 문제를 없앤다. 레벨 내림차순(동레벨이면 이름순)으로 항상 같은 순서를 계산해, 캐시 우선 표시
// 단계부터 실시간 동기화·과거 기간 조회까지 전부 이 순서를 그대로 따르게 한다. character-basic-cache를
// 이미 조회하는 김에 아바타용 imageUrl도 함께 반환한다(캐릭터명은 반환하지 않는다 — rows의
// characterName은 character/list·스케줄러 캐시가 출처이고 character-basic-cache의 이름은 갱신
// 시점이 달라 신뢰도가 낮다, ADR-017).
async function getSortedCharacterInfo(ocids: string[]): Promise<SortedCharacterInfo[]> {
  const withProfile = await Promise.all(
    ocids.map(async (ocid) => {
      const cached = await getCachedCharacterBasic(ocid)
      return {
        ocid,
        level: cached?.profile.level ?? null,
        name: cached?.profile.name ?? '',
        imageUrl: cached?.profile.imageUrl ?? null,
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
    .map(({ ocid, imageUrl }) => ({ ocid, imageUrl }))
}

// rows(보스 단위, 캐릭터당 여러 개)를 sortedOcids가 정한 캐릭터 순서로 재배열하고, 같은 캐릭터
// 안에서는 weekly-bosses.json 정규 순서(REFERENCE_ENTRIES: weekly → eventWeekly → monthly)로
// 결정적으로 정렬한다([[ADR-036]], #28). 예전에는 캐릭터 순위(ocid)로만 정렬하고 stable sort에
// 의존해 보스 순서를 데이터 소스가 만든 순서 그대로 물려받았는데, 그 소스 순서가 비결정적이라
// (특히 ORDER BY 없는 getBossProfitRecords, 캐시/라이브 Map 삽입 순서) 로드/렌더마다 보스 순서가
// 달라졌다. 모든 행 경로가 이 함수를 거치므로 여기서 2차 정렬 키를 부여하면 세 경로가 전부 같은
// 순서로 고정된다. 참조에 없는 보스(매칭 실패 원문명, [[ADR-008]])는 맨 뒤로, 같은 보스의 여러
// 난이도는 BOSS_DIFFICULTIES 순서로, 그래도 동률이면 보스명으로 완전 결정한다.
function sortRowsByOcidOrder(rows: BossProfitRow[], sortedOcids: string[]): BossProfitRow[] {
  const rank = new Map(sortedOcids.map((ocid, index) => [ocid, index]))
  const ocidRank = (ocid: string): number => rank.get(ocid) ?? Number.MAX_SAFE_INTEGER
  return [...rows].sort((a, b) => {
    const rankDiff = ocidRank(a.ocid) - ocidRank(b.ocid)
    if (rankDiff !== 0) return rankDiff
    // 순위가 같은데 ocid가 다르면(둘 다 sortedOcids 밖인 예외) 캐릭터끼리 섞이지 않게 ocid로 묶는다.
    if (a.ocid !== b.ocid) return a.ocid < b.ocid ? -1 : 1
    const bossDiff = getBossReferenceOrder(a.boss) - getBossReferenceOrder(b.boss)
    if (bossDiff !== 0) return bossDiff
    const difficultyDiff = BOSS_DIFFICULTIES.indexOf(a.difficulty) - BOSS_DIFFICULTIES.indexOf(b.difficulty)
    if (difficultyDiff !== 0) return difficultyDiff
    return a.boss < b.boss ? -1 : a.boss > b.boss ? 1 : 0
  })
}

function buildBossProfitRow(
  ocid: string,
  characterName: string,
  imageUrl: string | null,
  boss: MatchedBoss,
  now: Date,
): BossProfitRow {
  const bossName = boss.matchedBossName ?? boss.apiName
  const period = getCurrentBossProfitPeriod(boss.cycle, now)
  const periodLabel = formatBossProfitPeriodLabel(boss.cycle, period.periodKey, now).primary
  const priceEntry = findPriceEntry(bossName, boss.difficulty)
  const priceMeso = priceEntry?.priceMeso ?? null
  const maxPartySize = priceEntry?.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE

  return {
    ocid,
    characterName,
    imageUrl,
    boss: bossName,
    difficulty: boss.difficulty,
    cycle: boss.cycle,
    periodKey: period.periodKey,
    periodLabel,
    priceMeso,
    maxPartySize,
    partySize: null,
    // 미완료(등록만 되고 아직 처치 전) 보스는 항상 0메소로 계산한다(ADR-032) — 완료 보스는
    // 기존과 동일하게 null로 두고 자동 기록(위 for 루프)이나 병합(mergeRecordsIntoRows)에서 채운다.
    // isComplete(카드 표시용 승격된 값)가 아니라 ownComplete(승격 없는 원본 완료 여부)를 써야
    // 한다 — 여기 도달하는 boss는 이미 selectBossProfitBosses가 골라준 것이라 실제 처치 난이도
    // (ownComplete: true) 아니면 미완료 placeholder(ownComplete: false)뿐이다.
    payoutMeso: boss.ownComplete ? null : 0,
    isComplete: boss.ownComplete,
  }
}

// bossContents(API 원문/캐시)에서 이번 기간 표시할 보스 목록을 고른다. 트래킹 모드에 따라 분기한다(ADR-035 결정 21).
// - 자동 모드: 기존 동작 그대로 — selectBossProfitBosses(그룹당 실제 처치 난이도 우선, 없으면 인게임 등록 난이도 placeholder).
// - 수동 모드: "실제 처치한 보스 전부(처치 난이도)" ∪ "수동 추적 중이지만 미처치인 보스(고른 난이도 placeholder)".
//   자동 모드와 대칭이며 placeholder의 출처만 인게임 등록 → 수동 멤버십으로 바뀐다.
function selectProfitDisplayBosses(
  bossContents: BossContent[],
  mode: TrackingMode,
  manualItems: ManualTrackedItem[],
): MatchedBoss[] {
  const matched = bossContents.map(matchBossContent)
  if (mode !== 'manual') {
    return selectBossProfitBosses(matched)
  }

  const nameOf = (boss: MatchedBoss): string => boss.matchedBossName ?? boss.apiName

  // ① 실제 처치한 보스는 추적 여부와 무관하게 전부, 처치한 난이도·가격으로 노출한다(사용자 확정) —
  // 보스 수익 페이지는 정산이 목적이라([[ADR-032]]) 실제로 번 것은 다 보여준다. selectBossProfitBosses가
  // 그룹당 실제 처치 난이도를 골라주며(등록 난이도와 다르게 처치했어도 처치 난이도로 잡힌다), 인게임
  // 등록-only(미처치) placeholder는 수동 모드에서 신뢰하지 않으므로 ownComplete인 것만 남긴다.
  const kills = selectBossProfitBosses(matched).filter((boss) => boss.ownComplete)
  const killedNames = new Set(kills.map(nameOf))

  // ② 수동 추적 중이지만 아직 처치하지 않은 보스는 고른 난이도로 미완료 placeholder(#33). 보스 관리
  // 페이지와 동일 규약(mergeManualBossList — 정규화 명 매칭, cycle 폴백)으로 병합하되, 이미 ①에서 처치
  // 난이도로 나온 보스명은 중복 배제한다.
  const placeholders = mergeManualBossList(
    manualItems.filter((item) => item.kind === 'boss'),
    bossContents,
  )
    .map(matchBossContent)
    .filter((boss) => !boss.ownComplete && !killedNames.has(nameOf(boss)))

  return [...kills, ...placeholders]
}

function buildRowFromRecord(
  record: BossProfitRecord,
  characterName: string,
  imageUrl: string | null,
  now: Date,
): BossProfitRow {
  const difficulty = record.difficulty as BossDifficulty
  const priceEntry = findPriceEntry(record.boss, difficulty)
  const maxPartySize = priceEntry?.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE

  return {
    ocid: record.ocid,
    characterName,
    imageUrl,
    boss: record.boss,
    difficulty,
    cycle: record.cycle,
    periodKey: record.periodKey,
    periodLabel: formatBossProfitPeriodLabel(record.cycle, record.periodKey, now).primary,
    priceMeso: record.priceMeso,
    maxPartySize,
    partySize: record.partySize,
    payoutMeso: record.payoutMeso,
    isComplete: true, // 기록은 항상 완료된 보스만 남는다(backfillTarget/자동 기록이 완료 보스만 upsert)
  }
}

function mergeRecordsIntoRows(
  rows: BossProfitRow[],
  records: Awaited<ReturnType<typeof getBossProfitRecords>>,
): BossProfitRow[] {
  return rows.map((row) => {
    const record = records.find(
      (candidate) =>
        candidate.ocid === row.ocid &&
        candidate.boss === row.boss &&
        candidate.difficulty === row.difficulty &&
        candidate.periodKey === row.periodKey,
    )
    if (record === undefined) {
      return row
    }
    // ADR-023: priceMeso도 기록값으로 덮어쓴다 — 그렇지 않으면 과거 기록을 다시 보여줄 때
    // 라이브 시세로 조용히 재계산되는 데이터 무결성 버그가 생긴다.
    return { ...row, priceMeso: record.priceMeso, partySize: record.partySize, payoutMeso: record.payoutMeso }
  })
}

function matchesRowKey(row: BossProfitRow, key: BossProfitRowKey): boolean {
  return (
    row.ocid === key.ocid &&
    row.boss === key.boss &&
    row.difficulty === key.difficulty &&
    row.cycle === key.cycle &&
    row.periodKey === key.periodKey
  )
}

function filterRowsForTab(rows: BossProfitRow[], tab: BossCycle, periodKey: string): BossProfitRow[] {
  return rows.filter((row) => row.cycle === tab && row.periodKey === periodKey)
}

function sumRowsPayout(rows: BossProfitRow[]): number {
  return rows.reduce((sum, row) => sum + (row.payoutMeso ?? 0), 0)
}

// 리로드(OTA 적용·디버그 데이터 초기화 등)로 dbPromise는 초기화됐지만 네이티브 SQLite 커넥션은
// stale하게 남아있는 경우, openBossProfitDb의 "닫고 새로 생성" 보정만으로는 그 직후 첫 쿼리가
// 막히는 사례가 실기기에서 재현됐다(2026-07-17 — 데이터 초기화 → 보스 스케줄러 저장 직후 보스
// 수익 화면이 "불러오는 중..."에서 영영 멈춤). refresh()뿐 아니라 loadPeriod()(기간 이동)도 같은
// SQLite 조회에 의존하는데, 여기서 멈추면 periodKey 라벨만 바뀌고 rows는 갱신되지 않아 이전 기간
// 숫자가 그대로 남는(에러도 로딩 표시도 없는) 증상으로 나타난다(2026-07-17 재현). SQLite 의존 호출을
// 타임아웃과 경쟁시켜 지연/실패 시 fallback으로 진행한다 — 기록이 안 남았을 뿐이므로 다음
// 새로고침/재방문에서 정상 커넥션으로 재시도된다.
const SQLITE_QUERY_TIMEOUT_MS = 5000

function withSqliteFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), SQLITE_QUERY_TIMEOUT_MS)),
  ])
}

// upsertBossProfitRecord/markPeriodChecked(쓰기)는 withSqliteFallback처럼 타임아웃을 "성공"으로
// 위장하면 안 된다 — 실제로는 저장되지 않았는데 markPeriodChecked까지 호출되면 그 기간이 영구히
// "확인 완료, 기록 없음"으로 잘못 캐시돼 다시는 재시도되지 않는다. 대신 타임아웃을 실패로 전파해
// backfillTarget의 기존 catch가 재시도 가능한 실패(periodUnavailable)로 처리하게 한다.
function withSqliteTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('SQLite 응답 시간 초과')), SQLITE_QUERY_TIMEOUT_MS)),
  ])
}

// tab이 'monthly'일 때 그 달에 포함된 weekly periodKey들을 주차별로 합산한다. 현재 주는
// liveRows(방금 refresh/캐시가 계산해둔 값)에서 바로 합산하고, 지난 주는 로컬 기록을 조회하며,
// 아직 시작하지 않은 미래 주는 0/'upcoming'으로 채운다.
async function buildWeeklySubtotalsForMonth(
  ocids: string[],
  monthPeriodKey: string,
  liveRows: BossProfitRow[],
  knownProfiles: Map<string, CharacterProfileInfo>,
  now: Date,
): Promise<BossProfitWeeklySubtotal[]> {
  if (ocids.length === 0) {
    return []
  }

  const weekKeys = getWeeklyPeriodKeysInMonth(monthPeriodKey)
  const currentWeeklyPeriodKey = getCurrentBossProfitPeriod('weekly', now).periodKey
  const pastWeekKeys = weekKeys.filter((key) => key < currentWeeklyPeriodKey)
  const pastRecords =
    pastWeekKeys.length > 0 ? await withSqliteFallback(getBossProfitRecords(ocids, pastWeekKeys), []) : []

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
      if (weekKey === currentWeeklyPeriodKey) {
        const totalMeso = sumRowsPayout(
          liveRows.filter((row) => row.ocid === ocid && row.cycle === 'weekly' && row.periodKey === weekKey),
        )
        subtotals.push({ ocid, characterName, imageUrl, periodKey: weekKey, totalMeso, state: 'inProgress' })
      } else if (weekKey > currentWeeklyPeriodKey) {
        subtotals.push({ ocid, characterName, imageUrl, periodKey: weekKey, totalMeso: 0, state: 'upcoming' })
      } else {
        const matchingRecords = pastRecords.filter(
          (record) => record.ocid === ocid && record.cycle === 'weekly' && record.periodKey === weekKey,
        )
        // 이 조합에 이미 저장된 기록이 있으면(과거에 조회 가능했을 때 확보한 기록일 수 있음)
        // 지금 이 주가 조회 가능한지와 무관하게 그 기록을 그대로 쓴다 — 기록이 없을 때만
        // "지금 API로 조회할 수 있었는가"(isPeriodQueryable, MIN_SCHEDULER_DATE 고정 하한선 +
        // 롤링 조회 윈도우 둘 다 반영)로 "조회 불가"와 "0메소 확정"을 구분한다.
        if (matchingRecords.length === 0 && !isPeriodQueryable('weekly', weekKey, now)) {
          subtotals.push({ ocid, characterName, imageUrl, periodKey: weekKey, totalMeso: 0, state: 'unavailable' })
        } else {
          const totalMeso = matchingRecords.reduce((sum, record) => sum + record.payoutMeso, 0)
          subtotals.push({ ocid, characterName, imageUrl, periodKey: weekKey, totalMeso, state: 'confirmed' })
        }
      }
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

  const profileCache = new Map<string, CharacterProfileInfo | null>()
  const rows: BossProfitRow[] = []

  for (const record of records) {
    if (!profileCache.has(record.ocid)) {
      const cached = await getCachedCharacterBasic(record.ocid)
      profileCache.set(
        record.ocid,
        cached === null ? null : { characterName: cached.profile.name, imageUrl: cached.profile.imageUrl },
      )
    }
    const profile = profileCache.get(record.ocid) ?? null
    if (profile === null) {
      continue
    }
    rows.push(buildRowFromRecord(record, profile.characterName, profile.imageUrl, now))
  }

  return rows
}

interface BackfillTarget {
  ocid: string
  cycle: BossCycle
  periodKey: string
}

function buildBackfillTargets(tab: BossCycle, periodKey: string, ocids: string[], now: Date): BackfillTarget[] {
  const targets: BackfillTarget[] = []

  if (tab === 'weekly') {
    for (const ocid of ocids) {
      targets.push({ ocid, cycle: 'weekly', periodKey })
    }
    return targets
  }

  const currentWeeklyPeriodKey = getCurrentBossProfitPeriod('weekly', now).periodKey
  const weekKeysInMonth = getWeeklyPeriodKeysInMonth(periodKey).filter((key) => key <= currentWeeklyPeriodKey)

  for (const ocid of ocids) {
    targets.push({ ocid, cycle: 'monthly', periodKey })
    for (const weekKey of weekKeysInMonth) {
      targets.push({ ocid, cycle: 'weekly', periodKey: weekKey })
    }
  }

  return targets
}

// 과거 기간 백필: 성공하면 markPeriodChecked를 호출해 다음 방문부터 재조회하지 않게 하고,
// 실패(네트워크/인증 등 어떤 이유든)하면 markPeriodChecked를 호출하지 않아 다음 방문 때 재시도된다.
// 이미 기록된 보스(setPartySize로 override된 값 포함)는 건드리지 않는다 — 기존 refresh() 자동
// 기록 로직과 동일하게 "기록이 없는 조합만" 기본값(파티 관리 설정, 없으면 1)으로 채운다.
// 반환값은 이 target을 이번에 확인할 수 없었는지(periodUnavailable에 반영) 여부다.
async function backfillTarget(target: BackfillTarget, now: Date): Promise<boolean> {
  // 이 기간은 지금 API로 조회할 수 없다(ADR-032) — API가 존재하기 이전(고정 하한선) 이거나,
  // 롤링 조회 윈도우(오늘 기준 최근 13일)를 이미 벗어났거나 둘 중 하나다. 이 함수는 애초에
  // isPeriodChecked가 false인 대상에서만 호출되므로(loadPeriod), 여기 도달했다는 건 이 조합에
  // 대한 기록이 아직 없다는 뜻이다 — 재시도해도 영구히 실패하므로 API를 호출하지 않고 곧바로
  // "확인 완료, 기록 없음"으로 처리한다. periodUnavailable(재시도 유도)이 아니라 일반적인
  // "기록 없음"과 동일하게 다룬다.
  if (!isPeriodQueryable(target.cycle, target.periodKey, now)) {
    await withSqliteFallback(
      markPeriodChecked(target.ocid, target.cycle, target.periodKey, now.toISOString()),
      undefined,
    )
    return false
  }

  const date = getBackfillQueryDate(target.cycle, target.periodKey)

  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    return true
  }

  try {
    const state = await fetchSchedulerCharacterState(authConfig.apiKey, target.ocid, date)
    // selectBossProfitBosses로 그룹(content_name)당 실제 처치 난이도만 골라야 한다 — 그렇지
    // 않으면 등록 난이도와 실제 처치 난이도가 다를 때 둘 다 완료로 잡혀 같은 보스 하나를 두 번
    // 기록(이중 계산)하게 된다(ADR-032). 과거 기간 백필이므로 미완료 placeholder(ownComplete:
    // false)는 기록 대상에서 제외한다.
    const completedBosses = selectBossProfitBosses(
      state.bossContents.map(matchBossContent).filter((boss) => boss.cycle === target.cycle),
    ).filter((boss) => boss.ownComplete)

    const existingRecords = await withSqliteFallback(
      getBossProfitRecords([target.ocid], [target.periodKey]),
      [],
    )

    for (const boss of completedBosses) {
      const bossName = boss.matchedBossName ?? boss.apiName
      const alreadyRecorded = existingRecords.some(
        (record) =>
          record.ocid === target.ocid &&
          record.boss === bossName &&
          record.difficulty === boss.difficulty &&
          record.periodKey === target.periodKey,
      )
      if (alreadyRecorded) {
        continue
      }

      const priceEntry = findPriceEntry(bossName, boss.difficulty)
      if (priceEntry === undefined || priceEntry.priceMeso === null) {
        continue
      }

      const configuredPartySize = await withSqliteFallback(
        getBossPartySize(target.ocid, bossName, boss.difficulty),
        null,
      )
      const partySize = configuredPartySize ?? 1
      const payoutMeso = Math.floor(priceEntry.priceMeso / partySize)

      await withSqliteTimeout(
        upsertBossProfitRecord({
          ocid: target.ocid,
          boss: bossName,
          difficulty: boss.difficulty,
          cycle: target.cycle,
          periodKey: target.periodKey,
          partySize,
          priceMeso: priceEntry.priceMeso,
          payoutMeso,
          recordedAt: now.toISOString(),
        }),
      )
    }

    await withSqliteTimeout(markPeriodChecked(target.ocid, target.cycle, target.periodKey, now.toISOString()))
    return false
  } catch {
    return true
  }
}

// 이 기간(cycle, periodKey)에 대해 이미 저장된 보스 수익 기록이 하나라도 있는지 확인한다(#29).
// 롤링 조회 윈도우를 벗어나 "지금"은 API로 다시 조회할 수 없더라도, 과거에 확보해둔 기록이 있으면
// 그 기간을 그대로 보여줄 수 있으므로 이동을 허용해야 한다. monthly는 그 달의 monthly-cycle 기록뿐
// 아니라 그 달에 속한 주(weekly)의 기록도 화면에 함께 표시되므로 둘 다 조회 대상에 넣는다.
async function hasCachedRecordsForPeriod(
  ocids: string[],
  tab: BossCycle,
  periodKey: string,
): Promise<boolean> {
  if (ocids.length === 0) {
    return false
  }
  const periodKeys =
    tab === 'monthly' ? [periodKey, ...getWeeklyPeriodKeysInMonth(periodKey)] : [periodKey]
  const records = await withSqliteFallback(getBossProfitRecords(ocids, periodKeys), [])
  return records.length > 0
}

// 현재 기간(periodKey)에서 한 칸 더 과거로 이동해도 되는지 판단한다(#29). 이전 버튼 게이트와
// "조회 불가" 경계가 서로 다른 하한을 쓰던 버그를 없앤다 — 착지할 이전 기간이 실제로 데이터를
// 보여줄 수 있을 때만 이동을 허용한다.
//  1) MIN_SCHEDULER_DATE 이전(스케줄러 API 존재 이전)은 어떤 경우에도 데이터가 없다 → 불가.
//  2) 지금 API로 조회 가능하면(롤링 윈도우 안) 도달 시 백필로 데이터를 채울 수 있다 → 가능.
//  3) 롤링 윈도우 밖이라 지금은 조회 불가지만 과거에 저장해둔 기록이 있으면 그대로 보여줄 수 있다 → 가능.
// (이 캐시 존중이 롤링 하한을 그대로 이전 게이트로 쓰지 않는 이유다.)
async function canReachPreviousPeriod(
  tab: BossCycle,
  periodKey: string,
  ocids: string[],
  now: Date,
): Promise<boolean> {
  if (isEarliestNavigablePeriod(tab, periodKey)) {
    return false
  }
  const prevPeriodKey = getAdjacentPeriodKey(tab, periodKey, 'prev')
  if (isPeriodQueryable(tab, prevPeriodKey, now)) {
    return true
  }
  return hasCachedRecordsForPeriod(ocids, tab, prevPeriodKey)
}

type BossProfitSetter = (partial: Partial<BossProfitState>) => void

// "기간 로드" 규칙(ADR-023): 이동한 periodKey가 그 tab의 현재 기간이면 네트워크 호출 없이
// 최근 refresh가 채워둔 스냅샷에서 슬라이스하고, 과거 기간이면 로컬 우선(이미 체크된 조합은
// API 호출 없이 로컬 기록만 읽고, 체크 안 된 조합만 순차적으로 백필한다).
//
// generation은 호출한 쪽(setTab/goToPreviousPeriod/goToNextPeriod)이 periodKey를 동기적으로
// 바꾸는 바로 그 순간 캡처한 requestGeneration 값이다 — 이 비동기 함수가 끝나기 전에 더 최신
// 액션(연타 등)이 시작됐다면(requestGeneration이 그 사이 또 증가했다면) set()을 건너뛰어
// stale한 응답이 최신 화면을 덮어쓰지 않게 한다.
// 드롭 상태 키(ADR-038). BossProfitRow 키와 달리 cycle을 뺀다 — 드롭은 (ocid,boss,difficulty,
// periodKey)로 저장되고 periodKey가 이미 주간/월간을 구분하므로 cycle이 불필요하다.
export function dropRowKey(ocid: string, boss: string, difficulty: string, periodKey: string): string {
  return `${ocid}|${boss}|${difficulty}|${periodKey}`
}

// rows에 등장하는 periodKey들의 드롭 기록을 dropRowKey → RecordedDrop[]로 묶어 반환한다.
// getBossDropRecords는 ORDER BY drop_index라 추가 순서가 보존된다.
async function loadDropsByRowKey(
  ocids: string[],
  rows: BossProfitRow[],
  now: Date,
): Promise<Record<string, RecordedDrop[]>> {
  const periodKeys = Array.from(new Set(rows.map((row) => row.periodKey)))
  if (ocids.length === 0 || periodKeys.length === 0) return {}

  const records = await withSqliteFallback(getBossDropRecords(ocids, periodKeys), [])
  const map: Record<string, RecordedDrop[]> = {}
  for (const record of records) {
    const key = dropRowKey(record.ocid, record.boss, record.difficulty, record.periodKey)
    if (map[key] === undefined) map[key] = []
    map[key].push({
      category: record.category,
      itemName: record.itemName,
      slot: record.slot ?? undefined,
      boxOrigin: record.boxOrigin ?? undefined,
      ringLevel: record.ringLevel ?? undefined,
      quantity: record.quantity,
    })
  }

  // 처치 난이도가 확정된(완료) 행에 한해, 그 난이도에서 획득 불가한 드롭을 제거한다(ADR-044 후속).
  // 미완료 시트의 표시용 난이도 토글로 다른 난이도 전용 아이템이 행 난이도 키에 섞여 저장될 수
  // 있기 때문. 변경이 있으면 DB에도 영구 반영한다(멱등 — 이미 정리됐으면 재기록 없음). 미완료
  // 행은 아직 처치 난이도가 없으므로 건드리지 않는다(scratchpad).
  for (const row of rows) {
    if (!row.isComplete) continue
    const key = dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)
    const drops = map[key]
    if (drops === undefined || drops.length === 0) continue
    const pruned = pruneUnobtainableDrops(row.boss, row.difficulty, drops)
    if (pruned.length !== drops.length) {
      map[key] = pruned
      await withSqliteFallback(
        replaceBossDropRecords(row.ocid, row.boss, row.difficulty, row.periodKey, pruned, now.toISOString()),
        undefined,
      )
    }
  }

  return map
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
    const canGoPreviousPeriod = await canReachPreviousPeriod(tab, periodKey, ocids, now)
    const dropsByRowKey = await loadDropsByRowKey(ocids, rows, now)
    if (generation !== requestGeneration) return
    // loadPeriod는 항상 로컬 데이터(스냅샷/기록)로만 뷰를 정착시키고 실시간 동기화를 하지 않는다.
    // 또한 이 함수는 항상 requestGeneration을 올린 네비게이션 뒤에만 실행되므로, 진행 중이던
    // refresh의 'loading'은 이미 무효화된 상태다. 여기서 status를 'loaded'로 확정하지 않으면,
    // refresh 도중 기간을 이동했다가 돌아왔을 때 refresh의 최종 'loaded' set이 세대 가드에 막혀
    // status가 'loading'에 영구히 갇히는 버그가 생긴다(사용자 보고 — "조회 중..." 무한 진행).
    set({ status: 'loaded', rows, dropsByRowKey, weeklySubtotals, isPeriodLoading: false, periodUnavailable: false, canGoPreviousPeriod })
    return
  }

  const targets = buildBackfillTargets(tab, periodKey, ocids, now)
  const uncheckedTargets: BackfillTarget[] = []
  for (const target of targets) {
    const checked = await withSqliteFallback(
      isPeriodChecked(target.ocid, target.cycle, target.periodKey),
      false,
    )
    if (!checked) {
      uncheckedTargets.push(target)
    }
  }

  let periodUnavailable = false

  if (uncheckedTargets.length > 0) {
    if (generation !== requestGeneration) return
    set({ isPeriodLoading: true, periodUnavailable: false })
    for (const target of uncheckedTargets) {
      const failed = await backfillTarget(target, now)
      if (failed) {
        periodUnavailable = true
      }
    }
  }

  const rows = sortRowsByOcidOrder(await buildRowsFromRecords(ocids, tab, periodKey, now), sortedOcids)
  const weeklySubtotals =
    tab === 'monthly' ? await buildWeeklySubtotalsForMonth(sortedOcids, periodKey, [], new Map(), now) : []
  const canGoPreviousPeriod = await canReachPreviousPeriod(tab, periodKey, ocids, now)
  const dropsByRowKey = await loadDropsByRowKey(ocids, rows, now)

  if (generation !== requestGeneration) return
  // status를 'loaded'로 확정한다 — 위 "현재 기간" 분기와 같은 이유(중단된 refresh의 'loading'이
  // 세대 가드로 갇히는 것 방지).
  set({ status: 'loaded', rows, dropsByRowKey, weeklySubtotals, isPeriodLoading: false, periodUnavailable, canGoPreviousPeriod })
}

const initialState: BossProfitState = {
  status: 'idle',
  tab: 'weekly',
  periodKey: getCurrentBossProfitPeriod('weekly', new Date()).periodKey,
  rows: [],
  dropsByRowKey: {},
  weeklySubtotals: [],
  isPeriodLoading: false,
  periodUnavailable: false,
  canGoPreviousPeriod: false,
  error: null,
  staleCharacterNames: [],
  trackedOcids: null,
  lastSyncedAt: null,
}

export const useBossProfitStore = create<BossProfitStore>()((set, get) => ({
  ...initialState,

  async loadTrackedOcids() {
    const ocids = await getTrackedCharacterOcids()
    set({ trackedOcids: ocids })
    if (ocids !== null) {
      await get().refresh(ocids)
    }
  },

  async refresh(ocids) {
    const myGeneration = ++requestGeneration
    const tab = get().tab
    const now = new Date()
    const currentPeriodKey = getCurrentBossProfitPeriod(tab, now).periodKey

    if (ocids.length === 0) {
      latestSyncSnapshot = { ocids: [], rows: [], characterProfiles: new Map() }
      if (myGeneration !== requestGeneration) return
      set({
        status: 'loaded',
        periodKey: currentPeriodKey,
        rows: [],
        dropsByRowKey: {},
        weeklySubtotals: [],
        isPeriodLoading: false,
        periodUnavailable: false,
        canGoPreviousPeriod: false,
        error: null,
        staleCharacterNames: [],
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

    // refresh는 항상 "현재 기간"을 보여주므로, 여기서 한 칸 더 과거로 갈 수 있는지도 함께 계산해
    // 이전 버튼 게이트(#29)를 세운다. refresh는 현재 기간만 갱신하고 이전 기간의 기록은 건드리지
    // 않으므로 아래 캐시·라이브 두 set() 모두 같은 값을 쓴다. 현재 기간의 이전 기간은 대개 롤링
    // 윈도우 안이라 이 계산은 보통 DB 조회 없이 즉시 끝난다(canReachPreviousPeriod 참고).
    const canGoPreviousPeriod = await canReachPreviousPeriod(tab, currentPeriodKey, ocids, now)

    // ADR-035 결정 21: 수동 모드에서는 게임 등록/처치가 아니라 사용자 멤버십(manualTrackedContent)이 표시 목록을
    // 결정하므로 캐시·라이브 브랜치 양쪽에서 참조할 수동 목록을 미리 조회해둔다(#33). 자동 모드는 이 조회를 하지
    // 않는다 — 자동 동작은 트래킹과 완전히 독립이다.
    const mode = await getTrackingMode()
    const manualItemsByOcid = new Map<string, ManualTrackedItem[]>()
    if (mode === 'manual') {
      await Promise.all(
        ocids.map(async (ocid) => {
          manualItemsByOcid.set(ocid, await getManualTrackedContent(ocid))
        }),
      )
    }

    // ADR-017 결정 1: 캐시 우선 표시 — 재검증(syncSchedules) 전에 마지막으로 성공한
    // 스케줄 캐시가 있으면 완료된 보스만 걸러 화면을 먼저 채운다. 이미 저장된 기록이
    // 있으면 함께 조회해 partySize/payoutMeso도 바로 보여준다(단순 읽기이므로 안전) —
    // 다만 기록이 없는 조합에 대한 자동 기록(upsert)은 이 단계에서 하지 않는다. 낡은
    // 캐시를 기준으로 잘못된 파티원 수를 기록해버리는 걸 막기 위해, 자동 기록은 지금처럼
    // 실제 재검증(syncSchedules) 이후에만 수행한다.
    const cachedRows = (
      await Promise.all(
        ocids.map(async (ocid): Promise<BossProfitRow[]> => {
          const cached = await getCachedSchedulerState(ocid)
          if (cached === null) {
            return []
          }
          // 자동 모드: 완료된 보스뿐 아니라 등록만 되고 아직 처치 전인 보스도 미완료 placeholder로 함께
          // 보여준다(ADR-032) — selectBossProfitBosses가 그룹(같은 apiName)당 "실제로 처치한"
          // 난이도(ownComplete)를 우선하고, 없으면 등록 난이도를 미완료 placeholder로 대신
          // 고른다. boss-scheduler의 selectDisplayBosses(등록 여부 우선)와 달리, 등록 난이도와
          // 실제 처치 난이도가 다를 수 있어([[ADR-031]]) 가격 계산에는 반드시 실제 처치 난이도를
          // 써야 한다. 수동 모드는 사용자 멤버십을 병합해 표시한다(ADR-035 결정 21).
          const displayBosses = selectProfitDisplayBosses(cached.state.bossContents, mode, manualItemsByOcid.get(ocid) ?? [])
          return displayBosses.map((boss) =>
            buildBossProfitRow(ocid, cached.state.characterName, imageUrlByOcid.get(ocid) ?? null, boss, now),
          )
        }),
      )
    ).flat()

    const cachedPeriodKeys = Array.from(new Set(cachedRows.map((row) => row.periodKey)))
    const cachedRecords =
      cachedRows.length > 0 ? await withSqliteFallback(getBossProfitRecords(ocids, cachedPeriodKeys), []) : []
    const cachedMergedRows = sortRowsByOcidOrder(mergeRecordsIntoRows(cachedRows, cachedRecords), sortedOcids)

    // latestSyncSnapshot을 캐시 데이터로 즉시 채워둔다 — 이후 syncSchedules가 실패해도(네트워크
    // 등) 이 스냅샷이 null로 남지 않아야, 그 상태에서 tab 전환/기간 이동(loadPeriod)을 해도
    // 캐시 우선 표시(ADR-016/017)가 계속 유지된다. 실시간 동기화가 성공하면 아래에서 다시
    // 최신 데이터로 덮어쓴다.
    const cachedCharacterProfiles = new Map(
      cachedRows.map((row) => [row.ocid, { characterName: row.characterName, imageUrl: row.imageUrl }]),
    )
    latestSyncSnapshot = { ocids: [...ocids], rows: cachedMergedRows, characterProfiles: cachedCharacterProfiles }

    // monthly 탭의 주차별 합계도 캐시 단계에서 미리 채운다 — 지난 주차 합계는 로컬 기록
    // (getBossProfitRecords) 조회만으로 구해지는 값이라 API 재검증을 기다릴 이유가 없다.
    // 이걸 생략하면 매번 화면 진입 시 이미 확정된 지난 주차 합계까지 잠깐 사라졌다가
    // syncSchedules 완료 후에야 다시 채워지는 것처럼 보인다.
    const cachedWeeklySubtotals =
      tab === 'monthly'
        ? await buildWeeklySubtotalsForMonth(sortedOcids, currentPeriodKey, cachedMergedRows, cachedCharacterProfiles, now)
        : []

    const cachedDropsByRowKey = await loadDropsByRowKey(ocids, cachedMergedRows, now)

    // 이 호출보다 나중에 시작된 refresh/setTab/goToXPeriod가 이미 있다면(연타 등) 이 시점의
    // 캐시 우선 표시조차 화면에 반영하지 않는다 — 더 최신 액션이 이미 진행 중이므로 그 결과가
    // 우선한다.
    if (myGeneration !== requestGeneration) return

    set({
      status: 'loading',
      periodKey: currentPeriodKey,
      rows: filterRowsForTab(cachedMergedRows, tab, currentPeriodKey),
      dropsByRowKey: cachedDropsByRowKey,
      weeklySubtotals: cachedWeeklySubtotals,
      isPeriodLoading: false,
      periodUnavailable: false,
      canGoPreviousPeriod,
      error: null,
      staleCharacterNames: [],
    })

    let results: Awaited<ReturnType<typeof syncSchedules>>
    try {
      results = await syncSchedules(ocids)
    } catch {
      // syncSchedules 자체가 던지는 에러(온보딩 미완료 등)는
      // 캐릭터별 에러가 아니라 전체 조회 자체의 실패이므로 network로 취급한다.
      if (myGeneration === requestGeneration) {
        set({ status: 'error', error: { kind: 'network' } })
      }
      return
    }

    const rows: BossProfitRow[] = []
    const staleCharacterNames: string[] = []
    const characterProfiles = new Map<string, CharacterProfileInfo>()

    for (const result of results) {
      characterProfiles.set(result.ocid, {
        characterName: result.characterName,
        imageUrl: imageUrlByOcid.get(result.ocid) ?? null,
      })

      if (result.isStale) {
        staleCharacterNames.push(result.characterName)
      }

      const displayBosses = selectProfitDisplayBosses(
        result.state?.bossContents ?? [],
        mode,
        manualItemsByOcid.get(result.ocid) ?? [],
      )

      for (const boss of displayBosses) {
        rows.push(
          buildBossProfitRow(result.ocid, result.characterName, imageUrlByOcid.get(result.ocid) ?? null, boss, now),
        )
      }
    }

    const periodKeys = Array.from(new Set(rows.map((row) => row.periodKey)))
    const records = await withSqliteFallback(getBossProfitRecords(ocids, periodKeys), [])
    const mergedRows = mergeRecordsIntoRows(rows, records)

    // ADR-014/ADR-019: 기록이 없는 완료 보스는 화면 진입 전에도 즉시 기본 파티원 수로 자동 기록한다.
    // 기본값은 boss_party_settings(파티 관리) 조회 결과, 없으면 1(솔로)이다.
    // upsertBossProfitRecord는 단일 공유 SQLite 커넥션에 자체 트랜잭션을 열므로,
    // Promise.all로 동시 실행하면 트랜잭션이 겹쳐 에러가 난다 — 순차 실행으로 처리한다.
    const autoRecordedRows: BossProfitRow[] = []
    for (const row of mergedRows) {
      // 미완료 placeholder(ADR-032)는 절대 자동 기록하지 않는다 — 여기서 기록해버리면
      // 나중에 실제로 완료됐을 때 "이미 기록이 있다"고 오판해 실제 처치 수익으로 다시
      // 계산되지 않고 0메소로 영구히 고정된다.
      if (!row.isComplete || row.partySize !== null || row.priceMeso === null) {
        autoRecordedRows.push(row)
        continue
      }

      const configuredPartySize = await withSqliteFallback(
        getBossPartySize(row.ocid, row.boss, row.difficulty),
        null,
      )
      const partySize = configuredPartySize ?? 1
      const payoutMeso = Math.floor(row.priceMeso / partySize)

      await withSqliteFallback(
        upsertBossProfitRecord({
          ocid: row.ocid,
          boss: row.boss,
          difficulty: row.difficulty,
          cycle: row.cycle,
          periodKey: row.periodKey,
          partySize,
          priceMeso: row.priceMeso,
          payoutMeso,
          recordedAt: now.toISOString(),
        }),
        undefined,
      )

      autoRecordedRows.push({ ...row, partySize, payoutMeso })
    }

    const sortedRows = sortRowsByOcidOrder(autoRecordedRows, sortedOcids)
    latestSyncSnapshot = { ocids: [...ocids], rows: sortedRows, characterProfiles }

    // 실시간 동기화가 실제로 성공했으므로 "마지막 동기화 시각"을 기록한다 — 세대 가드보다 앞에서
    // 갱신해야 한다. 그 사이 다른 기간으로 이동해(세대가 바뀌어) 아래 최종 set()이 건너뛰어지더라도,
    // latestSyncSnapshot(모듈 스코프)은 이미 신선한 데이터로 갱신되므로 현재 기간으로 돌아오면 그
    // 데이터가 보인다. 이때 lastSyncedAt만 함께 갱신되지 않으면 "신선한 데이터를 보여주면서도
    // 동기화 기록 없음"이라고 표시되는 불일치가 생긴다(사용자 보고). lastSyncedAt은 현재 기간에서만
    // 노출되므로(#30) 과거 기간을 보는 동안 이 set이 일어나도 화면에는 영향이 없다.
    set({ lastSyncedAt: new Date().toISOString() })

    const weeklySubtotals =
      tab === 'monthly'
        ? await buildWeeklySubtotalsForMonth(sortedOcids, currentPeriodKey, sortedRows, characterProfiles, now)
        : []

    const liveDropsByRowKey = await loadDropsByRowKey(ocids, sortedRows, now)

    if (myGeneration !== requestGeneration) return

    set({
      status: 'loaded',
      periodKey: currentPeriodKey,
      rows: filterRowsForTab(sortedRows, tab, currentPeriodKey),
      dropsByRowKey: liveDropsByRowKey,
      weeklySubtotals,
      isPeriodLoading: false,
      periodUnavailable: false,
      canGoPreviousPeriod,
      error: null,
      staleCharacterNames,
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
      })
    }

    const applyEdit = (candidate: BossProfitRow): BossProfitRow =>
      matchesRowKey(candidate, rowKey) ? { ...candidate, partySize, payoutMeso } : candidate

    set({ rows: get().rows.map(applyEdit) })

    // latestSyncSnapshot(모듈 스코프 캐시)도 함께 갱신해야 한다 — 그렇지 않으면 이 수정 후
    // 탭을 전환했다가 돌아오거나 기간을 이동했다 복귀할 때, loadPeriod의 "현재 기간" 분기가
    // 이 스냅샷에서 그대로 슬라이스하므로 방금 수정한 값이 낡은 스냅샷 값으로 되돌아가 보인다
    // (2026-07-22 재현 — "파티원 수를 고쳐도 다시 파티관리 기본값으로 돌아간다"로 보고된 증상의
    // 실제 원인).
    if (latestSyncSnapshot !== null) {
      latestSyncSnapshot = { ...latestSyncSnapshot, rows: latestSyncSnapshot.rows.map(applyEdit) }
    }
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
}))
