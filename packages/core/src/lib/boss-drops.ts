import accessoryBoxesData from '@core/data/accessory-boxes.json'
import bossRingBoxesData from '@core/data/boss-ring-boxes.json'
import itemDropTableData from '@core/data/item-drop-table.json'
import {
  SELECTABLE_DROP_CATEGORIES,
  type DropCandidate,
  type DropCategory,
  type FixedDropGroup,
  type RecordedDrop,
} from '@core/types/drops'
import { BOSS_DIFFICULTIES, type BossDifficulty } from '@core/types/scheduler'

// item-drop-table.json / boss-ring-boxes.json / accessory-boxes.json 조회 헬퍼(ADR-038). 게임
// 수치 데이터는 여기서 읽기만 하고 추정하지 않는다([[ADR-006]]).

interface RawRewardItem {
  name: string
  amount?: string
  slot?: string
  set?: string
  note?: string
}
interface RawRewardEntry {
  boss: string
  difficulty: string
  rewards: Partial<Record<DropCategory, RawRewardItem[]>>
}

const rewardEntries = itemDropTableData.rewards as RawRewardEntry[]

function nfc(value: string): string {
  return value.normalize('NFC')
}

// BOSS_DIFFICULTIES 정규 순서 인덱스(미상 난이도는 뒤로).
function difficultyOrder(difficulty: string): number {
  const index = (BOSS_DIFFICULTIES as readonly string[]).indexOf(difficulty)
  return index === -1 ? BOSS_DIFFICULTIES.length : index
}

// 보스의 전 난이도 엔트리를 난이도 정규 순서로 반환한다.
function entriesForBoss(boss: string): RawRewardEntry[] {
  return rewardEntries
    .filter((entry) => nfc(entry.boss) === nfc(boss))
    .slice()
    .sort((a, b) => difficultyOrder(a.difficulty) - difficultyOrder(b.difficulty))
}

// 보스의 선택 가능한 드롭 후보(장비·소비)를 난이도 무관하게 통합해 반환한다(ADR-040 결정 1).
// 같은 아이템은 name+slot으로 dedupe하고, 등장하는 난이도를 difficulties에 정규 순서로 담는다.
// 고정 드롭은 값이 난이도마다 달라 여기서 제외하고 getBossFixedDrops로 별도 표시한다.
export function getBossDropCandidates(boss: string): DropCandidate[] {
  const byKey = new Map<string, DropCandidate>()
  const order: string[] = []

  for (const entry of entriesForBoss(boss)) {
    const difficulty = entry.difficulty as BossDifficulty
    for (const category of SELECTABLE_DROP_CATEGORIES) {
      for (const item of entry.rewards[category] ?? []) {
        const key = `${category}|${nfc(item.name)}|${nfc(item.slot ?? '')}`
        const existing = byKey.get(key)
        if (existing === undefined) {
          byKey.set(key, {
            name: item.name,
            category,
            slot: item.slot,
            set: item.set,
            note: item.note,
            difficulties: [difficulty],
          })
          order.push(key)
        } else if (!existing.difficulties.includes(difficulty)) {
          existing.difficulties.push(difficulty)
        }
      }
    }
  }
  return order.map((key) => byKey.get(key) as DropCandidate)
}

// 보스의 고정 드롭을 난이도별 그룹(정규 순서)으로 반환한다(ADR-040 결정 3). 읽기 전용 표시용.
export function getBossFixedDrops(boss: string): FixedDropGroup[] {
  const groups: FixedDropGroup[] = []
  for (const entry of entriesForBoss(boss)) {
    const items = (entry.rewards.fixed ?? []).map((item) => ({
      name: item.name,
      amount: item.amount,
      slot: item.slot,
    }))
    if (items.length > 0) {
      groups.push({ difficulty: entry.difficulty as BossDifficulty, items })
    }
  }
  return groups
}

// 이 보스의 드롭 테이블에 표시 가능한 드롭(고정·장비·소비)이 있는 난이도를 정규 순서로 반환한다.
// 드롭 시트의 난이도 토글 후보 목록에 쓴다 — 데이터 없는 난이도는 제외한다(추정 금지, [[ADR-006]]).
export function getBossDifficulties(boss: string): BossDifficulty[] {
  const present = new Set<BossDifficulty>()
  for (const entry of entriesForBoss(boss)) {
    const hasDisplayable =
      (entry.rewards.fixed?.length ?? 0) > 0 ||
      (entry.rewards.equipment?.length ?? 0) > 0 ||
      (entry.rewards.consumable?.length ?? 0) > 0
    if (hasDisplayable) present.add(entry.difficulty as BossDifficulty)
  }
  return BOSS_DIFFICULTIES.filter((difficulty) => present.has(difficulty))
}

// 이 보스의 특정 난이도에서 획득 가능한 '선택 타일' 이름 집합(장비·소비, 상자 포함). 상자 결과는
// 상자명(=타일명=boxOrigin) 기준. 시트 난이도 변경 재조정·처치 난이도 확정 정리에 공통으로 쓴다.
export function getObtainableTileNames(boss: string, difficulty: BossDifficulty): Set<string> {
  return new Set(
    getBossDropCandidates(boss)
      .filter((candidate) => candidate.difficulties.includes(difficulty))
      .map((candidate) => candidate.name),
  )
}

// 드롭 히스토리는 이 판정을 기록 한 건마다 한다([[ADR-071]] 결정 6). getObtainableTileNames는 매
// 호출마다 그 보스의 전 난이도 후보를 다시 순회하므로 난이도별 결과를 캐시한다 — 입력이 정적
// JSON뿐이라 결과가 바뀔 일이 없다.
const obtainableTileNamesCache = new Map<string, Set<string>>()

function obtainableTileNames(boss: string, difficulty: BossDifficulty): Set<string> {
  const key = `${boss}|${difficulty}`
  let cached = obtainableTileNamesCache.get(key)
  if (cached === undefined) {
    cached = getObtainableTileNames(boss, difficulty)
    obtainableTileNamesCache.set(key, cached)
  }
  return cached
}

// 이 드롭이 그 난이도(처치 난이도)에서 획득 가능한지. 상자 결과는 상자명 기준. 레거시 고정(fixed)
// 기록은 선택 대상이 아니므로 항상 true 다([[ADR-040]] 결정 3).
export function isObtainableDrop(
  boss: string,
  difficulty: BossDifficulty,
  drop: RecordedDrop,
): boolean {
  return drop.category === 'fixed' || obtainableTileNames(boss, difficulty).has(drop.boxOrigin ?? drop.itemName)
}

// 기록 드롭에서 이 난이도(처치 난이도)에서 획득 불가한 선택 드롭을 제거한다.
export function pruneUnobtainableDrops(
  boss: string,
  difficulty: BossDifficulty,
  drops: RecordedDrop[],
): RecordedDrop[] {
  return drops.filter((drop) => isObtainableDrop(boss, difficulty, drop))
}

/**
 * SQLite `boss_drop_records` 한 행에서 이 계산에 필요한 부분만 추린 모양. 저장 계층 타입을 쓰지
 * 않는 이유는 `lib/` 가 `storage/` 를 의존하지 않기 위함이다([[ADR-003]]).
 */
export interface StoredDropRecord extends RecordedDrop {
  difficulty: string
  dropIndex: number
}

export interface DropMigrationPlan {
  /** 확정 난이도 키에 새로 기록할 드롭 목록 — 기존분 뒤에 이관분을 이어 붙인 것 */
  drops: RecordedDrop[]
  /** 비워야 하는 옛 난이도 키들 */
  staleDifficulties: string[]
}

function toRecordedDrop(record: StoredDropRecord): RecordedDrop {
  return {
    category: record.category,
    itemName: record.itemName,
    slot: record.slot,
    boxOrigin: record.boxOrigin,
    ringLevel: record.ringLevel,
    quantity: record.quantity,
    // ⚠️ 가격 셋을 여기 빠뜨리면 **난이도가 확정되는 순간** 그 주 가격이 전부 날아간다 —
    // 타입 에러가 나지 않으므로(전부 optional) 테스트가 유일한 방어선이다([[ADR-124]] 결정 4).
    priceState: record.priceState,
    priceMeso: record.priceMeso,
    priceShare: record.priceShare,
  }
}

function compareStoredDrops(a: StoredDropRecord, b: StoredDropRecord): number {
  const byDifficulty = difficultyOrder(a.difficulty) - difficultyOrder(b.difficulty)
  return byDifficulty !== 0 ? byDifficulty : a.dropIndex - b.dropIndex
}

/**
 * 처치 난이도가 확정됐을 때, 옛 난이도 키에 남은 드롭을 확정 난이도로 어떻게 옮길지 계산한다
 * ([[ADR-069]] 결정 4).
 *
 * 왜 필요한가: 드롭은 `(ocid, boss, difficulty, period_key)` 로 저장된다. 익스트림으로 등록해두고
 * 드롭까지 기록한 뒤 백필이 실제 처치를 **하드**로 확정하면, 그 드롭은 아무 행도 읽지 않는 키에
 * 남아 영구 고아가 된다(화면·배지·환산 가치에서 사라지고 DB에만 쌓인다).
 *
 * - `records` 는 **같은 `(ocid, boss, period_key)`** 의 전 난이도 드롭이어야 한다(호출 측이 걸러 넘긴다).
 * - 확정 난이도에서 획득 불가한 항목은 **되살리지 않는다** — 근거는 사용자 판단이다: 그 난이도에서
 *   나올 수 없는 아이템은 거짓 기록이고, 표시하는 것보다 삭제가 안전하다. 잘못된 환산 가치가
 *   계산에 섞이는 것이 기록 한 줄을 잃는 것보다 나쁘다.
 * - 확정 난이도에 **이미 드롭이 있으면 그 뒤에 이어 붙인다**. 같은 아이템이 두 번 들어갈 수 있지만
 *   실제로 두 개를 먹은 경우와 구분할 수 없어 임의로 합치지 않는다 — 고아를 남기지 않는 유일한 선택.
 * - 옛 키가 없으면 `null`(할 일 없음)이라 매번 호출해도 안전하다(멱등).
 */
export function planConfirmedDifficultyDropMigration(
  boss: string,
  confirmedDifficulty: BossDifficulty,
  records: StoredDropRecord[],
): DropMigrationPlan | null {
  const stale = records.filter((record) => record.difficulty !== confirmedDifficulty)
  if (stale.length === 0) {
    return null
  }

  // SQLite는 `ORDER BY drop_index` 만 보장하므로 난이도가 섞이면 순서가 미정이다 — 정규 난이도
  // 순서로 정렬해 이관 결과가 실행마다 같게 한다.
  const migrated = pruneUnobtainableDrops(
    boss,
    confirmedDifficulty,
    [...stale].sort(compareStoredDrops).map(toRecordedDrop),
  )
  const existing = records
    .filter((record) => record.difficulty === confirmedDifficulty)
    .sort(compareStoredDrops)
    .map(toRecordedDrop)

  return {
    drops: [...existing, ...migrated],
    staleDifficulties: [...new Set(stale.map((record) => record.difficulty))].sort(
      (a, b) => difficultyOrder(a) - difficultyOrder(b),
    ),
  }
}

interface RawRingBox {
  name: string
  levelProbabilities: { level: number }[]
  itemProbabilities: { name: string; iconFile: string | null }[]
}
const ringBoxes = bossRingBoxesData.boxes as RawRingBox[]

interface RawAccessoryBox {
  name: string
  itemProbabilities: { name: string }[]
}
const accessoryBoxes = accessoryBoxesData.boxes as RawAccessoryBox[]

const ringBoxNames = new Set(ringBoxes.map((box) => nfc(box.name)))
const accessoryBoxNames = new Set(accessoryBoxes.map((box) => nfc(box.name)))

// 개봉 결과를 직접 선택해야 하는 랜덤 상자인지(반지 상자 또는 칠흑 장신구 상자).
export function isBoxItem(name: string): boolean {
  const key = nfc(name)
  return ringBoxNames.has(key) || accessoryBoxNames.has(key)
}

export interface RingOption {
  name: string
  iconFile: string | null
  hasLevel: boolean
}

export interface RingBoxContents {
  levels: number[]
  rings: RingOption[]
}

// '기타'(ADR-041): 백옥 반지 상자 목록 밖의 저가치 반지들을 한 칸으로 묶는 UI 전용 항목.
const OTHER_RING_NAME = '기타'
const OTHER_RING_ICON = 'Limit_Ring.webp' // 리밋 링 아이콘 재사용

// 명명 반지 기준(baseline) = 백옥 상자 반지 집합. 데이터에서 동적 산출(하드코딩·추정 없음, ADR-041/ADR-006).
const baselineRingNames = new Set(
  (
    ringBoxes.find((box) => nfc(box.name) === nfc('백옥의 보스 반지 상자'))?.itemProbabilities ?? []
  ).map((ring) => nfc(ring.name)),
)

// 연마석(생명의 연마석 등)은 반지가 아니라 등급(레벨) 개념이 없다.
function isWhetstone(name: string): boolean {
  return name.includes('연마석')
}

// 반지 상자의 등급 후보와 반지 후보. 백옥 목록을 기준으로 명명 반지만 개별 노출하고, 그 밖 반지는
// 단일 '기타'로 묶는다. 연마석은 별도(레벨 없음). 정렬: 명명 → 연마석 → 기타(ADR-041). 아니면 null.
export function getRingBoxContents(boxName: string): RingBoxContents | null {
  const box = ringBoxes.find((candidate) => nfc(candidate.name) === nfc(boxName))
  if (box === undefined) return null

  const named: RingOption[] = []
  const whetstones: RingOption[] = []
  let hasOther = false

  for (const entry of box.itemProbabilities) {
    if (isWhetstone(entry.name)) {
      whetstones.push({ name: entry.name, iconFile: entry.iconFile, hasLevel: false })
    } else if (baselineRingNames.has(nfc(entry.name))) {
      named.push({ name: entry.name, iconFile: entry.iconFile, hasLevel: true })
    } else {
      hasOther = true
    }
  }

  const rings: RingOption[] = [...named, ...whetstones]
  if (hasOther) {
    rings.push({ name: OTHER_RING_NAME, iconFile: OTHER_RING_ICON, hasLevel: true })
  }

  return {
    levels: box.levelProbabilities.map((entry) => entry.level),
    rings,
  }
}

// 칠흑 장신구 상자의 후보 장신구 목록(등급 없음). 장신구 상자가 아니면 null.
export function getAccessoryBoxContents(boxName: string): { name: string }[] | null {
  const box = accessoryBoxes.find((candidate) => nfc(candidate.name) === nfc(boxName))
  if (box === undefined) return null

  return box.itemProbabilities.map((entry) => ({ name: entry.name }))
}
