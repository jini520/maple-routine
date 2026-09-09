/**
 * 사냥 수동 입력 폼. 획득 메소를 사람이 친다.
 *
 * 계산기(`HuntCalculatorForm`)는 사냥터 하나에 머무는 것을 전제하고 그 사냥터가 참조표 408개
 * 안에 있어야 한다. 그 밖의 사냥은 앱이 셀 근거가 없어 여기서 받는다. 그래서 지역·사냥터·사냥
 * 효율·메소 획득량·시간 다섯 줄이 안 선다.
 *
 * 계산기 도입 전에 적힌 사냥 행도 이 폼으로 연다. 그 행은 조각이 없어 합계가 곧 획득 메소이므로
 * 지어내는 값이 하나도 없다.
 *
 * 어느 폼이 서는지는 `IncomeSheet` 가 정하고 수정 중에는 안 바뀐다.
 */
import { useState } from 'react'

import { Image, View } from 'react-native'

import {
  acceptMesoText,
  mesoTextOf,
  mesoValueOf,
  settleMesoText,
} from '../../../components/organisms/MesoPad/meso-pad'
import { Text } from '../../../components/atoms'
import { AmountFigure } from '../../../components/molecules/AmountFigure/AmountFigure'
import { ChainSelect } from '../../../components/organisms/ChainSelect/ChainSelect'
import { SheetTextInput } from '../../../components/molecules/SheetTextInput/SheetTextInput'
import { getItemIconUrlByFile } from '../../../lib/assets/asset-lookup'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { characterOptions } from '../character-options'
import { AmountInput, FieldRow } from '../sheet-fields'
import { useSaveSlot, type IncomeFormProps } from './form-shared'
import { useSheetSubmit } from '../../../hooks/useSheetSubmit'

export function HuntManualForm(props: IncomeFormProps): React.JSX.Element {
  const editing = props.editing !== undefined
  /**
   * 되살릴 입력. 수동으로 적힌 행일 때만 값이 있다.
   *
   * 계산기로 적힌 행은 이 폼으로 안 열리지만(`IncomeSheet` 가 갈라 준다) 타입이 그 사실을 모른다.
   */
  const detail = props.editing?.hunt?.mode === 'manual' ? props.editing.hunt : null
  const [ocid, setOcid] = useState<string | null>(props.editing?.ocid ?? null)
  /**
   * 친 획득 메소. 옛 행에서는 합계가 곧 이 값이다. 그 행은 조각이 없어 더한 것이 없고,
   * 그러므로 되짚는 것이지 지어내는 것이 아니다.
   *
   * `??` 라 `0` 은 안 흘러간다. 조각만 먹은 사냥은 친 메소가 0 이면서 수동으로 적힌 행이다.
   */
  const [typedMesoText, setTypedMesoText] = useState(
    mesoTextOf(detail?.typedMeso ?? props.editing?.mesoAmount ?? 0),
  )
  const [fragmentsText, setFragmentsText] = useState(mesoTextOf(detail?.fragments ?? 0))
  const [fragmentPriceText, setFragmentPriceText] = useState(mesoTextOf(detail?.fragmentPrice ?? 0))
  const { saving, submit, remove } = useSheetSubmit(props)

  /** 조각 줄의 그림. 계산기와 같은 파일을 본다. */
  const fragmentIcon = getItemIconUrlByFile('sol_erda_fragment.webp')

  const typedMeso = mesoValueOf(typedMesoText)
  const fragments = mesoValueOf(fragmentsText)
  const fragmentPrice = mesoValueOf(fragmentPriceText)
  /** 계산기의 `huntingTotalOf` 와 **같은 식**이고 메소의 출처만 다르다(거기서는 앱이 센다). */
  const total = typedMeso + fragments * fragmentPrice

  useSaveSlot(props.setSave, {
    editing,
    canSave: total > 0,
    saving,
    onSave: () =>
      void submit({
        ocid,
        earnedOn: props.dateKey,
        category: '사냥',
        // 사냥터 이름 칸이 없다. 새 기록은 비고, 옛 행의 이름은 그대로 들고 간다. 칸이
        // 없다는 것과 값을 지운다는 것은 다르다.
        item: props.editing?.item ?? null,
        mesoAmount: total,
        saleFeePercent: null,
        saleFeeMeso: null,
        pointAmount: null,
        pointPer100mMeso: null,
        cashAmount: null,
        // 수량은 `기타`만 쓴다.
        quantity: null,
        hunt: { mode: 'manual', typedMeso, fragments, fragmentPrice },
        memo: null,
      }),
    onDelete: props.onDelete === undefined ? undefined : () => void remove(),
  })

  return (
    <>
      {/*
        계산에 안 들고 **기록을 누구에게 붙일지**만 정한다. 고르는 자리의 모양은 계산기와 같다.
        자리표시자가 이름을 말하고 고른 것은 알약이 된다. 단계가 하나라 알약도 하나다.
      */}
      <ChainSelect
        testID="income-sheet-chain"
        steps={[
          {
            name: '캐릭터',
            options: characterOptions(props.characters),
            selected: ocid,
            onSelect: setOcid,
          },
        ]}
      />

      {/* 계산기에서는 앱이 세어 못 치는 줄이다. 여기서는 그 줄이 치는 칸이 된다. 같은 자리·
          같은 라벨이라 두 폼을 오갈 때 눈이 안 미끄러진다. */}
      <FieldRow label="획득 메소">
        <AmountInput
          testID="income-sheet-hunt-meso"
          value={typedMesoText}
          onChange={setTypedMesoText}
        />
        <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메소</Text>
      </FieldRow>

      {/* 계산기와 같은 줄이다. 이름은 그림이 지고 개수와 가격이 한 줄에 선다. */}
      <View className="min-h-8 flex-row items-center gap-2.5 border-b border-border pb-2">
        {fragmentIcon !== null && (
          // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
          <Image
            source={fragmentIcon}
            className="h-6 w-6 shrink-0"
            resizeMode="contain"
            aria-label="솔 에르다 조각"
          />
        )}
        <View className="shrink-0 flex-row items-baseline gap-1">
          <SheetTextInput
            testID="income-sheet-fragments"
            aria-label="솔 에르다 조각"
            value={fragmentsText}
            onChangeText={(text) => setFragmentsText(acceptMesoText(fragmentsText, text))}
            onBlur={() => setFragmentsText(settleMesoText(fragmentsText))}
            keyboardType="number-pad"
            placeholder="0"
            className="h-5 w-[52px] text-right text-sm font-semibold text-text"
            style={TABULAR_NUMS}
          />
          <Text className="text-xs text-text-muted">개</Text>
        </View>
        <View className="ml-auto min-w-0 flex-1 flex-row items-baseline gap-1.5">
          <SheetTextInput
            testID="income-sheet-fragment-price"
            aria-label="조각 가격"
            value={fragmentPriceText}
            onChangeText={(text) => setFragmentPriceText(acceptMesoText(fragmentPriceText, text))}
            onBlur={() => setFragmentPriceText(settleMesoText(fragmentPriceText))}
            keyboardType="number-pad"
            placeholder="조각 가격"
            className="h-5 flex-1 text-right text-sm font-semibold text-text"
            style={TABULAR_NUMS}
          />
          <Text className="shrink-0 text-xs text-text-muted">메소</Text>
        </View>
      </View>

      <AmountFigure
        // 큰 숫자는 여기서도 합계다. 사람이 치는 것은 획득 메소이지 합계가 아니라, 앱이 센
        // 값을 사람이 덮어쓰지 않는다는 규칙이 그대로 산다.
        value={total}
        unit="메소"
        testID="income-sheet-amount"
        // `≈` 를 안 붙인다. 그 표식은 미리 세어 둔 값이라는 뜻인데 이 메소는 사용자가 실제로
        // 본 값이다. 양쪽에 다 붙이면 표식이 아무것도 안 가른다.
      />

    </>
  )
}
