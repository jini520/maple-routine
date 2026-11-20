/**
 * 인벤토리 칸의 팝오버 글자가 하는 일. 화면은 저장소를 직접 부르지 않고 여기를 거친다.
 */
import type { FeesValue } from '../../components/organisms/InputCard/InputCard'
import type { BossDropRecord } from '../../storage/boss-drops'
import {
  addInventoryItem,
  deleteInventoryRemaining,
  setInventoryRemaining,
  type NewInventoryItem,
} from '../../storage/inventory'
import { bumpSpendRecordsRevision } from '../../storage/spend'
import {
  excludeDropPriceOf,
  loadDropPriceEntry,
  saveDropPriceOf,
  type DropPriceEntry,
  type DropShare,
} from '../boss-profit/drop-price-store'

/** 보스 드롭을 가격 카드에 올릴 모양으로 읽는다. 분배 처음 값은 가격 입력 화면과 같다. */
export function loadDropForSale(drop: BossDropRecord): Promise<DropPriceEntry> {
  return loadDropPriceEntry(drop)
}

/** 보스 드롭을 판다. 수입은 처치한 날에 든다. 가격 입력 화면에서 매긴 것과 같은 행이다. */
export function sellDrop(drop: BossDropRecord, priceMeso: number, share: DropShare, fees: FeesValue | undefined): Promise<void> {
  return saveDropPriceOf(drop, priceMeso, share, fees)
}

/** 보스 드롭을 `기록 안함` 으로 둔다. 확인을 묻지 않는다. 드롭 기록 시트의 `가격 수정` 에서 되돌릴 수 있다. */
export function skipDrop(drop: BossDropRecord): Promise<void> {
  return excludeDropPriceOf(drop)
}

export function addToInventory(item: NewInventoryItem): Promise<void> {
  return addInventoryItem(item, new Date())
}

/** 그 칸의 남은 개수를 고친다. 판 기록은 그대로다. */
export function editInventoryRemaining(id: string, remaining: number): Promise<void> {
  return setInventoryRemaining(id, remaining, new Date())
}

/** 그 칸에 남은 것을 지운다. 판 · 헥사 강화에 쓴 기록은 그대로다. */
export async function removeInventoryRemaining(id: string): Promise<void> {
  await deleteInventoryRemaining(id, new Date())
  // 이 줄에 보관한 가계부 구매는 보관이 풀려, 그 기록을 보는 가계부 화면도 다시 읽어야 한다.
  bumpSpendRecordsRevision()
}
