/**
 * 지출 어댑터.
 *
 * 대리키·`ON CONFLICT` 없음·`id`/`recordedAt` 을 호출부가 주는 규약은 `income.ts` 와 같다.
 * 그쪽에 사유를 적어 뒀다.
 *
 * 통화 칸이 셋이고 대개 둘은 비어 있다. 아이템 구매 한 건이 메소와 메포를 동시에 쓰기 때문에
 * 한 행 = 한 통화로는 표현이 안 된다. 희소 컬럼 셋이 그 대가이고, 대안(여러 행 + group_id)이
 * 지출 몇 건 을 거짓으로 만드는 것보다 낫다고 봤다.
 */
import {
  spendCategoryNameOf,
  spendItemKindNameOf,
  type SpendCategoryKey,
  type SpendItemKindKey,
} from '../lib/cashbook/categories'
import { getBossProfitDb } from './sqlite/db'

export interface SpendRecord {
  id: string
  /** `null` = 계정 단위가 기본. */
  ocid: string | null
  /** `'YYYY-MM-DD'` KST. */
  spentOn: string
  /** 갈래 key. DB 에는 그때 이름(`category`)도 함께 적는다. */
  category: SpendCategoryKey
  /**
   * 그때의 이름. 목록에서 고른 항목 이름, 에픽던전 리워드의 이어 붙인 이름, 또는 직접 친 이름
   * (`구매 아이템` · `내용`). 화면은 key 로 카탈로그를 찾고 못 찾을 때 이 글자를 쓴다.
   */
  item: string | null
  /** 목록에서 고른 항목 key. 직접 친 기록과 에픽던전 리워드는 `null` 이다. */
  itemKey: string | null
  /**
   * 에픽던전 리워드의 형태별 항목 key. `{ exp: 'high_mountain_2', sol_erda: 'high_mountain_1' }`.
   *
   * 한 기록이 형태 둘을 함께 지므로 항목 key 하나로는 못 적는다. 다른 기록은 `null` 이다.
   */
  formItemKeys: Readonly<Record<string, string>> | null
  /**
   * 아이템 구매 종류 key. 이 값 하나가 수량과 관세를 함께 가른다. 장비는 하나를 사고 관세가
   * 붙으며, 소비·기타는 여럿을 사고 월드 간 거래가 안 되어 관세가 없다.
   *
   * 다른 갈래에서는 `null` 이고, 아이템 구매의 `null` 은 종류 칸이 생기기 전 행이라 장비로
   * 연다. 그때는 치는 금액 + 관세 하나뿐이었고 그것이 정확히 장비의 모양이다.
   */
  itemKind: SpendItemKindKey | null
  /** 심볼 강화의 강화 전 레벨. 다른 갈래에서는 `null` 이다. */
  levelFrom: number | null
  /** 심볼 강화의 강화 후 레벨. */
  levelTo: number | null
  /**
   * 금액 = 카탈로그의 `unitPrice` × 이 값. **단위 이름은 안 적는다**.
   * 카탈로그가 항목별로 알고 있어(`unit`) 베끼면 목록이 바뀔 때 두 벌이 어긋난다.
   */
  quantity: number | null
  /**
   * **관세를 포함한 총액**이다. 집계는 이 한 칸만 보면 되므로
   * 관세를 빠뜨려 덜 세는 사고가 구조적으로 없다.
   */
  mesoAmount: number | null
  /**
   * 위 총액 중 관세분. **집계에 더하지 말 것**. 이미 `mesoAmount` 안에 있다.
   *
   * 요율을 안 박고 읽을 때 나누면 요율이 바뀌는 날 **지난달 관세가 전부 소급해 달라진다**
   * 10% 고정은 **지금의** 사실이다.
   */
  tariffMeso: number | null
  /** 메포 원금. 표시는 아래 시세로 환산한 메소다. */
  pointAmount: number | null
  /**
   * 메소마켓 시세. 단위가 **1억 메소당 메포**다.
   * 환산은 `메포 × 100,000,000 ÷ 시세` 로 **나눗셈**이다.
   */
  pointPer100mMeso: number | null
  /**
   * **환산하지 않는다**. 그래서 짝이 되는 환율 칸이 없다. 현금과 게임
   * 재화의 교환비가 실제로 성립하는 경로가 운영정책 위반 거래라, 앱이 그 숫자를 적으면 **그 경로에
   * 값을 매기는 것처럼 읽힌다.** 정확도의 문제가 아니라 무엇을 정상으로 보이게 하는가의 문제다.
   */
  cashAmount: number | null
  memo: string | null
  recordedAt: string
}

const INSERT_SQL = `
  INSERT INTO spend_records
    (id, ocid, spent_on, category, category_key, item, item_key, form, form_item_keys,
     item_kind, item_kind_key, quantity,
     meso_amount, tariff_meso, point_amount, point_per_100m_meso, cash_amount,
     memo, recorded_at, level_from, level_to)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

/**
 * 이름 칸과 key 칸의 값. 옛 `form` 칸은 더 안 쓴다(형태는 `form_item_keys` 가 든다).
 *
 * 이름 칸에 그때 이름을 함께 적는 것은 key 를 못 찾는 날(표에서 빠진 항목)에 기록이 보여 줄
 * 글자가 남게 하려는 것이다.
 */
function identityValues(record: SpendRecord): Array<string | null> {
  return [
    spendCategoryNameOf(record.category),
    record.category,
    record.item,
    record.itemKey,
    null,
    record.formItemKeys === null ? null : JSON.stringify(record.formItemKeys),
    record.itemKind === null ? null : spendItemKindNameOf(record.itemKind),
    record.itemKind,
  ]
}

/**
 * 메포를 썼으면 시세가 있어야 한다는 검사.
 *
 * 화면이 막지만 저장소가 한 번 더 막는 것은 실패의 모양이 나쁘기 때문이다. 시세 없이 저장하면
 * 그 행은 영영 메소로 표시할 수 없는 행이 된다. 환율이 행에 박히므로 나중에 채울 수도 없고,
 * 메포는 모두 메소로 표기한다 는 정책이 그 행에서만 깨진다.
 *
 * 0 을 함께 막는 것은 환산이 나눗셈이라서다.
 */
function assertPointRate(record: SpendRecord): void {
  if (record.pointAmount === null) {
    return
  }
  if (record.pointPer100mMeso === null || record.pointPer100mMeso <= 0) {
    throw new Error(
      '메포 지출에는 메소마켓 시세(1억 메소당 메포)가 필요하고 0보다 커야 합니다',
    )
  }
}

export async function insertSpendRecord(record: SpendRecord): Promise<void> {
  assertPointRate(record)

  const db = await getBossProfitDb()
  await db.run(INSERT_SQL, [
    record.id,
    record.ocid,
    record.spentOn,
    ...identityValues(record),
    record.quantity,
    record.mesoAmount,
    record.tariffMeso,
    record.pointAmount,
    record.pointPer100mMeso,
    record.cashAmount,
    record.memo,
    record.recordedAt,
    record.levelFrom,
    record.levelTo,
  ])
}

/**
 * 갈아 끼우기. **지우고 다시 넣지 않는다**.
 *
 * 지우고 넣으면 `id` 와 `recorded_at` 이 새것이 되는데, 그 둘은 언제 적었나 를 든 칸이라
 * **고친 시각이 적은 시각을 덮어쓴다.** 그래서 `SET` 에 `recorded_at` 이 없다. 적은 시각이지
 * 마지막으로 만진 시각이 아니다. 후자가 필요해지면 **칸을 새로 세운다**(있는 칸의 뜻을 바꾸면
 * 옛 행의 값이 조용히 거짓이 된다).
 */
const UPDATE_SQL = `
  UPDATE spend_records SET
    ocid = ?, spent_on = ?, category = ?, category_key = ?, item = ?, item_key = ?, form = ?,
    form_item_keys = ?, item_kind = ?, item_kind_key = ?, quantity = ?,
    meso_amount = ?, tariff_meso = ?, point_amount = ?, point_per_100m_meso = ?,
    cash_amount = ?, memo = ?, level_from = ?, level_to = ?
  WHERE id = ?
`

/** 넣을 때와 같은 검증을 탄다. 아니면 그 방어가 수정 쪽에서 반쪽이 된다. */
export async function updateSpendRecord(record: SpendRecord): Promise<void> {
  assertPointRate(record)

  const db = await getBossProfitDb()
  await db.run(UPDATE_SQL, [
    record.ocid,
    record.spentOn,
    ...identityValues(record),
    record.quantity,
    record.mesoAmount,
    record.tariffMeso,
    record.pointAmount,
    record.pointPer100mMeso,
    record.cashAmount,
    record.memo,
    record.levelFrom,
    record.levelTo,
    record.id,
  ])
}

/** 한 건만 지우는 삭제. 대리키라 같은 날 같은 것 두 건 중 하나만 골라 지울 수 있다. */
export async function deleteSpendRecord(id: string): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(`DELETE FROM spend_records WHERE id = ?`, [id])
}

function nullable(value: unknown): number | null {
  return (value as number | null | undefined) ?? null
}

/** 형태별 항목 key 칸. 앱이 쓴 JSON 이라 모양을 되묻지 않는다. */
function parseFormItemKeys(value: unknown): Readonly<Record<string, string>> | null {
  return typeof value === 'string' ? (JSON.parse(value) as Record<string, string>) : null
}

function rowToRecord(row: Record<string, unknown>): SpendRecord {
  return {
    id: row.id as string,
    ocid: (row.ocid as string | null | undefined) ?? null,
    spentOn: row.spent_on as string,
    // key 칸은 DB 를 여는 버전 이관이 옛 행까지 채운다.
    category: row.category_key as SpendCategoryKey,
    item: (row.item as string | null | undefined) ?? null,
    itemKey: (row.item_key as string | null | undefined) ?? null,
    formItemKeys: parseFormItemKeys(row.form_item_keys),
    itemKind: (row.item_kind_key as SpendItemKindKey | null | undefined) ?? null,
    levelFrom: nullable(row.level_from),
    levelTo: nullable(row.level_to),
    quantity: nullable(row.quantity),
    mesoAmount: nullable(row.meso_amount),
    tariffMeso: nullable(row.tariff_meso),
    pointAmount: nullable(row.point_amount),
    pointPer100mMeso: nullable(row.point_per_100m_meso),
    cashAmount: nullable(row.cash_amount),
    memo: (row.memo as string | null | undefined) ?? null,
    recordedAt: row.recorded_at as string,
  }
}

/** 날짜 범위의 기록. **두 끝을 포함**한다. `ocid` 로 거르지 않는 이유는 `income.ts` 와 같다. */

export async function getSpendRecordsBetween(
  fromDateKey: string,
  toDateKey: string,
): Promise<SpendRecord[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(`SELECT * FROM spend_records WHERE spent_on BETWEEN ? AND ?`, [
    fromDateKey,
    toDateKey,
  ])

  return (values ?? []).map((row) => rowToRecord(row as Record<string, unknown>))
}
