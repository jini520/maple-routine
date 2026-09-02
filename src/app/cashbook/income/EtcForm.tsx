/**
 * 「기타」 폼([[ADR-178]] 결정 3) — 갈래 둘에 안 드는 수입.
 *
 * **통화가 서는 자리는 여기 하나**다([[ADR-170]] 정정 15 결정 2) — 아이템 판매는 경매장이라
 * 메소이고 사냥도 메소다. 갈래가 이미 아는 것을 다시 묻지 않는다. 이벤트 보상이 메포·캐시로도
 * 들어오므로 이 갈래만 축이 갈린다.
 *
 * **금액 × 수량**이다([[ADR-202]] 결정 3). 줄 차례가 지출 「기타」와 같아서, 한쪽을 고칠 때
 * 다른 쪽이 눈에 들어온다. 큰 숫자는 그 곱이고 **못 친다**(결정 1).
 */
import { useState } from 'react'
import { View } from 'react-native'

import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { mesoTextOf, mesoValueOf } from '../../../components/organisms/MesoPad/meso-pad'
import { Segment } from '../../../components/molecules/Segment/Segment'
import {
  FREE_CURRENCY_LABELS,
  currencyOfLabel,
  labelOfCurrency,
  unitOfCurrency,
  type FreeCurrency,
} from '../../../lib/cashbook/free-currency'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { AmountInput, FieldRow, QuantityStepper } from '../sheet-fields'
import { CharacterField, SaveRow, type IncomeFormProps } from './form-shared'
import { useSheetSubmit } from './use-sheet-submit'
import { SheetTextInput } from '../../../components/molecules/SheetTextInput/SheetTextInput'

export function EtcForm(
  props: IncomeFormProps & {
    /** 마지막으로 쓴 메소마켓 시세 — 메포로 적을 때의 기본값이다([[ADR-170]] 정정 15). */
    lastPointRate: number | null
  },
): React.JSX.Element {
  const editing = props.editing !== undefined
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  const [name, setName] = useState(props.editing?.item ?? '')
  const [quantity, setQuantity] = useState(props.editing?.quantity ?? 1)
  /**
   * 친 값을 **되짚는다** — `금액 = 저장된 총액 ÷ 수량`([[ADR-202]] 결정 4).
   *
   * `quantity` 가 없던 시절의 행은 `null` 이라 수량 1 로 열리고, 그 행은 총액이 곧 금액이다.
   */
  const [typedText, setTypedText] = useState(() => {
    if (props.editing === undefined) return ''
    const count = props.editing.quantity ?? 1
    const total =
      props.editing.mesoAmount ?? props.editing.pointAmount ?? props.editing.cashAmount ?? 0
    return mesoTextOf(Math.round(total / count))
  })
  /**
   * 수정으로 열 때는 **찬 칸이 통화를 되짚는다**(지출 시트와 같은 방식) — 캐시 칸이 차 있으면
   * 캐시로 열려야 그 값이 안 사라진다.
   */
  const [currency, setCurrency] = useState<FreeCurrency>(
    props.editing?.cashAmount !== undefined && props.editing.cashAmount !== null
      ? 'cash'
      : props.editing?.pointAmount !== undefined && props.editing.pointAmount !== null
        ? 'point'
        : 'meso',
  )
  /** 메포로 적을 때만 쓰는 시세 — 글자로 든다(지출 시트와 같다: 지우는 중간 상태가 있다). */
  const [rateText, setRateText] = useState(
    (props.editing?.pointPer100mMeso ?? props.lastPointRate)?.toString() ?? '',
  )
  const { saving, submit, remove } = useSheetSubmit(props)

  const typed = mesoValueOf(typedText)
  const usesPoint = currency === 'point'
  const rate = /^\d+$/.test(rateText) && Number(rateText) > 0 ? Number(rateText) : null
  /** **언제나 곱한다** — 금액 × 수량([[ADR-202]] 결정 3). 지출 「기타」와 같은 식이다. */
  const amount = typed * quantity
  /** 메포로 적으면 **시세가 있어야** 잰다([[ADR-166]] 정정 2 ④). */
  const canSave = amount > 0 && (!usesPoint || rate !== null)

  return (
    <>
      <CharacterField characters={props.characters} selected={ocid} onSelect={setOcid} />

      <FieldRow label="내용" labelTestID="income-sheet-name-label">
        <SheetTextInput
          value={name}
          onChangeText={setName}
          placeholder="내용"
          className="flex-1 text-right text-sm text-text"
        />
      </FieldRow>

      {/* 통화는 **갈래가 아니라 금액의 축**이라 세그먼트다([[ADR-173]] 결정 3) — 지출 시트의
          그 줄과 같은 모양·같은 자리다([[ADR-170]] 정정 15 결정 2). */}
      <View
        testID="income-sheet-currency"
        className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2"
      >
        <Text className="shrink-0 text-xs text-text-muted">통화</Text>
        <View className="flex-1 flex-row items-center justify-end">
          <Segment
            options={FREE_CURRENCY_LABELS}
            selected={labelOfCurrency(currency)}
            onSelect={(label) => setCurrency(currencyOfLabel(label))}
          />
        </View>
      </View>

      {/* **통화 밑**이다 — 무엇으로 받았는지를 정한 다음에 얼마인지를 친다(지출 시트와 같은 차례). */}
      <FieldRow label="금액">
        <AmountInput testID="income-sheet-unit-price" value={typedText} onChange={setTypedText} />
        {/* 숫자만 있으면 무엇으로 받은 것인지 줄에서 사라진다([[ADR-170]] 정정 14 ④). 이 줄이 묻는
            것은 **얼마인가**라 라벨이 아니라 단위다 — 캐시는 「원」이고 큰 숫자와 같은 말이 된다. */}
        <Text
          testID="income-sheet-unit-price-unit"
          className="ml-1.5 shrink-0 text-xs font-semibold text-text-muted"
        >
          {unitOfCurrency(currency)}
        </Text>
      </FieldRow>

      {/* 「기타」가 세는 것은 «몇 회» 라 **스테퍼 그대로**다([[ADR-173]] 결정 18). */}
      <FieldRow label="수량">
        <QuantityStepper value={quantity} onChange={setQuantity} testID="income-sheet-quantity" />
      </FieldRow>

      {usesPoint && (
        // 메포를 메소 축으로 옮기는 값 — **1억 메소당 메포**다([[ADR-166]] 정정 2 ④).
        <View className="min-h-7 flex-row items-center gap-2 border-b border-border pb-2">
          <Text className="shrink-0 text-xs text-text-muted">
            시세 · 1억당
            <Text testID="income-sheet-required" className="text-error-ink">
              {' *'}
            </Text>
          </Text>
          <View className="flex-1 flex-row items-center justify-end">
            <SheetTextInput
              testID="income-sheet-rate"
              value={rateText}
              onChangeText={setRateText}
              keyboardType="number-pad"
              placeholder="메소마켓 시세"
              className={`flex-1 text-right text-sm font-semibold ${
                rate !== null ? 'text-text' : 'text-error-ink'
              }`}
              style={TABULAR_NUMS}
            />
            <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메포</Text>
          </View>
        </View>
      )}

      <AmountFigure
        // **합계이고 못 친다**([[ADR-202]] 결정 1) — 사람이 치는 것은 금액 한 개 값이지 합계가 아니다.
        value={amount}
        /*
         * **단위는 고른 통화**다([[ADR-170]] 정정 15) — 캐시는 「원」이다(실제로 받는 돈이 원이라
         * 지출 시트가 그렇게 적고, 같은 값을 두 시트가 다르게 적을 이유가 없다).
         */
        unit={unitOfCurrency(currency)}
        testID="income-sheet-amount"
        /*
         * 힌트가 말하는 것도 통화를 따른다: 메소는 억/만, 메포는 **메소로 얼마인가**(그 값이
         * 합계에 드는 값이다), 캐시는 **안 든다**는 사실 자체다([[ADR-166]] 정정 2 ①).
         */
      />

      <SaveRow
        editing={editing}
        canSave={canSave}
        saving={saving}
        onSave={() =>
          void submit({
            ocid,
            earnedOn: props.dateKey,
            category: '기타',
            item: name.trim() === '' ? null : name.trim(),
            // 통화가 갈리는 갈래에서는 **고른 통화의 칸에만** 담는다([[ADR-170]] 정정 15).
            mesoAmount: currency === 'meso' ? amount : null,
            saleFeePercent: null,
            saleFeeMeso: null,
            pointAmount: currency === 'point' ? amount : null,
            pointPer100mMeso: currency === 'point' ? rate : null,
            cashAmount: currency === 'cash' ? amount : null,
            // 곱한 총액만 남기면 수정으로 다시 열 때 되짚을 길이 없다([[ADR-202]] 결정 4).
            quantity,
            hunt: null,
            memo: null,
          })
        }
        onDelete={props.onDelete === undefined ? undefined : () => void remove()}
      />
    </>
  )
}
