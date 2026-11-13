/**
 * 아이템 넣기. 주인(메이플 ID · 월드) → 종류 → 아이템 → 수량 차례다. 아이템 칸은 글자를 치는 칸이고, 치는 동안 고른 종류 가운데
 * 이름이 맞는 아이템이 입력 카드 안 목록에 떠 그중에서 고른다. 목록에 없는 아이템은 넣을 수 없다. 넣은 아이템에는 날짜가 없어
 * 머리에 날짜가 없다.
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import { Text } from '../../components/atoms'
import { Segment } from '../../components/molecules/Segment/Segment'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { mesoValueOf } from '../../components/organisms/MesoPad/meso-pad'
import { COUNT_QUICK_ADDS } from '../../constants/domain/quick-adds'
import { openInputCard } from '../../features/input-card/store'
import { addToInventory } from '../../features/inventory/actions'
import { catalogMatches, inventoryCatalog, type CatalogItem } from '../../features/inventory/catalog'
import { loadInventoryOwners, type InventoryOwner } from '../../features/inventory/load'
import { useToastStore } from '../../features/toast/store'
import { countsQuantity, itemKindNameOf, itemKinds, type ItemKindKey } from '../../lib/cashbook/categories'
import { SaveRow } from '../cashbook/income/form-shared'
import { AmountInput, FieldCard, FieldRow, SelectRow } from '../cashbook/sheet-fields'

const ownerKeyOf = (owner: Pick<InventoryOwner, 'accountId' | 'worldKey'>): string => `${owner.accountId}|${owner.worldKey}`

/**
 * @param props.catalog 고를 수 있는 아이템. 비우면 서버 아이템 표다
 */
export function InventoryAddSheet(props: { onClose: () => void; catalog?: readonly CatalogItem[] }): React.JSX.Element {
  const catalog = props.catalog ?? inventoryCatalog()
  const [owners, setOwners] = useState<readonly InventoryOwner[]>([])
  const [ownerKey, setOwnerKey] = useState<string | null>(null)
  const [kind, setKind] = useState<ItemKindKey>('etc')
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [quantityText, setQuantityText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadInventoryOwners().then(setOwners, () => undefined)
  }, [])

  const owner = owners.find((each) => ownerKeyOf(each) === ownerKey) ?? null
  const counts = countsQuantity(kind)
  const quantity = counts ? mesoValueOf(quantityText) : 1
  const canSave = owner !== null && item !== null && quantity > 0

  function selectKind(name: string): void {
    const next = itemKinds().find((each) => each.name === name)?.key
    if (next === undefined || next === kind) return
    // 종류가 바뀌면 고른 아이템이 그 종류가 아니게 된다.
    setKind(next)
    setItem(null)
  }

  function openItemCard(): void {
    openInputCard({
      label: '아이템',
      context: itemKindNameOf(kind),
      text: true,
      placeholder: '아이템 명',
      value: item?.name ?? '',
      suggestions: {
        itemsOf: (draft) => catalogMatches(catalog, kind, draft),
        onPick: (key) => setItem(catalog.find((each) => each.key === key) ?? null),
        pickOnly: true,
      },
      onConfirm: () => undefined,
    })
  }

  async function save(): Promise<void> {
    if (owner === null || item === null) return
    setSaving(true)
    try {
      await addToInventory({ accountId: owner.accountId, worldKey: owner.worldKey, itemKey: item.key, itemKindKey: kind, quantity })
      props.onClose()
    } catch {
      useToastStore.getState().showError('아이템을 넣지 못했습니다')
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      testId="inventory-add-sheet"
      label="아이템 넣기"
      onClose={props.onClose}
      header={<Text className="text-base font-bold text-text">아이템 넣기</Text>}
      footer={<SaveRow editing={false} canSave={canSave && !saving} saving={saving} onSave={() => void save()} />}
    >
      <View className="gap-3 px-4">
        <FieldCard>
          <SelectRow
            testID="inventory-add-owner"
            label="메이플 ID"
            placeholder="메이플 ID 선택"
            options={owners.map((each) => ({ value: ownerKeyOf(each), label: each.label }))}
            selected={ownerKey}
            onSelect={setOwnerKey}
          />
          <FieldRow label="종류" testID="inventory-add-kind">
            <Segment
              size="sm"
              options={itemKinds().map((each) => each.name)}
              selected={itemKindNameOf(kind)}
              onSelect={selectKind}
            />
          </FieldRow>
          <FieldRow label="아이템">
            <Pressable testID="inventory-add-item" role="button" aria-label="아이템" onPress={openItemCard} className="h-5 flex-1">
              <Text
                numberOfLines={1}
                className={`text-right text-sm ${item === null ? 'text-text-disabled' : 'font-semibold text-text'}`}
              >
                {item?.name ?? '아이템 명'}
              </Text>
            </Pressable>
          </FieldRow>
          {counts && (
            <FieldRow label="수량">
              <AmountInput
                testID="inventory-add-quantity"
                label="수량"
                context={item?.name}
                unit="개"
                chips={COUNT_QUICK_ADDS}
                value={quantityText}
                onChange={setQuantityText}
              />
              <Text className="ml-1.5 shrink-0 text-xs text-text-muted">개</Text>
            </FieldRow>
          )}
        </FieldCard>
      </View>
    </BottomSheet>
  )
}
