/**
 * 드롭 표(`bossDrops` 칸)와 상자 표(`dropBoxes` 칸) 조회. 게임 수치는 여기서 읽기만 하고 추정하지 않는다.
 *
 * 응답은 난이도 줄 id · 분류 · 아이템 줄 id 가 한 줄인 납작한 표다. 여기서 보스 key 마다 난이도 정규 차례의 보상 묶음으로
 * 묶고 아이템을 key 로 바꿔 지금 코드가 읽던 모양을 만든다. 함수가 받는 `boss` 는 보스 key 이고 난이도는 난이도 key 다.
 */
import {
  DROP_CATEGORIES,
  SELECTABLE_DROP_CATEGORIES,
  type DropCandidate,
  type DropCategory,
  type FixedDropGroup,
  type RecordedDrop,
} from '../../types/drops'
import type { BossDifficultyRewardRow, BossDropsTable, DropBoxContentRow, DropBoxRow, DropBoxesTable } from '../../types/game-data'
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
import { deriveAll, gameTable, type GameTable } from '../game-data/table'
import { findItemById, itemsTable, originalItemOf } from '../item-catalog'
import { type EffectivePeriod, isEffectiveAnytimeIn, isEffectiveIn, periodOf } from './boss-profit-period'
import { bossDifficultyOfId } from './bosses'
import { bossCatalogTable } from './catalog'

function toReward(row: Row): BossDifficultyRewardRow | null {
  if (!isNonEmptyString(row.bossDifficultyId) || !isOneOf(row.category, DROP_CATEGORIES)) return null
  if (!isNonEmptyString(row.itemId)) return null
  const quantity = optional(row.quantity, isPositiveInteger)
  const validFrom = optional(row.validFrom, isPeriodText)
  const validUntil = optional(row.validUntil, isPeriodText)
  if (quantity === false || validFrom === false || validUntil === false) return null
  return compact({
    bossDifficultyId: row.bossDifficultyId,
    category: row.category,
    itemId: row.itemId,
    quantity,
    validFrom,
    validUntil,
  })
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. */
export function parseBossDrops(value: unknown): BossDropsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const bossDifficultyRewards = rowsOf(value.bossDifficultyRewards, toReward)
  if (bossDifficultyRewards === null) return null
  return { updatedAt, bossDifficultyRewards }
}

function toBox(row: Row): DropBoxRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.itemId)) return null
  const ringLevelMin = optional(row.ringLevelMin, isPositiveInteger)
  const ringLevelMax = optional(row.ringLevelMax, isPositiveInteger)
  if (ringLevelMin === false || ringLevelMax === false) return null
  if ((ringLevelMin === undefined) !== (ringLevelMax === undefined)) return null
  if (ringLevelMin !== undefined && ringLevelMax !== undefined && ringLevelMin > ringLevelMax) return null
  return compact({ id: row.id, itemId: row.itemId, ringLevelMin, ringLevelMax })
}

function toContent(row: Row): DropBoxContentRow | null {
  if (!isNonEmptyString(row.boxId) || !isNonEmptyString(row.itemId)) return null
  return { boxId: row.boxId, itemId: row.itemId }
}

/**
 * 계약을 지킨 값만 통과시킨다. 반지 상자는 레벨 범위 둘을 다 들고 장신구 상자는 둘 다 없다.
 *
 * 상자마다 개봉 후보가 하나 이상이어야 하고, 후보는 이 칸의 상자를 가리켜야 한다. 후보가 없는 상자를 열면 고를 것이 없다.
 */
export function parseDropBoxes(value: unknown): DropBoxesTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const dropBoxes = rowsOf(value.dropBoxes, toBox)
  const dropBoxContents = rowsOf(value.dropBoxContents, toContent)
  if (dropBoxes === null || dropBoxContents === null) return null
  if (!uniqueBy(dropBoxes, (box) => box.id) || !uniqueBy(dropBoxes, (box) => box.itemId)) return null
  const ids = new Set(dropBoxes.map((box) => box.id))
  if (dropBoxContents.some((content) => !ids.has(content.boxId))) return null
  const filled = new Set(dropBoxContents.map((content) => content.boxId))
  if (dropBoxes.some((box) => !filled.has(box.id))) return null
  return { updatedAt, dropBoxes, dropBoxContents }
}

export const bossDropsTable = gameTable('bossDrops', { updatedAt: null, bossDifficultyRewards: [] }, parseBossDrops)
export const dropBoxesTable = gameTable('dropBoxes', { updatedAt: null, dropBoxes: [], dropBoxContents: [] }, parseDropBoxes)

// BOSS_DIFFICULTIES 정규 순서 인덱스(미상 난이도는 뒤로).
function difficultyOrder(difficulty: string): number {
  const index = (BOSS_DIFFICULTIES as readonly string[]).indexOf(difficulty)
  return index === -1 ? BOSS_DIFFICULTIES.length : index
}

/** 보상 한 줄을 아이템 key 로 바꾼 모양. */
interface RewardItem {
  item: string
  quantity?: number
  period: EffectivePeriod
}

/** 보스 한 난이도의 보상 묶음. 분류마다 줄이 표의 차례다. */
interface RewardEntry {
  difficulty: BossDifficulty
  rewards: Partial<Record<DropCategory, RewardItem[]>>
}

/**
 * 보스 key 마다 난이도 정규 차례의 보상 묶음. 줄 표를 지금 코드가 읽는 모양으로 묶는다.
 *
 * 모르는 난이도 줄 · 아이템 줄을 가리키는 보상은 뺀다. 칸마다 따로 받아 잠깐 어긋날 수 있고, 어긋난 줄은 보일 이름이 없다.
 */
const rewardsByBoss = deriveAll([bossDropsTable, bossCatalogTable, itemsTable] as GameTable<unknown>[], () => {
  const byBoss = new Map<string, Map<BossDifficulty, RewardEntry>>()
  for (const row of bossDropsTable.get().bossDifficultyRewards) {
    const owner = bossDifficultyOfId(row.bossDifficultyId)
    const item = findItemById(row.itemId)
    if (owner === null || item === null) continue
    let entries = byBoss.get(owner.bossKey)
    if (entries === undefined) {
      entries = new Map()
      byBoss.set(owner.bossKey, entries)
    }
    let entry = entries.get(owner.difficulty)
    if (entry === undefined) {
      entry = { difficulty: owner.difficulty, rewards: {} }
      entries.set(owner.difficulty, entry)
    }
    ;(entry.rewards[row.category] ??= []).push(compact({ item: item.key, quantity: row.quantity, period: periodOf(row) }))
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
function effectiveNow(item: RewardItem, periodKey: string, now: Date | null): boolean {
  return now === null ? isEffectiveAnytimeIn(item.period, periodKey) : isEffectiveIn(item.period, periodKey, now)
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
      .filter((item) => isEffectiveIn(item.period, periodKey, now))
      .map((item) => compact({ key: item.item, name: dropItemNameOf(item.item, item.item), quantity: item.quantity }))
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
const obtainableTileKeysCache = deriveAll([bossDropsTable, bossCatalogTable, itemsTable] as GameTable<unknown>[], () => new Map<string, Set<string>>())

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

  // 저장 계층은 수익 건 안의 차례만 보장하므로 난이도가 섞이면 순서가 미정이다. 정규 난이도
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

// 명명 반지 기준(baseline) = 백옥 상자 반지 집합. 데이터에서 동적 산출(하드코딩·추정 없음).
const BASELINE_RING_BOX_KEY = 'white_boss_ring_box'

// 연마석은 반지가 아니라 등급(레벨) 개념이 없다.
const WHETSTONE_KEYS: ReadonlySet<string> = new Set(['life_whetstone', 'faith_whetstone'])

/** 상자 하나를 아이템 key 로 바꾼 모양. 후보는 원래 아이템의 key 다. 기록은 원래 아이템의 key 를 적어서다. */
interface BoxEntry {
  item: string
  levelMin?: number
  levelMax?: number
  /** 개봉 후보의 아이템 key. 차례가 화면 차례다. */
  contents: string[]
}

const boxIndex = deriveAll([dropBoxesTable, itemsTable] as GameTable<unknown>[], () => {
  const table = dropBoxesTable.get()
  const keyOf = (itemId: string): string | null => {
    const item = findItemById(itemId)
    return item === null ? null : originalItemOf(item).key
  }
  const byItem = new Map<string, BoxEntry>()
  for (const box of table.dropBoxes) {
    const item = findItemById(box.itemId)?.key
    if (item === undefined) continue
    const contents = table.dropBoxContents
      .filter((content) => content.boxId === box.id)
      .flatMap((content) => keyOf(content.itemId) ?? [])
    byItem.set(item, compact({ item, levelMin: box.ringLevelMin, levelMax: box.ringLevelMax, contents }))
  }
  return { byItem, baselineRingKeys: new Set(byItem.get(BASELINE_RING_BOX_KEY)?.contents ?? []) }
})

/** 반지 상자인가. 레벨 범위를 든 상자다. 장신구 상자는 레벨이 없다. */
function isRingBox(box: BoxEntry): box is BoxEntry & { levelMin: number; levelMax: number } {
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

/**
 * 반지 상자의 등급 후보와 반지 후보. 백옥 상자에 든 반지와 연마석(레벨 없음)이고, 그 밖의 반지는 고를 수 없다. 서버 아이템 표에
 * 그 반지들을 묶을 줄이 없어서다. 차례는 반지 다음 연마석이다. 반지 상자가 아니면 `null`.
 */
export function getRingBoxContents(boxKey: string): RingBoxContents | null {
  const box = boxIndex().byItem.get(boxKey)
  if (box === undefined || !isRingBox(box)) return null

  const named: RingOption[] = []
  const whetstones: RingOption[] = []

  for (const item of box.contents) {
    if (WHETSTONE_KEYS.has(item)) {
      whetstones.push(optionOf(item, false))
    } else if (boxIndex().baselineRingKeys.has(item)) {
      named.push(optionOf(item, true))
    }
  }

  const rings: RingOption[] = [...named, ...whetstones]

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
