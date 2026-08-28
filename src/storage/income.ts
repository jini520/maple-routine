// 손입력 수입 어댑터([[ADR-170]] 결정 1·2).
//
// ## 이 저장소 최초의 대리키 테이블이다
//
// 앞의 넷은 전부 자연키 복합 PK 인데(`ocid|boss|difficulty|period_key` …) 손입력은 **«같은 날 같은
// 것을 두 번» 이 정상**이라 자연키가 성립하지 않는다. 그래서 `INSERT` 에 `ON CONFLICT` 가 없다 —
// 덮어쓸 대상이 애초에 없다.
//
// ## `id` 와 `recordedAt` 은 **호출부가 준다**
//
// `boss-profit.ts` 가 `recordedAt` 을 받는 것과 같은 규약이다. 어댑터가 만들면 `Math.random()` ·
// `Date.now()` 가 이 파일에 들어와 «같은 입력에 같은 SQL» 이 깨지고, 테스트가 값을 못 박을 수 없다.
//
// ## 원천을 적는 칸이 없다
//
// 설계 도중 `source`(`'manual' | 'timer' | 'boss'`)를 두려다 접었다 — **이 테이블에 드는 것은
// 손입력 하나뿐이고, 테이블이 곧 원천**이다([[ADR-170]] 결정 2). 화면의 배지(`보스`·`손입력`)는
// 여러 원천을 읽어 합칠 때 붙는 **뷰 모델의 값**이지 컬럼이 아니다.
import type { FeePercent } from '../lib/item-split'
import { getBossProfitDb } from './sqlite/db'

/**
 * 수입의 갈래([[ADR-170]] 결정 1) — 사용자가 준 둘 + 안전망 하나.
 *
 * 「기타」가 없으면 셋으로 안 잡히는 수입이 **기록 자체를 못 남긴다**(가계부에 구멍이 뚫린다).
 * 넷째가 생기면 여기 한 줄을 더하면 된다 — 늘리는 것은 싸고 **지우는 쪽이 비싸다**(이미 그 갈래로
 * 적힌 행이 갈 곳을 잃는다).
 */
export const INCOME_CATEGORIES = ['아이템 판매', '사냥', '기타'] as const

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]

export interface IncomeRecord {
  id: string
  /** `null` = 계정 단위가 기본이다([[ADR-166]] 결정 3). 고르면 그 캐릭터가 붙는다. */
  ocid: string | null
  /** `'YYYY-MM-DD'` KST. **사용자가 고른 날짜**라 캘린더 칸에 바로 선다. */
  earnedOn: string
  category: IncomeCategory
  /** 판 것 / 사냥터 / 자유. 갈래가 이 칸의 **라벨만** 바꾼다. */
  item: string | null
  /**
   * 메소로 들어온 수입. **통화가 갈리는 갈래(「기타」)에서는 `null` 일 수 있다**([[ADR-170]] 정정 15).
   *
   * 아이템 판매면 **수수료를 뗀 값**이다([[ADR-170]] 정정 9 ⑤) — 집계가 보는 칸이 이것 하나라,
   * 판매 대금을 넣으면 번 적 없는 돈이 수입으로 선다.
   *
   * > 정정 15 이전 행은 **언제나 숫자**다(그때는 수입이 메소뿐이었다). 타입이 `| null` 인 것은
   * > 새 갈래를 위한 자리이고, 읽는 쪽은 `??  0` 으로 접는다(`incomeMesoOf`).
   */
  mesoAmount: number | null
  /**
   * 메포로 들어온 수입 — 이벤트 보상이 그렇다([[ADR-170]] 정정 15).
   *
   * **칸 이름을 지출과 같게 쓴다**(`point_amount`·`point_per_100m_meso`·`cash_amount`) — 그래야
   * 집계가 한 모양으로 접힌다(`incomeMesoOf` 는 `spendMesoOf` 와 같은 식이다).
   */
  pointAmount: number | null
  /** 메소마켓 시세 — 단위는 **1억 메소당 메포**다([[ADR-166]] 정정 2 ④). */
  pointPer100mMeso: number | null
  /** **환산하지 않는다**([[ADR-166]] 정정 2 ①) — 지출과 같은 이유·같은 결과다. */
  cashAmount: number | null
  /** 경매장 수수료율([[ADR-168]] `FeePercent`). `null` = 없음(직거래이거나 정정 9 이전 행). */
  saleFeePercent: FeePercent | null
  /** 뗀 몫. **판매 대금 = `mesoAmount` + 이것** 이다 — 요율만으로는 내림 때문에 역산이 안 된다. */
  saleFeeMeso: number | null
  /**
   * 「사냥」 갈래의 **계산 입력**([[ADR-175]] 결정 9) — 없으면 수정 시트가 못 열린다.
   *
   * 합계(`mesoAmount`)만 남기면 사냥 기록을 다시 열 때 빈 계산기가 서고, 무엇이든 만지는 순간
   * 금액이 덮인다([[ADR-171]] 결정 2 가 걸어 둔 «그 시트가 채워져 열린다» 가 깨진다).
   *
   * **다른 갈래에서는 전부 `null`** 이고, [[ADR-175]] 이전에 적힌 사냥 행도 그렇다 — 그때는
   * 계산기 대신 금액을 직접 치는 옛 모양으로 연다(없는 입력을 지어내지 않는다).
   *
   * 사냥터는 여기가 아니라 `item` 에 **이름 그대로** 들어간다(전역 유일이라 지역이 따라온다).
   */
  hunt: HuntingIncomeDetail | null
  memo: string | null
  recordedAt: string
}

/** 사냥 계산에 쓴 입력 한 벌 — 여섯이 **함께 있거나 함께 없다**. */
export interface HuntingIncomeDetail {
  /**
   * **그때의** 캐릭터 레벨. `null` = 캐릭터를 안 골랐다(페널티 0 — [[ADR-175]] 결정 6).
   *
   * 지금 레벨을 다시 읽지 않는 이유는 캐릭터가 레벨업하기 때문이다 — 그러면 한 달 전 기록의
   * 금액이 열 때마다 달라진다.
   */
  characterLevel: number | null
  /**
   * 젠 한 번에 **놓치는 마릿수**(0~4) — 퍼센트가 아니다([[ADR-175]] 결정 3).
   *
   * 효율 %는 맵마다 다르므로(40마리의 −1 은 98%, 22마리의 −1 은 95%) 퍼센트를 남기면 수정으로
   * 열 때 **어느 조각이었는지 되짚으려고 맵을 거꾸로 풀어야 한다**. 마릿수는 맵과 무관하다.
   */
  missedMobs: number
  /** 켠 메소 획득률 아이템의 id(`lib/hunting-meso.ts` 의 `MESO_BOOSTS`). 빈 배열 = 없음. */
  boosts: string[]
  /** 소재 수 — 하나가 30분이다. */
  sojae: number
  /** 솔 에르다 조각 개수 — 사용자가 직접 넣은 값이다([[ADR-175]] 결정 8). */
  fragments: number
  /** 조각 개당 메소. */
  fragmentPrice: number
}

/**
 * 여섯 칸 ↔ 한 덩어리. **`hunt_efficiency` 가 있으면 계산기로 적힌 행**이다 — 나머지는 0 일 수
 * 있지만(조각을 안 먹은 사냥) 효율은 언제나 세그먼트가 고른 값이 들어간다.
 */
function rowToHunt(row: Record<string, unknown>): HuntingIncomeDetail | null {
  const missed = row.hunt_missed_mobs as number | null | undefined
  if (missed === null || missed === undefined) return null

  const boosts = (row.hunt_boosts as string | null | undefined) ?? ''
  return {
    characterLevel: (row.hunt_character_level as number | null | undefined) ?? null,
    missedMobs: missed,
    boosts: boosts === '' ? [] : boosts.split(','),
    sojae: (row.hunt_sojae as number | null | undefined) ?? 0,
    fragments: (row.hunt_fragments as number | null | undefined) ?? 0,
    fragmentPrice: (row.hunt_fragment_price as number | null | undefined) ?? 0,
  }
}

/** 한 덩어리 → 칸 여섯. 없으면 전부 `null` 이다(다른 갈래의 행이 그렇다). */
function huntToValues(hunt: HuntingIncomeDetail | null): Array<number | string | null> {
  if (hunt === null) return [null, null, null, null, null, null]
  return [
    hunt.characterLevel,
    hunt.missedMobs,
    hunt.boosts.join(','),
    hunt.sojae,
    hunt.fragments,
    hunt.fragmentPrice,
  ]
}

const INSERT_SQL = `
  INSERT INTO income_records
    (id, ocid, earned_on, category, item, meso_amount, sale_fee_percent, sale_fee_meso,
     point_amount, point_per_100m_meso, cash_amount,
     hunt_character_level, hunt_missed_mobs, hunt_boosts, hunt_sojae, hunt_fragments,
     hunt_fragment_price,
     memo, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

export async function insertIncomeRecord(record: IncomeRecord): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(INSERT_SQL, [
    record.id,
    record.ocid,
    record.earnedOn,
    record.category,
    record.item,
    record.mesoAmount,
    record.saleFeePercent,
    record.saleFeeMeso,
    record.pointAmount,
    record.pointPer100mMeso,
    record.cashAmount,
    ...huntToValues(record.hunt),
    record.memo,
    record.recordedAt,
  ])
}

/** 갈아 끼우기 — 지출과 같은 계약이다([[ADR-171]] 결정 4). `recorded_at` 은 SET 에 없다. */
const UPDATE_SQL = `
  UPDATE income_records SET
    ocid = ?, earned_on = ?, category = ?, item = ?, meso_amount = ?,
    sale_fee_percent = ?, sale_fee_meso = ?,
    point_amount = ?, point_per_100m_meso = ?, cash_amount = ?,
    hunt_character_level = ?, hunt_missed_mobs = ?, hunt_boosts = ?, hunt_sojae = ?,
    hunt_fragments = ?, hunt_fragment_price = ?,
    memo = ?
  WHERE id = ?
`

export async function updateIncomeRecord(record: IncomeRecord): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(UPDATE_SQL, [
    record.ocid,
    record.earnedOn,
    record.category,
    record.item,
    record.mesoAmount,
    record.saleFeePercent,
    record.saleFeeMeso,
    record.pointAmount,
    record.pointPer100mMeso,
    record.cashAmount,
    ...huntToValues(record.hunt),
    record.memo,
    record.id,
  ])
}

/** 한 건만 지운다 — 대리키라 «같은 날 같은 것» 두 건 중 하나만 골라 지울 수 있다. */
export async function deleteIncomeRecord(id: string): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(`DELETE FROM income_records WHERE id = ?`, [id])
}

function rowToRecord(row: Record<string, unknown>): IncomeRecord {
  return {
    id: row.id as string,
    // `undefined` 도 `null` 로 접어 호출부가 한 형태만 다루게 한다(`boss-profit.ts` 와 같은 처리).
    ocid: (row.ocid as string | null | undefined) ?? null,
    earnedOn: row.earned_on as string,
    category: row.category as IncomeCategory,
    item: (row.item as string | null | undefined) ?? null,
    mesoAmount: (row.meso_amount as number | null | undefined) ?? null,
    saleFeePercent: (row.sale_fee_percent as FeePercent | null | undefined) ?? null,
    saleFeeMeso: (row.sale_fee_meso as number | null | undefined) ?? null,
    pointAmount: (row.point_amount as number | null | undefined) ?? null,
    pointPer100mMeso: (row.point_per_100m_meso as number | null | undefined) ?? null,
    cashAmount: (row.cash_amount as number | null | undefined) ?? null,
    hunt: rowToHunt(row),
    memo: (row.memo as string | null | undefined) ?? null,
    recordedAt: row.recorded_at as string,
  }
}

/**
 * 날짜 범위의 기록 — **두 끝을 포함**한다. 월간이든 주간이든 부르는 쪽이 범위만 정한다
 * (월간은 그 달의 첫날~마지막 날, 주간은 목요일~수요일 — [[ADR-170]] 결정 10).
 *
 * **`ocid` 로 거르지 않는다.** 가계부는 «내가 번 돈» 이지 «이 캐릭터가 번 돈» 이 아니라
 * ([[ADR-166]] 결정 3) 계정 단위 행과 캐릭터 행이 한 날에 함께 서야 한다.
 */
export async function getIncomeRecordsBetween(
  fromDateKey: string,
  toDateKey: string,
): Promise<IncomeRecord[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT * FROM income_records WHERE earned_on BETWEEN ? AND ?`,
    [fromDateKey, toDateKey],
  )

  return (values ?? []).map((row) => rowToRecord(row as Record<string, unknown>))
}
