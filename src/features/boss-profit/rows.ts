// 보스 수익 **행(row) 도메인의 순수 함수**들 — 스토어에서 분리했다(ADR-094 5단계).
//
// 왜 분리하나 — 이 함수들은 입출력만 있고 스토어·저장소·DOM 을 만지지 않는데, 1,548줄짜리
// store.ts 안에 있어서 **직접 테스트할 수 없었다**(export 된 것은 dropRowKey 하나뿐이라
// 89개 스토어 테스트가 전부 스토어를 거쳐 간접 검증했다). 여기로 나오면서 각 함수를
// 입출력으로 바로 검증할 수 있다.
//
// 여기 있는 것의 공통점: **행을 만들고·합치고·거르고·정렬한다.** 비동기 오케스트레이션,
// SQLite 복원력 래퍼, 백필 대상 계산은 스토어의 흐름에 붙어 있어 그대로 남겼다.

import { DEFAULT_MAX_PARTY_SIZE, findPriceEntry } from '../../lib/boss/boss-crystal-prices'
import {
  compareBossOrder,
  isWeeklyClearLimitReached,
  matchBossContent,
  selectBossProfitBosses,
} from '../../lib/boss/boss-matching'
import type { MatchedBoss } from '../../lib/boss/boss-matching'
import { formatBossProfitPeriodLabel, getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import { mergeManualBossList } from '../../lib/boss/manual-boss-merge'
import type { BossDropRecord } from '../../storage/boss-drops'
import type { BossProfitRecord, getBossProfitRecords } from '../../storage/boss-profit'
import type { ManualTrackedItem } from '../../storage/manual-tracked-content'
import type { TrackingMode } from '../../storage/tracking-mode'
import type { BossContent, BossCycle, BossDifficulty } from '../../types'
import type { RecordedDrop } from '../../types/drops'

export interface BossProfitRow {
  ocid: string
  characterName: string
  imageUrl: string | null // character/basic의 character_image(character-basic-cache 경유). 캐시가 없으면 null(이니셜 폴백)
  world: string | null // character/basic의 world_name(character-basic-cache 경유). 이전 캐시엔 없을 수 있어 null 가능(6 — 월드를 모르는 캐릭터는 월드 집계에서 제외)
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

export type BossProfitRowKey = Pick<BossProfitRow, 'ocid' | 'boss' | 'difficulty' | 'cycle' | 'periodKey'>

// 행 하나에 실리는 캐릭터 정보 한 덩어리. buildBossProfitRow/buildRowFromRecord가 이 객체를 통째로
// 받으므로, 필드가 늘어도 채우지 않은 호출부는 컴파일 단계에서 걸린다(세 경로 중 하나만 비는 것 방지).
export interface CharacterProfileInfo {
  characterName: string
  imageUrl: string | null
  world: string | null
}

export interface SortedCharacterInfo {
  ocid: string
  imageUrl: string | null // character-basic-cache의 character_image. 아바타 렌더링용(ADR-023 "미확정" 해소)
  world: string | null // 같은 캐시 프로필의 world_name. 월드별 결정석 한도 집계용
  // ADR-078 결정 2: 이 조회가 이미 읽은 이름을 버리지 않고 흘려보내, 뒤따르는 함수들이 같은 캐시를
  // 다시 읽지 않게 한다. **캐시가 없으면 null**이다 — 정렬용으로 쓰는 ''(빈 이름)를 그대로 넘기면
  // "캐시 없음"이 "이름이 빈 캐릭터"로 둔갑해 buildRowsFromRecords의 제외 규칙이 깨진다.
  characterName: string | null
}

// ADR-078 결정 2: 한 번의 기간 로드가 공유하는 프로필 스냅샷. 캐시가 없는 ocid는 **넣지 않는다**
// (넣으면 이름 없는 행이 화면에 샌다).
export function toProfileSnapshot(infos: SortedCharacterInfo[]): Map<string, CharacterProfileInfo> {
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

// rows(보스 단위, 캐릭터당 여러 개)를 sortedOcids가 정한 캐릭터 순서로 재배열하고, 같은 캐릭터
// 안에서는 weekly-bosses.json 정규 순서(REFERENCE_ENTRIES: weekly → eventWeekly → monthly)로
// 결정적으로 정렬한다(#28). 예전에는 캐릭터 순위(ocid)로만 정렬하고 stable sort에
// 의존해 보스 순서를 데이터 소스가 만든 순서 그대로 물려받았는데, 그 소스 순서가 비결정적이라
// (특히 ORDER BY 없는 getBossProfitRecords, 캐시/라이브 Map 삽입 순서) 로드/렌더마다 보스 순서가
// 달라졌다. 모든 행 경로가 이 함수를 거치므로 여기서 2차 정렬 키를 부여하면 세 경로가 전부 같은
// 순서로 고정된다. 참조에 없는 보스(매칭 실패 원문명)는 맨 뒤로, 같은 보스의 여러
// 난이도는 난이도 순서로, 그래도 동률이면 보스명으로 완전 결정한다 — 그 세 키는 이제
// `boss-matching` 의 공용 `compareBossOrder` 가 든다.
export function sortRowsByOcidOrder(rows: BossProfitRow[], sortedOcids: string[]): BossProfitRow[] {
  const rank = new Map(sortedOcids.map((ocid, index) => [ocid, index]))
  const ocidRank = (ocid: string): number => rank.get(ocid) ?? Number.MAX_SAFE_INTEGER
  return [...rows].sort((a, b) => {
    const rankDiff = ocidRank(a.ocid) - ocidRank(b.ocid)
    if (rankDiff !== 0) return rankDiff
    // 순위가 같은데 ocid가 다르면(둘 다 sortedOcids 밖인 예외) 캐릭터끼리 섞이지 않게 ocid로 묶는다.
    if (a.ocid !== b.ocid) return a.ocid < b.ocid ? -1 : 1
    // 2차 키 셋(참조 인덱스 → 난이도 → 보스명)은 여기 인라인이던 것을 **참조표의 소유자**로
    // 옮긴 것뿐이다 — 계약은 그대로이고, 스케줄러·today·
    // 가계부가 이제 같은 함수를 부른다.
    return compareBossOrder(a, b)
  })
}

export function buildBossProfitRow(
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
export function selectProfitDisplayBosses(
  bossContents: BossContent[],
  mode: TrackingMode,
  manualItems: ManualTrackedItem[],
): MatchedBoss[] {
  const matched = bossContents.map(matchBossContent)
  // **주간 한도를 채웠으면 미처치 placeholder 는 아예 안 세운다**(— 두 모드
  // 공통이라 아래 ①②보다 앞에 선다). 판정은
  // 동기화 결과 전체로 한다 — 이 결정이 겨누는 상황이 «표시 목록 밖 보스로 12를 채웠다» 라,
  // 목록만 보면 영영 12가 안 된다(이 «등록 여부와 무관하게» 세는 것과 같다).
  //
  // 「마감」 배지를 여기까지 들고 오지 않는 이유: 이 페이지는 정산이라 «벌지 않은 것» 은 줄을
  // 갖지 않는다(마감이 서는 자리는 보스 스케줄러 카드다). 그리고 «완료» 로 칠하지도 않는다 —
  // 그러면 안 잡은 보스의 결정석이 금액이 된다.
  const limitReached = isWeeklyClearLimitReached(matched)
  const isLimitClosed = (boss: MatchedBoss): boolean =>
    limitReached && boss.cycle === 'weekly' && !boss.isSeasonBoss && !boss.ownComplete

  if (mode !== 'manual') {
    return selectBossProfitBosses(matched).filter((boss) => !isLimitClosed(boss))
  }

  const nameOf = (boss: MatchedBoss): string => boss.matchedBossName ?? boss.apiName

  // ① 실제 처치한 보스는 추적 여부와 무관하게 전부, 처치한 난이도·가격으로 노출한다(사용자 확정) —
  // 보스 수익 페이지는 정산이 목적이라 실제로 번 것은 다 보여준다. selectBossProfitBosses가
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
    .filter((boss) => !boss.ownComplete && !killedNames.has(nameOf(boss)) && !isLimitClosed(boss))

  return [...kills, ...placeholders]
}

// ADR-069 결정 1(원천 규칙): **기록이 있으면 record.world, 없으면 캐시**다. 과거 기간 행은 전부
// 기록에서 오므로 여기서 스냅샷이 이긴다 — 캐시(라이브 값)를 쓰면 월드 리프가 과거 집계를 소급
// 이동시킨다. 컬럼 도입 전 기록(world: null)만 캐시 값으로 폴백한다.
export function buildRowFromRecord(
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

export function mergeRecordsIntoRows(
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
export function appendRecordOnlyRows(
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

export function matchesRowKey(row: BossProfitRow, key: BossProfitRowKey): boolean {
  return (
    row.ocid === key.ocid &&
    row.boss === key.boss &&
    row.difficulty === key.difficulty &&
    row.cycle === key.cycle &&
    row.periodKey === key.periodKey
  )
}

export function filterRowsForTab(rows: BossProfitRow[], tab: BossCycle, periodKey: string): BossProfitRow[] {
  return rows.filter((row) => row.cycle === tab && row.periodKey === periodKey)
}

export function sumRowsPayout(rows: BossProfitRow[]): number {
  return rows.reduce((sum, row) => sum + (row.payoutMeso ?? 0), 0)
}

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

export function toRecordedDrop(record: BossDropRecord): RecordedDrop {
  return {
    category: record.category,
    itemName: record.itemName,
    slot: record.slot ?? undefined,
    boxOrigin: record.boxOrigin ?? undefined,
    ringLevel: record.ringLevel ?? undefined,
    quantity: record.quantity,
    // ⚠️ 이쪽이 `lib/boss/boss-drops` 의 동명 함수보다 자주 지나간다 — **DB에서 읽을 때마다**다.
    // 빠뜨리면 저장은 됐는데 화면이 영영 "미입력"으로 보인다.
    priceState: record.priceState ?? undefined,
    priceMeso: record.priceMeso ?? undefined,
    priceShare: record.priceShare ?? undefined,
  }
}