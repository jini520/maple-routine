/**
 * 아이템 넣기. 주인(메이플 ID · 월드) → 아이템 → 레벨(특수스킬 반지만) → 수량 차례다. 아이템 칸은 글자를 치는 칸이고, 치는 동안
 * 이름이 맞는 아이템이 종류를 가리지 않고 입력 카드 안 목록에 떠 그중에서 고른다. 종류는 고른 아이템의 종류로 적는다. 목록에 없는
 * 아이템은 넣을 수 없다. 넣은 아이템에는 날짜가 없어 머리에 날짜가 없다.
 */
import { useEffect, useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { Text } from '../../components/atoms'
import { Segment } from '../../components/molecules/Segment/Segment'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { mesoValueOf } from '../../components/organisms/MesoPad/meso-pad'
import { COUNT_QUICK_ADDS } from '../../constants/domain/quick-adds'
import { openInputCard } from '../../features/input-card/store'
import { addToInventory } from '../../features/inventory/actions'
import { catalogMatches, inventoryCatalog, RING_LEVELS, type CatalogItem } from '../../features/inventory/catalog'
import { loadInventoryOwners, type InventoryOwner } from '../../features/inventory/load'
import { useToastStore } from '../../features/toast/store'
import { worldEmblemUrl } from '../../lib/assets/asset-lookup'
import { countsQuantity } from '../../lib/cashbook/categories'
import { naturalAspectStyle } from '../../lib/image-aspect'
import { worldNameOf } from '../../lib/world/worlds'
import { SaveRow } from '../cashbook/income/form-shared'
import { AmountInput, FieldCard, FieldRow, SelectRow } from '../cashbook/sheet-fields'

const ownerKeyOf = (owner: Pick<InventoryOwner, 'accountId' | 'worldKey'>): string => `${owner.accountId}|${owner.worldKey}`

/**
 * 보기 한 줄. 첫 줄은 메이플 ID 이름, 둘째 줄은 월드 아이콘과 그 메이플 ID · 월드의 대표 캐릭터 이름이다. 같은 메이플 ID 라도
 * 월드가 다르면 보기가 따로 서므로, 둘째 줄이 둘을 가른다. 캐릭터 관리의 메이플 ID 줄(`AccountRow`)과 같은 글자다.
 */
function OwnerOption(props: { owner: InventoryOwner; selected: boolean; testID: string }): React.JSX.Element {
  const emblem = worldEmblemUrl(props.owner.worldKey)
  return (
    <View testID={props.testID} className="min-w-0 flex-1 gap-0.5">
      <Text numberOfLines={1} className={`text-sm font-semibold ${props.selected ? 'text-primary-ink' : 'text-text'}`}>
        {props.owner.mapleIdName}
      </Text>
      <View className="flex-row items-center gap-1">
        {emblem !== null && (
          <Image
            accessibilityLabel={worldNameOf(props.owner.worldKey, props.owner.worldKey)}
            source={emblem}
            // 폭은 그림이 정한다. 안 적으면 엠블럼의 고유 폭이 남아 줄 왼쪽이 벌어진다.
            style={naturalAspectStyle(emblem, { height: 17 })}
            resizeMode="contain"
          />
        )}
        <Text numberOfLines={1} className={`min-w-0 flex-1 text-xs ${props.selected ? 'text-primary-ink' : 'text-text-muted'}`}>
          {props.owner.characterName}
        </Text>
      </View>
    </View>
  )
}

/** @param props.catalog 고를 수 있는 아이템. 비우면 서버 아이템 표다 */
export function InventoryAddSheet(props: { onClose: () => void; catalog?: readonly CatalogItem[] }): React.JSX.Element {
  const catalog = props.catalog ?? inventoryCatalog()
  const [owners, setOwners] = useState<readonly InventoryOwner[]>([])
  const [ownerKey, setOwnerKey] = useState<string | null>(null)
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [ringLevel, setRingLevel] = useState<number | null>(null)
  const [quantityText, setQuantityText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadInventoryOwners(new Date()).then(setOwners, () => undefined)
  }, [])

  const owner = owners.find((each) => ownerKeyOf(each) === ownerKey) ?? null
  const counts = item !== null && countsQuantity(item.kind)
  const quantity = counts ? mesoValueOf(quantityText) : 1
  const ringReady = item?.ringLevels !== true || ringLevel !== null
  const canSave = owner !== null && item !== null && quantity > 0 && ringReady

  function pickItem(key: string): void {
    // 아이템이 바뀌면 고른 레벨은 그 아이템의 것이 아니다.
    setItem(catalog.find((each) => each.key === key) ?? null)
    setRingLevel(null)
  }

  function openItemCard(): void {
    openInputCard({
      label: '아이템',
      text: true,
      placeholder: '아이템 명',
      value: item?.name ?? '',
      suggestions: {
        itemsOf: (draft) => catalogMatches(catalog, draft),
        onPick: pickItem,
        pickOnly: true,
      },
      onConfirm: () => undefined,
    })
  }

  async function save(): Promise<void> {
    if (owner === null || item === null) return
    setSaving(true)
    try {
      await addToInventory({
        accountId: owner.accountId,
        worldKey: owner.worldKey,
        itemKey: item.key,
        itemKindKey: item.kind,
        quantity,
        ringLevel: item.ringLevels ? ringLevel : null,
      })
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
            label="메이플 ID · 월드"
            placeholder="메이플 ID · 월드 선택"
            options={owners.map((each) => ({ value: ownerKeyOf(each), label: each.label }))}
            selected={ownerKey}
            onSelect={setOwnerKey}
            renderOption={(option, isSelected) => {
              const owner = owners.find((each) => ownerKeyOf(each) === option.value)
              return owner === undefined ? null : (
                <OwnerOption owner={owner} selected={isSelected} testID={`inventory-add-owner-row-${option.value ?? ''}`} />
              )
            }}
          />
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
          {item?.ringLevels === true && (
            <FieldRow label="레벨" testID="inventory-add-ring-level">
              <Segment
                size="sm"
                options={RING_LEVELS.map(String)}
                selected={ringLevel === null ? null : String(ringLevel)}
                onSelect={(level) => setRingLevel(Number(level))}
              />
            </FieldRow>
          )}
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
