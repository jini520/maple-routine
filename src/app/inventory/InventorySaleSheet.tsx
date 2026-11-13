/**
 * 넣은 아이템 · 기타 조각의 `판매`. 가계부 `아이템 판매` 와 같은 칸(장비는 판매 대금, 나머지는 단가 × 수량, 수수료)과 판 날짜를
 * 받는다. 칸이 주인 하나의 것이라 판 기록은 그 메이플 ID 로 한 줄이고, 주인은 아이템 블록 안에 흐린 글자로 선다.
 */
import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { Text } from '../../components/atoms'
import { AmountFigure } from '../../components/molecules/AmountFigure/AmountFigure'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { FeeRow } from '../../components/organisms/FeeRow/FeeRow'
import { acceptMesoText, mesoTextOf, mesoValueOf, settleMesoText } from '../../components/organisms/MesoPad/meso-pad'
import { MESO_QUICK_ADDS } from '../../constants/domain/meso-quick-adds'
import { COUNT_QUICK_ADDS } from '../../constants/domain/quick-adds'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { historyFloorDateKey } from '../../features/cashbook/range'
import { recordIncome } from '../../features/cashbook/records'
import { openInputCard } from '../../features/input-card/store'
import type { InventoryCell } from '../../features/inventory/cells'
import { inventoryItemIconOf, inventoryItemNameOf } from '../../features/inventory/item-look'
import { useToastStore } from '../../features/toast/store'
import { netProceedsMeso } from '../../lib/cashbook/item-split'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { useSaleFeeChoice } from '../cashbook/income/sale-fee'
import { SaveRow } from '../cashbook/income/form-shared'
import { AmountInput, FieldCard, FieldRow, SheetDateField } from '../cashbook/sheet-fields'

type ItemCell = Extract<InventoryCell, { kind: 'item' }>

const FRAGMENT_KEY = 'sol_erda_fragment'

/** 아이템 블록. 바꿀 수 없는 아이템 · 주인을 한 덩어리로 모은다. 오른쪽에 남은 개수가 선다. */
export function InventoryItemBlock(props: {
  cell: ItemCell
  owner: string
  right?: React.ReactNode
  children?: React.ReactNode
}): React.JSX.Element {
  const icon = inventoryItemIconOf(props.cell.itemKey)
  return (
    <View testID="inventory-item-block" className="gap-0.5 rounded-[10px] bg-card-inset px-3 py-2">
      <View className="min-h-[30px] flex-row items-center gap-2.5">
        {icon === null ? (
          <View style={{ width: 26, height: 26 }} />
        ) : (
          <Image source={icon} style={{ width: 26, height: 26 }} resizeMode="contain" aria-hidden />
        )}
        <Text className="shrink text-sm font-semibold text-text">{inventoryItemNameOf(props.cell.itemKey)}</Text>
        {props.right !== undefined && <View className="ml-auto shrink-0">{props.right}</View>}
      </View>
      <View className="min-h-7 flex-row items-center gap-3">
        <Text className="shrink-0 text-xs text-text-muted">메이플 ID</Text>
        <Text className="ml-auto shrink text-right text-sm text-text-muted" numberOfLines={1}>
          {props.owner}
        </Text>
      </View>
      {props.children}
    </View>
  )
}

export function InventorySaleSheet(props: { cell: ItemCell; owner: string; onClose: () => void }): React.JSX.Element {
  const { cell } = props
  const fragment = cell.itemKey === FRAGMENT_KEY
  const equipment = cell.itemKindKey === 'equipment'
  const [todayDateKey] = useState(() => getCurrentKstDateKey(new Date()))
  const [dateKey, setDateKey] = useState(todayDateKey)
  const [priceText, setPriceText] = useState(mesoTextOf(0))
  const [quantityText, setQuantityText] = useState(equipment ? '1' : '')
  const [saving, setSaving] = useState(false)
  // 그 메이플 ID · 월드의 캐릭터 하나로 등급을 찾는다. 등급은 메이플 ID 단위라 어느 캐릭터든 같다.
  const fee = useSaleFeeChoice(undefined, cell.faceOcid, dateKey)

  const quantity = equipment ? 1 : mesoValueOf(quantityText)
  const gross = equipment ? mesoValueOf(priceText) : mesoValueOf(priceText) * quantity
  const net = fee.percent === null ? gross : netProceedsMeso(gross, fee.percent)
  const canSave = gross > 0 && quantity > 0 && quantity <= cell.count && fee.ready
  const priceLabel = equipment ? '판매 대금' : fragment ? '개당 가격' : '단가'
  const countLabel = fragment ? '개수' : '수량'

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await recordIncome(
        {
          ocid: null,
          accountId: cell.item.accountId,
          earnedOn: dateKey,
          category: 'item_sale',
          item: null,
          itemKey: cell.itemKey,
          mesoAmount: net,
          saleFeePercent: fee.percent,
          saleFeeMeso: fee.percent === null ? null : gross - net,
          saleFeeAuto: fee.auto,
          pointAmount: null,
          pointPer100mMeso: null,
          cashAmount: null,
          // 장비 행의 `null` 이 곧 하나를 판 행이다. 가계부 아이템 판매와 같다.
          quantity: equipment ? null : quantity,
          itemKind: cell.itemKindKey,
          hunt: null,
          // 기타 조각은 메이플 ID · 월드마다 모아 세어 조각 사용으로 적는다. 헥사 강화가 가져간 것과 한 표에서 센다.
          ...(fragment
            ? { otherFragmentUse: { accountId: cell.item.accountId, worldKey: cell.item.worldKey, fragments: quantity } }
            : { inventoryItemId: cell.item.id }),
        },
        new Date(),
      )
      props.onClose()
    } catch {
      useToastStore.getState().showError('수입을 적지 못했습니다')
      setSaving(false)
    }
  }

  const priceInput = (
    <Pressable
      testID="inventory-sale-price"
      role="button"
      aria-label={priceLabel}
      onPress={() =>
        openInputCard({
          label: priceLabel,
          context: inventoryItemNameOf(cell.itemKey),
          icon: 'meso',
          unit: '메소',
          reading: true,
          unitKey: 'itemSale',
          chips: MESO_QUICK_ADDS,
          value: priceText,
          onConfirm: (next) => setPriceText(settleMesoText(acceptMesoText(priceText, next))),
        })
      }
      className="h-5 flex-1"
    >
      <Text className="text-right text-sm font-semibold text-text" style={TABULAR_NUMS}>
        {mesoValueOf(priceText).toLocaleString()}
      </Text>
    </Pressable>
  )
  const countInput = (
    <AmountInput
      testID="inventory-sale-quantity"
      label={countLabel}
      context={inventoryItemNameOf(cell.itemKey)}
      unit="개"
      chips={COUNT_QUICK_ADDS}
      value={quantityText}
      onChange={setQuantityText}
    />
  )

  return (
    <BottomSheet
      testId="inventory-sale-sheet"
      label={fragment ? '기타 조각 판매' : '아이템 판매'}
      onClose={props.onClose}
      header={
        <View className="flex-row items-center justify-between gap-2">
          <Text className="shrink text-base font-bold text-text">{fragment ? '기타 조각 판매' : '아이템 판매'}</Text>
          <SheetDateField
            dateKey={dateKey}
            min={historyFloorDateKey(todayDateKey)}
            max={todayDateKey}
            onChange={setDateKey}
            testID="inventory-sale-date"
          />
        </View>
      }
      footer={<SaveRow editing={false} canSave={canSave && !saving} saving={saving} onSave={() => void save()} />}
    >
      <View className="gap-3 px-4">
        <FieldCard>
          <InventoryItemBlock
            cell={cell}
            owner={props.owner}
            right={
              <Text className="text-xs text-text-muted" style={TABULAR_NUMS}>{`${cell.count.toLocaleString()}개`}</Text>
            }
          >
            {fragment && (
              <>
                <View className="min-h-7 flex-row items-center gap-3">
                  <Text className="shrink-0 text-xs text-text-muted">{priceLabel}</Text>
                  {priceInput}
                  <Text className="-ml-1.5 shrink-0 text-xs text-text-muted">메소</Text>
                </View>
                <View className="min-h-7 flex-row items-center gap-3">
                  <Text className="shrink-0 text-xs text-text-muted">{countLabel}</Text>
                  {countInput}
                  <Text className="-ml-1.5 shrink-0 text-xs text-text-muted">개</Text>
                </View>
              </>
            )}
          </InventoryItemBlock>
          {!fragment && (
            <FieldRow label={priceLabel}>
              {priceInput}
              <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메소</Text>
            </FieldRow>
          )}
          {!fragment && !equipment && (
            <FieldRow label={countLabel}>
              {countInput}
              <Text className="ml-1.5 shrink-0 text-xs text-text-muted">개</Text>
            </FieldRow>
          )}
          <FeeRow testID="inventory-sale-fee" label="수수료" {...fee.row} />
        </FieldCard>
        <AmountFigure value={net} unit="메소" testID="inventory-sale-amount" />
      </View>
    </BottomSheet>
  )
}
