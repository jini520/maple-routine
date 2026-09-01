/**
 * **[[ADR-175]] 이전에 적힌 「사냥」 행**을 여는 폼([[ADR-178]] 결정 3).
 *
 * 그 행은 계산 입력이 없다(`hunt === null`) — 그때는 계산기가 아니라 자유 입력이었다. 없는 입력을
 * 지어내면 «내가 그렇게 골랐나» 가 되므로 **그때의 모양 그대로** 연다: 사냥터를 글자로 적고 금액을
 * 직접 친다.
 *
 * 새로 적는 길은 없다 — 이 폼은 **수정으로만** 열린다.
 */
import { useState } from 'react'

import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { formatMesoUnits } from '../../../lib/drop-price'
import { nextAmountIdentity } from '../amount-identity'
import { FieldRow } from '../sheet-fields'
import { CharacterField, SaveRow, type IncomeFormProps } from './form-shared'
import { useSheetSubmit } from './use-sheet-submit'
import { SheetTextInput } from '../../../components/molecules/SheetTextInput/SheetTextInput'

export function LegacyHuntForm(props: IncomeFormProps): React.JSX.Element {
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  const [name, setName] = useState(props.editing?.item ?? '')
  const [gross, setGross] = useState(props.editing?.mesoAmount ?? 0)
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

  return (
    <>
      <CharacterField characters={props.characters} selected={ocid} onSelect={setOcid} />

      <FieldRow label="사냥터" labelTestID="income-sheet-name-label">
        <SheetTextInput
          value={name}
          onChangeText={setName}
          placeholder="사냥터"
          className="flex-1 text-right text-sm text-text"
        />
      </FieldRow>

      <AmountFigure
        value={gross}
        unit="메소"
        testID="income-sheet-amount"
        identity={amountIdentity}
        hint={gross > 0 ? formatMesoUnits(gross) : ' '}
        onChangeValue={setGross}
      />

      <SaveRow
        editing
        canSave={gross > 0}
        saving={saving}
        onSave={() =>
          void submit({
            ocid,
            earnedOn: props.dateKey,
            category: '사냥',
            item: name.trim() === '' ? null : name.trim(),
            mesoAmount: gross,
            saleFeePercent: null,
            saleFeeMeso: null,
            pointAmount: null,
            pointPer100mMeso: null,
            cashAmount: null,
            // 계산기로 적힌 행이 아니다 — 칸을 채우면 그 행이 «계산된 것» 으로 둔갑한다.
            hunt: null,
            memo: null,
          })
        }
        onDelete={props.onDelete === undefined ? undefined : () => void remove()}
      />
    </>
  )
}
