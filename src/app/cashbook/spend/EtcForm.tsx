/**
 * 「기타」 폼 — 갈래 넷에 안 드는 지출.
 *
 * **캐시는 여기서만 산다** — 통화도 여기서만 고른다. 그리고 **금액
 * × 수량**이다(라벨은) — 세는 것이 «몇 회» 라 수량은 스테퍼 그대로다.
 *
 * **합계는 언제나 메소**다(결정 11) — 캐시만 예외인데, 환산을 안 하므로
 * 그 축에 얹을 값이 없고 그대로 「원」 으로 적는다.
 */
import { useState } from 'react'

import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { mesoTextOf, mesoValueOf } from '../../../components/organisms/MesoPad/meso-pad'
import { Segment } from '../../../components/molecules/Segment/Segment'
import {
  FREE_CURRENCY_LABELS,
  currencyOfLabel,
  labelOfCurrency,
  type FreeCurrency,
} from '../../../lib/cashbook/free-currency'
import { pointToMeso } from '../../../lib/cashbook/spend-catalog'
import { AmountInput, FieldRow, QuantityStepper } from '../sheet-fields'
import {
  CategoryChips,
  CharacterRow,
  RateRow,
  SaveRow,
  SpendHeader,
  type SpendFormProps,
} from './form-shared'
import { useSpendSubmit } from './use-spend-submit'
import { SheetTextInput } from '../../../components/molecules/SheetTextInput/SheetTextInput'

export function EtcForm(props: SpendFormProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  const [name, setName] = useState(props.editing?.item ?? '')
  const [quantity, setQuantity] = useState(props.editing?.quantity ?? 1)
  /** 친 값을 **되짚는다** — `단가 = 저장된 총액 ÷ 수량`. */
  const [typedText, setTypedText] = useState(() => {
    if (props.editing === undefined) return ''
    const count = props.editing.quantity ?? 1
    const total =
      props.editing.mesoAmount ?? props.editing.pointAmount ?? props.editing.cashAmount ?? 0
    return mesoTextOf(Math.round(total / count))
  })
  /** 수정으로 열 때는 **찬 칸이 통화를 되짚는다** — 캐시 칸이 차 있으면 캐시로 열려야 한다. */
  const [currency, setCurrency] = useState<FreeCurrency>(
    props.editing?.cashAmount != null
      ? 'cash'
      : props.editing?.pointAmount != null
        ? 'point'
        : 'meso',
  )
  // 마지막으로 쓴 값으로 시작한다 — 필수 칸이 매번 비어 있으면 입력이 막힌다.
  // 고칠 때는 **그 행의 시세**가 먼저다.
  const [rateText, setRateText] = useState(() => {
    const rate = props.editing?.pointPer100mMeso ?? props.lastPointRate
    return rate === null || rate === undefined ? '' : String(rate)
  })
  const { saving, submit, remove } = useSpendSubmit(props)

  const typed = mesoValueOf(typedText)
  const usesPoint = currency === 'point'
  const typedRate = Number(rateText)
  const rate = usesPoint && rateText !== '' && Number.isFinite(typedRate) ? typedRate : null
  /** **언제나 곱한다** — 금액 × 수량. */
  const amount = typed * quantity
  // 캐시는 **환산하지 않는다** — 그래서 메소 축 합계에 안 든다.
  const totalMeso = currency === 'cash' ? 0 : usesPoint ? pointToMeso(amount, rate ?? 0) : amount
  // 메포를 쓰는데 시세가 없으면 **막는다** — 저장하면 영영 메소로 표시할 수 없는 행이 된다.
  const blocked = usesPoint && (rate === null || rate <= 0)
  const canSave = amount > 0 && !blocked

  return (
    <>
      <SpendHeader
        title={editing ? '기타' : '지출 추가'}
        dateKey={props.dateKey}
        onDateChange={props.onDateChange}
      />
      {!editing && (
        <CategoryChips selected={props.category} onSelect={props.onSelectCategory} />
      )}

      <CharacterRow characters={props.characters} selected={ocid} onSelect={setOcid} />

      <FieldRow label="내용" labelTestID="spend-sheet-name-label">
        <SheetTextInput
          testID="spend-sheet-name"
          value={name}
          onChangeText={setName}
          placeholder="내용"
          className="flex-1 text-right text-sm text-text"
        />
      </FieldRow>

      {/* 통화는 **갈래가 아니라 금액의 축**이라 세그먼트다 — 칩으로 두면
          갈래 칩과 한 무리로 읽힌다. */}
      <FieldRow label="통화">
        <Segment
          options={FREE_CURRENCY_LABELS}
          selected={labelOfCurrency(currency)}
          onSelect={(label) => setCurrency(currencyOfLabel(label))}
        />
      </FieldRow>

      {/* **통화 밑**이다 — 무엇으로 내는지를 정한 다음에 얼마인지를 친다. */}
      <FieldRow label="금액">
        <AmountInput testID="spend-sheet-unit-price" value={typedText} onChange={setTypedText} />
        {/* 통화를 고르는 자리라 숫자만 있으면 무엇으로 낸 것인지 줄에서 사라진다
            큰 숫자가 이미 하는 일을 이 줄도 한다. */}
        <Text
          testID="spend-sheet-unit-price-unit"
          className="ml-1.5 shrink-0 text-xs font-semibold text-text-muted"
        >
          {labelOfCurrency(currency)}
        </Text>
      </FieldRow>

      {/* 「기타」가 세는 것은 «몇 회» 라 **스테퍼 그대로**다. */}
      <FieldRow label="수량">
        <QuantityStepper value={quantity} onChange={setQuantity} testID="spend-sheet-quantity" />
      </FieldRow>

      {usesPoint && <RateRow value={rateText} onChange={setRateText} valid={rate !== null} />}

      <AmountFigure
        value={currency === 'cash' ? amount : totalMeso}
        unit={currency === 'cash' ? '원' : '메소'}
        testID="spend-sheet-amount"
      />

      <SaveRow
        showSave
        editing={editing}
        canSave={canSave}
        saving={saving}
        onSave={() =>
          void submit({
            ocid,
            spentOn: props.dateKey,
            category: '기타',
            item: name.trim() === '' ? null : name.trim(),
            form: null,
            itemKind: null,
            quantity,
            mesoAmount: currency === 'meso' ? amount : null,
            tariffMeso: null,
            pointAmount: currency === 'point' ? amount : null,
            pointPer100mMeso: currency === 'point' ? rate : null,
            cashAmount: currency === 'cash' ? amount : null,
            memo: null,
          })
        }
        onDelete={props.onDelete === undefined ? undefined : () => void remove()}
      />
    </>
  )
}
