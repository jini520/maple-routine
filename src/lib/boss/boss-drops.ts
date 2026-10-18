/**
 * 드롭 표(`bossDrops` 칸)와 상자 표(`dropBoxes` 칸) 조회. 게임 수치는 여기서 읽기만 하고 추정하지 않는다.
 *
 * 응답은 보스 · 난이도 · 갈래 · 아이템이 한 줄인 납작한 표다. 여기서 보스마다 난이도 정규 차례의 보상 묶음으로
 * 묶어 지금 코드가 읽던 모양을 만든다. 함수가 받는 `boss` 는 보스 key 이고 난이도는 난이도 key 다.
 */
import bundledBossDrops from '../../data/boss-drops.json'
import bundledDropBoxes from '../../data/drop-boxes.json'
import {
  DROP_CATEGORIES,
  SELECTABLE_DROP_CATEGORIES,
  type DropCandidate,
  type DropCategory,
  type FixedDropGroup,
  type RecordedDrop,
} from '../../types/drops'
import type { BossDropRow, BossDropsTable, DropBoxRow, DropBoxesTable } from '../../types/game-data'
import { BOSS_DIFFICULTIES, type BossDifficulty } from '../../types/scheduler'
import { dropItemNameOf } from '../drop/drop-items'
import {
  compact,
  isNonEmptyString,
  isOneOf,
  isPeriodText,
  isPositiveInteger,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { bundledTable, derive } from '../game-data/table'
import { isEffectiveAnytimeIn, isEffectiveIn } from './boss-profit-period'

function toReward(row: Row): BossDropRow | null {
  if (!isNonEmptyString(row.boss) || !isOneOf(row.difficulty, BOSS_DIFFICULTIES)) return null
  if (!isOneOf(row.category, DROP_CATEGORIES) || !isNonEmptyString(row.item)) return null
  const amount = optional(row.amount, isNonEmptyString)
  const from = optional(row.from, isPeriodText)
  const until = optional(row.until, isPeriodText)
  if (amount === false || from === false || until === false) return null
  return compact({
    boss: row.boss,
    difficulty: row.difficulty,
    category: row.category,
    item: row.item,
    amount,
    from,
    until,
  })
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. */
export function parseBossDrops(value: unknown): BossDropsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const rewards = rowsOf(value.rewards, toReward)
  if (rewards === null) return null
  return { updatedAt, rewards }
}

function toBox(row: Row): DropBoxRow | null {
  if (!isNonEmptyString(row.item)) return null
  const levelMin = optional(row.levelMin, isPositiveInteger)
  const levelMax = optional(row.levelMax, isPositiveInteger)
  if (levelMin === false || levelMax === false || (levelMin === undefined) !== (levelMax === undefined)) return null
  if (levelMin !== undefined && levelMax !== undefined && levelMin > levelMax) return null
  if (!Array.isArray(row.contents) || row.contents.length === 0 || !row.contents.every(isNonEmptyString)) return null
  return compact({ item: row.item, levelMin, levelMax, contents: [...row.contents] })
}

/** 계약을 지킨 값만 통과시킨다. 반지 상자는 레벨 범위 둘을 다 들고 장신구 상자는 둘 다 없다. */
export function parseDropBoxes(value: unknown): DropBoxesTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const boxes = rowsOf(value.boxes, toBox)
  if (boxes === null || !uniqueBy(boxes, (box) => box.item)) return null
  return { updatedAt, boxes }
}

export const bossDropsTable = bundledTable('bossDrops', bundledBossDrops, parseBossDrops)
export const dropBoxesTable = bundledTable('dropBoxes', bundledDropBoxes, parseDropBoxes)

// BOSS_DIFFICULTIES 정규 순서 인덱스(미상 난이도는 뒤로).
function difficultyOrder(difficulty: string): number {
  const index = (BOSS_DIFFICULTIES as readonly string[]).indexOf(difficulty)
  return index === -1 ? BOSS_DIFFICULTIES.length : index
}

/** 보스 한 난이도의 보상 묶음. 갈래마다 줄이 표의 차례다. */
interface RewardEntry {
  difficulty: BossDifficulty
  rewards: Partial<Record<DropCategory, BossDropRow[]>>
}

/** 보스마다 난이도 정규 차례의 보상 묶음. 줄 표를 지금 코드가 읽는 모양으로 묶는다. */
const rewardsByBoss = derive(bossDropsTable, (table) => {
  const byBoss = new Map<string, Map<BossDifficulty, RewardEntry>>()
  for (const row of table.rewards) {
    let entries = byBoss.get(row.boss)
    if (entries === undefined) {
      entries = new Map()
      byBoss.set(row.boss, entries)
    }
    let entry = entries.get(row.difficulty)
    if (entry === undefined) {
      entry = { difficulty: row.difficulty, rewards: {} }
      entries.set(row.difficulty, entry)
    }
    ;(entry.rewards[row.category] ??= []).push(row)
  }
  const result = new Map<string, RewardEntry[]>()
  for (const [boss, entries] of byBoss) {
    result.set(
      boss,
      [...entries.values()].sort((a, b) => difficultyOrder(a.difficulty) - difficultyOrder(b.difficulty)),
    )
  }
  return result
})

// 보스의 전 난이도 묶음을 난이도 정규 순서로 반환한다.
function entriesForBoss(bossKey: string): readonly RewardEntry[] {
  return rewardsByBoss().get(bossKey) ?? []
}

/** 그 줄이 이 기간에 든가. `now` 가 있으면 시계로 가르고, `null` 이면 기간 전체를 본다. */
function effectiveNow(item: BossDropRow, periodKey: string, now: Date | null): boolean {
  return now === null ? isEffectiveAnytimeIn(item, periodKey) : isEffectiveIn(item, periodKey, now)
}

// 보스의 선택 가능한 드롭 후보(장비·소비)를 난이도 무관하게 통합해 반환한다.
// 같은 아이템은 아이템 key 로 dedupe하고, 등장하는 난이도를 difficulties에 정규 순서로 담는다.
// 고정 드롭은 값이 난이도마다 달라 여기서 제외하고 getBossFixedDrops로 별도 표시한다.
// 그 기간에 나오는 줄만 든다. `now` 를 주면 시계로 가르고(표시), `null` 이면 그 기간 어느 때라도
// 나왔으면 든다(기록 정리). 갈라 두는 것은 09-17 09시에 적은 교환권을 10시에 지우지 않기 위해서다.
export function getBossDropCandidates(boss: string, periodKey: string, now: Date | null): DropCandidate[] {
  const byKey = new Map<string, DropCandidate>()
  const order: string[] = []

  for (const entry of entriesForBoss(boss)) {
    for (const category of SELECTABLE_DROP_CATEGORIES) {
      for (const item of entry.rewards[category] ?? []) {
        if (!effectiveNow(item, periodKey, now)) continue
        const key = `${category}|${item.item}`
        const existing = byKey.get(key)
        if (existing === undefined) {
          byKey.set(key, {
            key: item.item,
            name: dropItemNameOf(item.item, item.item),
            category,
            difficulties: [entry.difficulty],
          })
          order.push(key)
        } else if (!existing.difficulties.includes(entry.difficulty)) {
          existing.difficulties.push(entry.difficulty)
        }
      }
    }
  }
  return order.map((key) => byKey.get(key) as DropCandidate)
}

// 보스의 고정 드롭을 난이도별 그룹(정규 순서)으로 반환한다. 읽기 전용 표시용. 그 기간의 수량이다.
export function getBossFixedDrops(boss: string, periodKey: string, now: Date): FixedDropGroup[] {
  const groups: FixedDropGroup[] = []
  for (const entry of entriesForBoss(boss)) {
    const items = (entry.rewards.fixed ?? [])
      .filter((item) => isEffectiveIn(item, periodKey, now))
      .map((item) => compact({ key: item.item, name: dropItemNameOf(item.item, item.item), amount: item.amount }))
    if (items.length > 0) {
      groups.push({ difficulty: entry.difficulty, items })
    }
  }
  return groups
}

// 이 보스의 드롭 테이블에 표시 가능한 드롭(고정·장비·소비)이 있는 난이도를 정규 순서로 반환한다.
// 드롭 시트의 난이도 토글 후보 목록에 쓴다. 데이터 없는 난이도는 제외한다(추정 금지).
export function getBossDifficulties(boss: string): BossDifficulty[] {
  const present = new Set<BossDifficulty>()
  for (const entry of entriesForBoss(boss)) {
    const hasDisplayable = DROP_CATEGORIES.some((category) => (entry.rewards[category]?.length ?? 0) > 0)
    if (hasDisplayable) present.add(entry.difficulty)
  }
  return BOSS_DIFFICULTIES.filter((difficulty) => present.has(difficulty))
}

// 이 보스의 특정 난이도·기간에서 획득 가능한 '선택 타일' 아이템 key 집합(장비·소비, 상자 포함). 상자
// 결과는 상자 key(=타일 key) 기준. 시트 난이도 변경 재조정·처치 난이도 확정 정리에 공통으로 쓴다.
export function getObtainableTileKeys(boss: string, difficulty: BossDifficulty, periodKey: string): Set<string> {
  return new Set(
    getBossDropCandidates(boss, periodKey, null)
      .filter((candidate) => candidate.difficulties.includes(difficulty))
      .map((candidate) => candidate.key),
  )
}

// 드롭 히스토리는 이 판정을 기록 한 건마다 한다. getObtainableTileKeys는 매
// 호출마다 그 보스의 전 난이도 후보를 다시 순회하므로 난이도별 결과를 캐시한다. 표가 덮이면 캐시도 새것이다.
const obtainableTileKeysCache = derive(bossDropsTable, () => new Map<string, Set<string>>())

function obtainableTileKeys(boss: string, difficulty: BossDifficulty, periodKey: string): Set<string> {
  const cache = obtainableTileKeysCache()
  const key = `${boss}|${difficulty}|${periodKey}`
  let cached = cache.get(key)
  if (cached === undefined) {
    cached = getObtainableTileKeys(boss, difficulty, periodKey)
    cache.set(key, cached)
  }
  return cached
}

type TileFields = Pick<RecordedDrop, 'itemKey' | 'itemName' | 'boxOriginKey' | 'boxOrigin'>

/**
 * 드롭 하나가 서는 **타일 key**. 상자 결과는 상자 key, 그 밖은 아이템 key 다. 이관이 이름을 못 찾은 옛
 * 기록은 `null` 이다.
 *
 * 한 기록(카드)은 같은 타일을 하나만 든다(`BossDropSheet` 의 `toggleNormal` · `applyBoxResult`). 그래서
 * 같은 상자면 나온 반지가 달라도 같은 드롭이다.
 */
export function dropTileKey(drop: TileFields): string | null {
  return drop.boxOrigin !== undefined ? (drop.boxOriginKey ?? null) : drop.itemKey
}

/**
 * 같은 타일인지 가르는 값. 타일 key 이고, key 가 없는 옛 기록은 적어 둔 타일 이름으로 가른다.
 *
 * 둘이 섞여도 겹치지 않게 앞에 표지를 붙인다. key 와 이름이 같은 글자일 수 없지만 가정을 두지 않는다.
 */
export function dropTileIdentity(drop: TileFields): string {
  const key = dropTileKey(drop)
  return key !== null ? `key:${key}` : `name:${drop.boxOrigin ?? drop.itemName}`
}

// 이 드롭이 그 난이도(처치 난이도)와 그 기간에서 획득 가능한지. 상자 결과는 상자 key 기준. 레거시
// 고정(fixed) 기록은 선택 대상이 아니므로 항상 true 다. 기간을 보는 것은 패치로 빠진 아이템의
// 패치 전 기록을 거짓 기록으로 판정하지 않기 위해서다.
//
// 타일 key 가 없는 옛 기록(이관이 이름을 못 찾았다)은 판정하지 않고 true 다. 못 찾은 것이 못 먹은 것은
// 아니라서 지우지 않는다(사용자 결정 2026-09-15).
export function isObtainableDrop(
  boss: string,
  difficulty: BossDifficulty,
  periodKey: string,
  drop: RecordedDrop,
): boolean {
  if (drop.category === 'fixed') return true
  const tileKey = dropTileKey(drop)
  return tileKey === null || obtainableTileKeys(boss, difficulty, periodKey).has(tileKey)
}

// 기록 드롭에서 이 난이도(처치 난이도)와 그 기간에서 획득 불가한 선택 드롭을 제거한다.
export function pruneUnobtainableDrops(
  boss: string,
  difficulty: BossDifficulty,
  periodKey: string,
  drops: RecordedDrop[],
): RecordedDrop[] {
  return drops.filter((drop) => isObtainableDrop(boss, difficulty, periodKey, drop))
}

/**
 * SQLite `boss_drop_records` 한 행에서 이 계산에 필요한 부분만 추린 모양. 저장 계층 타입을 쓰지
 * 않는 이유는 `lib/` 가 `storage/` 를 의존하지 않기 위함이다.
 */
export interface StoredDropRecord extends RecordedDrop {
  difficulty: string
  dropIndex: number
}

export interface DropMigrationPlan {
  /** 확정 난이도 키에 새로 기록할 드롭 목록. 기존분 뒤에 기존분에 없는 타일의 이관분을 이어 붙인 것 */
  drops: RecordedDrop[]
  /** 비워야 하는 옛 난이도 키들 */
  staleDifficulties: string[]
}

function toRecordedDrop(record: StoredDropRecord): RecordedDrop {
  return {
    category: record.category,
    itemKey: record.itemKey,
    itemName: record.itemName,
    boxOriginKey: record.boxOriginKey,
    boxOrigin: record.boxOrigin,
    ringLevel: record.ringLevel,
    dropRecordId: record.dropRecordId,
    quantity: record.quantity,
    // ⚠️ 가격 셋을 여기 빠뜨리면 **난이도가 확정되는 순간** 그 주 가격이 전부 날아간다.
    // 타입 에러가 나지 않으므로(전부 optional) 이걸 막는 것은 테스트뿐이다.
    priceState: record.priceState,
    priceMeso: record.priceMeso,
    priceSplitMode: record.priceSplitMode,
    pricePartySize: record.pricePartySize,
    priceShare: record.priceShare,
    priceMyShare: record.priceMyShare,
    saleFeePercent: record.saleFeePercent,
    splitFeePercent: record.splitFeePercent,
    saleFeeAuto: record.saleFeeAuto,
    splitFeeAuto: record.splitFeeAuto,
  }
}

function compareStoredDrops(a: StoredDropRecord, b: StoredDropRecord): number {
  const byDifficulty = difficultyOrder(a.difficulty) - difficultyOrder(b.difficulty)
  return byDifficulty !== 0 ? byDifficulty : a.dropIndex - b.dropIndex
}

/**
 * 처치 난이도가 확정됐을 때 옛 난이도 키에 남은 드롭을 확정 난이도로 옮기는 계획.
 *
 * 왜 필요한가: 드롭은 `(ocid, boss, difficulty, period_key)` 로 저장된다. 익스트림으로 등록해두고
 * 드롭까지 기록한 뒤 백필이 실제 처치를 **하드**로 확정하면, 그 드롭은 아무 행도 읽지 않는 키에
 * 남아 영구 고아가 된다(화면·배지·환산 가치에서 사라지고 DB에만 쌓인다).
 *
 * - `records` 는 **같은 `(ocid, boss, period_key)`** 의 전 난이도 드롭이어야 한다(호출 측이 걸러 넘긴다).
 *   `periodKey` 는 그 기간이다. 그 기간에 나오는 아이템만 되살린다.
 * - 확정 난이도에서 획득 불가한 항목은 **되살리지 않는다**. 근거는 사용자 판단이다: 그 난이도에서
 *   나올 수 없는 아이템은 거짓 기록이고, 표시하는 것보다 삭제가 안전하다. 잘못된 환산 가치가
 *   계산에 섞이는 것이 기록 한 줄을 잃는 것보다 나쁘다.
 * - 확정 난이도에 **이미 드롭이 있으면 그 뒤에 이어 붙인다**. 단 **같은 타일(`dropTileIdentity`)은 두 번
 *   안 넣는다.** 한 카드는 같은 타일을 하나만 들어 두 번째 줄은 먹은 것이 아니고 금액만 두 번 센다.
 *   이미 있는 쪽이 남고, 옮겨 오는 것끼리 겹치면 정규 난이도 순서로 앞선 것이 남는다.
 * - 옛 키가 없으면 `null`(할 일 없음)이라 매번 호출해도 안전하다(멱등).
 */
export function planConfirmedDifficultyDropMigration(
  boss: string,
  confirmedDifficulty: BossDifficulty,
  periodKey: string,
  records: StoredDropRecord[],
): DropMigrationPlan | null {
  const stale = records.filter((record) => record.difficulty !== confirmedDifficulty)
  if (stale.length === 0) {
    return null
  }

  const existing = records
    .filter((record) => record.difficulty === confirmedDifficulty)
    .sort(compareStoredDrops)
    .map(toRecordedDrop)
  const seenTiles = new Set(existing.map(dropTileIdentity))

  // SQLite는 `ORDER BY drop_index` 만 보장하므로 난이도가 섞이면 순서가 미정이다. 정규 난이도
  // 순서로 정렬해 이관 결과가 실행마다 같게 한다. 겹치는 타일에서 어느 쪽이 남는지도 이 순서가 정한다.
  const migrated = pruneUnobtainableDrops(
    boss,
    confirmedDifficulty,
    periodKey,
    [...stale].sort(compareStoredDrops).map(toRecordedDrop),
  ).filter((drop) => {
    const tile = dropTileIdentity(drop)
    if (seenTiles.has(tile)) return false
    seenTiles.add(tile)
    return true
  })

  return {
    drops: [...existing, ...migrated],
    staleDifficulties: [...new Set(stale.map((record) => record.difficulty))].sort(
      (a, b) => difficultyOrder(a) - difficultyOrder(b),
    ),
  }
}

// '기타': 백옥 반지 상자 목록 밖의 저가치 반지들을 한 칸으로 묶는 UI 전용 항목. 그림은 마스터 표가 든다.
export const OTHER_RING_KEY = 'other_ring'

// 명명 반지 기준(baseline) = 백옥 상자 반지 집합. 데이터에서 동적 산출(하드코딩·추정 없음).
const BASELINE_RING_BOX_KEY = 'white_boss_ring_box'

// 연마석은 반지가 아니라 등급(레벨) 개념이 없다.
const WHETSTONE_KEYS: ReadonlySet<string> = new Set(['life_whetstone', 'faith_whetstone'])

const boxIndex = derive(dropBoxesTable, (table) => ({
  byItem: new Map(table.boxes.map((box) => [box.item, box])),
  baselineRingKeys: new Set(table.boxes.find((box) => box.item === BASELINE_RING_BOX_KEY)?.contents ?? []),
}))

/** 반지 상자인가. 레벨 범위를 든 상자다. 장신구 상자는 레벨이 없다. */
function isRingBox(box: DropBoxRow): box is DropBoxRow & { levelMin: number; levelMax: number } {
  return box.levelMin !== undefined && box.levelMax !== undefined
}

// 개봉 결과를 직접 선택해야 하는 랜덤 상자인지(반지 상자 또는 칠흑 장신구 상자). 아이템 key 로 묻는다.
export function isBoxItem(key: string | null): boolean {
  return key !== null && boxIndex().byItem.has(key)
}

export interface RingOption {
  key: string
  name: string
  hasLevel: boolean
}

export interface RingBoxContents {
  levels: number[]
  rings: RingOption[]
}

function optionOf(key: string, hasLevel: boolean): RingOption {
  return { key, name: dropItemNameOf(key, key), hasLevel }
}

// 반지 상자의 등급 후보와 반지 후보. 백옥 목록을 기준으로 명명 반지만 개별 노출하고, 그 밖 반지는
// 단일 '기타'로 묶는다. 연마석은 별도(레벨 없음). 정렬: 명명 → 연마석 → 기타. 아니면 null.
export function getRingBoxContents(boxKey: string): RingBoxContents | null {
  const box = boxIndex().byItem.get(boxKey)
  if (box === undefined || !isRingBox(box)) return null

  const named: RingOption[] = []
  const whetstones: RingOption[] = []
  let hasOther = false

  for (const item of box.contents) {
    if (WHETSTONE_KEYS.has(item)) {
      whetstones.push(optionOf(item, false))
    } else if (boxIndex().baselineRingKeys.has(item)) {
      named.push(optionOf(item, true))
    } else {
      hasOther = true
    }
  }

  const rings: RingOption[] = [...named, ...whetstones]
  if (hasOther) {
    rings.push(optionOf(OTHER_RING_KEY, true))
  }

  const levels: number[] = []
  for (let level = box.levelMin; level <= box.levelMax; level += 1) levels.push(level)
  return { levels, rings }
}

// 칠흑 장신구 상자의 후보 장신구 목록(등급 없음). 장신구 상자가 아니면 null.
export function getAccessoryBoxContents(boxKey: string): { key: string; name: string }[] | null {
  const box = boxIndex().byItem.get(boxKey)
  if (box === undefined || isRingBox(box)) return null

  return box.contents.map((key) => ({ key, name: dropItemNameOf(key, key) }))
}
