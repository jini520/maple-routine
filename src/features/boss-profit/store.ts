import { create } from 'zustand'
import { planConfirmedDifficultyDropMigration, pruneUnobtainableDrops } from '../../lib/boss-drops'
import { DEFAULT_MAX_PARTY_SIZE, findPriceEntry } from '../../lib/boss-crystal-prices'
import { getBossReferenceOrder, matchBossContent, selectBossProfitBosses, type MatchedBoss } from '../../lib/boss-matching'
import { mergeManualBossList } from '../../lib/manual-boss-merge'
import {
  containsInProgressWeek,
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  getBackfillQueryDate,
  getCurrentBossProfitPeriod,
  getWeeklyPeriodKeysInMonth,
  isEarliestNavigablePeriod,
  isLatestPeriod,
  isPeriodQueryable,
  resolvePagePeriodState,
  resolvePeriodDataState,
  type PeriodDataState,
  type PeriodQueryOutcome,
} from '../../lib/boss-profit-period'
import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import { getAuthConfig } from '../../storage/api-key'
import { getBossPartySize } from '../../storage/boss-party-settings'
import {
  fillMissingRecordWorlds,
  getBossProfitRecords,
  hasBossProfitRecordsAtOrBefore,
  upsertBossProfitRecord,
  type BossProfitRecord,
} from '../../storage/boss-profit'
import { getBossDropRecords, replaceBossDropRecords } from '../../storage/boss-drops'
import type { BossDropRecord } from '../../storage/boss-drops'
import type { RecordedDrop } from '../../types/drops'
import { isPeriodChecked, markPeriodChecked } from '../../storage/boss-profit-period-checks'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getManualTrackedContent, type ManualTrackedItem } from '../../storage/manual-tracked-content'
import { getCachedSchedulerState } from '../../storage/scheduler-cache'
import { getTrackingMode, type TrackingMode } from '../../storage/tracking-mode'
import { BOSS_DIFFICULTIES, type BossContent, type BossCycle, type BossDifficulty } from '../../types'
import { compareByName } from '../onboarding/representative-character'
import { syncSchedules, toScheduleSyncError, type ScheduleSyncError } from '../schedule-sync/schedule-sync'

export interface BossProfitRow {
  ocid: string
  characterName: string
  imageUrl: string | null // character/basic의 character_image(character-basic-cache 경유). 캐시가 없으면 null(이니셜 폴백)
  world: string | null // character/basic의 world_name(character-basic-cache 경유). 이전 캐시엔 없을 수 있어 null 가능([[ADR-054]] 결정 5·6 — 월드를 모르는 캐릭터는 월드 집계에서 제외)
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

/**
 * 월간 탭 주차 행의 상태([[ADR-068]] 결정 2). 기간 6상태([[ADR-067]] 결정 2)에 이 화면 고유의 두
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
  // 이 기간을 화면이 어떻게 말해야 하는지([[ADR-067]] 결정 2, 표현은 [[ADR-068]]). 전에는
  // periodUnavailable(boolean) 하나로 "집계 전"과 "그 외 실패"를 같은 문구로 말했다.
  periodState: PeriodDataState
  canGoPreviousPeriod: boolean // 현재 선택된 기간에서 한 칸 더 과거로 이동할 수 있는지(#29) — 이전 기간이 지금 조회 가능하거나 이미 캐시된 기록이 있을 때만 true. 조회 불가·레코드 없는 기간에 착지하는 것을 막는다.
  error: ScheduleSyncError | null
  staleCharacterNames: string[]
  /**
   * 동기화가 실패한 캐릭터의 카드에 붙일 표식([[ADR-068]] 결정 3). 키는 ocid —
   * `staleCharacterNames`(토스트용 이름 목록, [[ADR-063]])만으로는 어느 **카드**인지 알 수 없다.
   *   `unavailable` 400 OPENAPI00003 — 이 캐릭터는 조회할 수 없다(영구)
   *   `failed`      그 외 실패(네트워크·타임아웃 등)
   */
  characterIssues: Record<string, 'unavailable' | 'failed'>
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
  /**
   * 지금 보고 있는 (tab, periodKey)를 다시 로드한다([[ADR-068]] 결정 1·2). 재시도(`failed`)와
   * 조회(`notChecked`) 두 상태가 사용자에게 주는 유일한 행동이고 둘 다 같은 일을 한다 —
   * 그 기간의 미확인 target을 다시 백필한다. `refresh` 로는 대신할 수 없다(현재 기간으로 되돌린다).
   */
  retryPeriod(): Promise<void>
  setPartySize(row: BossProfitRowKey, partySize: number): Promise<void>
  setBossDrops(row: BossProfitRowKey, drops: RecordedDrop[]): Promise<void>
}

// 행 하나에 실리는 캐릭터 정보 한 덩어리. buildBossProfitRow/buildRowFromRecord가 이 객체를 통째로
// 받으므로, 필드가 늘어도 채우지 않은 호출부는 컴파일 단계에서 걸린다(세 경로 중 하나만 비는 것 방지).
interface CharacterProfileInfo {
  characterName: string
  imageUrl: string | null
  world: string | null
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
  world: string | null // 같은 캐시 프로필의 world_name. 월드별 결정석 한도 집계용([[ADR-054]] 결정 5)
  // ADR-078 결정 2: 이 조회가 이미 읽은 이름을 버리지 않고 흘려보내, 뒤따르는 함수들이 같은 캐시를
  // 다시 읽지 않게 한다. **캐시가 없으면 null**이다 — 정렬용으로 쓰는 ''(빈 이름)를 그대로 넘기면
  // "캐시 없음"이 "이름이 빈 캐릭터"로 둔갑해 buildRowsFromRecords의 제외 규칙이 깨진다.
  characterName: string | null
}

// ADR-078 결정 2: 한 번의 기간 로드가 공유하는 프로필 스냅샷. 캐시가 없는 ocid는 **넣지 않는다**
// (넣으면 이름 없는 행이 화면에 샌다).
function toProfileSnapshot(infos: SortedCharacterInfo[]): Map<string, CharacterProfileInfo> {
  const profiles = new Map<string, CharacterProfileInfo>()
  for (const info of infos) {
    if (info.characterName === null) continue
    profiles.set(info.ocid, {
      characterName: info.characterName,
      imageUrl: info.imageUrl,
      world: info.world,
    })
  }
  return profiles
}

// ADR-017 결정 2와 동일한 원칙 — 캐시 단계(trackedOcids 저장 순서)와 동기화 단계(Nexon
// character/list 응답 순서)가 서로 달라 캐릭터 목록 위치가 API 응답 이후 갑자기 바뀌어 보이던
// 문제를 없앤다. 레벨 내림차순(동레벨이면 이름순)으로 항상 같은 순서를 계산해, 캐시 우선 표시
// 단계부터 실시간 동기화·과거 기간 조회까지 전부 이 순서를 그대로 따르게 한다. character-basic-cache를
// 이미 조회하는 김에 아바타용 imageUrl과 월드(world_name)도 함께 반환한다 — 같은 profile 객체에
// 들어 있어 추가 조회 비용이 0이다([[ADR-054]] 결정 5). 캐릭터명은 반환하지 않는다 — rows의
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
  character: CharacterProfileInfo,
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
    characterName: character.characterName,
    imageUrl: character.imageUrl,
    world: character.world,
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

// ADR-069 결정 1(원천 규칙): **기록이 있으면 record.world, 없으면 캐시**다. 과거 기간 행은 전부
// 기록에서 오므로 여기서 스냅샷이 이긴다 — 캐시(라이브 값)를 쓰면 월드 리프가 과거 집계를 소급
// 이동시킨다. 컬럼 도입 전 기록(world: null)만 캐시 값으로 폴백한다.
function buildRowFromRecord(
  record: BossProfitRecord,
  character: CharacterProfileInfo,
  now: Date,
): BossProfitRow {
  const difficulty = record.difficulty as BossDifficulty
  const priceEntry = findPriceEntry(record.boss, difficulty)
  const maxPartySize = priceEntry?.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE

  return {
    ocid: record.ocid,
    characterName: character.characterName,
    imageUrl: character.imageUrl,
    world: record.world ?? character.world,
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

// ADR-067 결정 4(표시): **현재 기간의 행은 API/캐시가 원천이고 과거 기간의 행은 기록이 원천**이라는
// 비대칭 때문에, API가 보스를 빼면 이미 저장된 수익이 현재 기간 화면에서 사라진다. 실측된 경로는
// 미접속 캐릭터의 축약 응답이다 — 월간 보스를 처치한 뒤 1주 이상 접속하지 않으면 bossMonthly가
// reg=false·comp=false로만 남아 `selectBossProfitBosses` 가 행을 만들지 않는다(재현: 6.65억 기록
// 보유 상태에서 "이번 달 총 수익 0메소").
//
// mergeRecordsIntoRows는 **있는 행을 채우기만** 하므로, 기록만 있는 조합은 여기서 행으로 되살린다.
// 참조 데이터에서 사라진 보스의 기록도 행이 되지만 그것이 원칙과 일치한다("과거 기록은 지우지
// 않는다", error-resilience 원칙 5).
function appendRecordOnlyRows(
  rows: BossProfitRow[],
  records: BossProfitRecord[],
  profiles: Map<string, CharacterProfileInfo>,
  now: Date,
): BossProfitRow[] {
  const seen = new Set(rows.map((row) => `${row.ocid}|${row.boss}|${row.difficulty}|${row.periodKey}`))
  const restored: BossProfitRow[] = []

  for (const record of records) {
    const key = `${record.ocid}|${record.boss}|${record.difficulty}|${record.periodKey}`
    if (seen.has(key)) {
      continue
    }
    const profile = profiles.get(record.ocid)
    if (profile === undefined) {
      // 이 캐릭터의 프로필을 모르면 행을 만들 수 없다(캐릭터명·아바타가 없다) — buildRowsFromRecords가
      // 캐시 없는 ocid를 건너뛰는 것과 같은 규약이다.
      continue
    }
    seen.add(key)
    restored.push(buildRowFromRecord(record, profile, now))
  }

  return [...rows, ...restored]
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
        subtotals.push({ ocid, characterName, imageUrl, periodKey: weekKey, totalMeso: 0, state: 'upcoming' })
        continue
      }

      const matchingRecords = records.filter(
        (record) => record.ocid === ocid && record.cycle === 'weekly' && record.periodKey === weekKey,
      )
      const recordedMeso = matchingRecords.reduce((sum, record) => sum + record.payoutMeso, 0)

      if (weekKey === currentWeeklyPeriodKey) {
        // 진행 중인 주. 라이브 원천이 있으면 그쪽이 최신이고(자동 기록이 건너뛰어진 처치까지
        // 담는다), 없으면 이미 쌓인 기록에서 읽는다(ADR-075 — 달 경계를 걸친 주).
        const totalMeso = hasLiveSource
          ? sumRowsPayout(
              liveRows.filter((row) => row.ocid === ocid && row.cycle === 'weekly' && row.periodKey === weekKey),
            )
          : recordedMeso
        subtotals.push({ ocid, characterName, imageUrl, periodKey: weekKey, totalMeso, state: 'inProgress' })
        continue
      }

      // 판정을 화면·백필과 공유하는 한 함수에 맡긴다([[ADR-067]] 결정 2) — 전에는 여기서
      // "기록 없음 + 조회 가능"을 confirmed로 떨어뜨려 **조회한 적 없는 주를 0메소로 위장**했다.
      const state = resolvePeriodDataState({
        isCurrentPeriod: false,
        hasRecords: matchingRecords.length > 0,
        isChecked: checkedKeys.has(`${ocid}|${weekKey}`),
        isQueryable: isPeriodQueryable('weekly', weekKey, now),
        lastOutcome: outcomes?.get(`${ocid}|weekly|${weekKey}`) ?? null,
      })
      subtotals.push({ ocid, characterName, imageUrl, periodKey: weekKey, totalMeso: recordedMeso, state })
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
// 실패하면 호출하지 않아 다음 방문 때 재시도된다. 이미 기록된 보스(setPartySize로 override된 값
// 포함)는 건드리지 않는다 — 기존 refresh() 자동 기록 로직과 동일하게 "기록이 없는 조합만"
// 기본값(파티 관리 설정, 없으면 1)으로 채운다. 즉 **실시간으로 쌓인 기록이 base이고 백필은 빠진
// 것만 채우는 delta**다.
//
// 반환값은 이번 시도의 결과다([[ADR-067]] 결정 2) — null이면 확인 완료(0건이든 기록을 채웠든),
// 'notCollected'면 아직 집계 전(시간이 지나면 풀린다), 'failed'면 그 외 실패(지금 재시도 가능).
// **조회 불가(구간 밖) 대상은 여기 들어오지 않는다** — 호출부가 걸러낸다. 전에는 이 함수가 그
// 대상을 markPeriodChecked로 굳혔는데, 그러면 "조회해서 0건을 봤다"와 "조회 불가라 굳혔다"가
// 같은 기록이 되어 confirmedEmpty가 outOfRange로 격하되는 원인이었다([[ADR-067]] 결정 3).
async function backfillTarget(target: BackfillTarget, now: Date): Promise<PeriodQueryOutcome | null> {
  const date = getBackfillQueryDate(target.cycle, target.periodKey)

  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    return 'failed'
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
    // ADR-069 결정 1: 백필로 만드는 delta 행에도 월드를 박는다. 그 시점 캐시의 월드를 쓰는데,
    // **리프 이전 주는 API가 400을 주므로 백필 자체가 불가능**하고(실측) 백필로 채워지는 리프 이후
    // 주는 현재 월드가 정답이라 실질 부정확이 없다.
    const backfillWorld = (await getCachedCharacterBasic(target.ocid))?.profile.world ?? null

    // ADR-069 결정 4: 백필 응답이 **처치 난이도를 확정하는 지점**이다. 대상(캐릭터×기간)당 한 번만
    // 읽어 아래 루프에서 재사용한다 — 보스마다 조회하면 같은 쿼리를 보스 수만큼 반복한다.
    const dropRecords =
      completedBosses.length === 0
        ? []
        : await withSqliteFallback(getBossDropRecords([target.ocid], [target.periodKey]), [])

    for (const boss of completedBosses) {
      const bossName = boss.matchedBossName ?? boss.apiName
      // 이관은 `alreadyRecorded` 판정보다 앞에 둔다 — 이미 수익 기록이 있든 없든 이 응답이 말하는
      // 처치 난이도는 같고, 아래 continue 들(이미 기록됨·가격 미확정)에 막히면 안 되기 때문이다.
      await migrateDropsToConfirmedDifficulty(
        { ocid: target.ocid, boss: bossName, difficulty: boss.difficulty, periodKey: target.periodKey },
        dropRecords,
        now,
      )

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
          world: backfillWorld,
        }),
      )
    }

    await withSqliteTimeout(markPeriodChecked(target.ocid, target.cycle, target.periodKey, now.toISOString()))
    return null
  } catch (error) {
    // 코드가 알려주는 사실을 상태로 옮긴다([[ADR-067]] 결정 1).
    //  - notCollected(00009): 실패가 아니라 "아직" — 재시도 유도 문구를 띄우지 않는다.
    //  - periodOutOfRange(00004): 우리 계산상 조회 구간 안인데 API가 거부한 것 — 월드 리프 이전·
    //    휴면 등 그 캐릭터·날짜에 고유한 사정이라 "다시 시도"가 아니라 "조회할 수 없다"가 맞다.
    const kind = toScheduleSyncError(error).kind
    if (kind === 'notCollected') return 'notCollected'
    if (kind === 'periodOutOfRange') return 'outOfRange'
    return 'failed'
  }
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
  // ADR-068 결정 5: **그 기간 또는 더 과거에** 기록이 있으면 통과시킨다. 전에는 바로 이전 한 칸의
  // 기록만 봐서, 접속하지 않은 주가 벽이 되어 그 뒤의 기록 전체에 도달할 수 없었다(이슈 #78 —
  // 3·4주차 미접속 캐릭터의 1·2주차 기록이 DB에 있어도 화면으로 갈 방법이 없었다).
  // 빈 기간은 한 칸씩 지나가야 하지만(시안 A) 벽은 사라진다.
  return hasBossProfitRecordsAtOrBefore(ocids, tab, prevPeriodKey)
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

function toRecordedDrop(record: BossDropRecord): RecordedDrop {
  return {
    category: record.category,
    itemName: record.itemName,
    slot: record.slot ?? undefined,
    boxOrigin: record.boxOrigin ?? undefined,
    ringLevel: record.ringLevel ?? undefined,
    quantity: record.quantity,
  }
}

/**
 * 처치 난이도가 확정된 순간, 옛 난이도 키에 남은 드롭을 확정 난이도로 이관한다([[ADR-069]] 결정 4).
 * 계산은 `planConfirmedDifficultyDropMigration` 이 하고 여기서는 쓰기만 한다.
 *
 * `dropRecords` 는 호출 측이 이미 읽어둔 것을 그대로 받는다 — 행마다 새로 조회하지 않기 위함이다.
 * 옮길 것이 없으면 계획이 `null` 이라 쓰기도 없다(멱등).
 *
 * **확정 키를 먼저 쓰고 옛 키를 비운다.** 순서를 뒤집으면 중간에 앱이 죽었을 때 기록이 사라지는데,
 * 이 순서면 최악이 "아무도 읽지 않는 옛 키에 사본이 남는다"(=이관 전과 같은 고아)로 끝난다.
 */
async function migrateDropsToConfirmedDifficulty(
  row: Pick<BossProfitRow, 'ocid' | 'boss' | 'difficulty' | 'periodKey'>,
  dropRecords: BossDropRecord[],
  now: Date,
): Promise<void> {
  const plan = planConfirmedDifficultyDropMigration(
    row.boss,
    row.difficulty,
    dropRecords
      .filter(
        (record) =>
          record.ocid === row.ocid && record.boss === row.boss && record.periodKey === row.periodKey,
      )
      .map((record) => ({
        ...toRecordedDrop(record),
        difficulty: record.difficulty,
        dropIndex: record.dropIndex,
      })),
  )
  if (plan === null) return

  const recordedAt = now.toISOString()
  if (plan.drops.length > 0) {
    await withSqliteFallback(
      replaceBossDropRecords(row.ocid, row.boss, row.difficulty, row.periodKey, plan.drops, recordedAt),
      undefined,
    )
  }
  for (const staleDifficulty of plan.staleDifficulties) {
    await withSqliteFallback(
      replaceBossDropRecords(row.ocid, row.boss, staleDifficulty, row.periodKey, [], recordedAt),
      undefined,
    )
  }
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
    const canGoPreviousPeriod = await canReachPreviousPeriod(tab, periodKey, ocids, now)
    const dropsByRowKey = await loadDropsByRowKey(ocids, rows, now)
    if (generation !== requestGeneration) return
    // loadPeriod는 항상 로컬 데이터(스냅샷/기록)로만 뷰를 정착시키고 실시간 동기화를 하지 않는다.
    // 또한 이 함수는 항상 requestGeneration을 올린 네비게이션 뒤에만 실행되므로, 진행 중이던
    // refresh의 'loading'은 이미 무효화된 상태다. 여기서 status를 'loaded'로 확정하지 않으면,
    // refresh 도중 기간을 이동했다가 돌아왔을 때 refresh의 최종 'loaded' set이 세대 가드에 막혀
    // status가 'loading'에 영구히 갇히는 버그가 생긴다(사용자 보고 — "조회 중..." 무한 진행).
    set({
      status: 'loaded',
      rows,
      dropsByRowKey,
      weeklySubtotals,
      isPeriodLoading: false,
      // 현재 기간은 실시간 동기화가 원천이라 recorded/confirmedEmpty뿐이다([[ADR-067]] 결정 2).
      periodState: resolvePeriodDataState({
        isCurrentPeriod: true,
        hasRecords: rows.length > 0,
        isChecked: false,
        isQueryable: false,
        lastOutcome: null,
      }),
      canGoPreviousPeriod,
    })
    return
  }

  // 각 target(캐릭터×기간)의 상태를 모아 이 화면의 상태를 정한다([[ADR-067]] 결정 2).
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
  const canGoPreviousPeriod = await canReachPreviousPeriod(tab, periodKey, ocids, now)
  const dropsByRowKey = await loadDropsByRowKey(ocids, rows, now)

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
    dropsByRowKey,
    weeklySubtotals,
    isPeriodLoading: false,
    periodState,
    canGoPreviousPeriod,
  })
}

const initialState: BossProfitState = {
  status: 'idle',
  tab: 'weekly',
  periodKey: getCurrentBossProfitPeriod('weekly', new Date()).periodKey,
  rows: [],
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

    // ADR-076: 보고 있는 기간이 "진행 중인 주를 품은 지난 달"(7월 5주차 = 7/30~8/5)이면 그 화면에서
    // 새로고침할 수 있고, 그때는 **보던 기간을 유지**한다 — 동기화·자동 기록·스냅샷 갱신은 그대로
    // 하고(그것이 진행 중인 주의 기록을 만드는 유일한 경로다) 화면 반영만 loadPeriod에 넘긴다.
    const viewedPeriodKey = get().periodKey
    const refreshInPlace = containsInProgressWeek(tab, viewedPeriodKey, now)

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
    // 월드도 같은 조회 결과에서 그대로 꺼내 행까지 흘린다([[ADR-054]] 결정 5).
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
          const profile: CharacterProfileInfo = {
            characterName: cached.state.characterName,
            imageUrl: imageUrlByOcid.get(ocid) ?? null,
            world: worldByOcid.get(ocid) ?? null,
          }
          return displayBosses.map((boss) => buildBossProfitRow(ocid, profile, boss, now))
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
      cachedRows.map((row) => [
        row.ocid,
        { characterName: row.characterName, imageUrl: row.imageUrl, world: row.world },
      ]),
    )
    latestSyncSnapshot = { ocids: [...ocids], rows: cachedMergedRows, characterProfiles: cachedCharacterProfiles }

    // 제자리 새로고침(ADR-076 결정 2)은 캐시 우선 표시의 **화면 반영만** 건너뛴다 — 이 단계가
    // 그리는 것은 현재 기간의 캐시 행이라, 그대로 두면 7월 화면에 8월 데이터가 한 프레임 스친다.
    // 화면은 이미 그 기간을 그리고 있으므로 새로 그릴 것도 없다. 바로 위의 latestSyncSnapshot
    // 갱신은 그대로 한다(동기화가 실패해도 현재 기간으로 돌아갔을 때 캐시 우선 표시가 유지돼야 한다).
    if (refreshInPlace) {
      if (myGeneration !== requestGeneration) return
      set({ status: 'loading', error: null, staleCharacterNames: [], characterIssues: {} })
    } else {
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
        periodState: cachedMergedRows.length > 0 ? 'recorded' : 'confirmedEmpty',
        canGoPreviousPeriod,
        error: null,
        staleCharacterNames: [],
        characterIssues: {},
      })
    }

    let results: Awaited<ReturnType<typeof syncSchedules>>
    try {
      results = await syncSchedules(ocids)
    } catch (error) {
      // syncSchedules 자체가 던지는 에러(온보딩 미완료 등)는
      // 캐릭터별 에러가 아니라 전체 조회 자체의 실패다.
      // 원인은 toScheduleSyncError로 살린다([[ADR-063]]).
      if (myGeneration === requestGeneration) {
        set({ status: 'error', error: toScheduleSyncError(error) })
      }
      return
    }

    const rows: BossProfitRow[] = []
    const staleCharacterNames: string[] = []
    const characterIssues: Record<string, 'unavailable' | 'failed'> = {}
    // 동기화가 실패한 캐릭터. buildFallbackResult가 **마지막 캐시 상태를 그대로** 돌려주므로
    // (schedule-sync.ts) 그 state의 완료 여부는 "지금"의 사실이 아니다 — 자동 기록에서 제외한다
    // ([[ADR-067]] 결정 7). 표시는 캐시 우선 표시 규약([[ADR-017]])을 그대로 따르고, 그 카드에
    // 표식을 붙이는 것은 [[ADR-068]] 결정 3의 몫이다.
    const staleOcids = new Set<string>()
    const characterProfiles = new Map<string, CharacterProfileInfo>()

    for (const result of results) {
      const profile: CharacterProfileInfo = {
        characterName: result.characterName,
        imageUrl: imageUrlByOcid.get(result.ocid) ?? null,
        world: worldByOcid.get(result.ocid) ?? null,
      }
      characterProfiles.set(result.ocid, profile)

      if (result.isStale) {
        staleCharacterNames.push(result.characterName)
        staleOcids.add(result.ocid)
        // 영구(조회 불가)와 일시(그 외)를 카드에서도 갈라 말한다([[ADR-068]] 결정 3) — 전자는
        // 재시도가 무의미하고 추적 해제가 유일한 조치다.
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
    // 아래 자동 기록이 사용자가 저장한 파티원 수를 1로 덮어쓴다([[ADR-050]] 결정 3).
    const records = await withSqliteFallback<BossProfitRecord[] | null>(
      getBossProfitRecords(ocids, periodKeys),
      null,
    )
    const mergedRows = mergeRecordsIntoRows(rows, records ?? [])

    // ADR-014/ADR-019: 기록이 없는 완료 보스는 화면 진입 전에도 즉시 기본 파티원 수로 자동 기록한다.
    // 기본값은 boss_party_settings(파티 관리) 조회 결과, 없으면 1(솔로)이다.
    // upsertBossProfitRecord는 단일 공유 SQLite 커넥션에 자체 트랜잭션을 열므로,
    // Promise.all로 동시 실행하면 트랜잭션이 겹쳐 에러가 난다 — 순차 실행으로 처리한다.
    // ADR-069 결정 4: 아래 루프에서 완료 행의 드롭 이관에 쓴다(자동 기록과 같은 순회를 쓴다).
    const dropRecordsForMigration =
      records === null
        ? []
        : await withSqliteFallback(getBossDropRecords(ocids, periodKeys), [])

    const autoRecordedRows: BossProfitRow[] = []
    for (const row of mergedRows) {
      // 완료 행은 처치 난이도가 확정된 것이다 — 다른 난이도 키에 남은 드롭을 이 난이도로 옮긴다
      // ([[ADR-069]] 결정 4). 아래 자동 기록 가드보다 조건이 넓다: 가격 미확정이거나 이미 기록된
      // 조합도 난이도는 확정된 상태다. 낡은 캐시에서 나온 행은 제외한다([[ADR-067]] 결정 7 —
      // 그 행의 난이도는 지금의 사실이 아니다).
      if (records !== null && !staleOcids.has(row.ocid) && row.isComplete) {
        await migrateDropsToConfirmedDifficulty(row, dropRecordsForMigration, now)
      }

      // 미완료 placeholder(ADR-032)는 절대 자동 기록하지 않는다 — 여기서 기록해버리면
      // 나중에 실제로 완료됐을 때 "이미 기록이 있다"고 오판해 실제 처치 수익으로 다시
      // 계산되지 않고 0메소로 영구히 고정된다.
      // records가 null이면 조회 자체가 실패한 것이라 이 조합에 기록이 있는지 알 수 없다 —
      // 기본값으로 덮어쓰지 말고 다음 새로고침의 정상 커넥션에 맡긴다([[ADR-050]] 결정 3).
      // 동기화가 실패한 캐릭터도 제외한다([[ADR-067]] 결정 7) — 그 행은 낡은 캐시에서 나왔고,
      // 여기서 기록하면 4주 전 처치가 이번 주 수익으로 **영구히** 남는다(기록이 생긴 뒤에는
      // mergeRecordsIntoRows가 계속 복원하므로 스스로 사라지지 않는다). 캐시 우선 표시 분기가
      // 같은 이유로 자동 기록을 하지 않는데(위 [[ADR-017]] 주석) 폴백 경로가 그 방어를 우회했다.
      if (
        records === null ||
        staleOcids.has(row.ocid) ||
        !row.isComplete ||
        row.partySize !== null ||
        row.priceMeso === null
      ) {
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
          world: row.world,
        }),
        undefined,
      )

      autoRecordedRows.push({ ...row, partySize, payoutMeso })
    }

    // 기록만 있는 조합을 행으로 되살린다(ADR-067 결정 4 — 위 appendRecordOnlyRows 주석).
    const unionRows = appendRecordOnlyRows(autoRecordedRows, records ?? [], characterProfiles, now)
    const sortedRows = sortRowsByOcidOrder(unionRows, sortedOcids)
    latestSyncSnapshot = { ocids: [...ocids], rows: sortedRows, characterProfiles }

    // 실시간 동기화가 실제로 성공했으므로 "마지막 동기화 시각"을 기록한다 — 세대 가드보다 앞에서
    // 갱신해야 한다. 그 사이 다른 기간으로 이동해(세대가 바뀌어) 아래 최종 set()이 건너뛰어지더라도,
    // latestSyncSnapshot(모듈 스코프)은 이미 신선한 데이터로 갱신되므로 현재 기간으로 돌아오면 그
    // 데이터가 보인다. 이때 lastSyncedAt만 함께 갱신되지 않으면 "신선한 데이터를 보여주면서도
    // 동기화 기록 없음"이라고 표시되는 불일치가 생긴다(사용자 보고). lastSyncedAt은 새로고침이
    // 가능한 기간에서만 노출되므로(#30, ADR-076) 완전히 닫힌 과거 기간을 보는 동안 이 set이
    // 일어나도 화면에는 영향이 없다.
    set({ lastSyncedAt: new Date().toISOString() })

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
      periodState: sortedRows.length > 0 ? 'recorded' : 'confirmedEmpty',
      canGoPreviousPeriod,
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
