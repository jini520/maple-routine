/**
 * 넣은 아이템의 `수정`. 그 칸에 지금 남은 개수만 고친다. 아이템 · 주인은 바꿀 수 없어 아이템 블록 하나에 모으고 수량 칸만 따로
 * 둔다. 넣은 아이템에는 날짜가 없어 머리에 날짜가 없다.
 */
import { useState } from 'react'
import { View } from 'react-native'

import { Text } from '../../components/atoms'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { mesoValueOf } from '../../components/organisms/MesoPad/meso-pad'
import { COUNT_QUICK_ADDS } from '../../constants/domain/quick-adds'
import { editInventoryRemaining } from '../../features/inventory/actions'
import type { InventoryCell } from '../../features/inventory/cells'
import { inventoryItemNameOf } from '../../features/inventory/item-look'
import { useToastStore } from '../../features/toast/store'
import { SaveRow } from '../cashbook/income/form-shared'
import { AmountInput, FieldCard, FieldRow } from '../cashbook/sheet-fields'
import { InventoryItemBlock } from './InventorySaleSheet'

type ItemCell = Extract<InventoryCell, { kind: 'item' }>

export function InventoryEditSheet(props: { cell: ItemCell; owner: string; onClose: () => void }): React.JSX.Element {
  const { cell } = props
  const [quantityText, setQuantityText] = useState(String(cell.count))
  const [saving, setSaving] = useState(false)
  const remaining = mesoValueOf(quantityText)
  // 0 개로 고치는 것은 삭제다. 삭제는 팝오버의 `삭제` 가 확인을 묻고 한다.
  const canSave = remaining > 0 && remaining !== cell.count

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await editInventoryRemaining(cell.item.id, remaining)
      props.onClose()
    } catch {
      useToastStore.getState().showError('아이템을 고치지 못했습니다')
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      testId="inventory-edit-sheet"
      label="아이템 수정"
      onClose={props.onClose}
      header={<Text className="text-base font-bold text-text">아이템 수정</Text>}
      footer={<SaveRow editing canSave={canSave && !saving} saving={saving} onSave={() => void save()} />}
    >
      <View className="gap-3 px-4">
        <FieldCard>
          <InventoryItemBlock cell={cell} owner={props.owner} />
          <FieldRow label="수량">
            <AmountInput
              testID="inventory-edit-quantity"
              label="수량"
              context={inventoryItemNameOf(cell.itemKey)}
              unit="개"
              chips={COUNT_QUICK_ADDS}
              value={quantityText}
              onChange={setQuantityText}
            />
            <Text className="ml-1.5 shrink-0 text-xs text-text-muted">개</Text>
          </FieldRow>
        </FieldCard>
      </View>
    </BottomSheet>
  )
}
