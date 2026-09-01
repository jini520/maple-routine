// 지출 어댑터([[ADR-166]] 결정 10건 + 정정 3 · [[ADR-170]] 결정 2).
//
// 대리키·`ON CONFLICT` 없음·`id`/`recordedAt` 을 호출부가 주는 규약은 `income.ts` 와 같다 —
// 그쪽 파일 머리에 사유를 적어 뒀다.
//
// ## 통화 칸이 셋이고 대개 둘은 비어 있다
//
// 아이템 구매 한 건이 **메소와 메포를 동시에** 쓰기 때문에 «한 행 = 한 통화» 로는 표현이 안 된다
// ([[ADR-166]] 결정 2). 희소 컬럼 셋이 그 대가이고, 대안(여러 행 + group_id)이 «지출 몇 건» 을
// 거짓으로 만드는 것보다 낫다고 봤다.
import { getBossProfitDb } from './sqlite/db'

/**
 * 지출의 갈래([[ADR-166]] 정정 1 ②) — 앞의 셋은 **선택 목록**이고 뒤의 둘은 **직접 입력**이다.
 *
 * 앞의 셋은 `src/data/spend-catalog.json` 의 `categories` 와 **같은 이름이어야 한다**(그 파일이
 * 항목을 그 이름으로 묶는다). 어긋나면 고른 항목의 카테고리와 레코드의 카테고리가 달라져
 * **집계에서 조용히 빠진다** — `__tests__/spend.spec.ts` 가 그 일치를 붙든다.
 */
export const SPEND_CATEGORIES = [
  '컨텐츠',
  // 「상점·편의」 에서 이름이 바뀌었다(사용자 지정 2026-08-27, [[ADR-166]] 정정 4).
  // 기존 기록은 `db.ts` 의 마이그레이션이 옮긴다 — 값 자체가 이름이라 안 옮기면 고아가 된다.
  '이벤트·BM',
  '버프',
  '아이템 구매',
  '기타',
] as const

export type SpendCategory = (typeof SPEND_CATEGORIES)[number]

/**
 * 「아이템 구매」의 종류([[ADR-173]] 정정 1) — **게임의 인벤토리 탭 이름**이다.
 *
 * 「기타」가 `SPEND_CATEGORIES` 의 갈래 이름과 겹치지만 **고치지 않는다**: 사용자가 아는 말이
 * 그것이라 우리가 바꿔 부르면 게임과 갈라진다. 대신 **부르는 말을 나눈다** — 이쪽은 언제나
 * 「종류」이고 타입 이름도 `SpendItemKind` 다.
 */
export const SPEND_ITEM_KINDS = ['장비', '소비', '기타'] as const

export type SpendItemKind = (typeof SPEND_ITEM_KINDS)[number]

/** 수량과 관세가 서는 것은 **장비가 아닐 때**다([[ADR-173]] 정정 1 결정 1) — 판정이 한 자리에 산다. */
export function countsQuantity(kind: SpendItemKind): boolean {
  return kind !== '장비'
}

export interface SpendRecord {
  id: string
  /** `null` = 계정 단위가 기본([[ADR-166]] 결정 3). */
  ocid: string | null
  /** `'YYYY-MM-DD'` KST([[ADR-166]] 결정 4). */
  spentOn: string
  category: SpendCategory
  /** 목록에서 고른 항목 또는 직접 입력한 이름(`구매 아이템` · `내용`). */
  item: string | null
  /**
   * 같은 값을 두 형태로 받는 항목의 **어느 쪽인가** — 에픽던전 리워드의 「경험치」·「솔 에르다」
   * (카탈로그의 `forms`). **가격이 같아서 금액으로는 구분이 안 된다.**
   *
   * 형태가 없는 항목은 `null` 이다. 목록을 카탈로그가 들므로 여기에 **후보를 베끼지 않는다**
   * (베끼면 목록이 바뀔 때 두 벌이 어긋난다 — `quantity` 의 단위 이름과 같은 이유).
   */
  form: string | null
  /**
   * 「아이템 구매」의 **종류**([[ADR-173]] 정정 1) — 게임 인벤토리 탭 이름 그대로다. 이 값 하나가
   * 수량과 관세를 함께 가른다: **장비**는 하나를 사고 관세가 붙으며, **소비·기타**는 여럿을 사고
   * **월드 간 거래가 안 되어 관세가 없다.**
   *
   * `form` 과 갈라 둔 이유는 그 칸이 **카탈로그의 `forms`** 를 뜻하기 때문이다 — 한 칸이 두 뜻을
   * 들면 «지금 이건 어느 쪽이냐» 를 묻는 코드가 생긴다([[ADR-166]] 정정 2 ④ 가 `meso_per_point`
   * 라는 거짓 이름 하나로 겪은 그것이다).
   *
   * **다른 갈래에서는 `null`** 이고, 「아이템 구매」의 `null` 은 **정정 1 이전 행**이라 **장비로
   * 연다** — 그때는 «치는 금액 + 관세» 하나뿐이었고 그것이 정확히 장비의 모양이다.
   */
  itemKind: SpendItemKind | null
  /**
   * 금액 = 카탈로그의 `unitPrice` × 이 값([[ADR-166]] 정정 1 ③). **단위 이름은 안 적는다** —
   * 카탈로그가 항목별로 알고 있어(`unit`) 베끼면 목록이 바뀔 때 두 벌이 어긋난다.
   */
  quantity: number | null
  /**
   * **관세를 포함한 총액**이다([[ADR-166]] 정정 2 ②) — 집계는 이 한 칸만 보면 되므로
   * «관세를 빠뜨려 덜 세는» 사고가 구조적으로 없다.
   */
  mesoAmount: number | null
  /**
   * 위 총액 중 관세분. **집계에 더하지 말 것** — 이미 `mesoAmount` 안에 있다.
   *
   * 요율을 안 박고 읽을 때 나누면 요율이 바뀌는 날 **지난달 관세가 전부 소급해 달라진다**
   * ([[ADR-069]] 결정 1 과 같은 이유). 「10% 고정」은 **지금의** 사실이다.
   */
  tariffMeso: number | null
  /** 메포 원금. 표시는 아래 시세로 환산한 메소다([[ADR-166]] 정정 2 ①). */
  pointAmount: number | null
  /**
   * 메소마켓 시세 — 단위가 **1억 메소당 메포**다([[ADR-166]] 정정 2 ④).
   * 환산은 `메포 × 100,000,000 ÷ 시세` 로 **나눗셈**이다.
   */
  pointPer100mMeso: number | null
  /**
   * **환산하지 않는다**([[ADR-166]] 정정 2 ①) — 그래서 짝이 되는 환율 칸이 없다. 현금과 게임
   * 재화의 교환비가 실제로 성립하는 경로가 운영정책 위반 거래라, 앱이 그 숫자를 적으면 **그 경로에
   * 값을 매기는 것처럼 읽힌다.** 정확도의 문제가 아니라 무엇을 정상으로 보이게 하는가의 문제다.
   */
  cashAmount: number | null
  memo: string | null
  recordedAt: string
}

const INSERT_SQL = `
  INSERT INTO spend_records
    (id, ocid, spent_on, category, item, form, item_kind, quantity,
     meso_amount, tariff_meso, point_amount, point_per_100m_meso, cash_amount,
     memo, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

/**
 * **메포를 썼으면 시세가 있어야 한다**([[ADR-166]] 정정 2 ③).
 *
 * 화면이 막지만 저장소가 한 번 더 막는 이유는 실패의 모양이 나쁘기 때문이다 — 시세 없이 저장하면
 * 그 행은 **영영 메소로 표시할 수 없는 행**이 된다. 결정 5 가 환율을 행에 박으므로 나중에 채울
 * 수도 없고, «메포는 모두 메소로 표기한다» 는 정책이 **그 행에서만** 깨진다.
 *
 * 0 을 함께 막는 이유는 환산이 **나눗셈**이라서다(정정 2 ④).
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
    record.category,
    record.item,
    record.form,
    record.itemKind,
    record.quantity,
    record.mesoAmount,
    record.tariffMeso,
    record.pointAmount,
    record.pointPer100mMeso,
    record.cashAmount,
    record.memo,
    record.recordedAt,
  ])
}

/**
 * 갈아 끼우기 — **지우고 다시 넣지 않는다**([[ADR-171]] 결정 4).
 *
 * 지우고 넣으면 `id` 와 `recorded_at` 이 새것이 되는데, 그 둘은 «언제 적었나» 를 든 칸이라
 * **고친 시각이 적은 시각을 덮어쓴다.** 그래서 `SET` 에 `recorded_at` 이 없다 — 「적은 시각」이지
 * 「마지막으로 만진 시각」이 아니다. 후자가 필요해지면 **칸을 새로 세운다**(있는 칸의 뜻을 바꾸면
 * 옛 행의 값이 조용히 거짓이 된다).
 */
const UPDATE_SQL = `
  UPDATE spend_records SET
    ocid = ?, spent_on = ?, category = ?, item = ?, form = ?, item_kind = ?, quantity = ?,
    meso_amount = ?, tariff_meso = ?, point_amount = ?, point_per_100m_meso = ?,
    cash_amount = ?, memo = ?
  WHERE id = ?
`

/** 넣을 때와 **같은 검증**을 탄다 — 아니면 정정 2 ③ 의 방어가 수정 쪽에서 반쪽이 된다. */
export async function updateSpendRecord(record: SpendRecord): Promise<void> {
  assertPointRate(record)

  const db = await getBossProfitDb()
  await db.run(UPDATE_SQL, [
    record.ocid,
    record.spentOn,
    record.category,
    record.item,
    record.form,
    record.itemKind,
    record.quantity,
    record.mesoAmount,
    record.tariffMeso,
    record.pointAmount,
    record.pointPer100mMeso,
    record.cashAmount,
    record.memo,
    record.id,
  ])
}

/** 한 건만 지운다 — 대리키라 «같은 날 같은 것» 두 건 중 하나만 골라 지울 수 있다. */
export async function deleteSpendRecord(id: string): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(`DELETE FROM spend_records WHERE id = ?`, [id])
}

function nullable(value: unknown): number | null {
  return (value as number | null | undefined) ?? null
}

function rowToRecord(row: Record<string, unknown>): SpendRecord {
  return {
    id: row.id as string,
    ocid: (row.ocid as string | null | undefined) ?? null,
    spentOn: row.spent_on as string,
    category: row.category as SpendCategory,
    item: (row.item as string | null | undefined) ?? null,
    form: (row.form as string | null | undefined) ?? null,
    itemKind: (row.item_kind as SpendItemKind | null | undefined) ?? null,
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

/** 날짜 범위의 기록 — **두 끝을 포함**한다. `ocid` 로 거르지 않는 이유는 `income.ts` 와 같다. */
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
