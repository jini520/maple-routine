import { getBossProfitDb } from './sqlite/db'
import type { DropCategory, RecordedDrop } from '../types/drops'

// ADR-038 결정 5: 한 보스/기간의 드롭 집합은 시트에서 통째로 편집되므로 replace-all(DELETE→INSERT)이
// 수정에 가장 단순하다. drop_index 다중 행으로 저장한다. `storage/boss-profit.ts` 어댑터 패턴을 미러한다.
//
// **금액을 함께 저장한다**([[ADR-124]], [[ADR-038]] 반전) — 기록 한 건에 붙는 실판매가다. 시세표가
// 아니라 스냅샷이라 재평가 대상이 아니고, 같은 행에 두므로 난이도 확정 이관·prune 삭제가 가격까지
// 함께 옮기고 지운다.
export interface BossDropRecord {
  ocid: string
  boss: string
  difficulty: string
  periodKey: string
  dropIndex: number
  category: DropCategory
  itemName: string
  slot: string | null
  boxOrigin: string | null
  ringLevel: number | null
  quantity: number
  recordedAt: string // ISO 8601
  /** `'entered'` · `'excluded'` · `null`(미입력). 상태를 금액 유무로 추론하지 않는다([[ADR-124]] 결정 4). */
  priceState: 'entered' | 'excluded' | null
  /** 판매 **총액**. 수량이 2 이상이어도 묶음가 하나다. */
  priceMeso: number | null
  /** 분배 인원 스냅샷 — 그 행의 `party_size` 와 다를 수 있다([[ADR-124]] 결정 2). */
  priceShare: number | null
}

const DELETE_SQL = `
  DELETE FROM boss_drop_records
  WHERE ocid = ? AND boss = ? AND difficulty = ? AND period_key = ?
`

const INSERT_SQL = `
  INSERT INTO boss_drop_records
    (ocid, boss, difficulty, period_key, drop_index, category, item_name, slot, box_origin, ring_level, quantity, recorded_at,
     price_state, price_meso, price_share)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

// 한 보스/기간의 드롭 집합을 통째로 교체한다(기존 삭제 후 0..n으로 재삽입). 빈 배열이면 삭제만.
export async function replaceBossDropRecords(
  ocid: string,
  boss: string,
  difficulty: string,
  periodKey: string,
  drops: RecordedDrop[],
  recordedAt: string,
): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(DELETE_SQL, [ocid, boss, difficulty, periodKey])
  for (let index = 0; index < drops.length; index++) {
    const drop = drops[index]
    await db.run(INSERT_SQL, [
      ocid,
      boss,
      difficulty,
      periodKey,
      index,
      drop.category,
      drop.itemName,
      drop.slot ?? null,
      drop.boxOrigin ?? null,
      drop.ringLevel ?? null,
      drop.quantity,
      recordedAt,
      // **미입력은 NULL 이다 — 0 이 아니다.** 0 으로 넣으면 "0메소에 팔았다"가 되어
      // 스킵·미입력과 구분이 사라진다([[ADR-124]] 결정 4).
      drop.priceState ?? null,
      drop.priceMeso ?? null,
      drop.priceShare ?? null,
    ])
  }
}

/** 저장된 상태 문자열을 도메인 값으로. 모르는 값은 미입력으로 떨어뜨린다(거짓 상태를 만들지 않는다). */
function normalizePriceState(value: unknown): BossDropRecord['priceState'] {
  if (value === 'entered') return 'entered'
  if (value === 'excluded' || value === 'skipped') return 'excluded'
  return null
}

function rowToRecord(row: Record<string, unknown>): BossDropRecord {
  return {
    ocid: row.ocid as string,
    boss: row.boss as string,
    difficulty: row.difficulty as string,
    periodKey: row.period_key as string,
    dropIndex: row.drop_index as number,
    category: row.category as DropCategory,
    itemName: row.item_name as string,
    slot: (row.slot as string | null) ?? null,
    boxOrigin: (row.box_origin as string | null) ?? null,
    ringLevel: (row.ring_level as number | null) ?? null,
    quantity: row.quantity as number,
    recordedAt: row.recorded_at as string,
    // 옛 값 `'skipped'` 는 지금의 `'excluded'`(기록 안함)와 같은 뜻이다 — 이름만 갈렸다
    // ([[ADR-124]] 결정 6 정정, 2026-08-10). 읽을 때 흡수하므로 마이그레이션이 필요 없다.
    priceState: normalizePriceState(row.price_state),
    priceMeso: (row.price_meso as number | null | undefined) ?? null,
    priceShare: (row.price_share as number | null | undefined) ?? null,
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
 * 기간을 걸지 않고 이 캐릭터들의 **전 기간** 드롭 기록을 읽는다([[ADR-071]] 결정 1) — 드롭 히스토리가
 * 히스토리 전용 테이블 없이 이 테이블 하나만 보고 동작하는 근거다. `getBossDropRecords` 는
 * `periodKeys` 가 필수라 "지금 보고 있는 기간" 밖을 조회할 수단이 없었다(이슈 #54).
 *
 * 정렬은 `period_key DESC, drop_index` 다 — `recorded_at` 은 replace-all·prune·난이도 이관이 그룹
 * 전체를 호출 시점으로 덮어쓰므로 시간순 기준이 될 수 없다([[ADR-071]] 결정 2·3). 같은 기간 안에서
 * 보스가 섞이지 않게 `ocid`·`boss`·`difficulty` 까지 정렬 키에 넣어 순서를 완전히 결정한다.
 *
 * 주간(`YYYY-MM-DD`)·월간(`YYYY-MM`) 키가 섞이면 문자열 DESC 는 시간순이 아니다(월간 `2026-07` 이
 * 그 달 주차들보다 뒤로 밀린다) — 시간축 정렬은 `lib/drop-history` 가 기간 시작 시점으로 환산해
 * 다시 한다. 여기서는 **같은 기간 안의 순서**만 보장하면 되고, 그 순서를 안정 정렬이 보존한다.
 */
export async function getAllBossDropRecords(ocids: string[]): Promise<BossDropRecord[]> {
  if (ocids.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT * FROM boss_drop_records WHERE ocid IN (${ocidPlaceholders}) ORDER BY period_key DESC, ocid, boss, difficulty, drop_index`,
    [...ocids],
  )

  return (values ?? []).map(rowToRecord)
}
