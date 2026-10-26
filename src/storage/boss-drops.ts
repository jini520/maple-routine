import { bossNameOf } from '../lib/boss/bosses'
import { dropItemNameOf } from '../lib/drop/drop-items'
import { worldNameOf } from '../lib/world/worlds'
import {
  PERIOD_KEY_WHERE,
  SPLIT_COLUMN_NAMES,
  deletePeriodIfEmpty,
  ensurePeriodId,
  numberOrNull,
  periodKeyValues,
} from './boss-periods'
import { notifyAfterBatch } from './record-revision-batch'
import { getBossProfitDb } from './sqlite/db'
import { NEW_UUID_SQL } from './sqlite/uuid'
import { inTransaction } from './sqlite/transaction'
import type { DropCategory, RecordedDrop } from '../types/drops'

// 한 보스/기간의 드롭 집합은 시트에서 통째로 편집되므로 replace-all(DELETE→INSERT)이
// 수정에 가장 단순하다. 드롭은 그 기간 행(`boss_party_periods`)을 가리킨다.
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
  dropIndex: number
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
  /** 기록 시점의 월드 이름. 기간 행의 `world_key` 로 찾는다. 모르면 `null`. */
  world: string | null
  /** 기간 행의 월드 key. */
  worldKey: string | null
  /** 저장된 `record_status` 를 화면의 말로. `'entered'`(completed) · `'excluded'`(skipped) · `null`(pending). */
  priceState: 'entered' | 'excluded' | null
  /** 입력한 판매가. 값을 매긴 드롭만 있고 1 이상이다. */
  priceMeso: number | null
  /** `ratio` 의 비율 합. **기본은 이 칸을 안 본다.** */
  /** 어떻게 나눴나. **아래 두 칸의 뜻을 이 칸이 정한다.** 없으면 방식을 모르는 옛 기록이다. */
  priceSplitMode: 'even' | 'ratio' | null
  /** `even` 의 분배 인원. **비율은 이 칸을 안 본다.** */
  pricePartySize: number | null
  priceShare: number | null
  /** 내 비율 스냅샷. `null` 은 1 이라 이 칸이 없던 옛 기록의 금액이 안 움직인다. */
  priceMyShare: number | null
  /** 판매 수수료(%). `null` 은 없음 */
  saleFeePercent: number | null
  /** 분배 수수료(%). `null` 은 없음 */
  splitFeePercent: number | null
  /** 판매 수수료가 등급을 따라가나 */
  saleFeeAuto: boolean
  /** 분배 수수료가 등급을 따라가나 */
  splitFeeAuto: boolean
}

/** 드롭 상태. 서버 `drop_prices` 의 `record_status` 와 같은 값이다. */
type DropRecordStatus = 'pending' | 'completed' | 'skipped'

/**
 * 기록할 월드. 기간 행에 한 번 적는다. 그 기간의 처치와 드롭이 같은 월드다.
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
    (id, period_id, sort_order, category, item_key, box_origin_key, ring_level, record_status, price_meso, priced_at,
     sale_fee_percent, sale_fee_auto, ${SPLIT_COLUMN_NAMES.join(', ')}, created_at, updated_at)
  VALUES (COALESCE(?, ${NEW_UUID_SQL}), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

/** 드롭을 읽는 SELECT. 별칭은 `d`(드롭) · `pe`(기간) · `pa`(조합)다. */
const DROP_SELECT = `
  SELECT d.*, pa.ocid, pa.boss_key, pa.difficulty, pe.period_key, pe.world_key
    FROM boss_drops d
    JOIN boss_party_periods pe ON pe.id = d.period_id
    JOIN boss_parties pa ON pa.id = pe.party_id`

/** 이전 값을 이어 받을 때 읽는 칸. */
interface PreviousDrop {
  id: string
  recordStatus: string
  priceMeso: number | null
  pricedAt: string | null
  createdAt: string
}

function previousOf(row: Record<string, unknown>): PreviousDrop {
  return {
    id: row.id as string,
    recordStatus: row.record_status as string,
    priceMeso: numberOrNull(row.price_meso),
    pricedAt: (row.priced_at as string | null | undefined) ?? null,
    createdAt: row.created_at as string,
  }
}

/**
 * 아이템의 신분. **같은 아이템이 일반 드롭과 상자 결과로 둘 들어올 수 있어** 아이템 key 하나로는
 * 못 가린다. 상자 key 와 반지 레벨까지 넣어야 둘이 갈린다.
 *
 * `item_key` 가 `null` 인 옛 행은 이름으로 떨어진다(이관이 key 를 못 찾은 행이다).
 */
function identityOf(parts: {
  itemKey?: string | null
  itemName: string
  boxOriginKey?: string | null
  ringLevel?: number | null
}): string {
  return [
    parts.itemKey ?? `name:${parts.itemName}`,
    parts.boxOriginKey ?? '',
    parts.ringLevel ?? '',
  ].join('\u0000')
}

// 한 보스/기간의 드롭 집합을 통째로 교체한다(기존 삭제 후 0..n으로 재삽입). 빈 배열이면 삭제만.
/**
 * 드롭 기록이 바뀔 때마다 오르는 수. **이 테이블을 캐시하는 쪽이 **내 스냅샷이 낡았나** 를
 * 물을 수 있게** 하는 값이다.
 *
 * ## 왜 저장 계층에 있나
 *
 * 이 테이블에는 캐시가 **셋**이다. `boss-profit/store`(`dropsByRowKey`) · `drop-price-store` ·
 * `drop-history-store`(전 기간 집계). 앞의 둘은 서로를 직접 부르는 것으로 맞춘다
 * (`applyExternalDropEdit`, 새로고침해야 반영된다 보고의 처방). 그 방식은 **쓰는 쪽이
 * 읽는 쪽을 전부 알아야** 해서, 캐시가 하나 늘 때마다 세 호출부를 다시 훑어야 한다. 실제로
 * `drop-history-store` 가 그렇게 빠졌다.
 *
 * 이 수는 그 방향을 뒤집는다. **쓰기 경로가 이 함수 하나뿐**이므로(세 호출부가 전부 여기로 온다)
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

/** 테스트 전용. 모듈 수준 상태라 테스트끼리 오염된다. 프로덕션에서 부르지 말 것. */
export function resetBossDropRecordsRevisionForTests(): void {
  recordsRevision = 0
}

/**
 * 드롭의 분배 칸 여섯. 값을 매긴 드롭만 갖는다. 비율의 빈 칸은 1 로 채운다.
 *
 * 균등이어도 내 비율이 있으면 남긴다. 2026-10-19 전의 균등 기록은 그 칸으로 금액을 세고(`dropPayoutMeso`), 비우면 그룹을
 * 다시 저장할 때 지난 금액이 바뀐다. 새로 매기는 균등은 그 칸을 안 들고 온다(`dropShareFieldsOf`).
 */
function dropSplitValues(drop: RecordedDrop): (string | number | null)[] {
  const mode = drop.priceSplitMode ?? 'even'
  const partySize = drop.pricePartySize ?? drop.priceShare ?? 1
  return [
    mode,
    partySize,
    mode === 'ratio' ? (drop.priceMyShare ?? 1) : (drop.priceMyShare ?? null),
    mode === 'ratio' ? (drop.priceShare ?? 1) : null,
    drop.splitFeePercent ?? null,
    drop.splitFeeAuto === true ? 1 : null,
  ]
}

/**
 * 0메소는 매긴 것이 아니다. 저장하면 앱은 매긴 것, 서버는 미입력으로 봐서 상태가 갈렸다.
 */
function statusOf(drop: RecordedDrop): DropRecordStatus {
  if (drop.priceState === 'entered' && (drop.priceMeso ?? 0) > 0) return 'completed'
  if (drop.priceState === 'excluded') return 'skipped'
  return 'pending'
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
  const periodId = await ensurePeriodId(db, { ocid, bossKey, difficulty, periodKey }, recordedAt)
  if (world.key !== null) {
    await db.run('UPDATE boss_party_periods SET world_key = ? WHERE id = ? AND world_key IS NULL', [world.key, periodId])
  }

  // **지우기 전에 식별자를 읽어 둔다.** 그룹을 통째로 바꾸는 저장이라, 안 읽으면 같은 아이템이
  // 매번 새 식별자를 받아 서버에 같은 기록이 계속 쌓인다.
  const { values: before } = await db.query(
    'SELECT id, item_key, box_origin_key, ring_level, record_status, price_meso, priced_at, created_at FROM boss_drops WHERE period_id = ?',
    [periodId],
  )
  const kept = new Map<string, PreviousDrop>()
  const byId = new Map<string, PreviousDrop>()
  for (const row of (before ?? []) as Record<string, unknown>[]) {
    const previous = previousOf(row)
    byId.set(previous.id, previous)
    kept.set(
      identityOf({
        itemKey: row.item_key as string,
        itemName: '',
        boxOriginKey: row.box_origin_key as string | null,
        ringLevel: row.ring_level as number | null,
      }),
      previous,
    )
  }

  await db.run('DELETE FROM boss_drops WHERE period_id = ?', [periodId])

  // **다른 기간에 있던 식별자를 들고 온 드롭은 그 기간에서 옮겨 온다.** 난이도 확정 이관이 그렇다. 옛 행을
  // 그대로 두면 같은 식별자를 넣는 순간 기본키가 부딪혀 저장이 실패하고, 뒤이어 옛 그룹을 비우는 쓰기가 드롭을
  // 지운다.
  const carriedIds = drops.map((drop) => drop.dropRecordId).filter((id): id is string => id !== null)
  if (carriedIds.length > 0) {
    const placeholders = carriedIds.map(() => '?').join(', ')
    const { values: elsewhere } = await db.query(
      `SELECT id, period_id, record_status, price_meso, priced_at, created_at FROM boss_drops WHERE id IN (${placeholders})`,
      carriedIds,
    )
    const emptied = new Set<string>()
    for (const row of (elsewhere ?? []) as Record<string, unknown>[]) {
      byId.set(row.id as string, previousOf(row))
      emptied.add(row.period_id as string)
    }
    await db.run(`DELETE FROM boss_drops WHERE id IN (${placeholders})`, carriedIds)
    for (const otherPeriodId of emptied) await deletePeriodIfEmpty(db, otherPeriodId)
  }

  for (let index = 0; index < drops.length; index++) {
    const drop = drops[index]
    // **드롭이 들고 온 식별자가 먼저다.** 난이도 확정 이관처럼 다른 그룹으로 옮기는 경로는 신분
    // 조회로 못 찾는다(그 그룹에 그 행이 없다).
    //
    // 신분 조회는 식별자를 안 들고 온 경로의 안전망이다. 같은 신분이 둘 있으면 첫 행만 물려받고
    // 둘째는 새 값을 받는다 - 한 식별자가 두 행에 붙으면 서버가 그것을 한 기록으로 보고 하나가
    // 다른 하나를 덮는다.
    const identity = identityOf(drop)
    const inherited = kept.get(identity)
    if (inherited !== undefined) kept.delete(identity)
    const id = drop.dropRecordId ?? inherited?.id ?? null
    const previous = (id === null ? undefined : byId.get(id)) ?? inherited

    const status = statusOf(drop)
    const completed = status === 'completed'
    // 가격을 매긴 시각은 서버 시세의 거래 시각이다. 같은 값을 다시 저장해도 움직이면 안 된다.
    const samePrice = previous?.recordStatus === 'completed' && previous.priceMeso === drop.priceMeso
    await db.run(INSERT_SQL, [
      id,
      periodId,
      index,
      drop.category,
      drop.itemKey,
      drop.boxOriginKey ?? null,
      drop.ringLevel ?? null,
      status,
      completed ? drop.priceMeso! : null,
      completed ? (samePrice ? previous!.pricedAt : recordedAt) : null,
      completed ? (drop.saleFeePercent ?? null) : null,
      completed && drop.saleFeeAuto === true ? 1 : null,
      ...(completed ? dropSplitValues(drop) : SPLIT_COLUMN_NAMES.map(() => null)),
      previous?.createdAt ?? recordedAt,
      recordedAt,
    ])
  }
  if (drops.length === 0) await deletePeriodIfEmpty(db, periodId)

  // **삭제/삽입이 다 끝난 뒤**에 올린다. 중간에 던지면 테이블이 바뀌지 않은 채로 끝나므로
  // 그때 올리면 읽는 쪽이 헛되이 전 기간을 다시 읽는다.
  bumpRecordsRevision()

  // 드롭을 넘긴 차례 그대로의 식별자. 가격을 서버로 보내는 쪽이 이것으로 기록을 가리킨다.
  // 메모리의 드롭은 식별자가 없을 수 있고(시트에서 방금 적은 것), 그 값은 위 INSERT 에서 처음 생긴다.
  if (drops.length === 0) return []
  const { values } = await db.query('SELECT id FROM boss_drops WHERE period_id = ? ORDER BY sort_order', [periodId])
  return ((values ?? []) as Record<string, unknown>[]).map((row) => row.id as string)
}

const PRICE_STATE_OF_STATUS: Record<DropRecordStatus, BossDropRecord['priceState']> = {
  completed: 'entered',
  skipped: 'excluded',
  pending: null,
}

function rowToRecord(row: Record<string, unknown>): BossDropRecord {
  const bossKey = row.boss_key as string
  const itemKey = row.item_key as string
  const boxOriginKey = (row.box_origin_key as string | null | undefined) ?? null
  const worldKey = (row.world_key as string | null | undefined) ?? null
  const recordStatus = row.record_status as DropRecordStatus
  const splitMode = (row.split_mode as 'even' | 'ratio' | null | undefined) ?? null
  return {
    dropRecordId: row.id as string,
    ocid: row.ocid as string,
    bossKey,
    boss: bossNameOf(bossKey, bossKey),
    difficulty: row.difficulty as string,
    periodKey: row.period_key as string,
    dropIndex: row.sort_order as number,
    category: row.category as DropCategory,
    itemKey,
    itemName: dropItemNameOf(itemKey, itemKey),
    boxOriginKey,
    boxOrigin: boxOriginKey === null ? null : dropItemNameOf(boxOriginKey, boxOriginKey),
    ringLevel: numberOrNull(row.ring_level),
    quantity: 1,
    recordedAt: row.updated_at as string,
    pricedAt: (row.priced_at as string | null | undefined) ?? null,
    world: worldKey === null ? null : worldNameOf(worldKey, worldKey),
    worldKey,
    priceState: PRICE_STATE_OF_STATUS[recordStatus],
    priceMeso: numberOrNull(row.price_meso),
    priceSplitMode: splitMode,
    pricePartySize: numberOrNull(row.party_size),
    priceShare: splitMode === 'ratio' ? numberOrNull(row.shares_total) : null,
    priceMyShare: numberOrNull(row.my_share),
    saleFeePercent: numberOrNull(row.sale_fee_percent),
    splitFeePercent: numberOrNull(row.split_fee_percent),
    saleFeeAuto: Number(row.sale_fee_auto) === 1,
    splitFeeAuto: Number(row.split_fee_auto) === 1,
  }
}

export async function getBossDropRecords(
  ocids: string[],
  periodKeys: string[],
): Promise<BossDropRecord[]> {
  if (ocids.length === 0 || periodKeys.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const periodKeyPlaceholders = periodKeys.map(() => '?').join(', ')
  const { values } = await db.query(
    `${DROP_SELECT} WHERE pa.ocid IN (${ocidPlaceholders}) AND pe.period_key IN (${periodKeyPlaceholders}) ORDER BY d.sort_order`,
    [...ocids, ...periodKeys],
  )

  return (values ?? []).map(rowToRecord)
}

/**
 * 식별자 하나로 그 기록을 찾는다. 서버로 보낼 때 **현재 값**을 읽는 자리다.
 *
 * 없으면 `null` 이고, 그것이 **서버에서 지워라** 의 신호다 - 보내기와 지우기를 가르는 칸을 따로
 * 두지 않고 원본의 유무로 판다.
 */
export async function getBossDropRecordById(dropRecordId: string): Promise<BossDropRecord | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query(`${DROP_SELECT} WHERE d.id = ?`, [dropRecordId])
  const row = (values ?? [])[0]
  return row === undefined ? null : rowToRecord(row as Record<string, unknown>)
}

/** 판매 · 분배 수수료 중 하나라도 자동인 기록 전부. 등급 기록이 바뀌면 다시 셀 대상이다. */
export async function getAutoFeeDropRecords(): Promise<BossDropRecord[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `${DROP_SELECT} WHERE d.sale_fee_auto = 1 OR d.split_fee_auto = 1 ORDER BY d.sort_order`,
  )
  return (values ?? []).map(rowToRecord)
}

/** 키 넷과 `sort_order` 로 드롭 하나의 id 를 고르는 하위 질의. */
const DROP_ID_OF_KEY = `(SELECT d.id FROM boss_drops d
  JOIN boss_party_periods pe ON pe.id = d.period_id JOIN boss_parties pa ON pa.id = pe.party_id
  WHERE ${PERIOD_KEY_WHERE} AND d.sort_order = ?)`

export interface DropFeeUpdate {
  ocid: string
  bossKey: string
  difficulty: string
  periodKey: string
  dropIndex: number
  saleFeePercent: number | null
  splitFeePercent: number | null
}

/** 드롭 기록들의 두 요율을 고쳐 쓴다. 수익은 읽을 때 `dropPayoutMeso` 가 센다. */
export async function updateDropFees(updates: readonly DropFeeUpdate[]): Promise<void> {
  if (updates.length === 0) return
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    for (const update of updates) {
      await db.run(
        `UPDATE boss_drops SET sale_fee_percent = ?, split_fee_percent = ?
         WHERE record_status = 'completed' AND id = ${DROP_ID_OF_KEY}`,
        [update.saleFeePercent, update.splitFeePercent, ...periodKeyValues(update), update.dropIndex],
      )
    }
  })
  bumpRecordsRevision()
}

/** 일괄 적용 대상. 가격을 입력했고 두 수수료가 다 빈 드롭이다. */
export async function getBulkFeeDropRecords(): Promise<BossDropRecord[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `${DROP_SELECT}
     WHERE d.record_status = 'completed' AND d.sale_fee_percent IS NULL AND d.split_fee_percent IS NULL
     ORDER BY d.sort_order`,
  )
  return (values ?? []).map(rowToRecord)
}

/** 일괄 적용. 두 요율을 적고 두 칸을 자동으로 바꾼다. */
export async function applyAutoDropFees(updates: readonly DropFeeUpdate[]): Promise<void> {
  if (updates.length === 0) return
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    for (const update of updates) {
      await db.run(
        `UPDATE boss_drops SET sale_fee_percent = ?, split_fee_percent = ?, sale_fee_auto = 1, split_fee_auto = 1
         WHERE record_status = 'completed' AND id = ${DROP_ID_OF_KEY}`,
        [update.saleFeePercent, update.splitFeePercent, ...periodKeyValues(update), update.dropIndex],
      )
    }
  })
  bumpRecordsRevision()
}

/**
 * 기간을 걸지 않고 읽는 이 캐릭터들의 전 기간 드롭 기록. 드롭 히스토리가 히스토리 전용
 * 테이블 없이 이 테이블 하나만 보고 동작하는 근거다. `getBossDropRecords` 는 `periodKeys` 가
 * 필수라 지금 보고 있는 기간 밖을 조회할 수단이 없다.
 *
 * 정렬은 `period_key DESC, sort_order` 다. `recorded_at` 은 replace-all·prune·난이도 이관이
 * 그룹 전체를 호출 시점으로 덮어쓰므로 시간순 기준이 될 수 없다. 같은 기간 안에서 보스가
 * 섞이지 않게 `ocid`·`boss`·`difficulty` 까지 정렬 키에 넣어 순서를 완전히 결정한다.
 *
 * 주간(`YYYY-MM-DD`)·월간(`YYYY-MM`) 키가 섞이면 문자열 DESC 는 시간순이 아니다. 시간축
 * 정렬은 `lib/drop/drop-history` 가 기간 시작 시점으로 환산해 다시 한다. 여기서는 같은 기간
 * 안의 순서만 보장하면 되고 그 순서를 안정 정렬이 보존한다.
 */
export async function getAllBossDropRecords(ocids: string[]): Promise<BossDropRecord[]> {
  if (ocids.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const { values } = await db.query(
    `${DROP_SELECT} WHERE pa.ocid IN (${ocidPlaceholders})
      ORDER BY pe.period_key DESC, pa.ocid, pa.boss_key, pa.difficulty, d.sort_order`,
    [...ocids],
  )

  return (values ?? []).map(rowToRecord)
}
