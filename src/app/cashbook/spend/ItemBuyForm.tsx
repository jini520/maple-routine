/**
 * 「아이템 구매」 폼([[ADR-178]] 결정 3) — **종류가 나머지 둘을 정한다**([[ADR-173]] 정정 1).
 *
 * | 종류 | 수량 | 관세 |
 * |---|---|---|
 * | 장비 | 없다(하나를 산다) — 큰 숫자가 **치는 칸** | 있다 |
 * | 소비 · 기타 | 단가 × 수량 — 큰 숫자가 **못 치는 합계** | **줄 자체가 없다** |
 *
 * 소비·기타에 관세가 없는 이유는 **월드 간 거래가 안 되기 때문**이다 — 있을 수 없는 것을 물을 수
 * 있게 두지 않는다. 통화는 언제나 **메소**다(관세를 메소로 재므로 메포 칸이 없다).
 */
import { useState } from 'react'

import { Text } from '../../../components/atoms/Text/Text'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { parseMesoText } from '../../../components/molecules/MesoPad/meso-pad'
import { Segment } from '../../../components/molecules/Segment/Segment'
import { formatMesoUnits } from '../../../lib/drop-price'
import { SPEND_TARIFF_PERCENT, withTariffMeso } from '../../../lib/spend-catalog'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import { SPEND_ITEM_KINDS, countsQuantity, type SpendItemKind } from '../../../storage/spend'
import { nextAmountIdentity } from '../amount-identity'
import { FieldRow } from '../sheet-fields'
import {
  CategoryChips,
  CharacterRow,
  SaveRow,
  SpendHeader,
  type SpendFormProps,
} from './form-shared'
import { useSpendSubmit } from './use-spend-submit'
import { SheetTextInput } from '../../../components/molecules/SheetTextInput/SheetTextInput'

/**
 * 관세 조각 둘 — **「없음」 이 첫 조각이고 기본값**이다([[ADR-173]] 정정 1 결정 6).
 *
 * 요율은 `SPEND_TARIFF_PERCENT` **하나에서 나온다** — 여기 숫자를 적으면 참조표가 바뀌는 날
 * 글자와 셈이 갈린다([[ADR-006]]).
 */
const TARIFF_OPTIONS = ['없음', `${SPEND_TARIFF_PERCENT}%`] as const

export function ItemBuyForm(props: SpendFormProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  const [name, setName] = useState(props.editing?.item ?? '')
  const [quantity, setQuantity] = useState(props.editing?.quantity ?? 1)
  /**
   * 친 값을 **되짚는다** — `단가 = (저장된 총액 − 관세분) ÷ 수량`([[ADR-173]] 정정 1).
   *
   * 총액을 그대로 친 값으로 삼으면 시트가 그 위에 **관세를 또 물린다**(935,000,000 짜리 기록이
   * 1,028,500,000 으로 열렸다). 나눗셈은 언제나 나누어떨어진다 — 저장된 총액이
   * `단가 × 수량 (+ 관세분)` 으로 만들어진 값이라서다.
   */
  const [typed, setTyped] = useState(() => {
    if (props.editing === undefined) return 0
    const count = props.editing.quantity ?? 1
    const total = props.editing.mesoAmount ?? 0
    return Math.round((total - (props.editing.tariffMeso ?? 0)) / count)
  })
  const [hasTariff, setHasTariff] = useState(props.editing?.tariffMeso != null)
  /** **`null` 은 정정 1 이전 행이고 장비다**([[ADR-173]] 정정 1 결정 4). */
  const [itemKind, setItemKind] = useState<SpendItemKind>(
    props.editing?.itemKind ?? SPEND_ITEM_KINDS[0],
  )
  /**
   * 큰 숫자의 **정체**([[ADR-087]] 정정 1) — 갈면 굴리지 않고 **갈아 끼운다**. 종류를 바꾸면
   * 큰 숫자가 «무엇을 세는지» 가 바뀌므로(치는 금액 ↔ 합계) 굴리면 «내가 뭘 지웠나» 로 읽힌다.
   */
  const [amountIdentity, setAmountIdentity] = useState(nextAmountIdentity)
  const { saving, submit, remove } = useSpendSubmit(props)

  /** **곱할 것이 있는가** — 장비는 하나를 사므로 없다([[ADR-173]] 정정 1 결정 1·2). */
  const counts = countsQuantity(itemKind)
  /** 관세를 얹기 **전**의 값 — 곱할 것이 없으면 친 값 그대로다. */
  const subtotal = counts ? typed * quantity : typed
  // 관세는 **친 숫자를 안 바꾼다** — 아래에 한 줄로 더한다. 금액 자체를 고치면 껐다 켰다 할 때
  // 8.5억 → 9.35억 → 10.28억 으로 부푼다([[ADR-166]] 정정 2 ②).
  const tariffed = withTariffMeso(subtotal)
  const amount = hasTariff ? tariffed.mesoAmount : subtotal
  const canSave = subtotal > 0

  /**
   * 종류를 바꾼다([[ADR-173]] 정정 1 결정 5) — **수량은 1 로, 관세는 꺼진다.**
   *
   * 관세를 안 끄면 **화면에 없는 값이 저장된다**(소비·기타에는 그 체크가 아예 없다). **친 금액은
   * 남긴다** — 수량이 1 이면 장비의 «금액» 과 소비의 «단가» 가 같은 값이라 거짓이 되지 않는다.
   */
  function selectItemKind(next: SpendItemKind): void {
    setItemKind(next)
    setQuantity(1)
    setHasTariff(false)
    setAmountIdentity(nextAmountIdentity())
  }

  return (
    <>
      <SpendHeader
        title={editing ? '아이템 구매' : '지출 추가'}
        dateKey={props.dateKey}
        onDateChange={props.onDateChange}
      />
      {!editing && (
        <CategoryChips selected={props.category} onSelect={props.onSelectCategory} />
      )}

      <CharacterRow characters={props.characters} selected={ocid} onSelect={setOcid} />

      <FieldRow label="구매 아이템" labelTestID="spend-sheet-name-label">
        <SheetTextInput
          testID="spend-sheet-name"
          value={name}
          onChangeText={setName}
          placeholder="아이템 명"
          className="flex-1 text-right text-sm text-text"
        />
      </FieldRow>

      {/* **종류가 나머지 둘을 정한다** — 세그먼트인 이유는 통화와 같다([[ADR-173]] 결정 3):
          갈래가 아니라 **값의 축**이다. */}
      <FieldRow label="종류" testID="spend-sheet-item-kind">
        <Segment options={SPEND_ITEM_KINDS} selected={itemKind} onSelect={selectItemKind} />
      </FieldRow>

      {counts && (
        // **한 개 값**(단가)이다 — 곱할 것이 있을 때만 선다.
        <FieldRow label="단가">
          <SheetTextInput
            testID="spend-sheet-unit-price"
            value={typed === 0 ? '' : typed.toLocaleString()}
            onChangeText={(text) => setTyped(parseMesoText(typed, text))}
            keyboardType="number-pad"
            placeholder="0"
            className="flex-1 text-right text-sm font-semibold text-text"
            style={TABULAR_NUMS}
          />
          <Text
            testID="spend-sheet-unit-price-unit"
            className="ml-1.5 shrink-0 text-xs font-semibold text-text-muted"
          >
            메소
          </Text>
        </FieldRow>
      )}

      {!counts && (
        /*
         * **관세도 라벨–값 줄이다**([[ADR-173]] 정정 1 결정 6) — 시트에서 고르는 것은 전부 이
         * 모양인데 관세만 큰 숫자 밑의 맨몸 체크박스였다. **장비에만 선다** — 끄는 것이 아니라
         * 줄 자체가 없다: 있는데 못 누르면 «왜 못 누르나» 를 새로 묻게 된다.
         *
         * **더해지는 금액을 안 적는다**(결정 5) — 큰 숫자가 그만큼 올라간다.
         */
        <FieldRow label="관세" testID="spend-sheet-tariff">
          <Segment
            options={TARIFF_OPTIONS}
            selected={hasTariff ? TARIFF_OPTIONS[1] : TARIFF_OPTIONS[0]}
            onSelect={(option) => setHasTariff(option !== '없음')}
          />
        </FieldRow>
      )}

      {counts && (
        // **스테퍼가 아니라 치는 칸**이다([[ADR-173]] 정정 1 결정 3) — 주문서 300장을 스테퍼로
        // 세면 300번을 누른다.
        //
        // **단위는 「개」다**(결정 17 정정, 사용자 지정 2026-08-29). 결정 17 이 «수량에 단위를 안
        // 적는다» 고 한 근거는 **「기타」가 자유 입력이라 앱이 무엇을 세는지 모른다**는 것이었는데,
        // 여기서 세는 것은 **아이템**이라 그 근거가 성립하지 않는다. 「기타」는 그대로 비어 있다.
        <FieldRow label="수량">
          <SheetTextInput
            testID="spend-sheet-quantity"
            value={quantity === 0 ? '' : quantity.toLocaleString()}
            onChangeText={(text) => setQuantity(parseMesoText(quantity, text))}
            keyboardType="number-pad"
            placeholder="0"
            className="flex-1 text-right text-sm font-semibold text-text"
            style={TABULAR_NUMS}
          />
          <Text
            testID="spend-sheet-quantity-unit"
            className="ml-1.5 shrink-0 text-xs font-semibold text-text-muted"
          >
            개
          </Text>
        </FieldRow>
      )}

      <AmountFigure
        value={subtotal}
        // **칠 때는 구입가, 손을 떼면 합계**([[ADR-173]] 결정 6) — 관세를 켜면 그 사이를 굴러
        // 넘어간다. 그래서 더해지는 금액을 따로 안 적는다(결정 5).
        displayValue={hasTariff ? tariffed.mesoAmount : undefined}
        unit="메소"
        testID="spend-sheet-amount"
        identity={amountIdentity}
        hint={formatMesoUnits(amount)}
        // **곱할 것이 있으면 못 친다**(결정 17 · 정정 1 결정 2) — 장비는 곱할 것이 없어 여전히 친다.
        readOnly={counts}
        onChangeValue={setTyped}
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
            category: '아이템 구매',
            item: name.trim() === '' ? null : name.trim(),
            form: null,
            itemKind,
            // 수량은 **곱할 것이 있을 때만** 실린다 — 그 `null` 이 곧 «곱하지 않은 행» 이라는 사실이다.
            quantity: counts ? quantity : null,
            mesoAmount: amount,
            // 총액과 그 몫을 **둘 다** 박는다(정정 2 ②) — 집계는 총액 한 칸만 본다.
            tariffMeso: hasTariff ? tariffed.tariffMeso : null,
            pointAmount: null,
            pointPer100mMeso: null,
            cashAmount: null,
            memo: null,
          })
        }
        onDelete={props.onDelete === undefined ? undefined : () => void remove()}
      />
    </>
  )
}
