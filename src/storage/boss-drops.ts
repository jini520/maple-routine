import { getBossDropCandidates } from '../lib/boss/boss-drops'
import { bossDifficultyOfId, bossNameOf } from '../lib/boss/bosses'
import { dropItemIdOf, dropItemPartsOf, planClearedDrops } from '../lib/boss/drop-item-ids'
import { dropItemNameOf } from '../lib/drop/drop-items'
import { dropPayoutMeso, type DropPriceFields } from '../lib/drop/drop-price'
import { findWorld, findWorldById, worldNameOf } from '../lib/world/worlds'
import {
  SPLIT_COLUMN_NAMES,
  bossDifficultyIdFor,
  deleteEntryIfEmpty,
  ensureEntryId,
  entryKeyOf,
  numberOrNull,
  periodCodeFor,
  periodCodesOf,
  type BossPeriodKey,
} from './boss-periods'
import { notifyAfterBatch } from './record-revision-batch'
import { withServerSyncPaused } from './server-sync-queue'
import type { SqliteDbConnection } from './ports'
import { getBossProfitDb } from './sqlite/db'
import { NEW_UUID_SQL } from './sqlite/uuid'
import { inTransaction } from './sqlite/transaction'
import type { DropCategory, RecordedDrop } from '../types/drops'

// 한 보스/기간의 드롭 집합은 시트에서 통째로 편집되므로 replace-all(DELETE→INSERT)이
// 수정에 가장 단순하다. 드롭은 그 수익 건(`boss_profit_entries`)을 가리킨다.
//
// **금액을 함께 저장한다**. 기록 한 건에 붙는 실판매가다. 시세표가 아니라 스냅샷이라 재평가 대상이 아니고,
// 같은 행에 두므로 난이도 확정 이관·prune 삭제가 가격까지 함께 옮기고 지운다.
export interface BossDropRecord {
  /** 이 기록을 다시 가리키는 값. 저장 계층이 붙이고 그룹을 다시 저장해도 유지된다. */
  dropRecordId: string
  ocid: string
  /** 보스 key. 기본키에 든다. */
  bossKey: string
  /** 보스 이름. 저장하지 않고 읽을 때 key 로 찾는다. */
  boss: string
  /** 난이도 key. */
  difficulty: string
  periodKey: string
  /** 그 수익 건 안의 차례. 드롭 표의 차례로 늘어놓은 자리이고 저장하지 않는다. */
  dropIndex: number
  /** 저장된 아이템 줄 id. 반지는 레벨 줄, 상자에서 나온 연마석은 상자용 줄 */
  itemId: string
  category: DropCategory
  /** 아이템 key. 저장된 기록은 늘 있다. */
  itemKey: string | null
  /** 아이템 이름. 저장하지 않고 읽을 때 key 로 찾는다. 표에 없는 key 면 key 다. */
  itemName: string
  /** 상자 결과면 상자의 아이템 key. */
  boxOriginKey: string | null
  /** 상자 이름. `boxOriginKey` 로 찾는다. */
  boxOrigin: string | null
  ringLevel: number | null
  /** 늘 1 이다. 저장하지 않는다. */
  quantity: number
  /** 마지막으로 저장한 시각. */
  recordedAt: string // ISO 8601
  /** 판매가를 적은 시각. 같은 값을 다시 저장하면 그대로다. 판매가가 없으면 `null` */
  pricedAt: string | null
  /** 기록 시점의 월드 이름. 수익 건의 `world_id` 로 찾는다. 모르면 `null`. */
  world: string | null
  /** 수익 건의 월드 key. */
  worldKey: string | null
  /** 저장된 `price_status` 를 화면의 말로. `'entered'`(entered) · `'excluded'`(skipped) · `null`(pending). */
  priceState: 'entered' | 'excluded' | null
  /** 입력한 판매가. 값을 매긴 드롭만 있고 1 이상이다. */
  priceMeso: number | null
  /** 어떻게 나눴나. **아래 두 칸의 뜻을 이 칸이 정한다.** 가격을 적지 않은 드롭은 없다. */
  priceSplitMode: 'even' | 'ratio' | null
  /** `even` 의 분배 인원. **비율은 이 칸을 안 본다.** */
  pricePartySize: number | null
  /** `ratio` 의 비율 합. 저장된 값을 읽으면 100000 이다. **기본은 이 칸을 안 본다.** */
  priceShare: number | null
  /** `ratio` 의 내 비율(% 의 1000 배). 균등은 비어 있다. 지난 금액은 저장된 받는 메소가 지킨다. */
  priceMyShare: number | null
  /** 판매 수수료(%). `null` 은 없음 */
  saleFeePercent: number | null
  /** 분배 수수료(%). `null` 은 없음 */
  splitFeePercent: number | null
  /** 판매 수수료가 등급을 따라가나 */
  saleFeeAuto: boolean
  /** 분배 수수료가 등급을 따라가나 */
  splitFeeAuto: boolean
  /** 저장된 받는 메소. 가격을 적은 드롭만 있다. 가격 · 분배 · 수수료를 고칠 때만 다시 센다 */
  saleReceivedMeso?: number | null
}

/** 드롭 상태. 서버 `boss_drops` 의 `price_status` 와 같은 값이다. */
type DropPriceStatus = 'pending' | 'entered' | 'skipped'

/**
 * 기록할 월드. 수익 건에 한 번 적는다. 그 기간의 처치와 드롭이 같은 월드다.
 *
 * 이미 적힌 월드는 덮지 않는다. 기록 시점의 스냅샷이라 가격만 고치는 저장이 그것을 지우면 안 된다.
 */
export interface DropWorld {
  name: string | null
  key: string | null
}

/** 월드를 모를 때. 지우기만 하는 호출도 이것을 쓴다(쓸 행이 없다). */
export const NO_WORLD: DropWorld = { name: null, key: null }

const INSERT_SQL = `
  INSERT INTO boss_drops
    (id, profit_entry_id, item_id, category, price_status, sale_price_meso, sale_received_meso, priced_at,
     sale_fee_percent, sale_fee_follows_mvp_grade, ${SPLIT_COLUMN_NAMES.join(', ')}, created_at, updated_at)
  VALUES (COALESCE(?, ${NEW_UUID_SQL}), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

/** 드롭을 읽는 SELECT. 별칭은 `d`(드롭) · `e`(수익 건)다. */
const DROP_SELECT = `
  SELECT d.*, e.ocid, e.boss_difficulty_id, e.period_code, e.world_id
    FROM boss_drops d
    JOIN boss_profit_entries e ON e.id = d.profit_entry_id`

/** 이전 값을 이어 받을 때 읽는 칸. 받는 메소는 가격 · 분배 · 수수료가 그대로면 이어 받는다. */
interface PreviousDrop {
  id: string
  priceStatus: string
  priceMeso: number | null
  pricedAt: string | null
  createdAt: string
  receivedMeso: number | null
  /** 받는 메소를 정하는 칸들을 이은 글자. 같으면 다시 세지 않는다. */
  pricing: string
}

/** 받는 메소를 정하는 칸들. 가격 · 판매 수수료 · 분배 다섯이다. */
const PRICING_COLUMNS = ['sale_price_meso', 'sale_fee_percent', ...SPLIT_COLUMN_NAMES.slice(0, 4)] as const

function previousOf(row: Record<string, unknown>): PreviousDrop {
  return {
    id: row.id as string,
    priceStatus: row.price_status as string,
    priceMeso: numberOrNull(row.sale_price_meso),
    pricedAt: (row.priced_at as string | null | undefined) ?? null,
    createdAt: row.created_at as string,
    receivedMeso: numberOrNull(row.sale_received_meso),
    pricing: JSON.stringify(PRICING_COLUMNS.map((column) => row[column] ?? null)),
  }
}

// 한 보스/기간의 드롭 집합을 통째로 교체한다(기존 삭제 후 0..n으로 재삽입). 빈 배열이면 삭제만.
/**
 * 드롭 기록이 바뀔 때마다 오르는 수. **이 테이블을 캐시하는 쪽이 **내 스냅샷이 낡았나** 를
 * 물을 수 있게** 하는 값이다.
 *
 * ## 왜 저장 계층에 있나
 *
 * 이 테이블을 읽는 캐시가 **셋**이다. 보스 수익 기간 쿼리(`period-query`, `dropsByRowKey`) · `drop-price-store` ·
 * 드롭 히스토리 쿼리(`drop-history-query`, 전 기간 집계). 쓰는 쪽이 읽는 쪽을 직접 불러 맞추는 방식은 **쓰는 쪽이
 * 읽는 쪽을 전부 알아야** 해서, 캐시가 하나 늘 때마다 모든 호출부를 다시 훑어야 한다. 실제로
 * 전 기간 집계가 그렇게 빠진 적이 있다. 지금은 이 판을 쿼리 무효화(`features/query/invalidation.ts`)가 구독한다.
 *
 * 이 수는 그 방향을 뒤집는다. **쓰기 경로가 이 함수 하나뿐**이므로(세 호출부가 전부 여기로 온다. 기간째 옮기는 월드 리프
 * 옮기기만 `bumpBossDropRecordsRevision` 으로 판을 올린다)
 * 여기서 한 번 올리면 캐시가 몇 개든 물어볼 수 있는 상태가 되고, 새 캐시가 생겨도 쓰는 쪽은
 * 손댈 것이 없다.
 *
 * **영속화하지 않는다.** 프로세스와 함께 사라지는 것이 맞다. 앱을 다시 켜면 어느 캐시든 비어 있다.
 */
let recordsRevision = 0
const revisionListeners = new Set<() => void>()

export function getBossDropRecordsRevision(): number {
  return recordsRevision
}

/**
 * 판이 오를 때 부를 함수를 건다. 풀 함수를 돌려준다.
 *
 * 판을 묻는 쪽은 다시 읽을 때를 스스로 알지만, 쓰기마다 곧바로 다시 읽어야 하는 쪽은 알림이 없으면
 * 쓰기를 모른다.
 */
export function subscribeBossDropRecordsRevision(listener: () => void): () => void {
  revisionListeners.add(listener)
  return () => {
    revisionListeners.delete(listener)
  }
}

function notifyRevisionListeners(): void {
  for (const listener of revisionListeners) listener()
}

function bumpRecordsRevision(): void {
  recordsRevision += 1
  notifyAfterBatch(notifyRevisionListeners)
}

/** 드롭 행을 안 거치고 드롭의 캐릭터가 바뀔 때 판을 올리는 함수. 월드 리프 옮기기가 기간째 새 캐릭터로 옮길 때 쓴다. */
export function bumpBossDropRecordsRevision(): void {
  bumpRecordsRevision()
}

/** 테스트 전용. 모듈 수준 상태라 테스트끼리 오염된다. 프로덕션에서 부르지 말 것. */
export function resetBossDropRecordsRevisionForTests(): void {
  recordsRevision = 0
}

/**
 * 드롭의 분배 칸 다섯. 가격을 적은 드롭만 갖는다. 비율의 내 몫은 `내 비율 ÷ 비율 합` 을 % 의 1000 배로 반올림하고 빈 칸은 1
 * 로 본다. 균등은 내 몫을 비운다. 지난 금액은 저장된 받는 메소가 지킨다.
 */
function dropSplitValues(drop: RecordedDrop): (string | number | null)[] {
  const mode = drop.priceSplitMode ?? 'even'
  const partySize = drop.pricePartySize ?? drop.priceShare ?? 1
  const share = mode === 'ratio'
    ? Math.min(100_000, Math.max(0, Math.round(((drop.priceMyShare ?? 1) * 100_000) / Math.max(1, drop.priceShare ?? 1))))
    : null
  return [mode, partySize, share, drop.splitFeePercent ?? null, drop.splitFeeAuto === true ? 1 : 0]
}

/** 0메소는 매긴 것이 아니다. 저장하면 앱은 매긴 것, 서버는 미입력으로 봐서 상태가 갈렸다. */
function statusOf(drop: RecordedDrop): DropPriceStatus {
  if (drop.priceState === 'entered' && (drop.priceMeso ?? 0) > 0) return 'entered'
  if (drop.priceState === 'excluded') return 'skipped'
  return 'pending'
}

/** 드롭의 아이템 줄 id. 게임 데이터에 없는 아이템은 적을 수 없어 던진다. */
function itemIdFor(drop: Pick<RecordedDrop, 'itemKey' | 'ringLevel' | 'boxOriginKey'>): string {
  const id = dropItemIdOf({ itemKey: drop.itemKey, ringLevel: drop.ringLevel ?? null, boxOriginKey: drop.boxOriginKey ?? null })
  if (id === null) throw new Error(`게임 데이터에 없는 드롭 아이템이다: ${drop.itemKey}`)
  return id
}

export async function replaceBossDropRecords(
  ocid: string,
  bossKey: string,
  difficulty: string,
  periodKey: string,
  drops: RecordedDrop[],
  recordedAt: string,
  world: DropWorld,
): Promise<string[]> {
  const db = await getBossProfitDb()
  const entryId = await ensureEntryId(db, { ocid, bossKey, difficulty, periodKey }, recordedAt)
  const worldId = findWorld(world.key)?.id
  if (worldId !== undefined) {
    await db.run('UPDATE boss_profit_entries SET world_id = ? WHERE id = ? AND world_id IS NULL', [worldId, entryId])
  }

  // **지우기 전에 식별자를 읽어 둔다.** 그룹을 통째로 바꾸는 저장이라, 안 읽으면 같은 아이템이
  // 매번 새 식별자를 받아 서버에 같은 기록이 계속 쌓인다. 한 수익 건에 같은 아이템 줄은 하나라 아이템 줄 id 가 신분이다.
  const { values: before } = await db.query('SELECT * FROM boss_drops WHERE profit_entry_id = ?', [entryId])
  const kept = new Map<string, PreviousDrop>()
  const byId = new Map<string, PreviousDrop>()
  for (const row of (before ?? []) as Record<string, unknown>[]) {
    const previous = previousOf(row)
    byId.set(previous.id, previous)
    kept.set(row.item_id as string, previous)
  }

  await db.run('DELETE FROM boss_drops WHERE profit_entry_id = ?', [entryId])

  // **다른 수익 건에 있던 식별자를 들고 온 드롭은 그 수익 건에서 옮겨 온다.** 난이도 확정 이관이 그렇다. 옛 줄을
  // 그대로 두면 같은 식별자를 넣는 순간 기본키가 부딪혀 저장이 실패하고, 뒤이어 옛 그룹을 비우는 쓰기가 드롭을
  // 지운다.
  const carriedIds = drops.map((drop) => drop.dropRecordId).filter((id): id is string => id !== null)
  if (carriedIds.length > 0) {
    const placeholders = carriedIds.map(() => '?').join(', ')
    const { values: elsewhere } = await db.query(`SELECT * FROM boss_drops WHERE id IN (${placeholders})`, carriedIds)
    const emptied = new Set<string>()
    for (const row of (elsewhere ?? []) as Record<string, unknown>[]) {
      byId.set(row.id as string, previousOf(row))
      emptied.add(row.profit_entry_id as string)
    }
    await db.run(`DELETE FROM boss_drops WHERE id IN (${placeholders})`, carriedIds)
    for (const otherEntryId of emptied) await deleteEntryIfEmpty(db, otherEntryId)
  }

  const ids: string[] = []
  for (const drop of drops) {
    // **드롭이 들고 온 식별자가 먼저다.** 난이도 확정 이관처럼 다른 그룹으로 옮기는 경로는 신분
    // 조회로 못 찾는다(그 그룹에 그 줄이 없다). 신분 조회는 식별자를 안 들고 온 경로의 안전망이다.
    const itemId = itemIdFor(drop)
    const inherited = kept.get(itemId)
    if (inherited !== undefined) kept.delete(itemId)
    const id = drop.dropRecordId ?? inherited?.id ?? null
    const previous = (id === null ? undefined : byId.get(id)) ?? inherited

    const status = statusOf(drop)
    const entered = status === 'entered'
    const split = entered ? dropSplitValues(drop) : [null, null, null, null, 0]
    const saleFee = entered ? (drop.saleFeePercent ?? null) : null
    // 가격을 매긴 시각은 서버 시세의 거래 시각이다. 같은 값을 다시 저장해도 움직이면 안 된다.
    const samePrice = previous?.priceStatus === 'entered' && previous.priceMeso === drop.priceMeso
    // 받는 메소는 가격 · 분배 · 수수료가 그대로면 이어 받는다. 다시 세면 셈법이 바뀐 지난 금액이 움직인다.
    const pricing = JSON.stringify([drop.priceMeso ?? null, saleFee, ...split.slice(0, 4)])
    const received = !entered
      ? null
      : samePrice && previous?.pricing === pricing && previous.receivedMeso !== null
        ? previous.receivedMeso
        : dropPayoutMeso({ ...drop, saleReceivedMeso: undefined })
    await db.run(INSERT_SQL, [
      id,
      entryId,
      itemId,
      drop.category,
      status,
      entered ? drop.priceMeso! : null,
      received,
      entered ? (samePrice ? previous!.pricedAt : recordedAt) : null,
      saleFee,
      entered && drop.saleFeeAuto === true ? 1 : 0,
      ...split,
      previous?.createdAt ?? recordedAt,
      recordedAt,
    ])
    const { values: inserted } = await db.query('SELECT id FROM boss_drops WHERE profit_entry_id = ? AND item_id = ?', [
      entryId,
      itemId,
    ])
    ids.push((inserted ?? [])[0]!.id as string)
  }
  if (drops.length === 0) await deleteEntryIfEmpty(db, entryId)

  // **삭제/삽입이 다 끝난 뒤**에 올린다. 중간에 던지면 테이블이 바뀌지 않은 채로 끝나므로
  // 그때 올리면 읽는 쪽이 헛되이 전 기간을 다시 읽는다.
  bumpRecordsRevision()

  // 드롭을 넘긴 차례 그대로의 식별자. 메모리의 드롭은 식별자가 없을 수 있고(시트에서 방금 적은 것), 그 값은 위 INSERT 에서
  // 처음 생긴다.
  return ids
}

const PRICE_STATE_OF_STATUS: Record<DropPriceStatus, BossDropRecord['priceState']> = {
  entered: 'entered',
  skipped: 'excluded',
  pending: null,
}

/** 줄을 드롭 기록으로. 차례는 `ordered` 가 매긴다. 게임 데이터에 없는 난이도 · 아이템 줄이면 `null` 이다. */
function rowToRecord(row: Record<string, unknown>): BossDropRecord | null {
  const key = entryKeyOf(row)
  const parts = key === null ? null : dropItemPartsOf(row.item_id as string, row.boss_difficulty_id as string, key.periodKey)
  if (key === null || parts === null) return null
  const worldKey = findWorldById(row.world_id as string | null)?.key ?? null
  const ratio = row.split_type === 'ratio'
  return {
    dropRecordId: row.id as string,
    ocid: row.ocid as string,
    bossKey: key.bossKey,
    boss: bossNameOf(key.bossKey, key.bossKey),
    difficulty: key.difficulty,
    periodKey: key.periodKey,
    dropIndex: 0,
    itemId: row.item_id as string,
    category: row.category as DropCategory,
    itemKey: parts.itemKey,
    itemName: dropItemNameOf(parts.itemKey, parts.itemKey),
    boxOriginKey: parts.boxOriginKey,
    boxOrigin: parts.boxOriginKey === null ? null : dropItemNameOf(parts.boxOriginKey, parts.boxOriginKey),
    ringLevel: parts.ringLevel,
    quantity: 1,
    recordedAt: row.updated_at as string,
    pricedAt: (row.priced_at as string | null | undefined) ?? null,
    world: worldKey === null ? null : worldNameOf(worldKey, worldKey),
    worldKey,
    priceState: PRICE_STATE_OF_STATUS[row.price_status as DropPriceStatus],
    priceMeso: numberOrNull(row.sale_price_meso),
    priceSplitMode: (row.split_type as 'even' | 'ratio' | null | undefined) ?? null,
    pricePartySize: numberOrNull(row.party_size),
    priceShare: ratio ? 100_000 : null,
    priceMyShare: ratio ? numberOrNull(row.split_share_millipercent) : null,
    saleFeePercent: numberOrNull(row.sale_fee_percent),
    splitFeePercent: numberOrNull(row.split_fee_percent),
    saleFeeAuto: Number(row.sale_fee_follows_mvp_grade) === 1,
    splitFeeAuto: Number(row.split_fee_follows_mvp_grade) === 1,
    saleReceivedMeso: numberOrNull(row.sale_received_meso),
  }
}

/**
 * 줄들을 기록으로 바꾸고 수익 건마다 드롭 표의 차례로 늘어놓은 뒤 차례 번호를 매긴다. 표에 없는 타일은 뒤로 간다.
 *
 * 수익 건 사이의 차례는 기간 값 내림차순 · 캐릭터 · 보스 · 난이도다. 시간축 정렬은 `lib/drop/drop-history` 가 다시 한다.
 */
function ordered(rows: readonly Record<string, unknown>[] | undefined): BossDropRecord[] {
  const records = (rows ?? []).flatMap((row) => {
    const record = rowToRecord(row)
    return record === null ? [] : [{ record, code: row.period_code as string }]
  })
  const orderCache = new Map<string, Map<string, number>>()
  const orderOf = (record: BossDropRecord): number => {
    const cacheKey = `${record.bossKey}|${record.periodKey}`
    let order = orderCache.get(cacheKey)
    if (order === undefined) {
      order = new Map(getBossDropCandidates(record.bossKey, record.periodKey, null).map((candidate, index) => [candidate.key, index]))
      orderCache.set(cacheKey, order)
    }
    return order.get(record.boxOriginKey ?? record.itemKey ?? '') ?? Number.MAX_SAFE_INTEGER
  }
  const groupKey = (entry: { record: BossDropRecord; code: string }): string =>
    [entry.code, entry.record.ocid, entry.record.bossKey, entry.record.difficulty].join('\u0000')
  records.sort((a, b) => {
    if (a.code !== b.code) return a.code < b.code ? 1 : -1
    const group = groupKey(a).localeCompare(groupKey(b))
    return group !== 0 ? group : orderOf(a.record) - orderOf(b.record)
  })
  const indexes = new Map<string, number>()
  return records.map((entry) => {
    const group = groupKey(entry)
    const index = indexes.get(group) ?? 0
    indexes.set(group, index + 1)
    return { ...entry.record, dropIndex: index }
  })
}

export async function getBossDropRecords(
  ocids: string[],
  periodKeys: string[],
): Promise<BossDropRecord[]> {
  const codes = periodCodesOf(periodKeys)
  if (ocids.length === 0 || codes.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const { values } = await db.query(
    `${DROP_SELECT} WHERE e.ocid IN (${ocids.map(() => '?').join(', ')}) AND e.period_code IN (${codes.map(() => '?').join(', ')})`,
    [...ocids, ...codes],
  )

  return ordered(values)
}

/** 판매 · 분배 수수료 중 하나라도 자동인 기록 전부. 등급 기록이 바뀌면 다시 셀 대상이다. */
export async function getAutoFeeDropRecords(): Promise<BossDropRecord[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `${DROP_SELECT} WHERE d.sale_fee_follows_mvp_grade = 1 OR d.split_fee_follows_mvp_grade = 1`,
  )
  return ordered(values)
}

export interface DropFeeUpdate {
  dropRecordId: string
  saleFeePercent: number | null
  splitFeePercent: number | null
}

/**
 * 가격을 적은 드롭들의 두 요율을 고쳐 쓰고 받는 메소를 새 요율로 다시 센다. 받는 메소는 저장된 값이라 요율과 함께 간다.
 *
 * @param follow 참이면 두 수수료를 등급을 따르는 것으로 바꾼다(일괄 적용)
 */
async function writeDropFees(updates: readonly DropFeeUpdate[], follow: boolean): Promise<void> {
  if (updates.length === 0) return
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    for (const update of updates) {
      const { values } = await db.query(`${DROP_SELECT} WHERE d.id = ? AND d.price_status = 'entered'`, [update.dropRecordId])
      const record = ordered(values)[0]
      if (record === undefined) continue
      const fields: DropPriceFields = {
        ...record,
        saleFeePercent: update.saleFeePercent,
        splitFeePercent: update.splitFeePercent,
        saleReceivedMeso: null,
      }
      await db.run(
        `UPDATE boss_drops SET sale_fee_percent = ?, split_fee_percent = ?, sale_received_meso = ?${
          follow ? ', sale_fee_follows_mvp_grade = 1, split_fee_follows_mvp_grade = 1' : ''
        } WHERE id = ?`,
        [update.saleFeePercent, update.splitFeePercent, dropPayoutMeso(fields), update.dropRecordId],
      )
    }
  })
  bumpRecordsRevision()
}

/** 드롭 기록들의 두 요율을 고쳐 쓴다. */
export async function updateDropFees(updates: readonly DropFeeUpdate[]): Promise<void> {
  await writeDropFees(updates, false)
}

/** 일괄 적용 대상. 가격을 입력했고 두 수수료가 다 빈 드롭이다. */
export async function getBulkFeeDropRecords(): Promise<BossDropRecord[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `${DROP_SELECT}
     WHERE d.price_status = 'entered' AND d.sale_fee_percent IS NULL AND d.split_fee_percent IS NULL`,
  )
  return ordered(values)
}

/** 일괄 적용. 두 요율을 적고 두 칸을 자동으로 바꾼다. */
export async function applyAutoDropFees(updates: readonly DropFeeUpdate[]): Promise<void> {
  await writeDropFees(updates, true)
}

/**
 * 기간을 걸지 않고 읽는 이 캐릭터들의 전 기간 드롭 기록. 드롭 히스토리가 히스토리 전용
 * 테이블 없이 이 테이블 하나만 보고 동작하는 근거다. `getBossDropRecords` 는 `periodKeys` 가
 * 필수라 지금 보고 있는 기간 밖을 조회할 수단이 없다.
 *
 * 수익 건 사이의 차례는 기간 값 내림차순이다. 주간과 월간 값은 첫 글자가 달라 내림차순이 시간순이 아니다. 시간축
 * 정렬은 `lib/drop/drop-history` 가 기간 시작 시점으로 환산해 다시 한다. 여기서는 같은 기간 안의 순서만 보장하면 되고 그
 * 순서를 안정 정렬이 보존한다.
 */
export async function getAllBossDropRecords(ocids: string[]): Promise<BossDropRecord[]> {
  if (ocids.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const { values } = await db.query(`${DROP_SELECT} WHERE e.ocid IN (${ocids.map(() => '?').join(', ')})`, [...ocids])

  return ordered(values)
}

/** 처치한 수익 건으로 모을 드롭의 범위. `group` 은 묶음의 모든 수익 건, `entry` 는 처치한 수익 건 안의 드롭만 */
export type ClearedDropScope = 'group' | 'entry'

interface EntryRow {
  id: string
  bossDifficultyId: string
  cleared: boolean
}

/**
 * 같은 캐릭터 · 보스 · 기간의 드롭을 처치한 수익 건으로 모으는 쓰기(`planClearedDrops`). 처치한 수익 건이 기기에 있으면 대기 표에
 * 넣지 않음(서버가 같은 규칙으로 모음). 처치한 수익 건이 없으면 정해진 난이도의 수익 건으로 모으고 대기 표로 올림. 비운 수익 건은
 * 대기 줄이 남았거나 대기 표로 올리는 쓰기에서 드롭을 옮겨 비운 것이면 지우지 않음
 *
 * @param key 정해진 처치 난이도. 그 난이도의 수익 건이 처치한 것이 아니면 묶음에서 처치한 수익 건으로 모음
 * @returns 바꾼 것이 있으면 참
 */
export async function settleClearedBossDrops(key: BossPeriodKey, scope: ClearedDropScope, at: string): Promise<boolean> {
  const db = await getBossProfitDb()
  const { values } = await db.query('SELECT id, boss_difficulty_id, clear_recorded_by FROM boss_profit_entries WHERE ocid = ? AND period_code = ?', [
    key.ocid,
    periodCodeFor(key.periodKey),
  ])
  const entries: EntryRow[] = (values ?? [])
    .filter((row) => bossDifficultyOfId(row.boss_difficulty_id as string)?.bossKey === key.bossKey)
    .map((row) => ({ id: row.id as string, bossDifficultyId: row.boss_difficulty_id as string, cleared: row.clear_recorded_by != null }))
  const ownDifficultyId = bossDifficultyIdFor(key.bossKey, key.difficulty)
  const own = entries.find((entry) => entry.bossDifficultyId === ownDifficultyId)
  const target = own?.cleared === true ? own : (entries.find((entry) => entry.cleared) ?? own)
  const write = (conn: SqliteDbConnection) => writeClearedDrops(conn, key, scope, entries, target, ownDifficultyId, at)
  const changed = target?.cleared === true ? await withServerSyncPaused(write) : await inTransaction(db, () => write(db))
  if (changed) bumpRecordsRevision()
  return changed
}

async function writeClearedDrops(
  db: SqliteDbConnection,
  key: BossPeriodKey,
  scope: ClearedDropScope,
  entries: readonly EntryRow[],
  target: EntryRow | undefined,
  ownDifficultyId: string,
  at: string,
): Promise<boolean> {
  const sources = scope === 'entry' ? (target === undefined ? [] : [target]) : entries
  if (sources.length === 0) return false
  const difficultyOf = new Map(sources.map((entry) => [entry.id, entry.bossDifficultyId]))
  const { values } = await db.query(
    `SELECT id, item_id, category, profit_entry_id FROM boss_drops WHERE profit_entry_id IN (${sources.map(() => '?').join(', ')})`,
    sources.map((entry) => entry.id),
  )
  const drops = (values ?? []).map((row) => ({
    id: row.id as string,
    itemId: row.item_id as string,
    category: row.category as DropCategory,
    entryId: row.profit_entry_id as string,
    bossDifficultyId: difficultyOf.get(row.profit_entry_id as string)!,
  }))
  const targetDifficultyId = target?.bossDifficultyId ?? ownDifficultyId
  const plan = planClearedDrops(targetDifficultyId, key.periodKey, drops)
  if (plan === null) return false
  const byId = new Map(drops.map((drop) => [drop.id, drop]))
  const moves = plan.keep.filter(({ id, itemId }) => {
    const drop = byId.get(id)!
    return drop.entryId !== target?.id || drop.itemId !== itemId
  })
  if (moves.length === 0 && plan.remove.length === 0) return false
  for (const id of plan.remove) await db.run('DELETE FROM boss_drops WHERE id = ?', [id])
  if (moves.length > 0) {
    const targetId = target?.id ?? (await ensureEntryId(db, { ...key, difficulty: bossDifficultyOfId(targetDifficultyId)!.difficulty }, at))
    for (const { id, itemId } of moves) {
      await db.run('UPDATE boss_drops SET profit_entry_id = ?, item_id = ?, updated_at = ? WHERE id = ?', [targetId, itemId, at, id])
    }
  }
  const paused = target?.cleared === true
  const movedFrom = new Set(moves.map(({ id }) => byId.get(id)!.entryId))
  for (const entry of entries) {
    if (!drops.some((drop) => drop.entryId === entry.id)) continue
    // 비운 수익 건의 아직 올리지 않은 쓰기가 서버에 먼저 닿아야 서버가 같은 순서로 맞춘다. 지우면 그 쓰기 대신 지우기가 가서 서버가
    // 아직 옮기지 않은 드롭을 함께 지운다. 대기 표로 올리는 쓰기면 수익 건이 드롭보다 먼저 올라가 같은 일이 난다.
    if (paused ? await isQueued(db, entry.id) : movedFrom.has(entry.id)) continue
    await deleteEntryIfEmpty(db, entry.id)
  }
  return true
}

async function isQueued(db: SqliteDbConnection, recordId: string): Promise<boolean> {
  const { values } = await db.query('SELECT 1 FROM server_sync_queue WHERE record_id = ?', [recordId])
  return (values ?? []).length > 0
}
