import weeklyBossesData from '../../data/weekly-bosses.json'
import { BOSS_DIFFICULTIES, type ManualTrackedItem } from '../../types/scheduler'
import type { BossContent, BossCycle, BossDifficulty } from '../../types'

export interface MatchedBoss {
  apiName: string
  difficulty: BossDifficulty
  cycle: BossCycle
  isRegistered: boolean
  isComplete: boolean
  ownComplete: boolean // 승격 없는 원본 완료 여부(ADR-032) — selectBossProfitBosses가 실제 처치 난이도를 판정할 때 사용
  matchedBossName: string | null
  portraitSlug: string | null
  isSeasonBoss: boolean
}

interface BossReferenceEntry {
  boss: string
  difficulties: string[]
  portraitSlug?: string
  apiAlias?: string
  status?: string
  note?: string
}

interface ReferenceEntryWithOrigin extends BossReferenceEntry {
  isSeasonBoss: boolean
  cycle: BossCycle
}

// eventWeekly(시즌 보스, 현재 메이린) 소속 여부를 isSeasonBoss로 태깅해둔다 — 주간 보스
// 12마리 제한/처치 카운트에서 시즌 보스를 제외하는 판정에 쓰인다([[ADR-007]], [[ADR-031]]).
// cycle은 세 섹션 중 어디서 왔는지다(시즌 보스도 주기는 weekly) — 수동 추적 배열이 주간·월간
// 보스를 kind: 'boss'로 함께 담아, 주간 한도를 셀 때 주기로 걸러야 하기 때문([[ADR-055]] 결정 3).
const REFERENCE_ENTRIES: ReferenceEntryWithOrigin[] = [
  ...(weeklyBossesData.weekly as BossReferenceEntry[]).map((entry) => ({
    ...entry,
    isSeasonBoss: false,
    cycle: 'weekly' as BossCycle,
  })),
  ...(weeklyBossesData.eventWeekly as BossReferenceEntry[]).map((entry) => ({
    ...entry,
    isSeasonBoss: true,
    cycle: 'weekly' as BossCycle,
  })),
  ...(weeklyBossesData.monthly as BossReferenceEntry[]).map((entry) => ({
    ...entry,
    isSeasonBoss: false,
    cycle: 'monthly' as BossCycle,
  })),
]

// 이름이 비슷하지만 단위가 다른 별개 한도라 나란히 둔다([[ADR-054]] 결정 2) — CLEAR_LIMIT은
// 캐릭터당 주간 보스 등록/처치 한도(12), CRYSTAL_SALE_LIMIT은 월드당 주간 결정석 판매 한도(90).
export const WEEKLY_BOSS_CLEAR_LIMIT: number = weeklyBossesData.weeklyBossSelectionLimit
export const WEEKLY_CRYSTAL_SALE_LIMIT: number = weeklyBossesData.weeklyCrystalSaleLimit

// weekly-bosses.json 정규 순서(REFERENCE_ENTRIES: weekly → eventWeekly → monthly)에서 보스
// 표시명 → 인덱스. 보스 수익 페이지의 캐릭터 내부 보스 순서([[ADR-036]])와 보스 관리 페이지의
// 수동 추적 목록 순서([[ADR-035]] 결정 20, mergeManualBossList)를 데이터 소스/DB 반복 순서에
// 의존하지 않고 이 정규 순서로 고정하기 위한 공용 정렬 키다. 중복 보스명이 있으면 첫 등장 인덱스를 유지한다.
const BOSS_REFERENCE_ORDER = new Map<string, number>()
REFERENCE_ENTRIES.forEach((entry, index) => {
  if (!BOSS_REFERENCE_ORDER.has(entry.boss)) {
    BOSS_REFERENCE_ORDER.set(entry.boss, index)
  }
})

// 보스 표시명(matchedBossName)의 정규 순서 인덱스. 참조 목록에 없는 보스(매칭 실패 원문명,
// [[ADR-008]])는 Number.MAX_SAFE_INTEGER를 반환해 맨 뒤로 보낸다 — 안정 정렬과 함께 쓰면
// 그들끼리는 입력 순서를 유지한다.
export function getBossReferenceOrder(bossName: string): number {
  return BOSS_REFERENCE_ORDER.get(bossName) ?? Number.MAX_SAFE_INTEGER
}

/** `compareBossOrder` 가 읽는 것 — 이름과 난이도뿐이다(행이든 카드든 타일이든 이 둘은 있다). */
export interface BossOrderKey {
  /** 보스 **표시명**(`matchedBossName ?? apiName`) — 참조표 조회가 그 이름으로 이뤄진다. */
  boss: string
  /** 없거나 참조표 밖 값이면 같은 보스 안에서 맨 앞이다(`indexOf` 가 -1). 보스 항목엔 늘 있다. */
  difficulty?: string
}

/**
 * **앱 전체의 보스 순서**([[ADR-186]]) — `weekly-bosses.json` 정규 순서 → 난이도 → 보스명.
 *
 * 키 셋은 [[ADR-036]] 결정 3 이 보스 수익에 정한 그것 **그대로**이고, 이 함수는 그것을 네 소비자가
 * 함께 쓸 수 있게 `REFERENCE_ENTRIES` 의 **소유자**에 둔 것뿐이다:
 *
 * - `lib/boss/manual-boss-merge`(수동 목록, [[ADR-035]] 결정 20)
 * - `features/boss-scheduler/displayed-bosses`(스케줄러 카드 · today 「남은 스케줄」 펼침)
 * - `features/boss-profit/rows`(`sortRowsByOcidOrder` 의 2차 키)
 * - `features/cashbook/records`(펼친 결정석 줄의 보스 타일)
 *
 * 정렬 코드가 네 벌이면 값을 바꿀 때 한 벌만 바뀐다 — [[ADR-036]] 결정 5 가 사설 사본을 흡수한
 * 것과 같은 이유이고, 자동 모드에 넷째 사본을 새로 쓰지 않으려고 이 함수가 생겼다.
 *
 * **완전 결정적이다.** 참조표에 없는 보스([[ADR-008]] 매칭 실패 원문명)는 맨 뒤로 가되 그들끼리도
 * 난이도·이름으로 갈린다 — 안정 정렬에 기대면 «입력 순서» 가 계약이 되는데, 그 입력이 `ORDER BY`
 * 없는 조회나 Map 삽입 순서라는 것이 [[ADR-036]] 이 고친 버그였다.
 */
export function compareBossOrder(a: BossOrderKey, b: BossOrderKey): number {
  const referenceDiff = getBossReferenceOrder(a.boss) - getBossReferenceOrder(b.boss)
  if (referenceDiff !== 0) return referenceDiff

  const difficultyDiff =
    BOSS_DIFFICULTIES.indexOf(a.difficulty as BossDifficulty) -
    BOSS_DIFFICULTIES.indexOf(b.difficulty as BossDifficulty)
  if (difficultyDiff !== 0) return difficultyDiff

  return a.boss < b.boss ? -1 : a.boss > b.boss ? 1 : 0
}

// 시즌 보스(eventWeekly) 표시명 집합. 화면에서 행 단위로 반복 조회하므로 매 호출마다
// REFERENCE_ENTRIES를 훑지 않도록 BOSS_REFERENCE_ORDER와 같이 모듈 로드 시 한 번만 만든다.
const SEASON_BOSS_NAMES = new Set<string>(
  REFERENCE_ENTRIES.filter((entry) => entry.isSeasonBoss).map((entry) => entry.boss),
)

// 보스 표시명으로 시즌 보스 여부를 조회한다([[ADR-054]] 결정 3) — 주간 처치 수·결정석 판매 수
// 집계에서 시즌 보스를 제외하는 판정용. 입력은 BossProfitRow.boss이고 그 값은 matchedBossName
// (REFERENCE_ENTRIES의 boss 표기 그대로) 아니면 매칭에 실패한 API 원문명이라, getBossReferenceOrder와
// 마찬가지로 정확 일치로 충분하다 — 후자는 애초에 참조표에 없으므로 시즌 보스가 아니다.
export function isSeasonBossName(bossName: string): boolean {
  return SEASON_BOSS_NAMES.has(bossName)
}

// 보스 표시명 → 주기. eventWeekly(시즌 보스)도 주간이다 — 주간/월간 탭 구분용이고, 시즌 보스
// 제외 여부는 isSeasonBossName이 따로 판정한다([[ADR-055]] 결정 3).
const BOSS_CYCLE_BY_NAME = new Map<string, BossCycle>()
for (const entry of REFERENCE_ENTRIES) {
  if (!BOSS_CYCLE_BY_NAME.has(entry.boss)) {
    BOSS_CYCLE_BY_NAME.set(entry.boss, entry.cycle)
  }
}

// 참조표에 없는 보스명(매칭 실패 원문명)은 주기를 알 수 없으므로 null이다.
export function getBossCycleByName(bossName: string): BossCycle | null {
  return BOSS_CYCLE_BY_NAME.get(bossName) ?? null
}

// 보스 표시명 → 지원 난이도. 파티 인원 모달의 난이도 세그먼트가 쓴다([[ADR-121]]) — 보스 관리
// 페이지가 `weekly-bosses.json` 의 `difficulties` 를 그대로 쓰는 것과 같은 소스다.
const BOSS_DIFFICULTIES_BY_NAME = new Map<string, BossDifficulty[]>()
for (const entry of REFERENCE_ENTRIES) {
  if (!BOSS_DIFFICULTIES_BY_NAME.has(entry.boss)) {
    BOSS_DIFFICULTIES_BY_NAME.set(entry.boss, entry.difficulties as BossDifficulty[])
  }
}

/**
 * 보스 표시명의 지원 난이도. 참조표에 없는 보스(매칭 실패 원문명, [[ADR-008]])는 후보를 알 수
 * 없으므로 **지금 난이도 하나만** 돌려주도록 호출부가 폴백을 준다 — 빈 배열을 그리면 세그먼트가
 * 사라져 무엇을 편집 중인지도 안 보인다.
 */
export function getSupportedDifficulties(bossName: string): BossDifficulty[] {
  return BOSS_DIFFICULTIES_BY_NAME.get(bossName) ?? []
}

// ADR-055 결정 3: 수동 추적 항목 중 "주간 12개 한도에 잡히는" 보스 수. 관리 화면의 주간 섹션은
// weekly와 eventWeekly를 합쳐 출처 구분을 잃고, 저장 배열은 월간 보스까지 kind: 'boss'로
// 함께 담으므로, 주기와 시즌 여부를 참조표에서 되찾아야 한다. 제외 규칙은
// countClearedWeeklyBosses([[ADR-031]] 결정 1)와 같아야 한다 — 어긋나면 선택은 12/12인데
// 처치 카운트는 11/12로 표시되는 모순이 생긴다.
export function countManualWeeklyBosses(items: ManualTrackedItem[]): number {
  return items.filter(
    (item) =>
      item.kind === 'boss' &&
      getBossCycleByName(item.contentName) === 'weekly' &&
      !isSeasonBossName(item.contentName),
  ).length
}

function stripSpaces(value: string): string {
  return value.replace(/\s+/g, '')
}

// 공백 유무 방향이 보스마다 달라(API 쪽에 더 있을 때도, 데이터 쪽에 더 있을 때도 있음, ADR-007)
// 양쪽 다 공백을 제거한 뒤 비교한다. apiAlias는 공백 제거로도 못 잡는 예외(예: "시즌 보스 메이린")를 위한 명시 매핑이다.
function findReferenceEntry(apiName: string): ReferenceEntryWithOrigin | undefined {
  const normalizedApiName = stripSpaces(apiName)
  return REFERENCE_ENTRIES.find((entry) => {
    const candidates = [entry.boss, entry.apiAlias].filter((value): value is string => value !== undefined)
    return candidates.some((candidate) => stripSpaces(candidate) === normalizedApiName)
  })
}

export function matchBossContent(content: BossContent): MatchedBoss {
  const entry = findReferenceEntry(content.name)

  return {
    apiName: content.name,
    difficulty: content.difficulty,
    cycle: content.cycle,
    isRegistered: content.isRegistered,
    isComplete: content.isComplete,
    ownComplete: content.ownComplete,
    matchedBossName: entry?.boss ?? null,
    portraitSlug: entry?.portraitSlug ?? null,
    isSeasonBoss: entry?.isSeasonBoss ?? false,
  }
}

function groupByApiName(bosses: MatchedBoss[]): Map<string, MatchedBoss[]> {
  const groups = new Map<string, MatchedBoss[]>()
  for (const boss of bosses) {
    const group = groups.get(boss.apiName) ?? []
    group.push(boss)
    groups.set(boss.apiName, group)
  }
  return groups
}

// 등록 여부와 무관하게 시즌 보스를 제외한 주간 보스 중 완료된(content_name 기준) 보스 수를
// 센다([[ADR-031]] 결정 1) — 등록 없이 잡은 보스도 포함하되, 같은 보스를 여러 난이도로
// 동시에 완료해도 1로만 센다.
export function countClearedWeeklyBosses(bosses: MatchedBoss[]): number {
  const weeklyBosses = bosses.filter((boss) => boss.cycle === 'weekly' && !boss.isSeasonBoss)
  let count = 0
  for (const group of groupByApiName(weeklyBosses).values()) {
    if (group.some((boss) => boss.isComplete)) {
      count += 1
    }
  }
  return count
}

/**
 * **이번 주 주간 보스 한도(12)를 채웠는가** ([[ADR-187]] 결정 1).
 *
 * 세는 규칙을 새로 쓰지 않고 `countClearedWeeklyBosses`([[ADR-031]] 결정 1)를 그대로 쓴다 —
 * 시즌 보스 제외·월간 제외·같은 보스의 여러 난이도는 1, 세 규칙이 여기서도 그대로여야
 * «선택은 12/12 인데 처치는 11/12» 같은 모순이 안 생긴다([[ADR-055]] 결정 3 이 이미 겪은 것).
 *
 * 판정이 여기 있는 이유는 `WEEKLY_BOSS_CLEAR_LIMIT` 과 세는 함수를 **이 파일이 소유**하기
 * 때문이다 — 소비자(스케줄러 카드 · today 「남은 스케줄」 · 보스 수익)가 각자 `>= 12` 를 쓰면
 * 같은 규칙이 세 벌이 되고, 그때부터 화면마다 다른 말을 한다([[ADR-186]] 결정 2 와 같은 태도).
 *
 * **넥슨의 `weekly_boss_clear_count` 는 안 쓴다** — 그 필드는 타입에만 있고 제품 코드는 처음부터
 * 앱이 센 값을 쓴다. 대가는 «동기화가 낡으면 판정도 낡는다» 이고, 다음 동기화가 스스로 고친다.
 */
export function isWeeklyClearLimitReached(bosses: MatchedBoss[]): boolean {
  return countClearedWeeklyBosses(bosses) >= WEEKLY_BOSS_CLEAR_LIMIT
}

// 보스 카드 목록에 표시할 항목을 content_name 그룹별로 고른다([[ADR-031]] 결정 5) — 등록된
// 난이도가 있으면 그것만 보여주고(중복 카드 방지), 없으면 완료된 난이도를 대신 보여준다.
export function selectDisplayBosses(bosses: MatchedBoss[]): MatchedBoss[] {
  const result: MatchedBoss[] = []
  for (const group of groupByApiName(bosses).values()) {
    const registered = group.filter((boss) => boss.isRegistered)
    if (registered.length > 0) {
      result.push(...registered)
      continue
    }
    result.push(...group.filter((boss) => boss.isComplete))
  }
  return result
}

// 보스 수익 계산기 전용 선택 로직(ADR-032). selectDisplayBosses(카드 표시용, 등록 여부 우선)와
// 달리 "실제로 처치했는가"(ownComplete, 승격 없는 원본 완료 여부)를 우선한다 — 등록한 난이도와
// 실제로 처치한 난이도가 다를 수 있어([[ADR-031]]), 수익 계산은 반드시 진짜 처치한 난이도의
// 가격을 써야 한다. 같은 content_name·같은 cycle(weekly/monthly) 안에서는 게임 룰상 한
// 캐릭터가 여러 난이도를 동시에 완료할 수 없으므로(사용자 확인, 2026-07-22) ownComplete: true인
// 항목은 그룹당 최대 1개다 — 그 이상이면(예: 서로 다른 cycle 그룹이 우연히 같은 content_name을
// 쓰는 경우) 전부 실제 완료이므로 데이터를 숨기지 않고 그대로 보여준다.
export function selectBossProfitBosses(bosses: MatchedBoss[]): MatchedBoss[] {
  const result: MatchedBoss[] = []
  for (const group of groupByApiName(bosses).values()) {
    const actuallyComplete = group.filter((boss) => boss.ownComplete)
    if (actuallyComplete.length > 0) {
      result.push(...actuallyComplete)
      continue
    }
    const registered = group.find((boss) => boss.isRegistered)
    if (registered !== undefined) {
      result.push(registered) // 미완료 placeholder — 등록 난이도로 표시(ADR-032)
    }
  }
  return result
}
