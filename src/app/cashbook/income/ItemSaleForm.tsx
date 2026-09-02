/**
 * 아이템 판매 폼 — 경매장에서 판 것.
 *
 * 이 갈래만 **수수료를 뗀다** — 경매장이 3% 또는 5% 를 가져가므로 판 값 과
 * 번 돈 이 다르다. 그래서 치는 자리가 큰 숫자가 아니라 **판매 대금** 줄이고, 큰 숫자는 **못 치는
 * 합계**가 된다(과 같은 모양).
 *
 * 상태가 이 컴포넌트에 매여 있으므로 갈래를 옮기면 **함께 사라진다**.
 */
import { useState } from 'react'
import { View } from 'react-native'

import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { mesoTextOf, mesoValueOf } from '../../../components/organisms/MesoPad/meso-pad'
import { Segment } from '../../../components/molecules/Segment/Segment'
import { netProceedsMeso, type FeePercent } from '../../../lib/cashbook/item-split'
import { AmountInput, FieldRow } from '../sheet-fields'
import { CharacterField, SaveRow, type IncomeFormProps } from './form-shared'
import { useSheetSubmit } from './use-sheet-submit'
import { SheetTextInput } from '../../../components/molecules/SheetTextInput/SheetTextInput'

/**
 * 수수료 조각 셋 — **`없음` 이 첫 조각이고 기본값**이다.
 *
 * 3%·5% 만 두면 직거래를 못 적고, 무엇보다 **정정 9 이전에 적힌 행**이 거짓이 된다: 수정 시트가
 * 그 행을 열 때 요율 하나를 억지로 세우면 열기만 해도 금액이 달라진다.
 */
const FEE_OPTIONS = ['없음', '3%', '5%'] as const

type FeeOption = (typeof FEE_OPTIONS)[number]

function feeOptionOf(percent: FeePercent | null): FeeOption {
  return percent === null ? '없음' : (`${percent}%` as FeeOption)
}

function feePercentOf(option: FeeOption): FeePercent | null {
  return option === '없음' ? null : (Number(option.replace('%', '')) as FeePercent)
}

export function ItemSaleForm(props: IncomeFormProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  const [name, setName] = useState(props.editing?.item ?? '')
  /**
   * 치는 값은 **판매 대금**이다 — 행에 남는 것은 수수료를 뗀 값이라, 되짚을 때 뗀 몫을 되돌린다
   * . 요율만 들고 역산하면 내림 때문에 1 메소가 어긋난다.
   */
  const [grossText, setGrossText] = useState(
    mesoTextOf((props.editing?.mesoAmount ?? 0) + (props.editing?.saleFeeMeso ?? 0)),
  )
  const [feePercent, setFeePercent] = useState<FeePercent | null>(
    props.editing?.saleFeePercent ?? null,
  )
  const { saving, submit, remove } = useSheetSubmit(props)

  const gross = mesoValueOf(grossText)
  /** 의 계산을 **그대로 부른다** — 수수료 쪽을 내림한다(= 손에 남는 쪽이 커진다). */
  const net = feePercent === null ? gross : netProceedsMeso(gross, feePercent)
  const canSave = gross > 0

  return (
    <>
      <CharacterField characters={props.characters} selected={ocid} onSelect={setOcid} />

      <FieldRow label="판매 아이템" labelTestID="income-sheet-name-label">
        <SheetTextInput
          value={name}
          onChangeText={setName}
          placeholder="아이템 명"
          className="flex-1 text-right text-sm text-text"
        />
      </FieldRow>

      {/* **치는 자리는 여기**다 — 큰 숫자는 합계라 못 친다. 이름 아래에
          서는 이유는 계산 차례 그대로이기 때문이다: 무엇을 · 얼마에 · 몇 % 떼고 → 합계. */}
      <FieldRow label="판매 대금">
        <AmountInput testID="income-sheet-gross" value={grossText} onChange={setGrossText} />
        {/* 큰 숫자는 **수수료를 뗀 합계**라(정정 9 ④) 이 줄과 축이 같은지 헷갈린다 —
            둘 다 메소라는 것을 여기서 말한다. */}
        <Text
          testID="income-sheet-gross-unit"
          className="ml-1.5 shrink-0 text-xs font-semibold text-text-muted"
        >
          메소
        </Text>
      </FieldRow>

      <View
        testID="income-sheet-fee"
        className="flex-row items-center gap-3 border-b border-border pb-2"
      >
        <Text className="text-xs text-text-muted">수수료</Text>
        <View className="ml-auto">
          <Segment
            options={FEE_OPTIONS}
            selected={feeOptionOf(feePercent)}
            onSelect={(option) => setFeePercent(feePercentOf(option))}
          />
        </View>
      </View>

      <AmountFigure
        // **아이템 판매의 큰 숫자는 합계**다 — 수수료를 뗀 값이고, 앱이
        // 세므로 못 친다.
        value={net}
        unit="메소"
        testID="income-sheet-amount"
      />

      <SaveRow
        editing={editing}
        canSave={canSave}
        saving={saving}
        onSave={() =>
          void submit({
            ocid,
            earnedOn: props.dateKey,
            category: '아이템 판매',
            // 빈 칸은 `null` 이다 — 빈 문자열을 넣으면 **적었는데 비어 있다** 와 **안 적었다** 가 같아진다.
            item: name.trim() === '' ? null : name.trim(),
            // **수수료를 뗀 값**이다(정정 9 ⑤) — 집계가 보는 칸이 이것 하나다.
            mesoAmount: net,
            saleFeePercent: feePercent,
            saleFeeMeso: feePercent === null ? null : gross - net,
            pointAmount: null,
            pointPer100mMeso: null,
            cashAmount: null,
            // 수량은 `기타`만 쓴다.
            quantity: null,
            hunt: null,
            memo: null,
          })
        }
        onDelete={props.onDelete === undefined ? undefined : () => void remove()}
      />
    </>
  )
}
