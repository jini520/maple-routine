/**
 * 사냥 전리품 판매 폼. 맨 위 `분류` 세그먼트로 조각 · 소비 · 이벤트 칸을 가른다.
 *
 * | 분류 | 아이템 | 치는 것 | 수수료 |
 * |---|---|---|---|
 * | 조각 | 솔 에르다 조각 | 개당 가격 · 개수(보유까지) | 뗀다 |
 * | 소비 | NPC 가격이 정해진 아이템 | 개수 | 없다 |
 * | 이벤트 | 기간 안의 이벤트 아이템 | 아이템마다 개당 가격 · 개수 | 뗀다 |
 *
 * 아이템은 서버 전리품 표가 정한다. 열린 이벤트가 없으면 세그먼트에서 `이벤트` 칸을 뺀다. 고를 수 없는 칸을 흐리게
 * 세워 두면 쓸모없는 칸이 하나 느는 것이라서다.
 *
 * 한 번에 여러 아이템을 치고, 저장은 아이템마다 한 줄이다. 한 줄로 묶으면 통계와 하루 상세에서 아이템별 수익을 못 나눈다.
 * 조각 칸은 옛 조각 정산 그대로 `sol_erda_fragment` 한 줄이다. 수정으로 열면 그 줄의 아이템 하나만 서고 분류 줄이 없다.
 */
import { useState } from 'react'

import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { mesoTextOf, mesoValueOf } from '../../../components/organisms/MesoPad/meso-pad'
import { Segment } from '../../../components/molecules/Segment/Segment'
import { FeeRow } from '../../../components/organisms/FeeRow/FeeRow'
import { COUNT_QUICK_ADDS } from '../../../constants/domain/quick-adds'
import { MESO_QUICK_ADDS } from '../../../constants/domain/meso-quick-adds'
import { cashbookCategoryOf } from '../../../lib/cashbook/categories'
import { findHuntLoot, huntLootOn, type HuntLoot, type HuntLootKind } from '../../../lib/cashbook/hunt-loot'
import { netProceedsMeso } from '../../../lib/cashbook/item-split'
import { HUNT_LOOT_KINDS } from '../../../types/game-data'
import { useSheetSubmit } from '../../../hooks/useSheetSubmit'
import { requiredCharacterOptions } from '../character-options'
import { AmountInput, FieldCard, FieldRow, SelectRow } from '../sheet-fields'
import { FragmentSettleForm, type LoadFragmentStorage } from './FragmentSettleForm'
import { useSaveSlot, type IncomeDraft, type IncomeFormProps } from './form-shared'
import { LootBlock, LootLine, NpcLootRow } from './loot-block'
import { useSaleFeeChoice } from './sale-fee'

const KIND_NAMES: Record<HuntLootKind, string> = { fragment: '조각', consumable: '소비', event: '이벤트' }

export function HuntLootSaleForm(
  props: IncomeFormProps & {
    /** 어느 갈래로 열었나. 솔 에르다 조각이면 조각 칸 하나뿐이다. */
    category: 'sol_erda_fragment' | 'hunt_loot_sale'
    loadFragmentStorage: LoadFragmentStorage
    onSaveMany: (drafts: readonly IncomeDraft[]) => void | Promise<void>
  },
): React.JSX.Element {
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  const [chosen, setChosen] = useState<HuntLootKind | null>(null)

  const editingLoot = props.editing?.category === 'hunt_loot_sale' ? findHuntLoot(props.editing.itemKey) : null
  /** 이 폼에 서는 아이템. 수정은 그 줄의 아이템 하나, 새로 적을 때는 그 날 팔 수 있는 것 전부다. */
  const items: readonly HuntLoot[] = editingLoot !== null ? [editingLoot] : huntLootOn(props.dateKey)
  const kinds: readonly HuntLootKind[] =
    props.category === 'sol_erda_fragment'
      ? ['fragment']
      : HUNT_LOOT_KINDS.filter((kind) => items.some((item) => item.kind === kind))
  /** 날짜를 바꿔 이벤트가 닫히면 고른 칸이 사라진다. 그때는 첫 칸이다. */
  const kind = chosen !== null && kinds.includes(chosen) ? chosen : (kinds[0] ?? 'fragment')

  const head = (
    <>
      <SelectRow
        testID="income-sheet-chain"
        label="캐릭터"
        placeholder="캐릭터 선택"
        options={requiredCharacterOptions(props.characters)}
        selected={ocid}
        onSelect={setOcid}
      />
      {kinds.length > 1 && (
        <FieldRow label="분류" testID="income-sheet-loot-kind">
          <Segment
            size="sm"
            options={kinds}
            selected={kind}
            labelOf={(each) => KIND_NAMES[each]}
            onSelect={setChosen}
          />
        </FieldRow>
      )}
    </>
  )

  if (kind === 'fragment') {
    // 표에 조각 줄이 없으면 갈래 줄의 이름 · 그림을 쓴다. 옛 조각 정산 카드가 그 갈래다.
    const fragment = items.find((item) => item.kind === 'fragment')
    const category = cashbookCategoryOf('income', 'sol_erda_fragment')
    return (
      <FragmentSettleForm
        {...props}
        ocid={ocid}
        head={head}
        iconFile={fragment?.iconFile ?? category?.icon ?? ''}
        name={fragment?.name ?? category?.name ?? ''}
      />
    )
  }
  return (
    <LootForm
      key={kind}
      {...props}
      ocid={ocid}
      head={head}
      items={items.filter((item) => item.kind === kind)}
      auction={kind === 'event'}
    />
  )
}

/** 아이템 하나에 친 값. 소비는 단가를 표가 정해 개수만 든다. */
interface Typed {
  price: string
  count: string
}

/**
 * 소비 · 이벤트 칸. 아이템마다 친 값을 들고, 개수를 친 아이템만 한 줄씩 저장한다.
 *
 * 이벤트(`auction`)는 경매장에 팔아 단가를 치고 수수료를 아이템마다 뗀다. 소비는 NPC 가격이 정해져 개수만 친다.
 */
function LootForm(
  props: IncomeFormProps & {
    ocid: string | null
    head: React.ReactNode
    items: readonly HuntLoot[]
    auction: boolean
    onSaveMany: (drafts: readonly IncomeDraft[]) => void | Promise<void>
  },
): React.JSX.Element {
  const editing = props.editing !== undefined
  const [typed, setTyped] = useState<Record<string, Typed>>(() => {
    const record = props.editing
    if (record === undefined || record.itemKey === null) return {}
    const quantity = record.quantity ?? 0
    // 받은 돈은 수수료를 뗀 값이라 뗀 몫을 더해 단가를 되짚는다.
    const price = quantity <= 0 ? '' : mesoTextOf(Math.round(((record.mesoAmount ?? 0) + (record.saleFeeMeso ?? 0)) / quantity))
    return { [record.itemKey]: { price, count: mesoTextOf(quantity) } }
  })
  const fee = useSaleFeeChoice(props.editing, props.ocid, props.dateKey)
  const { saving, submit, submitMany, remove } = useSheetSubmit(props)

  const feePercent = props.auction ? fee.percent : null
  const lines = props.items.map((item) => {
    const count = mesoValueOf(typed[item.key]?.count ?? '')
    const price = props.auction ? mesoValueOf(typed[item.key]?.price ?? '') : (item.npcPriceMeso ?? 0)
    const gross = count * price
    const net = feePercent === null ? gross : netProceedsMeso(gross, feePercent)
    return { item, count, price, gross, net }
  })
  const counted = lines.filter((line) => line.count > 0)
  const total = counted.reduce((sum, line) => sum + line.net, 0)
  /** 개수를 친 아이템이 하나는 있어야 하고, 그 아이템은 모두 단가가 있어야 한다. */
  const canSave =
    props.ocid !== null &&
    counted.length > 0 &&
    counted.every((line) => line.price > 0) &&
    (!props.auction || fee.ready)

  const drafts = (): IncomeDraft[] =>
    counted.map((line) => ({
      ocid: props.ocid,
      earnedOn: props.dateKey,
      category: 'hunt_loot_sale',
      // 이름은 전리품 표가 key 로 든다.
      item: null,
      itemKey: line.item.key,
      mesoAmount: line.net,
      saleFeePercent: feePercent,
      saleFeeMeso: feePercent === null ? null : line.gross - line.net,
      saleFeeAuto: props.auction && fee.auto,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
      quantity: line.count,
      itemKind: null,
      hunt: null,
    }))

  useSaveSlot(props.setSave, {
    editing,
    canSave,
    saving,
    onSave: () => {
      const all = drafts()
      // 수정은 그 줄 하나다.
      if (editing) {
        if (all[0] !== undefined) void submit(all[0])
        return
      }
      void submitMany(all)
    },
    onDelete: props.onDelete === undefined ? undefined : () => void remove(),
  })

  function type(key: string, field: keyof Typed, value: string): void {
    setTyped((current) => ({ ...current, [key]: { ...(current[key] ?? { price: '', count: '' }), [field]: value } }))
  }

  return (
    <>
      <FieldCard>
        {props.head}

        {props.items.map((item) => {
          const countInput = (
            <AmountInput
              testID={`income-sheet-loot-count-${item.key}`}
              label="개수"
              context={item.name}
              unit="개"
              chips={COUNT_QUICK_ADDS}
              value={typed[item.key]?.count ?? ''}
              onChange={(next) => type(item.key, 'count', next)}
            />
          )
          if (!props.auction) {
            return (
              <NpcLootRow key={item.key} iconFile={item.iconFile} name={item.name} npcPriceMeso={item.npcPriceMeso ?? 0}>
                {countInput}
              </NpcLootRow>
            )
          }
          return (
            <LootBlock key={item.key} iconFile={item.iconFile} name={item.name}>
              <LootLine label="개당 가격" unit="메소">
                <AmountInput
                  testID={`income-sheet-loot-price-${item.key}`}
                  label="개당 가격"
                  context={item.name}
                  icon="meso"
                  unit="메소"
                  reading
                  chips={MESO_QUICK_ADDS}
                  value={typed[item.key]?.price ?? ''}
                  onChange={(next) => type(item.key, 'price', next)}
                />
              </LootLine>
              <LootLine label="개수" unit="개">
                {countInput}
              </LootLine>
            </LootBlock>
          )
        })}

        {props.auction && <FeeRow testID="income-sheet-fee" label="수수료" {...fee.row} />}
      </FieldCard>

      <AmountFigure value={total} unit="메소" testID="income-sheet-amount" />
    </>
  )
}
