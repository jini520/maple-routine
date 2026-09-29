/**
 * 아이템 판매 폼. 경매장에서 판 것.
 *
 * 이 갈래만 수수료를 뗀다. 경매장이 3% 또는 5% 를 가져가므로 판 값과 번 돈이 다르다. 그래서
 * 치는 자리가 큰 숫자가 아니라 금액 줄이고, 큰 숫자는 못 치는 합계가 된다.
 *
 * 종류가 금액 칸과 수량을 정한다. 아이템 구매와 같은 표이고 수수료는 모든 종류에 선다.
 *
 * | 종류 | 금액 칸 | 수량 |
 * |---|---|---|
 * | 장비 | `판매 대금` | 없다(하나를 판다) |
 * | 소비 · 기타 | `단가` | 단가 × 수량 |
 *
 * 상태가 이 컴포넌트에 매여 있으므로 갈래를 옮기면 함께 사라진다.
 */
import { useState } from 'react'
import { Pressable } from 'react-native'

import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { mesoTextOf, mesoValueOf } from '../../../components/organisms/MesoPad/meso-pad'
import { ChainSelect } from '../../../components/organisms/ChainSelect/ChainSelect'
import { Segment } from '../../../components/molecules/Segment/Segment'
import { FeeRow } from '../../../components/organisms/FeeRow/FeeRow'
import { netProceedsMeso } from '../../../lib/cashbook/item-split'
import { requiredCharacterOptions } from '../character-options'
import { ITEM_KINDS, countsQuantity, itemKindNameOf, type ItemKindKey } from '../../../lib/cashbook/categories'
import { AmountInput, FieldRow } from '../sheet-fields'
import { useSaveSlot, type IncomeFormProps } from './form-shared'
import { useSaleFeeChoice } from './sale-fee'
import { useSheetSubmit } from '../../../hooks/useSheetSubmit'
import { openInputCard } from '../../../features/input-card/store'
import { MESO_QUICK_ADDS } from '../../../constants/domain/meso-quick-adds'
import { COUNT_QUICK_ADDS } from '../../../constants/domain/quick-adds'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { acceptMesoText, settleMesoText } from '../../../components/organisms/MesoPad/meso-pad'

export function ItemSaleForm(props: IncomeFormProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  const [name, setName] = useState(props.editing?.item ?? '')
  /** `null` 은 종류 칸이 생기기 전 행이고 장비다. */
  const [itemKind, setItemKind] = useState<ItemKindKey>(props.editing?.itemKind ?? ITEM_KINDS[0].key)
  const [quantityText, setQuantityText] = useState(mesoTextOf(props.editing?.quantity ?? 1))
  /**
   * 치는 값은 판매 대금(장비)이나 단가(소비 · 기타)다. 행에 남는 것은 수수료를 뗀 합계라 되짚을 때
   * 뗀 몫을 되돌리고 수량으로 나눈다. 요율만 들고 역산하면 내림 때문에 1 메소가 어긋난다.
   */
  const [typedText, setTypedText] = useState(() => {
    if (props.editing === undefined) return mesoTextOf(0)
    const total = (props.editing.mesoAmount ?? 0) + (props.editing.saleFeeMeso ?? 0)
    return mesoTextOf(Math.round(total / (props.editing.quantity ?? 1)))
  })
  const fee = useSaleFeeChoice(props.editing, ocid, props.dateKey)
  const { saving, submit, remove } = useSheetSubmit(props)

  const feePercent = fee.percent
  const counts = countsQuantity(itemKind)
  const quantity = mesoValueOf(quantityText)
  const amountLabel = counts ? '단가' : '판매 대금'
  /** 수수료를 떼기 전 합계. */
  const gross = counts ? mesoValueOf(typedText) * quantity : mesoValueOf(typedText)
  /** 분배 계산기의 계산을 **그대로 부른다**. 수수료 쪽을 내림한다(= 손에 남는 쪽이 커진다). */
  const net = feePercent === null ? gross : netProceedsMeso(gross, feePercent)
  // 요율을 캐릭터가 속한 ID 의 등급에서 찾아 캐릭터를 골라야 저장된다.
  const canSave = gross > 0 && ocid !== null && fee.ready

  /** 종류를 바꾸면 수량은 1 로 돌아가고 친 금액은 남는다. 수량 1 이면 판매 대금과 단가가 같은 값이다. */
  function selectItemKind(name: string): void {
    const next = ITEM_KINDS.find((each) => each.name === name)?.key
    if (next === undefined) return
    setItemKind(next)
    setQuantityText('1')
  }

  useSaveSlot(props.setSave, {
    editing,
    canSave,
    saving,
    onSave: () =>
      void submit({
        ocid,
        earnedOn: props.dateKey,
        category: 'item_sale',
        // 빈 칸은 `null` 이다. 빈 문자열을 넣으면 **적었는데 비어 있다** 와 **안 적었다** 가 같아진다.
        item: name.trim() === '' ? null : name.trim(),
        // 직접 친 이름이라 가리킬 key 가 없다.
        itemKey: null,
        // 수수료를 뗀 값이다. 집계가 보는 칸이 이것 하나다.
        mesoAmount: net,
        saleFeePercent: feePercent,
        saleFeeMeso: feePercent === null ? null : gross - net,
        saleFeeAuto: fee.auto,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        // 곱했을 때만 싣는다. 장비 행의 `null` 이 곧 하나를 판 행이다.
        quantity: counts ? quantity : null,
        itemKind,
        hunt: null,
        memo: null,
      }),
    onDelete: props.onDelete === undefined ? undefined : () => void remove(),
  })

  return (
    <>
      <ChainSelect
        testID="income-sheet-chain"
        steps={[
          {
            name: '캐릭터',
            options: requiredCharacterOptions(props.characters),
            selected: ocid,
            onSelect: setOcid,
          },
        ]}
      />

      <FieldRow label="판매 아이템" labelTestID="income-sheet-name-label">
        {/* 누르면 입력 카드가 글자판으로 받는다. 카드 안에서는 왼쪽 정렬이라 끝 공백이 보인다. */}
        <Pressable
          testID="income-sheet-name"
          role="button"
          aria-label="판매 아이템"
          onPress={() =>
            openInputCard({
              label: '판매 아이템',
              text: true,
              placeholder: '아이템 명',
              value: name,
              onConfirm: setName,
            })
          }
          className="h-5 flex-1"
        >
          <Text
            numberOfLines={1}
            className={`text-right text-sm ${name === '' ? 'text-text-disabled' : 'text-text'}`}
          >
            {name === '' ? '아이템 명' : name}
          </Text>
        </Pressable>
      </FieldRow>

      <FieldRow label="종류" testID="income-sheet-item-kind">
        <Segment
          options={ITEM_KINDS.map((each) => each.name)}
          selected={itemKindNameOf(itemKind)}
          onSelect={selectItemKind}
        />
      </FieldRow>

      {/* 치는 자리는 여기다. 큰 숫자는 합계라 못 친다. 이름 아래에 서는 것은 계산 차례
          그대로이기 때문이다. 무엇을 · 얼마에 · 몇 개 · 몇 % 떼고 → 합계. */}
      <FieldRow label={amountLabel}>
        <Pressable
          testID="income-sheet-gross"
          role="button"
          aria-label={amountLabel}
          onPress={() =>
            openInputCard({
              label: amountLabel,
              context: name === '' ? undefined : name,
              icon: 'meso',
              unit: '메소',
              reading: true,
              chips: MESO_QUICK_ADDS,
              value: typedText,
              onConfirm: (next) => setTypedText(settleMesoText(acceptMesoText(typedText, next))),
            })
          }
          className="h-5 flex-1"
        >
          <Text
            className={`text-right text-sm font-semibold ${
              typedText === '' ? 'text-text-disabled' : 'text-text'
            }`}
            style={TABULAR_NUMS}
          >
            {typedText === '' ? '0' : mesoValueOf(typedText).toLocaleString()}
          </Text>
        </Pressable>
        {/* 큰 숫자는 수수료를 뗀 합계라 이 줄과 축이 같은지 헷갈린다. 둘 다 메소라는 것을
            여기서 말한다. */}
        <Text
          testID="income-sheet-gross-unit"
          className="ml-1.5 shrink-0 text-xs font-semibold text-text-muted"
        >
          메소
        </Text>
      </FieldRow>

      {counts && (
        // 스테퍼가 아니라 치는 칸이다. 아이템 구매의 수량 칸과 같은 모양이다.
        <FieldRow label="수량">
          <AmountInput
            testID="income-sheet-quantity"
            label="수량"
            context={name === '' ? undefined : name}
            unit="개"
            chips={COUNT_QUICK_ADDS}
            value={quantityText}
            onChange={setQuantityText}
          />
          <Text className="ml-1.5 shrink-0 text-xs font-semibold text-text-muted">개</Text>
        </FieldRow>
      )}

      <FeeRow testID="income-sheet-fee" label="수수료" {...fee.row} />

      <AmountFigure
        // 아이템 판매의 큰 숫자는 합계다. 수수료를 뗀 값이고 앱이 세므로 못 친다.
        value={net}
        unit="메소"
        testID="income-sheet-amount"
      />

    </>
  )
}
