import { bossNameOf } from '../lib/boss/bosses'
import { notifyAfterBatch } from './record-revision-batch'
import { getBossProfitDb } from './sqlite/db'
import { NEW_UUID_SQL } from './sqlite/uuid'
import { inTransaction } from './sqlite/transaction'
import type { DropCategory, RecordedDrop } from '../types/drops'

// 한 보스/기간의 드롭 집합은 시트에서 통째로 편집되므로 replace-all(DELETE→INSERT)이
// 수정에 가장 단순하다. drop_index 다중 행으로 저장한다. `storage/boss-profit.ts` 어댑터 패턴을 미러한다.
//
// **금액을 함께 저장한다**(반전). 기록 한 건에 붙는 실판매가다. 시세표가
// 아니라 스냅샷이라 재평가 대상이 아니고, 같은 행에 두므로 난이도 확정 이관·prune 삭제가 가격까지
// 함께 옮기고 지운다.
export interface BossDropRecord {
  /** 이 기록을 다시 가리키는 값. 저장 계층이 붙이고 그룹을 다시 저장해도 유지된다. */
  dropRecordId: string
  ocid: string
  /** 보스 key. 기본키에 든다. */
  bossKey: string
  /** 적을 때의 보스 이름. */
  boss: string
  /** 난이도 key. */
  difficulty: string
  periodKey: string
  dropIndex: number
  category: DropCategory
  /** 아이템 key. 이름만 저장된 옛 행에서 이관이 못 찾았으면 `null` 이다. */
  itemKey: string | null
  /** 적을 때의 이름. */
  itemName: string
  slot: string | null
  /** 상자 결과면 상자의 아이템 key. */
  boxOriginKey: string | null
  boxOrigin: string | null
  ringLevel: number | null
  quantity: number
  recordedAt: string // ISO 8601
  /** 기록 시점의 월드 스냅샷. 모르면 `null`. */
  world: string | null
  /** 월드 key. `world` 가 `null` 이면 함께 `null`. */
  worldKey: string | null
  /** `'entered'` · `'excluded'` · `null`(미입력). 상태를 금액 유무로 추론하지 않는다. */
  priceState: 'entered' | 'excluded' | null
  /** 입력한 판매가. */
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

/**
 * 기록할 월드. **한 번의 저장이 한 캐릭터·한 시점이라 드롭마다가 아니라 호출마다 하나다.**
 *
 * 짝인 수익 행에서 물려받지 않는다 - 결정석 가격을 모르는 보스는 수익 행이 없어 물려받을 짝이 없고,
 * 서버로 보내는 값이라 비면 그 기록을 못 쓴다.
 */
export interface DropWorld {
  name: string | null
  key: string | null
}

/** 월드를 모를 때. 지우기만 하는 호출도 이것을 쓴다(쓸 행이 없다). */
export const NO_WORLD: DropWorld = { name: null, key: null }

const DELETE_SQL = `
  DELETE FROM boss_drop_records
  WHERE ocid = ? AND boss_key = ? AND difficulty = ? AND period_key = ?
`

/**
 * 한 행을 넣는다. **식별자는 넘겨받은 것이 있으면 그것을, 없으면 SQLite 가 만든 새 값을 쓴다.**
 *
 * `COALESCE` 로 가르는 것이 요점이다. 인자로 `null` 을 주면 그 자리에서 새 uuid 가 생기고, 값을
 * 주면 그것이 그대로 남는다. 두 경로를 SQL 하나로 묶어 분기를 안 만든다.
 */
const INSERT_SQL = `
  INSERT INTO boss_drop_records
    (drop_record_id, ocid, boss_key, boss, difficulty, period_key, drop_index, category, item_key, item_name, slot, box_origin_key,
     box_origin, ring_level, quantity, recorded_at, world, world_key, price_state, price_meso, price_split_mode, price_party_size, price_share, price_my_share,
     sale_fee_percent, split_fee_percent, sale_fee_auto, split_fee_auto)
  VALUES (COALESCE(?, ${NEW_UUID_SQL}), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

/** 그룹 안에서 아이템 하나를 가리키는 값. 저장을 되풀이해도 같아야 식별자를 물려줄 수 있다. */
const SELECT_GROUP_IDS_SQL = `
  SELECT drop_record_id, world, world_key, item_key, item_name, slot, box_origin_key, ring_level
  FROM boss_drop_records
  WHERE ocid = ? AND boss_key = ? AND difficulty = ? AND period_key = ?
`

/**
 * 아이템의 신분. **같은 아이템이 일반 드롭과 상자 결과로 둘 들어올 수 있어** 아이템 key 하나로는
 * 못 가린다. 상자 key 와 칸·반지 레벨까지 넣어야 둘이 갈린다.
 *
 * `item_key` 가 `null` 인 옛 행은 이름으로 떨어진다(이관이 key 를 못 찾은 행이다).
 */
function identityOf(parts: {
  itemKey?: string | null
  itemName: string
  slot?: string | null
  boxOriginKey?: string | null
  ringLevel?: number | null
}): string {
  return [
    parts.itemKey ?? `name:${parts.itemName}`,
    parts.slot ?? '',
    parts.boxOriginKey ?? '',
    parts.ringLevel ?? '',
  ].join('\u0000')
}

// 한 보스/기간의 드롭 집합을 통째로 교체한다(기존 삭제 후 0..n으로 재삽입). 빈 배열이면 삭제만.
/**
 * `boss_drop_records` 가 바뀔 때마다 오르는 수. **이 테이블을 캐시하는 쪽이 **내 스냅샷이 낡았나** 를
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

export async function replaceBossDropRecords(
  ocid: string,
  bossKey: string,
  difficulty: string,
  periodKey: string,
  drops: RecordedDrop[],
  recordedAt: string,
  world: DropWorld,
): Promise<void> {
  const db = await getBossProfitDb()

  // **지우기 전에 식별자를 읽어 둔다.** 그룹을 통째로 바꾸는 저장이라, 안 읽으면 같은 아이템이
  // 매번 새 식별자를 받아 서버에 같은 기록이 계속 쌓인다.
  const { values: before } = await db.query(SELECT_GROUP_IDS_SQL, [ocid, bossKey, difficulty, periodKey])
  const kept = new Map<string, { id: string; world: string | null; worldKey: string | null }>()
  for (const row of (before ?? []) as Record<string, unknown>[]) {
    kept.set(
      identityOf({
        itemKey: row.item_key as string | null,
        itemName: row.item_name as string,
        slot: row.slot as string | null,
        boxOriginKey: row.box_origin_key as string | null,
        ringLevel: row.ring_level as number | null,
      }),
      {
        id: row.drop_record_id as string,
        world: (row.world as string | null | undefined) ?? null,
        worldKey: (row.world_key as string | null | undefined) ?? null,
      },
    )
  }

  await db.run(DELETE_SQL, [ocid, bossKey, difficulty, periodKey])
  // 이름 칸은 적을 때의 이름이다. 수익 기록과 모양을 맞춘다.
  const bossName = bossNameOf(bossKey, bossKey)
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

    await db.run(INSERT_SQL, [
      drop.dropRecordId ?? inherited?.id ?? null,
      ocid,
      bossKey,
      bossName,
      difficulty,
      periodKey,
      index,
      drop.category,
      drop.itemKey,
      drop.itemName,
      drop.slot ?? null,
      drop.boxOriginKey ?? null,
      drop.boxOrigin ?? null,
      drop.ringLevel ?? null,
      drop.quantity,
      recordedAt,
      // **월드도 물려받는다.** 기록 시점의 스냅샷이라 가격만 고치는 저장이 그것을 지우면 안 된다.
      // 가격 편집 경로는 월드를 모르고 `NO_WORLD` 를 넘긴다.
      inherited?.world ?? world.name,
      inherited?.worldKey ?? world.key,
      // **미입력은 NULL 이다. 0 이 아니다.** 0 으로 넣으면 "0메소에 팔았다"가 되어
      // 스킵·미입력과 구분이 사라진다.
      drop.priceState ?? null,
      drop.priceMeso ?? null,
      drop.priceSplitMode ?? null,
      drop.pricePartySize ?? null,
      drop.priceShare ?? null,
      drop.priceMyShare ?? null,
      drop.saleFeePercent ?? null,
      drop.splitFeePercent ?? null,
      drop.saleFeeAuto === true ? 1 : null,
      drop.splitFeeAuto === true ? 1 : null,
    ])
  }

  // **삭제/삽입이 다 끝난 뒤**에 올린다. 중간에 던지면 테이블이 바뀌지 않은 채로 끝나므로
  // 그때 올리면 읽는 쪽이 헛되이 전 기간을 다시 읽는다.
  bumpRecordsRevision()
}

/** 저장된 상태 문자열을 도메인 값으로. 모르는 값은 미입력으로 떨어뜨린다(거짓 상태를 만들지 않는다). */
function normalizePriceState(value: unknown): BossDropRecord['priceState'] {
  if (value === 'entered') return 'entered'
  if (value === 'excluded' || value === 'skipped') return 'excluded'
  return null
}

function rowToRecord(row: Record<string, unknown>): BossDropRecord {
  return {
    dropRecordId: row.drop_record_id as string,
    ocid: row.ocid as string,
    bossKey: row.boss_key as string,
    boss: row.boss as string,
    difficulty: row.difficulty as string,
    periodKey: row.period_key as string,
    dropIndex: row.drop_index as number,
    category: row.category as DropCategory,
    itemKey: (row.item_key as string | null | undefined) ?? null,
    itemName: row.item_name as string,
    slot: (row.slot as string | null) ?? null,
    boxOriginKey: (row.box_origin_key as string | null | undefined) ?? null,
    boxOrigin: (row.box_origin as string | null) ?? null,
    ringLevel: (row.ring_level as number | null) ?? null,
    quantity: row.quantity as number,
    recordedAt: row.recorded_at as string,
    world: (row.world as string | null | undefined) ?? null,
    worldKey: (row.world_key as string | null | undefined) ?? null,
    // 옛 값 `'skipped'` 는 지금의 `'excluded'`(기록 안함)와 같은 뜻이다. 이름만 갈렸다
    // (정정, 2026-08-10). 읽을 때 흡수하므로 마이그레이션이 필요 없다.
    priceState: normalizePriceState(row.price_state),
    priceMeso: (row.price_meso as number | null | undefined) ?? null,
    priceSplitMode: (row.price_split_mode as 'even' | 'ratio' | null | undefined) ?? null,
    pricePartySize: (row.price_party_size as number | null | undefined) ?? null,
    priceShare: (row.price_share as number | null | undefined) ?? null,
    priceMyShare: (row.price_my_share as number | null | undefined) ?? null,
    saleFeePercent: (row.sale_fee_percent as number | null | undefined) ?? null,
    splitFeePercent: (row.split_fee_percent as number | null | undefined) ?? null,
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
    `SELECT * FROM boss_drop_records WHERE ocid IN (${ocidPlaceholders}) AND period_key IN (${periodKeyPlaceholders}) ORDER BY drop_index`,
    [...ocids, ...periodKeys],
  )

  return (values ?? []).map(rowToRecord)
}

/**
 * 식별자 하나로 그 기록을 찾는다. 서버로 보낼 때 **현재 값**을 읽는 자리다.
 *
 * 없으면 `null` 이고, 그것이 「서버에서 지워라」 의 신호다 - 보내기와 지우기를 가르는 칸을 따로
 * 두지 않고 원본의 유무로 판다.
 */
export async function getBossDropRecordById(dropRecordId: string): Promise<BossDropRecord | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query(`SELECT * FROM boss_drop_records WHERE drop_record_id = ?`, [
    dropRecordId,
  ])
  const row = (values ?? [])[0]
  return row === undefined ? null : rowToRecord(row as Record<string, unknown>)
}

/** 판매 · 분배 수수료 중 하나라도 자동인 기록 전부. 등급 기록이 바뀌면 다시 셀 대상이다. */
export async function getAutoFeeDropRecords(): Promise<BossDropRecord[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT * FROM boss_drop_records WHERE sale_fee_auto = 1 OR split_fee_auto = 1 ORDER BY drop_index`,
  )
  return (values ?? []).map(rowToRecord)
}

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
        `UPDATE boss_drop_records SET sale_fee_percent = ?, split_fee_percent = ?
         WHERE ocid = ? AND boss_key = ? AND difficulty = ? AND period_key = ? AND drop_index = ?`,
        [update.saleFeePercent, update.splitFeePercent, update.ocid, update.bossKey, update.difficulty, update.periodKey, update.dropIndex],
      )
    }
  })
  bumpRecordsRevision()
}

/** 일괄 적용 대상. 가격을 입력했고 두 수수료가 다 빈 드롭이다. */
export async function getBulkFeeDropRecords(): Promise<BossDropRecord[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT * FROM boss_drop_records
     WHERE price_state = 'entered' AND sale_fee_percent IS NULL AND split_fee_percent IS NULL
     ORDER BY drop_index`,
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
        `UPDATE boss_drop_records SET sale_fee_percent = ?, split_fee_percent = ?, sale_fee_auto = 1, split_fee_auto = 1
         WHERE ocid = ? AND boss_key = ? AND difficulty = ? AND period_key = ? AND drop_index = ?`,
        [update.saleFeePercent, update.splitFeePercent, update.ocid, update.bossKey, update.difficulty, update.periodKey, update.dropIndex],
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
 * 정렬은 `period_key DESC, drop_index` 다. `recorded_at` 은 replace-all·prune·난이도 이관이
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
    `SELECT * FROM boss_drop_records WHERE ocid IN (${ocidPlaceholders}) ORDER BY period_key DESC, ocid, boss_key, difficulty, drop_index`,
    [...ocids],
  )

  return (values ?? []).map(rowToRecord)
}
