/**
 * 인벤토리 격자의 칸. 미입력 보스 드롭 · 사냥 조각 · 넣은 아이템을 게임 인벤토리처럼 아이템 칸으로 세운다.
 */
import { ITEM_KIND_KEYS, type ItemKindKey } from '../../lib/cashbook/categories'
import type { BossDropRecord } from '../../storage/boss-drops'
import { SOL_ERDA_FRAGMENT_ITEM_KEY, type InventoryItem } from '../../storage/inventory'

interface CellBase {
  itemKey: string
  itemKindKey: ItemKindKey
  /** 칸에 서는 개수 */
  count: number
  /** 칸 오른쪽 위의 얼굴. 보스 드롭은 드롭을 가진 캐릭터, 넣은 아이템은 그 메이플 ID · 월드의 대표 캐릭터 */
  faceOcid: string | null
  /** 칸 왼쪽 위의 경로 글자. 솔 에르다 조각만 `사냥` · `기타` 로 가른다 */
  tag: '사냥' | '기타' | null
}

export type InventoryCell =
  | (CellBase & { kind: 'drop'; drop: BossDropRecord })
  | (CellBase & { kind: 'hunt' })
  | (CellBase & { kind: 'item'; item: InventoryItem })

export type InventoryCellKind = InventoryCell['kind']

/** 팝오버의 글자. 칸에 따라 다르다. */
export function inventoryMenuOf(kind: InventoryCellKind): readonly string[] {
  if (kind === 'drop') return ['판매', '기록 안함']
  if (kind === 'hunt') return ['판매']
  return ['판매', '수정', '삭제']
}

/** 드롭 표의 장비 · 소비는 같은 이름의 가계부 종류로 선다. 고정 드롭은 기타 칸에 선다. */
function dropKindOf(category: BossDropRecord['category']): ItemKindKey {
  if (category === 'equipment') return 'equipment'
  if (category === 'consumable') return 'consumable'
  return 'etc'
}

function itemKindOf(key: string): ItemKindKey {
  return (ITEM_KIND_KEYS as readonly string[]).includes(key) ? (key as ItemKindKey) : 'etc'
}

/**
 * 격자의 칸 차례. 종류는 장비 · 소비 · 기타 · 캐시 차례이고, 같은 종류 안에서는 같은 아이템의 칸이 붙어 선다. 아이템끼리는
 * 처음 나온 차례(보스 드롭 · 사냥 조각 · 넣은 아이템)다.
 *
 * @param input.huntFragments 보유가 1개 이상인 캐릭터의 사냥 조각 합
 * @param input.faceOf 넣은 아이템의 메이플 ID · 월드에 얼굴을 보일 캐릭터
 */
export function buildInventoryCells(input: {
  pendingDrops: readonly BossDropRecord[]
  huntFragments: number
  items: readonly InventoryItem[]
  faceOf: (accountId: string, worldKey: string) => string | null
}): InventoryCell[] {
  const cells: InventoryCell[] = [
    ...input.pendingDrops
      .filter((drop) => drop.itemKey !== null)
      .map(
        (drop): InventoryCell => ({
          kind: 'drop',
          drop,
          itemKey: drop.itemKey!,
          itemKindKey: dropKindOf(drop.category),
          count: drop.quantity,
          faceOcid: drop.ocid,
          tag: null,
        }),
      ),
    ...(input.huntFragments > 0
      ? [
          {
            kind: 'hunt',
            itemKey: SOL_ERDA_FRAGMENT_ITEM_KEY,
            itemKindKey: 'etc',
            count: input.huntFragments,
            faceOcid: null,
            tag: '사냥',
          } satisfies InventoryCell,
        ]
      : []),
    ...input.items
      .filter((item) => item.remaining > 0)
      .map(
        (item): InventoryCell => ({
          kind: 'item',
          item,
          itemKey: item.itemKey,
          itemKindKey: itemKindOf(item.itemKindKey),
          count: item.remaining,
          faceOcid: input.faceOf(item.accountId, item.worldKey),
          tag: item.itemKey === SOL_ERDA_FRAGMENT_ITEM_KEY ? '기타' : null,
        }),
      ),
  ]
  return ITEM_KIND_KEYS.flatMap((kind) => {
    const ofKind = cells.filter((cell) => cell.itemKindKey === kind)
    const keys = [...new Set(ofKind.map((cell) => cell.itemKey))]
    return keys.flatMap((key) => ofKind.filter((cell) => cell.itemKey === key))
  })
}
