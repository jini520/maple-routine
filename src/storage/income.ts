/**
 * 손입력 수입 어댑터. 기록은 가계부 기록 표 셋(`cashbook-entries.ts`)에 `entry_type = 'income'` 으로 산다. 수입은
 * 품목 하나이고, 사냥의 계산 입력은 사냥 입력 표에 따로 든다. 화면이 쓰는 모양(`IncomeRecord`)은 그대로다.
 *
 * 손입력은 같은 날 같은 것을 두 번이 정상이라 자연키가 성립하지 않는다. 기록마다 uuid 하나다.
 *
 * **`id` 와 `recordedAt` 은 호출부가 준다.** 어댑터가 만들면 `Math.random()` · `Date.now()` 가 이
 * 파일에 들어와 같은 입력에 같은 SQL 이 깨지고, 테스트가 값을 못 박을 수 없다.
 *
 * 원천을 적는 칸이 없다. 이 테이블에 드는 것은 손입력 하나뿐이고 **테이블이 곧 원천**이다. 화면의
 * 배지는 여러 원천을 읽어 합칠 때 붙는 뷰 모델의 값이지 컬럼이 아니다.
 */
import type { IncomeCategoryKey, ItemKindKey } from '../lib/cashbook/categories'
import type { UnionTier } from '../lib/cashbook/hunting-meso'
import type { FeePercent } from '../lib/cashbook/item-split'
import {
  assignLegacyEntryAccounts,
  assignOwnerlessEntries,
  deleteEntry,
  insertEntry,
  moveEntriesToOcid,
  readEntries,
  replaceEntry,
} from './cashbook-entries'
import { availableFragmentsOn } from '../lib/cashbook/fragment-ledger'
import type { OtherFragmentUse } from './cashbook-entries'
import { incomeEntryOf, incomeRecordOf } from './cashbook-entry-shape'
import { readFragmentMoves, writeCheckingFragments } from './fragment-ledger'
import { moveHexaAfterWrite, type HexaSources } from './fragment-moves'
import type { SqliteDbConnection } from './ports'
import { notifyAfterBatch } from './record-revision-batch'
import { bumpSpendRecordsRevision } from './spend'
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'

export interface IncomeRecord {
  id: string
  /** 기록이 붙은 캐릭터. 메이플 ID 기록과 주인을 모르는 옛 기록은 `null` 이다. */
  ocid: string | null
  /** 기록이 붙은 메이플 ID. 메이플 ID 기록에만 있다. */
  accountId?: string
  /** `'YYYY-MM-DD'` KST. **사용자가 고른 날짜**라 캘린더 칸에 바로 선다. */
  earnedOn: string
  /** 갈래 key. */
  category: IncomeCategoryKey
  /** 직접 친 이름(판 것 · 자유). key 가 있는 기록(사냥터)은 저장하지 않고 읽으면 `null` 이다. */
  item: string | null
  /** 사냥 기록의 사냥터 key. 다른 갈래와 사냥터가 없는 사냥 기록은 `null` 이다. */
  itemKey: string | null
  /**
   * 메소로 들어온 수입. 통화가 갈리는 갈래(`기타`)에서는 `null` 일 수 있다.
   *
   * 아이템 판매면 수수료를 뗀 값이다. 집계가 보는 칸이 이것 하나라 판매 대금을 넣으면 번 적
   * 없는 돈이 수입으로 선다.
   *
   * 통화가 갈리기 전에 적힌 행은 언제나 숫자다. 타입이 `| null` 인 것은 새 갈래를 위한
   * 자리이고, 읽는 쪽은 `?? 0` 으로 접는다(`incomeMesoOf`).
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
  /**
   * 아이템 판매의 종류. 다른 갈래는 `null` 이다.
   *
   * 판매 행의 `null` 은 이 칸이 생기기 전 행이고 장비로 연다. 수량이 없어 친 금액이 곧 판매 대금이다.
   */
  itemKind: ItemKindKey | null
  /** 경매장 수수료율(`FeePercent`). `null` = 없음(직거래이거나 수수료 칸이 생기기 전 행). */
  saleFeePercent: FeePercent | null
  /** 뗀 몫. **판매 대금 = `mesoAmount` + 이것** 이다. 요율만으로는 내림 때문에 역산이 안 된다. */
  saleFeeMeso: number | null
  /** 수수료가 등급을 따라가나. 자동인 행은 등급 기록이 바뀔 때 요율 · 뗀 몫 · 받는 돈이 다시 적힌다 */
  saleFeeAuto: boolean
  /**
   * 사냥 갈래를 어떻게 적었나.
   *
   * 합계(`mesoAmount`)만 남기면 사냥 기록을 다시 열 때 빈 시트가 서고 무엇이든 만지는 순간
   * 금액이 덮인다. 그래서 적을 때 쓴 값을 함께 남긴다.
   *
   * 다른 갈래에서는 전부 `null` 이다. 계산기 도입 전에 적힌 사냥 행도 `null` 인데 그 행은
   * 수동 입력으로 연다. 조각이 없어 합계가 곧 획득 메소이고 그것은 지어낸 값이 아니다.
   *
   * 사냥터는 여기가 아니라 `itemKey` 에 들어간다(key 하나로 지역이 따라온다). 수동 입력에는 그
   * 칸이 없어 새 행은 비고, 옛 행의 사냥터는 그대로 들고 간다.
   */
  hunt: HuntingIncomeDetail | null
  recordedAt: string
  /** 인벤토리에서 판 아이템 판매가 가리키는 인벤토리 줄. 가계부에서 적은 판매는 칸이 없다. */
  inventoryItemId?: string
  /** 아이템 판매에서 목록으로 고른 특수스킬 반지의 레벨. 다른 기록은 칸이 없다. */
  ringLevel?: number
  /** 인벤토리에서 판 기타 조각. 판 개수만큼 그 메이플 ID · 월드의 기타 조각에서 가져온다. 다른 기록은 칸이 없다. */
  otherFragmentUse?: OtherFragmentUse
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
  /** 조각 개당 메소. `null` 이면 가격을 안 적었고 조각 값이 합계에 없으며 개수가 그 캐릭터의 보관에 든다. */
  fragmentPrice: number | null
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
  /** 조각 개당 메소. `null` 은 수동 입력과 같은 뜻이다. */
  fragmentPrice: number | null
  /**
   * **그때의** 캐릭터 메소 획득량(%).
   *
   * 캐릭터 레벨을 박아 두는 것과 **같은 이유**다: 장비를 갈아입으므로 지금 값으로 다시 재면
   * 한 달 전 기록의 금액이 열 때마다 달라진다. `0` 은 ** 이전에 적힌 행**이기도 하고
   * (그때는 메획이 계산에 없었다) 메획을 안 두른 캐릭터이기도 하다. 둘 다 곱이 ×1 이라 같다.
   */
  mesoRate: number
  /** 유니온의 부 단계. 칸이 `NULL` 인 옛 행은 3단계다(그동안 사냥 전체에 걸렸다). */
  unionTier: UnionTier
}

/**
 * 수입 기록의 판. 쓰기마다 오른다. 이 표를 읽는 쿼리가 판이 오를 때 무효화된다(`features/query/invalidation.ts`).
 * 쓰기 **뒤**에 올린다. 앞에 올리면 무효화된 쿼리가 쓰기 전 값을 읽는다.
 */
let incomeRecordsRevision = 0
const revisionListeners = new Set<() => void>()

export function getIncomeRecordsRevision(): number {
  return incomeRecordsRevision
}

/** 판이 오를 때 부를 함수를 건다. 풀 함수를 돌려준다. `storage/boss-profit` 의 같은 이름 함수와 같은 물건이다. */
export function subscribeIncomeRecordsRevision(listener: () => void): () => void {
  revisionListeners.add(listener)
  return () => {
    revisionListeners.delete(listener)
  }
}

function bumpIncomeRecordsRevision(): void {
  incomeRecordsRevision += 1
  notifyAfterBatch(() => {
    for (const listener of revisionListeners) listener()
  })
}

/** 조각 장부를 모자라게 하면 던진다(`FragmentShortageError`). 넣기 · 고치기 · 지우기가 모두 같다. */
export async function insertIncomeRecord(record: IncomeRecord): Promise<void> {
  const db = await getBossProfitDb()
  await inTransaction(db, () => writeCheckingFragments(db, () => insertEntry(db, incomeEntryOf(record))))
  bumpIncomeRecordsRevision()
}

/** 여러 건을 한 트랜잭션으로 넣는다. 하나라도 못 넣으면 아무것도 안 남는다. */
export async function insertIncomeRecords(records: readonly IncomeRecord[]): Promise<void> {
  const db = await getBossProfitDb()
  await inTransaction(db, () =>
    writeCheckingFragments(db, async () => {
      for (const record of records) await insertEntry(db, incomeEntryOf(record))
    }),
  )
  bumpIncomeRecordsRevision()
}

/** 수입 기록 하나를 고치거나 지우는 일. */
type IncomeChange = { kind: 'edit'; record: IncomeRecord } | { kind: 'remove'; id: string }

function changedIdOf(change: IncomeChange): string {
  return change.kind === 'edit' ? change.record.id : change.id
}

function writeChange(db: SqliteDbConnection, change: IncomeChange, now: Date): Promise<void> {
  return change.kind === 'edit' ? replaceEntry(db, incomeEntryOf(change.record), now) : deleteEntry(db, change.id)
}

/**
 * 고치기 · 지우기를 쓰고, 옮길 곳을 받았으면 모자라게 된 장부에서 헥사 강화를 다른 보관으로 옮긴다. 옮기고도 모자라면
 * `FragmentShortageError` 를 던지고 아무것도 남기지 않는다.
 *
 * @param sources 사냥 기록만 넘긴다. 정산은 폼이 쓸 수 있는 개수까지만 받으므로, 모자라면 그 저장만 실패한다
 */
async function writeIncomeChange(change: IncomeChange, sources: HexaSources | undefined): Promise<void> {
  const db = await getBossProfitDb()
  const now = new Date()
  const id = changedIdOf(change)
  const moved = await inTransaction(db, () =>
    writeCheckingFragments(
      db,
      () => writeChange(db, change, now),
      sources === undefined ? undefined : (before) => moveHexaAfterWrite(db, [id], before, sources, now),
    ),
  )
  bumpIncomeRecordsRevision()
  if (moved === true) bumpSpendRecordsRevision()
}

/** 갈아 끼우기. 지출과 같은 계약이다. 저장 시각은 그대로다. */
export function updateIncomeRecord(record: IncomeRecord, sources?: HexaSources): Promise<void> {
  return writeIncomeChange({ kind: 'edit', record }, sources)
}

/**
 * 주인을 모르는 옛 수입을 그 넥슨 계정의 하나뿐인 메이플 ID 로 옮긴다. 옮긴 것이 있을 때만 판이 오른다.
 *
 * @param categoryKeys 메이플 ID 를 고를 수 있는 수입 분류
 */
export async function assignLegacyIncomeAccounts(categoryKeys: readonly IncomeCategoryKey[]): Promise<void> {
  const db = await getBossProfitDb()
  if (await assignLegacyEntryAccounts(db, 'income', categoryKeys)) bumpIncomeRecordsRevision()
}

/**
 * 남은 주인 모르는 옛 수입을 대표 캐릭터에게 붙인다. 붙인 것이 있을 때만 판이 오른다.
 *
 * @param categoryKeys 메이플 ID 를 고를 수 있는 수입 분류
 */
export async function assignOwnerlessIncomes(
  owner: { ocid: string; accountId: string },
  categoryKeys: readonly IncomeCategoryKey[],
): Promise<void> {
  const db = await getBossProfitDb()
  if (await assignOwnerlessEntries(db, 'income', owner, categoryKeys)) bumpIncomeRecordsRevision()
}

/** 월드 리프한 캐릭터의 수입을 새 ocid 로 옮긴다. 옮긴 것이 있을 때만 판이 오른다. */
export async function moveIncomeRecordsToOcid(fromOcid: string, toOcid: string): Promise<void> {
  const db = await getBossProfitDb()
  if (await inTransaction(db, () => moveEntriesToOcid(db, 'income', fromOcid, toOcid))) bumpIncomeRecordsRevision()
}

/** 한 건만 지우는 삭제. 대리키라 같은 날 같은 것 두 건 중 하나만 골라 지울 수 있다. */
export function deleteIncomeRecord(id: string, sources?: HexaSources): Promise<void> {
  return writeIncomeChange({ kind: 'remove', id }, sources)
}

const INCOME = `e.entry_type = 'income'`

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
  const entries = await readEntries(db, `${INCOME} AND e.entry_date BETWEEN ? AND ?`, [fromDateKey, toDateKey])
  return entries.map(incomeRecordOf)
}

/** 수수료가 자동인 기록 전부. 등급 기록이 바뀌면 다시 셀 대상이다. */
export async function getAutoFeeIncomeRecords(): Promise<IncomeRecord[]> {
  const db = await getBossProfitDb()
  const entries = await readEntries(
    db,
    `${INCOME} AND EXISTS (SELECT 1 FROM cashbook_entry_items i WHERE i.entry_id = e.id AND i.sale_fee_auto = 1)`,
    [],
  )
  return entries.map(incomeRecordOf)
}

/** 수수료 세 칸을 고쳐 쓰는 한 줄. 받는 돈이 뗀 몫과 함께 가야 합계가 맞는다. */
export interface IncomeSaleFeeUpdate {
  id: string
  mesoAmount: number
  saleFeePercent: FeePercent
  saleFeeMeso: number
}

const UPDATE_FEE_SQL = `UPDATE cashbook_entry_items SET amount_meso = ?, sale_fee_percent = ?, sale_fee_meso = ?`
const OF_INCOME_ENTRY = `WHERE entry_id = ? AND sort_order = 0`

/** 자동 수수료를 다시 셀 때 세 칸만 고쳐 쓴다. 수입은 품목 하나다. 조각 하나가 트랜잭션 하나다. */
export async function updateIncomeSaleFees(updates: readonly IncomeSaleFeeUpdate[]): Promise<void> {
  if (updates.length === 0) return
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    for (const update of updates) {
      await db.run(`${UPDATE_FEE_SQL} ${OF_INCOME_ENTRY}`, [
        update.mesoAmount,
        update.saleFeePercent,
        update.saleFeeMeso,
        update.id,
      ])
    }
  })
  bumpIncomeRecordsRevision()
}

/**
 * 일괄 적용 대상. 수수료가 빈 아이템 판매 · 조각 정산 · 조각 가격을 적은 사냥이다.
 * 저장된 금액이 수수료를 안 뗀 값이라 되짚을 것이 없다.
 */
export async function getBulkFeeIncomeRecords(): Promise<IncomeRecord[]> {
  const db = await getBossProfitDb()
  const entries = await readEntries(
    db,
    `${INCOME}
     AND EXISTS (SELECT 1 FROM cashbook_entry_items i WHERE i.entry_id = e.id AND i.sort_order = 0 AND i.sale_fee_percent IS NULL)
     AND (e.category_key IN ('item_sale', 'sol_erda_fragment')
          OR (e.category_key = 'hunting'
              AND EXISTS (SELECT 1 FROM cashbook_entry_hunt_inputs h WHERE h.entry_id = e.id AND h.fragment_price_meso IS NOT NULL)))`,
    [],
  )
  return entries.map(incomeRecordOf)
}

/** 일괄 적용. 세 칸을 적고 자동으로 바꾼다. 그 뒤 등급 기록을 고치면 함께 다시 센다. 조각 하나가 트랜잭션 하나다. */
export async function applyAutoIncomeSaleFees(updates: readonly IncomeSaleFeeUpdate[]): Promise<void> {
  if (updates.length === 0) return
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    for (const update of updates) {
      await db.run(`${UPDATE_FEE_SQL}, sale_fee_auto = 1 ${OF_INCOME_ENTRY}`, [
        update.mesoAmount,
        update.saleFeePercent,
        update.saleFeeMeso,
        update.id,
      ])
    }
  })
  bumpIncomeRecordsRevision()
}

/**
 * 한 캐릭터가 그 날 쓸 수 있는 솔 에르다 조각. 그 날과 뒤 모든 날의 남은 개수 가운데 가장 작은 값이다. 정산 폼 ·
 * 헥사 폼 · 사냥 전리품 판매의 `보유` 가 모두 이것을 읽는다. 따로 세면 한 폼에서 받은 개수가 다른 폼에서 모자라게 된다.
 *
 * @param ocid 보관이 캐릭터별이라 캐릭터 없는 기록은 안 든다
 * @param dateKey 쓰려는 날
 * @param excludeRecordId 수정 중인 정산 · 헥사 기록. 자기 몫을 빼야 보관을 다 쓴 기록을 열어 저장할 수 있다
 */
export async function getFragmentStorage(ocid: string, dateKey: string, excludeRecordId?: string): Promise<number> {
  const db = await getBossProfitDb()
  const moves = (await readFragmentMoves(db, ocid)).filter((move) => move.entryId !== excludeRecordId)
  return availableFragmentsOn(moves, dateKey)
}

/**
 * 인벤토리의 사냥 조각 칸 개수. 캐릭터마다 그 날 쓸 수 있는 조각을 세어, 1개 이상인 캐릭터만 더한다. 인벤토리는 가진 것을
 * 파는 화면이라 팔 수 없는 마이너스는 더하지 않는다.
 */
export async function getHuntFragmentTotal(dateKey: string): Promise<number> {
  const moves = await readFragmentMoves(await getBossProfitDb())
  const ocids = [...new Set(moves.map((move) => move.ocid))]
  return ocids
    .map((ocid) => availableFragmentsOn(moves.filter((move) => move.ocid === ocid), dateKey))
    .filter((stored) => stored > 0)
    .reduce((sum, stored) => sum + stored, 0)
}
