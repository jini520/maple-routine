// 손입력 수입 어댑터.
//
// ## 이 저장소 최초의 대리키 테이블이다
//
// 앞의 넷은 전부 자연키 복합 PK 인데(`ocid|boss|difficulty|period_key` …) 손입력은 **같은 날 같은
// 것을 두 번 이 정상**이라 자연키가 성립하지 않는다. 그래서 `INSERT` 에 `ON CONFLICT` 가 없다.
// 덮어쓸 대상이 애초에 없다.
//
// ## `id` 와 `recordedAt` 은 **호출부가 준다**
//
// `boss-profit.ts` 가 `recordedAt` 을 받는 것과 같은 규약이다. 어댑터가 만들면 `Math.random()` ·
// `Date.now()` 가 이 파일에 들어와 **같은 입력에 같은 SQL** 이 깨지고, 테스트가 값을 못 박을 수 없다.
//
// ## 원천을 적는 칸이 없다
//
// 설계 도중 `source`(`'manual' | 'timer' | 'boss'`)를 두려다 접었다. **이 테이블에 드는 것은
// 손입력 하나뿐이고, 테이블이 곧 원천**이다. 화면의 배지(`보스`·`손입력`)는
// 여러 원천을 읽어 합칠 때 붙는 **뷰 모델의 값**이지 컬럼이 아니다.
import type { FeePercent } from '../lib/cashbook/item-split'
import { getBossProfitDb } from './sqlite/db'

/**
 * 수입의 갈래. 사용자가 준 둘 + 안전망 하나.
 *
 * 기타가 없으면 셋으로 안 잡히는 수입이 **기록 자체를 못 남긴다**(가계부에 구멍이 뚫린다).
 * 넷째가 생기면 여기 한 줄을 더하면 된다. 늘리는 것은 싸고 **지우는 쪽이 비싸다**(이미 그 갈래로
 * 적힌 행이 갈 곳을 잃는다).
 *
 * **차례가 곧 화면**이다. 시트의 칩이 이 차례로 서고 `[0]` 이 **＋ 수입** 을
 * 열었을 때 골라져 있는 갈래다. 사냥이 앞인 것은 그 갈래가 계산기라 손이 가장
 * 많이 가서이고, 기타는 안전망이라 끝이다. **줄을 옮기면 기본 갈래가 함께 바뀐다.**
 */
export const INCOME_CATEGORIES = ['사냥', '아이템 판매', '기타'] as const

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]

export interface IncomeRecord {
  id: string
  /** `null` = 계정 단위가 기본이다. 고르면 그 캐릭터가 붙는다. */
  ocid: string | null
  /** `'YYYY-MM-DD'` KST. **사용자가 고른 날짜**라 캘린더 칸에 바로 선다. */
  earnedOn: string
  category: IncomeCategory
  /** 판 것 / 사냥터 / 자유. 갈래가 이 칸의 **라벨만** 바꾼다. */
  item: string | null
  /**
   * 메소로 들어온 수입. **통화가 갈리는 갈래(`기타`)에서는 `null` 일 수 있다**.
   *
   * 아이템 판매면 **수수료를 뗀 값**이다. 집계가 보는 칸이 이것 하나라,
   * 판매 대금을 넣으면 번 적 없는 돈이 수입으로 선다.
   *
   * > 정정 15 이전 행은 **언제나 숫자**다(그때는 수입이 메소뿐이었다). 타입이 `| null` 인 것은
   * > 새 갈래를 위한 자리이고, 읽는 쪽은 `??  0` 으로 접는다(`incomeMesoOf`).
   */
  mesoAmount: number | null
  /**
   * 메포로 들어온 수입. 이벤트 보상이 그렇다.
   *
   * **칸 이름을 지출과 같게 쓴다**(`point_amount`·`point_per_100m_meso`·`cash_amount`). 그래야
   * 집계가 한 모양으로 접힌다(`incomeMesoOf` 는 `spendMesoOf` 와 같은 식이다).
   */
  pointAmount: number | null
  /** 메소마켓 시세. 단위는 **1억 메소당 메포**다. */
  pointPer100mMeso: number | null
  /** **환산하지 않는다**. 지출과 같은 이유·같은 결과다. */
  cashAmount: number | null
  /**
   * 몇 회인가. 기타만 쓰고 나머지 갈래는 `null` 이다.
   *
   * 위 세 칸에는 **곱한 총액**이 들어간다. 수량을 안 남기면 수정으로 다시 열 때 되짚을 길이 없어
   * 수량이 1 로 서고 금액 칸에 총액이 들어간다(`금액 = 총액 ÷ 수량` 으로 되짚는다).
   *
   * 이 칸이 없던 시절의 행도 `null` 이고 수량 1 로 열린다. 그 행은 총액이 곧 금액이다.
   */
  quantity: number | null
  /** 경매장 수수료율(`FeePercent`). `null` = 없음(직거래이거나 정정 9 이전 행). */
  saleFeePercent: FeePercent | null
  /** 뗀 몫. **판매 대금 = `mesoAmount` + 이것** 이다. 요율만으로는 내림 때문에 역산이 안 된다. */
  saleFeeMeso: number | null
  /**
   * 사냥 갈래를 **어떻게 적었나**.
   *
   * 합계(`mesoAmount`)만 남기면 사냥 기록을 다시 열 때 빈 시트가 서고, 무엇이든 만지는 순간
   * 금액이 덮인다(가 걸어 둔 계약이 깨진다). 그래서 적을 때 쓴 값을 함께 남긴다.
   *
   * **다른 갈래에서는 전부 `null`** 이다. 이전에 적힌 사냥 행도 `null` 인데, 그 행은
   * 수동 입력으로 연다. 조각이 없어 합계가 곧 획득 메소이고 그것은 지어낸 값이 아니다
   *
   *
   * 사냥터는 여기가 아니라 `item` 에 **이름 그대로** 들어간다(전역 유일이라 지역이 따라온다).
   * 수동 입력에는 그 칸이 없어 새 행은 `item` 이 비고, 옛 행의 이름은 그대로 들고 간다(결정 7).
   */
  hunt: HuntingIncomeDetail | null
  memo: string | null
  recordedAt: string
}

/**
 * 사냥을 적은 두 모양. `mode` 가 어느 쪽인지 말한다.
 *
 * **가르는 이유는 칸이 서로 안 겹쳐서다.** 계산기는 사냥터가 정해져야 도는 값을 들고, 수동은 그
 * 값이 아예 없다. 한 벌로 두면 수동 행에 뜻 없는 0 이 들어가고, 읽는 쪽이 그것을 진짜 값으로
 * 읽는다.
 */
export type HuntingIncomeDetail = HuntingCalculatorDetail | HuntingManualDetail

/** 사냥을 어느 폼으로 적나. 기록에 박히고 수정 중에는 안 바뀐다. */
export type HuntInputMode = HuntingIncomeDetail['mode']

/** 수동으로 적은 사냥. 앱이 셀 근거가 없어 획득 메소를 사람이 친다. */
export interface HuntingManualDetail {
  mode: 'manual'
  /**
   * 사용자가 친 획득 메소. 합계(`mesoAmount`)는 여기에 `fragments × fragmentPrice` 를 더한 값이다.
   *
   * **합계에서 빼서 되돌리지 않고 그대로 저장한다**. 이 저장소가
   * `characterLevel`·`mesoRate` 를 다시 안 재는 것과 같은 이유이고, 되돌리는 길을 고르면 수동인지
   * 아닌지를 가릴 칸이 따로 필요해 결국 두 칸이 된다.
   */
  typedMeso: number
  /** 솔 에르다 조각 개수. 계산기와 같은 값이라 양쪽에 다 있다. */
  fragments: number
  /** 조각 개당 메소. */
  fragmentPrice: number
}

/** 계산기로 적은 사냥. 계산에 쓴 입력 한 벌이고 일곱이 **함께 있거나 함께 없다**. */
export interface HuntingCalculatorDetail {
  mode: 'calculator'
  /**
   * **그때의** 캐릭터 레벨. `null` = 캐릭터를 안 골랐다(페널티 0).
   *
   * 지금 레벨을 다시 읽지 않는 이유는 캐릭터가 레벨업하기 때문이다. 그러면 한 달 전 기록의
   * 금액이 열 때마다 달라진다.
   */
  characterLevel: number | null
  /**
   * 젠 한 번에 **놓치는 마릿수**(0~4). 퍼센트가 아니다.
   *
   * 효율 %는 맵마다 다르므로(40마리의 −1 은 98%, 22마리의 −1 은 95%) 퍼센트를 남기면 수정으로
   * 열 때 **어느 조각이었는지 되짚으려고 맵을 거꾸로 풀어야 한다**. 마릿수는 맵과 무관하다.
   */
  missedMobs: number
  /** 켠 메소 획득률 아이템의 id(`lib/cashbook/hunting-meso.ts` 의 `MESO_BOOSTS`). 빈 배열 = 없음. */
  boosts: string[]
  /** 소재 수. 하나가 30분이다. */
  sojae: number
  /** 솔 에르다 조각 개수. 사용자가 직접 넣은 값이다. */
  fragments: number
  /** 조각 개당 메소. */
  fragmentPrice: number
  /**
   * **그때의** 캐릭터 메소 획득량(%).
   *
   * 캐릭터 레벨을 박아 두는 것과 **같은 이유**다: 장비를 갈아입으므로 지금 값으로 다시 재면
   * 한 달 전 기록의 금액이 열 때마다 달라진다. `0` 은 ** 이전에 적힌 행**이기도 하고
   * (그때는 메획이 계산에 없었다) 메획을 안 두른 캐릭터이기도 하다. 둘 다 곱이 ×1 이라 같다.
   */
  mesoRate: number
}

/** 칸 하나를 숫자로. 없거나 `NULL` 이면 `null` 이다. */
function numberOrNull(value: unknown): number | null {
  return (value as number | null | undefined) ?? null
}

/**
 * 여덟 칸 ↔ 한 덩어리. 어느 모양인지는 **칸 둘이 가른다**.
 *
 * `hunt_typed_meso` 가 있으면 수동이고, 없는데 `hunt_missed_mobs` 가 있으면 계산기다. 둘 다 없으면
 *  이전에 적힌 행이라 `null` 이고, 그 행은 수동 입력 폼이 합계를 그대로 받아 연다.
 *
 * **친 메소가 `0` 이어도 수동이다.** 조각만 먹은 사냥이 그렇다. `0` 과 `NULL` 이 갈리는 자리라
 * `??` 로 접으면 그 행이 계산기 행으로 둔갑한다.
 */
function rowToHunt(row: Record<string, unknown>): HuntingIncomeDetail | null {
  const typedMeso = numberOrNull(row.hunt_typed_meso)
  if (typedMeso !== null) {
    return {
      mode: 'manual',
      typedMeso,
      fragments: numberOrNull(row.hunt_fragments) ?? 0,
      fragmentPrice: numberOrNull(row.hunt_fragment_price) ?? 0,
    }
  }

  const missed = numberOrNull(row.hunt_missed_mobs)
  if (missed === null) return null

  const boosts = (row.hunt_boosts as string | null | undefined) ?? ''
  return {
    mode: 'calculator',
    characterLevel: (row.hunt_character_level as number | null | undefined) ?? null,
    missedMobs: missed,
    boosts: boosts === '' ? [] : boosts.split(','),
    sojae: (row.hunt_sojae as number | null | undefined) ?? 0,
    fragments: (row.hunt_fragments as number | null | undefined) ?? 0,
    fragmentPrice: (row.hunt_fragment_price as number | null | undefined) ?? 0,
    // **`NULL` 은 이전 행**이고 0 으로 읽는다. 없는 값을 지어내면 옛 기록의 금액이
    // 지금 세는 값과 안 맞는다.
    mesoRate: (row.hunt_meso_rate as number | null | undefined) ?? 0,
  }
}

/**
 * 한 덩어리 → 칸 여덟. 없으면 전부 `null` 이다(다른 갈래의 행이 그렇다).
 *
 * **수동 행은 계산기 칸 넷을 비운다**. 0 을 채우면 그 행이 놓친 마릿수 0 으로
 * 센 행 처럼 읽힌다. 비어 있는 것이 곧 앱이 센 값이 아니라는 뜻이다.
 */
function huntToValues(hunt: HuntingIncomeDetail | null): Array<number | string | null> {
  if (hunt === null) return [null, null, null, null, null, null, null, null]
  if (hunt.mode === 'manual') {
    return [null, null, null, null, hunt.fragments, hunt.fragmentPrice, null, hunt.typedMeso]
  }
  return [
    hunt.characterLevel,
    hunt.missedMobs,
    hunt.boosts.join(','),
    hunt.sojae,
    hunt.fragments,
    hunt.fragmentPrice,
    hunt.mesoRate,
    null,
  ]
}

const INSERT_SQL = `
  INSERT INTO income_records
    (id, ocid, earned_on, category, item, meso_amount, sale_fee_percent, sale_fee_meso,
     point_amount, point_per_100m_meso, cash_amount, quantity,
     hunt_character_level, hunt_missed_mobs, hunt_boosts, hunt_sojae, hunt_fragments,
     hunt_fragment_price, hunt_meso_rate, hunt_typed_meso,
     memo, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    record.quantity,
    ...huntToValues(record.hunt),
    record.memo,
    record.recordedAt,
  ])
}

/** 갈아 끼우기. 지출과 같은 계약이다. `recorded_at` 은 SET 에 없다. */
const UPDATE_SQL = `
  UPDATE income_records SET
    ocid = ?, earned_on = ?, category = ?, item = ?, meso_amount = ?,
    sale_fee_percent = ?, sale_fee_meso = ?,
    point_amount = ?, point_per_100m_meso = ?, cash_amount = ?, quantity = ?,
    hunt_character_level = ?, hunt_missed_mobs = ?, hunt_boosts = ?, hunt_sojae = ?,
    hunt_fragments = ?, hunt_fragment_price = ?, hunt_meso_rate = ?, hunt_typed_meso = ?,
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
    record.quantity,
    ...huntToValues(record.hunt),
    record.memo,
    record.id,
  ])
}

/** 한 건만 지운다. 대리키라 같은 날 같은 것 두 건 중 하나만 골라 지울 수 있다. */
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
    quantity: (row.quantity as number | null | undefined) ?? null,
    hunt: rowToHunt(row),
    memo: (row.memo as string | null | undefined) ?? null,
    recordedAt: row.recorded_at as string,
  }
}

/**
 * 날짜 범위의 기록. **두 끝을 포함**한다. 월간이든 주간이든 부르는 쪽이 범위만 정한다
 * (월간은 그 달의 첫날~마지막 날, 주간은 목요일~수요일).
 *
 * **`ocid` 로 거르지 않는다.** 가계부는 내가 번 돈 이지 이 캐릭터가 번 돈 이 아니라
 *  계정 단위 행과 캐릭터 행이 한 날에 함께 서야 한다.
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
