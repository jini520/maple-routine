/**
 * 지출 어댑터. 기록은 가계부 기록 표 셋(`cashbook-entries.ts`)에 `entry_type = 'spend'` 로 산다.
 *
 * 화면이 쓰는 모양(`SpendRecord`)은 그대로 두고 여기서 기록 행 · 품목 행과 서로 옮긴다. 에픽던전 리워드는 형태마다
 * 품목 하나이고, 나머지는 품목 하나다. `id` · `recordedAt` 을 호출부가 주는 규약은 `income.ts` 와 같다.
 *
 * 통화 칸이 셋이고 대개 둘은 비어 있다. 아이템 구매 한 건이 메소와 메포를 동시에 쓰기 때문에
 * 한 행 = 한 통화로는 표현이 안 된다.
 */
import type { ItemKindKey, SpendCategoryKey } from '../lib/cashbook/categories'
import {
  assignLegacyEntryAccounts,
  assignOwnerlessEntries,
  deleteEntry,
  insertEntry,
  moveEntriesToOcid,
  moveFragmentUsesToOcid,
  readEntries,
  replaceEntry,
} from './cashbook-entries'
import type { OtherFragmentUse } from './cashbook-entries'
import { spendEntryOf, spendRecordOf } from './cashbook-entry-shape'
import { writeCheckingFragments } from './fragment-ledger'
import { deleteEmptyInventoryRows, inventoryRowForPurchase, linkedInventoryItemOf } from './inventory'
import type { SqliteDbConnection } from './ports'
import { notifyAfterBatch } from './record-revision-batch'
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'

export interface SpendRecord {
  id: string
  /** 기록이 붙은 캐릭터. 메이플 ID 기록과 주인을 모르는 옛 기록은 `null` 이다. */
  ocid: string | null
  /** 기록이 붙은 메이플 ID. 메이플 ID 기록에만 있다. */
  accountId?: string
  /** `'YYYY-MM-DD'` KST. */
  spentOn: string
  /** 갈래 key. */
  category: SpendCategoryKey
  /**
   * 직접 친 이름(`구매 아이템` · `내용`). key 가 있는 기록은 저장하지 않고 읽으면 `null` 이다. 화면은 key 로
   * 참조표를 찾고 못 찾을 때 이 글자를 쓴다.
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
  itemKind: ItemKindKey | null
  /** 심볼 강화 · 헥사 스킬의 강화 전 레벨. 다른 갈래에서는 `null` 이다. */
  levelFrom: number | null
  /** 심볼 강화 · 헥사 스킬의 강화 후 레벨. */
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
   * 메포 지출의 메소마켓 수수료율(%). 메소 · 캐시 지출은 `null` 이다.
   *
   * 요율을 기록마다 박는다. 지금 규칙을 읽을 때 쓰면 요율이 바뀌는 날 지난 메포 지출이 전부 소급해 달라진다.
   */
  mesoMarketFeePercent: number | null
  /**
   * **환산하지 않는다**. 그래서 짝이 되는 환율 칸이 없다. 현금과 게임
   * 재화의 교환비가 실제로 성립하는 경로가 운영정책 위반 거래라, 앱이 그 숫자를 적으면 **그 경로에
   * 값을 매기는 것처럼 읽힌다.** 정확도의 문제가 아니라 무엇을 정상으로 보이게 하는가의 문제다.
   */
  cashAmount: number | null
  /** 헥사 매트릭스 기록의 조각. 다른 갈래는 `null` 이다. */
  hexa: SpendHexa | null
  recordedAt: string
  /** 아이템 구매에서 목록으로 고른 특수스킬 반지의 레벨. 다른 기록은 칸이 없다. */
  ringLevel?: number
  /** 인벤토리에 보관한 아이템 구매가 가리키는 인벤토리 줄. 읽을 때만 채운다. 저장은 `inventoryStore` 로 고른다. */
  inventoryItemId?: string
  /**
   * 아이템 구매를 보관할 메이플 ID · 월드. 있으면 저장할 때 그 주인의 인벤토리 줄을 찾거나 만들어 잇고, 없으면 보관을 푼다. 읽은
   * 기록에는 칸이 없다. 주인을 정하는 캐릭터 정보가 저장 계층 밖에 있어 고르는 쪽이 넘긴다.
   */
  inventoryStore?: { accountId: string; worldKey: string }
}

/**
 * 헥사 강화에 든 조각. 금액은 개당 가격을 곱할 개수(`hexaPricedFragments`) × `fragmentPrice` 를 저장할 때 굳힌다.
 *
 * `activation` 이 참 · 거짓이면 헥사 스탯 기록이고 `null` 이면 헥사 스킬 기록이다. 헥사 스킬은 코어 이름이
 * `itemKey`, 레벨이 `levelFrom` · `levelTo` 다.
 */
export interface SpendHexa {
  fragmentCount: number
  untradableFragmentCount: number
  /** 곱할 개수가 없어 가격을 안 받은 기록은 `null` 이다. */
  fragmentPrice: number | null
  activation: boolean | null
  /** 보관 중인 조각 사용 체크. */
  useStorage: boolean
  /** 보관에서 가져온 몫도 지출로 셀지 고르는 체크. */
  storageAsSpend: boolean
  /** 보관에서 가져온 조각을 캐릭터마다. 보관을 안 쓰면 빈 배열이다. */
  storageUses: readonly { ocid: string; fragments: number }[]
  /** 강화한 캐릭터의 메이플 ID · 월드의 기타 조각에서 가져온 조각. 가져온 것이 없으면 칸이 없다. */
  otherUse?: OtherFragmentUse
}

/**
 * 메포를 썼으면 시세가 있어야 한다는 검사.
 *
 * 화면이 막지만 저장소가 한 번 더 막는 것은 실패의 모양이 나쁘기 때문이다. 시세 없이 저장하면
 * 그 행은 영영 메소로 표시할 수 없는 행이 된다. 0 을 함께 막는 것은 환산이 나눗셈이라서다.
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

/**
 * 지출 기록의 판. 넣기 · 고치기 · 지우기마다 오른다. 이 표를 읽는 쿼리가 판이 오를 때 무효화된다
 * (`features/query/invalidation.ts`). 쓰기 **뒤**에 올린다. 앞에 올리면 무효화된 쿼리가 쓰기 전 값을 읽는다.
 */
let spendRecordsRevision = 0
const revisionListeners = new Set<() => void>()

export function getSpendRecordsRevision(): number {
  return spendRecordsRevision
}

/** 판이 오를 때 부를 함수를 건다. 풀 함수를 돌려준다. `storage/boss-profit` 의 같은 이름 함수와 같은 물건이다. */
export function subscribeSpendRecordsRevision(listener: () => void): () => void {
  revisionListeners.add(listener)
  return () => {
    revisionListeners.delete(listener)
  }
}

/** 판을 올린다. 사냥 기록을 고쳐 헥사 기록이 함께 바뀌면 수입 어댑터도 부른다. */
export function bumpSpendRecordsRevision(): void {
  spendRecordsRevision += 1
  notifyAfterBatch(() => {
    for (const listener of revisionListeners) listener()
  })
}

/**
 * 보관할 아이템 구매면 그 주인의 인벤토리 줄을 찾거나 만들어 기록에 잇는다. 보관하지 않으면 잇지 않는다. 부르는 쪽이 트랜잭션으로
 * 감싼다.
 *
 * @param previousId 고치기 전 그 기록이 가리키던 줄. 같은 주인 · 아이템이면 다시 쓴다
 */
async function withInventoryLink(db: SqliteDbConnection, record: SpendRecord, previousId: string | null): Promise<SpendRecord> {
  const { inventoryItemId: _previous, ...rest } = record
  const store = record.inventoryStore
  if (record.category !== 'item_purchase' || store === undefined || record.itemKey === null) return rest
  const id = await inventoryRowForPurchase(db, {
    ...store,
    itemKey: record.itemKey,
    itemKindKey: record.itemKind ?? 'equipment',
    ringLevel: record.ringLevel ?? null,
    previousId,
    now: new Date(),
  })
  return { ...rest, inventoryItemId: id }
}

/**
 * 조각 장부나 인벤토리를 모자라게 하면 던진다(`FragmentShortageError` · `InventoryShortageError`). 넣기 · 고치기 · 지우기가 모두
 * 같다. 보관한 구매를 고치거나 지워 이미 판 것보다 적어지는 저장도 여기서 되돌아간다.
 */
export async function insertSpendRecord(record: SpendRecord): Promise<void> {
  assertPointRate(record)

  const db = await getBossProfitDb()
  await inTransaction(db, () =>
    writeCheckingFragments(db, async () => {
      await insertEntry(db, spendEntryOf(await withInventoryLink(db, record, null)))
      await deleteEmptyInventoryRows(db)
    }),
  )
  bumpSpendRecordsRevision()
}

/**
 * 갈아 끼우기. **지우고 다시 넣지 않는다**. 지우고 넣으면 `id` 와 저장 시각이 새것이 되어 같은 날 안의 차례가
 * 바뀐다. 넣을 때와 같은 검증을 탄다. 아니면 그 방어가 수정 쪽에서 반쪽이 된다.
 */
export async function updateSpendRecord(record: SpendRecord): Promise<void> {
  assertPointRate(record)

  const db = await getBossProfitDb()
  await inTransaction(db, () =>
    writeCheckingFragments(db, async () => {
      const linked = await withInventoryLink(db, record, await linkedInventoryItemOf(db, record.id))
      await replaceEntry(db, spendEntryOf(linked), new Date())
      await deleteEmptyInventoryRows(db)
    }),
  )
  bumpSpendRecordsRevision()
}

/**
 * 주인을 모르는 옛 지출을 그 넥슨 계정의 하나뿐인 메이플 ID 로 옮긴다. 옮긴 것이 있을 때만 판이 오른다.
 *
 * @param categoryKeys 메이플 ID 를 고를 수 있는 지출 분류
 */
export async function assignLegacySpendAccounts(categoryKeys: readonly SpendCategoryKey[]): Promise<void> {
  const db = await getBossProfitDb()
  if (await assignLegacyEntryAccounts(db, 'spend', categoryKeys)) bumpSpendRecordsRevision()
}

/**
 * 남은 주인 모르는 옛 지출을 대표 캐릭터에게 붙인다. 붙인 것이 있을 때만 판이 오른다.
 *
 * @param categoryKeys 메이플 ID 를 고를 수 있는 지출 분류
 */
export async function assignOwnerlessSpends(
  owner: { ocid: string; accountId: string },
  categoryKeys: readonly SpendCategoryKey[],
): Promise<void> {
  const db = await getBossProfitDb()
  if (await assignOwnerlessEntries(db, 'spend', owner, categoryKeys)) bumpSpendRecordsRevision()
}

/** 월드 리프한 캐릭터의 지출과 그 캐릭터 보관에서 가져간 조각을 새 ocid 로 옮긴다. 옮긴 것이 있을 때만 판이 오른다. */
export async function moveSpendRecordsToOcid(fromOcid: string, toOcid: string): Promise<void> {
  const db = await getBossProfitDb()
  const moved = await inTransaction(db, async () => {
    const entries = await moveEntriesToOcid(db, 'spend', fromOcid, toOcid)
    const uses = await moveFragmentUsesToOcid(db, fromOcid, toOcid)
    return entries || uses
  })
  if (moved) bumpSpendRecordsRevision()
}

/** 한 건만 지우는 삭제. 대리키라 같은 날 같은 것 두 건 중 하나만 골라 지울 수 있다. */
export async function deleteSpendRecord(id: string): Promise<void> {
  const db = await getBossProfitDb()
  await inTransaction(db, () =>
    writeCheckingFragments(db, async () => {
      await deleteEntry(db, id)
      await deleteEmptyInventoryRows(db)
    }),
  )
  bumpSpendRecordsRevision()
}

/** 날짜 범위의 기록. **두 끝을 포함**한다. `ocid` 로 거르지 않는 이유는 `income.ts` 와 같다. */
export async function getSpendRecordsBetween(
  fromDateKey: string,
  toDateKey: string,
): Promise<SpendRecord[]> {
  const db = await getBossProfitDb()
  const entries = await readEntries(db, `e.entry_type = 'spend' AND e.entry_date BETWEEN ? AND ?`, [
    fromDateKey,
    toDateKey,
  ])
  return entries.map(spendRecordOf)
}

/**
 * 그 캐릭터 · 갈래 · 대상(심볼 key · 코어 이름)의 가장 최근 지출. 날짜가 같으면 늦게 저장한 것이다.
 * 강화 레벨 기억을 고칠지 가를 때 쓴다. 가장 최근 기록을 고치거나 지울 때만 기억이 따라 바뀐다.
 */
export async function getLatestSpendFor(
  ocid: string,
  category: SpendCategoryKey,
  itemKey: string,
): Promise<SpendRecord | null> {
  const db = await getBossProfitDb()
  const entries = await readEntries(
    db,
    `e.entry_type = 'spend' AND e.ocid = ? AND e.category_key = ?
      AND e.id IN (SELECT entry_id FROM cashbook_entry_items WHERE item_key = ?)`,
    [ocid, category, itemKey],
  )
  const last = entries.at(-1)
  return last === undefined ? null : spendRecordOf(last)
}
