/**
 * 솔 에르다 조각 정산 폼. 사냥에서 가격을 나중에 입력으로 보관한 조각을 판 날에 적는다.
 *
 * 보관은 캐릭터별이고 시트 머리에서 고른 날까지 쌓인 것만 센다. 그래서 캐릭터가 필수이고, 날짜나
 * 캐릭터를 바꾸면 다시 센다. 보관 개수는 저장하지 않고 기록에서 세며 그 조회는 화면이 넘긴다.
 *
 * 금액은 `판 개수 × 개당 가격` 에서 판매 수수료를 뗀 값이다. 판 개수는 `quantity` 칸에 담아 수정으로 열 때
 * 단가를 `(받은 돈 + 뗀 몫) ÷ 판 개수` 로 되짚는다.
 */
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { mesoTextOf, mesoValueOf } from '../../../components/organisms/MesoPad/meso-pad'
import { ChainSelect } from '../../../components/organisms/ChainSelect/ChainSelect'
import { FeeRow } from '../../../components/organisms/FeeRow/FeeRow'
import { netProceedsMeso } from '../../../lib/cashbook/item-split'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { requiredCharacterOptions } from '../character-options'
import { AmountInput, FieldRow } from '../sheet-fields'
import { COUNT_QUICK_ADDS } from '../../../constants/domain/quick-adds'
import { FRAGMENT_PRICE_QUICK_ADDS } from '../../../constants/domain/meso-quick-adds'
import { useSaveSlot, type IncomeFormProps } from './form-shared'
import { useSaleFeeChoice } from './sale-fee'
import { useSheetSubmit } from '../../../hooks/useSheetSubmit'

/** 보관 개수를 읽는 함수. 못 읽으면 `null` 이다. 뺄 기록 id 는 수정 중인 정산 기록이다. */
export type LoadFragmentStorage = (
  ocid: string,
  onOrBeforeDateKey: string,
  excludeRecordId: string | undefined,
) => Promise<number | null>

export function FragmentSettleForm(
  props: IncomeFormProps & {
    /** 보관 개수 조회. 폼은 `storage/` 를 모른다. */
    loadFragmentStorage: LoadFragmentStorage
  },
): React.JSX.Element {
  const editing = props.editing !== undefined
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  const [countText, setCountText] = useState(mesoTextOf(props.editing?.quantity ?? 0))
  /** 친 단가를 되짚는다. 받은 돈은 수수료를 뗀 값이라 뗀 몫을 더해 나눈다. `quantity` 가 없으면 빈 칸이다. */
  const [priceText, setPriceText] = useState(() => {
    const quantity = props.editing?.quantity ?? null
    if (quantity === null || quantity <= 0) return ''
    return mesoTextOf(Math.round(((props.editing?.mesoAmount ?? 0) + (props.editing?.saleFeeMeso ?? 0)) / quantity))
  })
  const fee = useSaleFeeChoice(props.editing, ocid, props.dateKey)
  /**
   * 읽어 온 보관. 어느 캐릭터 · 날짜로 읽은 값인지 함께 든다.
   *
   * 캐릭터를 빠르게 바꾸면 먼저 부른 응답이 늦게 올 수 있다. 지금 고른 것과 열쇠가 다른 값은 안 쓴다.
   */
  const [loaded, setLoaded] = useState<{ key: string; count: number | null } | null>(null)
  const { saving, submit, remove } = useSheetSubmit(props)

  const { loadFragmentStorage, dateKey } = props
  const editingId = props.editing?.id
  const storageKey = ocid === null ? null : `${ocid}:${dateKey}`

  useEffect(() => {
    if (ocid === null) return
    const key = `${ocid}:${dateKey}`
    let live = true
    void loadFragmentStorage(ocid, dateKey, editingId).then((count) => {
      if (live) setLoaded({ key, count })
    })
    return () => {
      live = false
    }
  }, [ocid, dateKey, editingId, loadFragmentStorage])

  /** 지금 캐릭터 · 날짜의 보관. 안 골랐거나 읽는 중이거나 못 읽었으면 `null` 이다. */
  const storage = loaded !== null && loaded.key === storageKey ? loaded.count : null
  const count = mesoValueOf(countText)
  const price = mesoValueOf(priceText)
  const gross = count * price
  const amount = fee.percent === null ? gross : netProceedsMeso(gross, fee.percent)
  /** 보관이 있어야 하고 판 개수는 1 부터 보관까지다. */
  const canSave = storage !== null && count >= 1 && count <= storage && price > 0 && fee.ready

  useSaveSlot(props.setSave, {
    editing,
    canSave,
    saving,
    onSave: () =>
      void submit({
        ocid,
        earnedOn: dateKey,
        category: 'sol_erda_fragment',
        item: null,
        itemKey: null,
        mesoAmount: amount,
        saleFeePercent: fee.percent,
        saleFeeMeso: fee.percent === null ? null : gross - amount,
        saleFeeAuto: fee.auto,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        // 판 개수. 보관 조회가 이 칸을 빼고, 수정으로 열 때 단가를 되짚는다.
        quantity: count,
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

      {/* 판 개수를 치면서 상한인 보관을 같은 줄에서 본다(사용자 지정). */}
      <View
        testID="income-sheet-settle-count-row"
        className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2"
      >
        <Text className="shrink-0 text-xs text-text-muted">보관 중</Text>
        <Text
          testID="income-sheet-fragment-storage"
          className="shrink-0 text-sm font-semibold text-text"
          style={TABULAR_NUMS}
        >
          {storage === null ? '-' : `${storage}개`}
        </Text>
        <Text className="ml-auto shrink-0 text-xs text-text-muted">판 개수</Text>
        <View className="w-16 flex-row items-center">
          <AmountInput
            testID="income-sheet-settle-count"
            label="판 개수"
            context="솔 에르다 조각"
            icon="fragment"
            unit="개"
            chips={COUNT_QUICK_ADDS}
            value={countText}
            onChange={setCountText}
          />
        </View>
        <Text className="-ml-1.5 shrink-0 text-xs text-text-muted">개</Text>
      </View>

      <FieldRow label="개당 가격">
        <AmountInput
          testID="income-sheet-settle-price"
          label="개당 가격"
          context="솔 에르다 조각"
          icon="meso"
          unit="메소"
          reading
          chips={FRAGMENT_PRICE_QUICK_ADDS}
          value={priceText}
          onChange={setPriceText}
        />
        <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메소</Text>
      </FieldRow>

      <FeeRow testID="income-sheet-fee" label="수수료" {...fee.row} />

      <AmountFigure value={amount} unit="메소" testID="income-sheet-amount" />
    </>
  )
}
