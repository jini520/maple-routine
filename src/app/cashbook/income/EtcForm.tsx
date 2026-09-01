/**
 * 「기타」 폼([[ADR-178]] 결정 3) — 갈래 둘에 안 드는 수입.
 *
 * **통화가 서는 자리는 여기 하나**다([[ADR-170]] 정정 15 결정 2) — 아이템 판매는 경매장이라
 * 메소이고 사냥도 메소다. 갈래가 이미 아는 것을 다시 묻지 않는다. 이벤트 보상이 메포·캐시로도
 * 들어오므로 이 갈래만 축이 갈린다.
 */
import { useState } from 'react'
import { View } from 'react-native'

import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { Segment } from '../../../components/molecules/Segment/Segment'
import { formatMesoUnits } from '../../../lib/drop-price'
import {
  FREE_CURRENCY_LABELS,
  currencyOfLabel,
  labelOfCurrency,
  unitOfCurrency,
  type FreeCurrency,
} from '../../../lib/free-currency'
import { pointToMeso } from '../../../lib/spend-catalog'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import { nextAmountIdentity } from '../amount-identity'
import { FieldRow } from '../sheet-fields'
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
  const [gross, setGross] = useState(props.editing?.mesoAmount ?? 0)
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
  /**
   * 큰 숫자의 **이름표**([[ADR-087]] 정정 1) — **마운트마다 새로 받는다**.
   *
   * 안 넘기면 `testID` 가 곧 정체가 되는데 그것은 고정 문자열이고, 카운트업의 기억은 모듈 수준이라
   * 시트를 닫아도 남는다(결정 8). 그래서 **다른 기록을 열어도 지난 금액에서 굴러왔다**
   * (사용자 보고 2026-08-29). 갈래를 옮기면 폼이 새로 심기므로([[ADR-178]] 결정 3) 이름표도
   * 함께 새로 발급된다 — «다른 숫자를 보게 된 것» 이 곧 다른 이름표다.
   */
  const [amountIdentity] = useState(nextAmountIdentity)
  const { saving, submit, remove } = useSheetSubmit(props)

  const usesPoint = currency === 'point'
  const rate = /^\d+$/.test(rateText) && Number(rateText) > 0 ? Number(rateText) : null
  /** 메포로 적으면 **시세가 있어야** 잰다([[ADR-166]] 정정 2 ④). */
  const canSave = gross > 0 && (!usesPoint || rate !== null)
  /** 메포를 메소 축으로 옮긴 값 — 큰 숫자 밑 힌트가 이것을 말한다. */
  const pointMeso = usesPoint && rate !== null ? pointToMeso(gross, rate) : 0

  /** 큰 숫자 밑 한 줄 — **0 일 때도 빈 줄로 자리를 지킨다**(사라지면 첫 타건에 아래가 밀린다). */
  const hint =
    currency === 'cash'
      ? '캐시는 메소로 환산하지 않아요'
      : usesPoint
        ? rate === null
          ? '시세를 넣어야 메소로 셀 수 있어요'
          : gross > 0
            ? `${pointMeso.toLocaleString()} 메소`
            : ' '
        : gross > 0
          ? formatMesoUnits(gross)
          : ' '

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
        value={gross}
        /*
         * **단위는 고른 통화**다([[ADR-170]] 정정 15) — 캐시는 「원」이다(실제로 내는 돈이 원이라
         * 지출 시트가 그렇게 적고, 같은 값을 두 시트가 다르게 적을 이유가 없다).
         */
        unit={unitOfCurrency(currency)}
        testID="income-sheet-amount"
        identity={amountIdentity}
        /*
         * 힌트가 말하는 것도 통화를 따른다: 메소는 억/만, 메포는 **메소로 얼마인가**(그 값이
         * 합계에 드는 값이다), 캐시는 **안 든다**는 사실 자체다([[ADR-166]] 정정 2 ①).
         */
        hint={hint}
        hintBlocked={usesPoint && rate === null}
        onChangeValue={setGross}
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
            mesoAmount: currency === 'meso' ? gross : null,
            saleFeePercent: null,
            saleFeeMeso: null,
            pointAmount: currency === 'point' ? gross : null,
            pointPer100mMeso: currency === 'point' ? rate : null,
            cashAmount: currency === 'cash' ? gross : null,
            hunt: null,
            memo: null,
          })
        }
        onDelete={props.onDelete === undefined ? undefined : () => void remove()}
      />
    </>
  )
}
