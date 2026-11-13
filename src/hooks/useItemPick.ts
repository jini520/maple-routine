/**
 * 아이템 구매 · 판매 폼이 고른 아이템과 친 이름을 함께 드는 훅. 칸은 `app/cashbook/item-pick-field.tsx` 가 그린다.
 */
import { useState } from 'react'

import { catalogEntryOf, type CatalogItem } from '../features/inventory/catalog'
import type { ItemKindKey } from '../lib/cashbook/categories'
import { findItem, withRingLevel } from '../lib/item-catalog'

interface PickedRecord {
  item: string | null
  itemKey: string | null
  itemKind: ItemKindKey | null
  ringLevel?: number
}

/**
 * 고친 기록이 고른 아이템. 목록에서 빠진 아이템도 아이템 표에 있으면 그 이름으로 세운다. 직접 친 이름으로 바뀌면 key 가
 * 지워져 기록이 달라진다.
 */
function pickedOfRecord(record: PickedRecord | undefined): CatalogItem | null {
  if (record?.itemKey == null) return null
  const entry = catalogEntryOf(record.itemKey, record.ringLevel)
  if (entry !== null) return entry
  const item = findItem(record.itemKey)
  if (item === null) return null
  return {
    key: record.itemKey,
    itemKey: record.itemKey,
    name: withRingLevel(item.name, record.ringLevel),
    kind: record.itemKind ?? 'equipment',
    ringLevel: record.ringLevel ?? null,
  }
}

/**
 * 고른 아이템과 친 이름. 목록의 한 줄을 누르면 고른 것이 되고, 고른 이름과 다른 글자를 치면 고른 것이 풀려 친 이름이 된다.
 *
 * @param onKind 아이템을 고를 때 그 아이템의 종류를 받는 폼의 손잡이
 */
export function useItemPick(editing: PickedRecord | undefined, onKind: (kind: ItemKindKey) => void) {
  const [picked, setPicked] = useState<CatalogItem | null>(() => pickedOfRecord(editing))
  const [typed, setTyped] = useState(editing?.itemKey == null ? (editing?.item ?? '') : '')

  function pick(entry: CatalogItem): void {
    setPicked(entry)
    onKind(entry.kind)
  }

  // 줄을 누르면 고르기 다음에 그 줄 이름으로 확인이 온다. 그 이름이면 고른 것을 지킨다.
  function type(text: string): void {
    const trimmed = text.trim()
    setPicked((current) => (current !== null && current.name === trimmed ? current : null))
    setTyped(trimmed)
  }

  /** 칸과 입력 카드에 서는 이름 */
  const name = picked?.name ?? typed
  /** 저장할 품목 칸. 고른 아이템은 key 와 레벨, 친 이름은 이름이다. */
  const fields = {
    item: picked === null && typed !== '' ? typed : null,
    itemKey: picked?.itemKey ?? null,
    ...(picked?.ringLevel == null ? {} : { ringLevel: picked.ringLevel }),
  }
  return { picked, name, pick, type, fields }
}
