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
import { deleteEntry, insertEntry, readEntries, replaceEntry } from './cashbook-entries'
import { spendEntryOf, spendRecordOf } from './cashbook-entry-shape'
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'

export interface SpendRecord {
  id: string
  /** `null` = 계정 단위가 기본. */
  ocid: string | null
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

/** 지출 기록의 판. 넣기 · 고치기 · 지우기마다 오른다. 통계 화면이 가계부 시트의 쓰기를 알려고 본다 */
let spendRecordsRevision = 0

export function getSpendRecordsRevision(): number {
  return spendRecordsRevision
}

export async function insertSpendRecord(record: SpendRecord, nexonAccountId: string | null = null): Promise<void> {
  spendRecordsRevision += 1
  assertPointRate(record)

  const db = await getBossProfitDb()
  await inTransaction(db, () => insertEntry(db, spendEntryOf(record), nexonAccountId))
}

/**
 * 갈아 끼우기. **지우고 다시 넣지 않는다**. 지우고 넣으면 `id` 와 저장 시각이 새것이 되어 같은 날 안의 차례가
 * 바뀐다. 넣을 때와 같은 검증을 탄다. 아니면 그 방어가 수정 쪽에서 반쪽이 된다.
 */
export async function updateSpendRecord(record: SpendRecord, nexonAccountId: string | null = null): Promise<void> {
  spendRecordsRevision += 1
  assertPointRate(record)

  const db = await getBossProfitDb()
  await inTransaction(db, () => replaceEntry(db, spendEntryOf(record), new Date(), nexonAccountId))
}

/** 한 건만 지우는 삭제. 대리키라 같은 날 같은 것 두 건 중 하나만 골라 지울 수 있다. */
export async function deleteSpendRecord(id: string): Promise<void> {
  spendRecordsRevision += 1
  const db = await getBossProfitDb()
  await deleteEntry(db, id)
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
