/**
 * 수입 기록 시트의 **껍데기**([[ADR-178]] 결정 3).
 *
 * ## 여기 남는 것은 **갈래가 안 바꾸는 것**뿐이다
 *
 * 제목 · 날짜 · 갈래 칩. 그 아래는 전부 **갈래별 폼**이 든다(`income/`) — 캐릭터 고르개부터 큰
 * 숫자와 저장 줄까지.
 *
 * 종전에는 한 함수가 갈래 셋의 상태를 **전부 들고** 조건문으로 그렸다. 그래서 갈래를 옮겨도 고른
 * 값(캐릭터 · 지역 · 사냥터)이 안 사라졌다 — 상태가 컴포넌트에 안 매여 있었기 때문이다. 이제
 * 갈래를 옮기면 폼이 **언마운트**되므로 그 값들이 함께 사라진다. «옮길 때 무엇을 지울까» 를 손으로
 * 정하던 자리([[ADR-173]] 결정 13)가 규칙이 아니라 **기본값**이 됐다.
 *
 * ## 여기 서는 것은 **손입력 수익**뿐이다
 *
 * 보스 드롭은 이 시트로 안 들어온다([[ADR-170]] 결정 3) — 이미 보스 수익 탭이 기록하고, 두 곳에서
 * 적으면 같은 판매가 두 벌이 된다. 캘린더는 그것을 **읽어서** 같은 목록에 세우되 여기서 못 고친다.
 *
 * ## 뼈대는 **지출 시트와 같다** ([[ADR-173]] 결정 10)
 *
 * 제목 · 갈래 칩 · 라벨–값 줄 · **큰 숫자 + 힌트** · 저장. 한 곳을 고치면 두 시트가 같이 고쳐진다.
 *
 * 제목은 **안 바뀐다**(결정 7) — 「수입 추가」·「수입 수정」 둘뿐이고, 갈래를 골라도 그대로다.
 * **수정 모드의 머리는 «고른 것»** 이다([[ADR-173]] 결정 15) — 수입은 고를 것이 갈래뿐이라
 * 그것이 곧 제목이고, 그래서 그 모드에는 칩이 없다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { Text } from '../../components/atoms'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import type { MesoRateLoad } from '../../features/cashbook/meso-rate'
import {
  INCOME_CATEGORIES,
  type HuntInputMode,
  type IncomeCategory,
  type IncomeRecord,
} from '../../storage/income'
import { CheckBox, DateStepper } from './sheet-fields'
import { EtcForm } from './income/EtcForm'
import { HuntCalculatorForm } from './income/HuntCalculatorForm'
import { ItemSaleForm } from './income/ItemSaleForm'
import { HuntManualForm } from './income/HuntManualForm'
import type { IncomeFormProps, SheetCharacter } from './income/form-shared'

export type { IncomeDraft } from './income/form-shared'

function CategoryChip(props: {
  label: string
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-selected={props.selected}
      onPress={props.onPress}
      className={`rounded-full border px-3 py-1.5 ${
        props.selected ? 'border-transparent bg-rise-ink' : 'border-border'
      }`}
    >
      <Text className={`text-xs font-semibold ${props.selected ? 'text-bg' : 'text-text-muted'}`}>
        {props.label}
      </Text>
    </Pressable>
  )
}

export interface IncomeSheetProps {
  dateKey: string
  /**
   * 고를 수 있는 캐릭터([[ADR-166]] 결정 3) — 화면이 읽어서 넘긴다(시트는 `storage/` 를 모른다).
   * 비어 있으면 고르개에 「선택 안함」 하나만 선다.
   *
   * `level` 은 **사냥 계산기가 쓴다**([[ADR-175]] 결정 6) — 지역 목록을 거르고 레벨 차이 페널티를
   * 낸다. 캐시에 없으면 `null` 이고, 그때는 페널티 없이 계산하며 그 사실을 화면이 말한다.
   */
  characters: readonly SheetCharacter[]
  /**
   * 마지막으로 쓴 메소마켓 시세 — 「기타」를 메포로 적을 때의 기본값이다([[ADR-170]] 정정 15).
   * 지출 시트와 **같은 계약**이라 화면이 한 값을 두 시트에 그대로 넘긴다.
   */
  lastPointRate: number | null
  /**
   * 캐릭터의 **메소 획득량**을 읽어 온다([[ADR-177]] 결정 7·9) — 시트는 `nexon/` 도 `storage/` 도
   * 모른다. 사냥 폼만 쓴다.
   */
  loadMesoRate: (ocid: string) => Promise<MesoRateLoad>
  /**
   * 고칠 기록. 있으면 **수정 모드**다([[ADR-171]] 결정 2) — 머리와 버튼 글자가 갈리고 삭제가 선다.
   */
  editing?: IncomeRecord
  onDelete?: () => void | Promise<void>
  /** 던지면 **안 닫는다** — 친 것을 잃지 않는다. 실패를 말하는 것은 화면 몫이다(토스트). */
  onSave: IncomeFormProps['onSave']
  onClose: () => void
}

export function IncomeSheet(props: IncomeSheetProps): React.JSX.Element {
  const editing = props.editing !== undefined
  const [category, setCategory] = useState<IncomeCategory>(
    props.editing?.category ?? INCOME_CATEGORIES[0],
  )
  /**
   * **어느 날에 적히나** — 시트를 연 날로 시작하고 머리에서 바꾼다(정정 6).
   *
   * 갈래 폼은 `key={category}` 로만 다시 심기므로, 날짜를 바꿔도 **친 것이 안 사라진다**.
   */
  const [dateKey, setDateKey] = useState(props.dateKey)
  /**
   * 사냥을 어느 폼으로 적나([[ADR-201]] 결정 5). **수정으로 열면 기록이 정하고 안 바뀐다** —
   * 모드를 바꾸면 앱이 센 합계가 사람이 친 값으로 둔갑한다([[ADR-173]] 결정 15 와 같은 자리).
   */
  const [huntMode, setHuntMode] = useState<HuntInputMode>(huntModeOf(props.editing))

  const formProps: IncomeFormProps = {
    dateKey,
    characters: props.characters,
    editing: props.editing,
    onDelete: props.onDelete,
    onSave: props.onSave,
    onClose: props.onClose,
  }

  return (
    <BottomSheet testId="income-sheet" onClose={props.onClose}>
      <View className="gap-3 px-4 pb-2">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text
            testID="income-sheet-title"
            numberOfLines={1}
            className="shrink text-base font-bold text-text"
          >
            {editing ? category : '수입 추가'}
          </Text>
          <DateStepper dateKey={dateKey} onChange={setDateKey} testID="income-sheet-date" />
        </View>

        {/* **수정 모드에는 칩이 없다**(결정 15) — 갈래를 바꾸면 그 기록은 «다른 것» 이 되고,
            무엇이었는지는 **제목**이 이미 말한다. */}
        {!editing && (
          <View className="flex-row flex-wrap gap-1.5">
            {INCOME_CATEGORIES.map((each) => (
              <CategoryChip
                key={each}
                label={each}
                selected={each === category}
                onPress={() => setCategory(each)}
              />
            ))}
          </View>
        )}

        {/* **새로 적을 때만 선다**([[ADR-201]] 결정 5) — 수정 모드에서는 기록이 이미 정했다.
            사냥 갈래에만 있는 줄이라 다른 갈래에서는 안 그린다. */}
        {!editing && category === '사냥' && (
          // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
          <Pressable
            role="checkbox"
            aria-label="직접 입력"
            aria-checked={huntMode === 'manual'}
            onPress={() => setHuntMode(huntMode === 'manual' ? 'calculator' : 'manual')}
            hitSlop={8}
            className="flex-row items-center gap-2"
          >
            <CheckBox checked={huntMode === 'manual'} />
            <Text className="text-xs font-semibold text-text-muted">직접 입력</Text>
          </Pressable>
        )}

        {/* **`key` 가 곧 «갈래를 옮기면 값이 사라진다»** 다([[ADR-178]] 결정 3) — 갈래가 바뀌면
            리액트가 폼을 새로 심는다. 지울 것을 손으로 세지 않는다. 사냥의 두 모드도 같은 열쇠에
            들어간다([[ADR-201]] 결정 6) — 모드를 옮기는 것도 «다른 것을 적기 시작하는 일» 이다. */}
        <IncomeForm
          key={`${category}:${huntMode}`}
          category={category}
          huntMode={huntMode}
          {...props}
          formProps={formProps}
        />
      </View>
    </BottomSheet>
  )
}

/**
 * 이 기록을 어느 폼으로 여나([[ADR-201]] 결정 5). **기록에 박힌 값이 정한다.**
 *
 * `hunt` 가 `null` 인 행은 [[ADR-175]] 이전에 적힌 것이고 수동으로 연다(결정 4) — 조각이 없어
 * 합계가 곧 획득 메소라 되짚을 수 있다. 새로 적을 때는 계산기로 시작한다.
 */
function huntModeOf(editing: IncomeRecord | undefined): HuntInputMode {
  if (editing === undefined) return 'calculator'
  return editing.hunt?.mode ?? 'manual'
}

/** 갈래 하나에 폼 하나 — 고르는 자리는 여기 하나뿐이다. 사냥만 그 아래로 한 번 더 갈린다. */
function IncomeForm(
  props: IncomeSheetProps & {
    category: IncomeCategory
    huntMode: HuntInputMode
    formProps: IncomeFormProps
  },
): React.JSX.Element {
  if (props.category === '아이템 판매') return <ItemSaleForm {...props.formProps} />
  if (props.category === '기타') {
    return <EtcForm {...props.formProps} lastPointRate={props.lastPointRate} />
  }
  return props.huntMode === 'manual' ? (
    <HuntManualForm {...props.formProps} />
  ) : (
    <HuntCalculatorForm {...props.formProps} loadMesoRate={props.loadMesoRate} />
  )
}
