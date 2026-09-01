/**
 * 수입 시트의 **갈래별 폼이 함께 쓰는 것**([[ADR-178]] 결정 3).
 *
 * 갈래마다 폼이 따로 서지만 캐릭터를 고르는 줄과 저장·삭제 줄은 전부 똑같다. 여러 벌로 갈리면
 * 한쪽만 고쳐지는 자리가 생기므로 한 벌만 둔다([[ADR-173]] 결정 10 이 두 시트를 한 뼈대로 묶은
 * 이유와 같다). 조각 두 줄도 사냥 폼 둘이 나눠 쓴다([[ADR-201]] 결정 6).
 */
import { Pressable } from 'react-native'

import { Text } from '../../../components/atoms'
import { parseMesoText } from '../../../components/molecules/MesoPad/meso-pad'
import { SheetTextInput } from '../../../components/molecules/SheetTextInput/SheetTextInput'
import { SelectField } from '../../../components/organisms/SelectField/SelectField'
import { characterOptions } from '../character-options'
import { FieldRow } from '../sheet-fields'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import type { IncomeRecord } from '../../../storage/income'

export type IncomeDraft = Omit<IncomeRecord, 'id' | 'recordedAt'>

/** 고를 수 있는 캐릭터 — `level` 은 사냥 계산기가 쓴다([[ADR-175]] 결정 6). */
export interface SheetCharacter {
  ocid: string
  name: string
  level: number | null
}

/** 갈래별 폼이 **전부 받는 것**. 갈래에만 필요한 것은 각 폼이 따로 받는다. */
export interface IncomeFormProps {
  dateKey: string
  characters: readonly SheetCharacter[]
  /** 있으면 **수정 모드**다([[ADR-171]] 결정 2). */
  editing?: IncomeRecord
  onDelete?: () => void | Promise<void>
  /** 던지면 **안 닫는다** — 친 것을 잃지 않는다. */
  onSave: (draft: IncomeDraft) => void | Promise<void>
  onClose: () => void
}

/**
 * 캐릭터 줄 — **기본은 「선택 안함」**([[ADR-166]] 결정 3, 사용자 지정 2026-08-26).
 *
 * 폼 안에 사는 이유는 [[ADR-178]] 결정 3 이다 — 갈래를 옮기면 폼이 언마운트되어 고른 것이 함께
 * 사라진다. 껍데기에 두면 그것만 남아 «갈래를 옮겼는데 캐릭터는 그대로» 가 된다.
 */
export function CharacterField(props: {
  characters: readonly SheetCharacter[]
  selected: string | null
  onSelect: (next: string | null) => void
}): React.JSX.Element {
  return (
    <SelectField
      label="캐릭터"
      options={characterOptions(props.characters)}
      selected={props.selected}
      onSelect={props.onSelect}
      testID="income-sheet-character"
    />
  )
}

/**
 * 솔 에르다 조각 두 줄 — 사냥 폼 **둘이 함께** 쓴다([[ADR-201]] 결정 6).
 *
 * 계산기든 수동이든 조각은 **사용자가 직접 넣는 값**이라([[ADR-175]] 결정 8) 갈릴 이유가 없다.
 * 스테퍼가 아니라 치는 칸인 이유는 30분에 10개 내외라 8소재면 80개가 넘어서다.
 */
export function FragmentFields(props: {
  fragments: number
  fragmentPrice: number
  onChangeFragments: (next: number) => void
  onChangeFragmentPrice: (next: number) => void
}): React.JSX.Element {
  return (
    <>
      <FieldRow label="솔 에르다 조각">
        <SheetTextInput
          testID="income-sheet-fragments"
          value={props.fragments === 0 ? '' : props.fragments.toLocaleString()}
          onChangeText={(text) => props.onChangeFragments(parseMesoText(props.fragments, text))}
          keyboardType="number-pad"
          placeholder="0"
          className="flex-1 text-right text-sm font-semibold text-text"
          style={TABULAR_NUMS}
        />
        <Text className="ml-1.5 shrink-0 text-xs text-text-muted">개</Text>
      </FieldRow>

      <FieldRow label="조각 가격">
        <SheetTextInput
          testID="income-sheet-fragment-price"
          value={props.fragmentPrice === 0 ? '' : props.fragmentPrice.toLocaleString()}
          onChangeText={(text) =>
            props.onChangeFragmentPrice(parseMesoText(props.fragmentPrice, text))
          }
          keyboardType="number-pad"
          placeholder="0"
          className="flex-1 text-right text-sm font-semibold text-text"
          style={TABULAR_NUMS}
        />
        <Text className="ml-1.5 shrink-0 text-xs text-text-muted">메소</Text>
      </FieldRow>
    </>
  )
}

/**
 * 저장 · 삭제 줄 — 큰 숫자 **바로 아래**다([[ADR-173]] 결정 1).
 *
 * 삭제는 **버튼처럼 안 생겼다**([[ADR-171]] 결정 3) — 이미 두 번 눌러야 여기까지 온다.
 */
export function SaveRow(props: {
  editing: boolean
  canSave: boolean
  saving: boolean
  onSave: () => void
  onDelete?: () => void
}): React.JSX.Element {
  return (
    <>
      <Pressable
        role="button"
        aria-label={props.editing ? '수정' : '저장'}
        disabled={!props.canSave || props.saving}
        onPress={props.onSave}
        className={`items-center rounded-xl py-3 ${props.canSave ? 'bg-rise-ink' : 'bg-surface-2'}`}
      >
        <Text className={`text-sm font-bold ${props.canSave ? 'text-bg' : 'text-text-disabled'}`}>
          {props.editing ? '수정' : '저장'}
        </Text>
      </Pressable>

      {props.editing && props.onDelete !== undefined && (
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <Pressable
          role="button"
          aria-label="삭제"
          testID="income-sheet-delete"
          disabled={props.saving}
          onPress={props.onDelete}
          className="items-center py-2"
        >
          <Text className="text-xs font-semibold text-error-ink">삭제</Text>
        </Pressable>
      )}
    </>
  )
}
