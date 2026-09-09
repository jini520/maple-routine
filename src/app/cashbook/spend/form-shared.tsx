/**
 * 지출 시트의 **갈래별 폼이 함께 쓰는 것**.
 *
 * 머리줄 · 캐릭터 줄 · 시세 줄 · 저장·삭제 줄은 갈래가 안 바꾼다. 세 벌로 갈리면 한쪽만
 * 고쳐지는 자리가 생기므로 한 벌만 둔다.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import { Pressable, View } from 'react-native'

import { ChevronLeftIcon, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { SelectField } from '../../../components/organisms/SelectField/SelectField'
import { characterOptions } from '../character-options'
import { DateStepper } from '../sheet-fields'
import { type SpendCategory, type SpendRecord } from '../../../storage/spend'
import { SheetTextInput } from '../../../components/molecules/SheetTextInput/SheetTextInput'

/** 저장할 값에서 **어댑터가 아니라 화면이 정하는 것 둘**(`id`·`recordedAt`)을 뺀 나머지. */
export type SpendDraft = Omit<SpendRecord, 'id' | 'recordedAt'>

/** 저장 줄이 그리는 값과 누를 때 부를 것. 시트가 이것을 받아 바닥에 세운다. */
export interface SpendSaveSlot {
  /** 셀 자리가 있나. 항목 격자에서는 거짓이고 그때 시트는 바닥 줄을 아예 안 세운다. */
  showSave: boolean
  editing: boolean
  canSave: boolean
  saving: boolean
  onSave: () => void
  onDelete?: () => void
}

/** 갈래별 폼이 **전부 받는 것**. */
export interface SpendFormProps {
  /** 저장 줄을 시트 바닥으로 올리는 손잡이. 폼이 값을 정하고 자리는 시트가 준다. */
  setSave: (slot: SpendSaveSlot) => void
  dateKey: string
  characters: ReadonlyArray<{ ocid: string; name: string }>
  /** 머리의 제목이 쓰는 값. 1차에서 고른 갈래다. */
  category: SpendCategory
  /** 1차로 되돌아간다. 머리의 화살촉이 부른다. 수정 모드에서는 폼이 안 붙인다. */
  onBack: () => void
  editing?: SpendRecord
  onDelete?: () => void | Promise<void>
  lastPointRate: number | null
  onSave: (draft: SpendDraft) => void | Promise<void>
  onClose: () => void
  /** 시트 껍데기의 스크롤을 되돌릴 열쇠. 목록 갈래가 단계를 오갈 때 부른다. */
  onScrollKeyChange: (key: string) => void
  /** 머리에서 날짜를 바꾸는 콜백. 수입 시트와 같은 계약이다. */
  onDateChange: (next: string) => void
  /** 오늘. 머리의 날짜를 이 날 뒤로 못 옮긴다. */
  todayDateKey: string
}

/**
 * 머리줄. 지금 어디인지를 말한다.
 *
 * 항목 격자에서는 갈래 이름이고 폼으로 들어가면 고른 항목의 이름이다. 왼쪽에는 한 걸음
 * 되돌아가는 자리가 선다. 제목을 그대로 두고 본문에 돌아가는 줄을 따로 두면 같은 것을 말하는
 * 자리가 둘이 되고 시트 위쪽 한 줄이 통째로 낭비된다.
 *
 * `items-baseline` 이 아니라 `items-center` 다. 화살촉은 글자가 아니라 밑줄이 없다.
 */
export function SpendHeader(props: {
  title: string
  dateKey: string
  /** 오늘. 머리의 날짜를 이 날 뒤로 못 옮긴다. */
  todayDateKey: string
  /** 머리에서 날짜를 바꾸는 줄. 수입 시트와 **같은 부품**이다. */
  onDateChange: (next: string) => void
  /** 제목을 **되돌아가는 누르개**로 만드는 콜백. 수정 모드에는 되돌아갈 곳이 없어 안 준다. */
  onBack?: () => void
}): React.JSX.Element {
  return (
    <View className="flex-row items-center justify-between gap-2">
      {props.onBack === undefined ? (
        <Text
          testID="spend-sheet-title"
          numberOfLines={1}
          className="shrink text-base font-bold text-text"
        >
          {props.title}
        </Text>
      ) : (
        <Pressable
          role="button"
          aria-label="다시 고르기"
          testID="spend-sheet-back"
          onPress={props.onBack}
          hitSlop={8}
          className="-ml-1 shrink flex-row items-center gap-1"
        >
          <ChevronLeftIcon className="h-5 w-5 text-text" strokeWidth={2} aria-hidden />
          <Text
            testID="spend-sheet-title"
            numberOfLines={1}
            className="shrink text-base font-bold text-text"
          >
            {props.title}
          </Text>
        </Pressable>
      )}
      <DateStepper
        dateKey={props.dateKey}
        latest={props.todayDateKey}
        onChange={props.onDateChange}
        testID="spend-sheet-date"
      />
    </View>
  )
}

/**
 * 캐릭터 줄. 기본은 `선택 안함`.
 *
 * 고를 것을 고르는 화면(타일 격자)에는 안 선다. 거기엔 아직 적을 기록이 없다.
 */
export function CharacterRow(props: {
  characters: ReadonlyArray<{ ocid: string; name: string }>
  selected: string | null
  onSelect: (value: string | null) => void
}): React.JSX.Element {
  return (
    <SelectField
      label="캐릭터"
      options={characterOptions(props.characters)}
      selected={props.selected}
      onSelect={props.onSelect}
      testID="spend-sheet-character"
    />
  )
}

/**
 * 시세 줄. 메포를 쓸 때만 선다.
 *
 * 시세는 네 자리라 **OS 숫자 키패드로 충분하다**. `*` 는 지금 비었다 가 아니라 이 칸은 반드시
 * 있어야 한다 를 말하므로 채워도 안 사라진다.
 */
export function RateRow(props: {
  value: string
  onChange: (next: string) => void
  valid: boolean
}): React.JSX.Element {
  return (
    <View className="min-h-7 flex-row items-center gap-2 border-b border-border pb-2">
      <Text className="shrink-0 text-xs text-text-muted">
        시세 · 1억당
        <Text testID="spend-sheet-required" className="text-error-ink">
          {' *'}
        </Text>
      </Text>
      <SheetTextInput
        testID="spend-sheet-rate"
        value={props.value}
        onChangeText={props.onChange}
        keyboardType="number-pad"
        placeholder="메소마켓 시세"
        className={`h-5 flex-1 text-right text-sm font-semibold ${
          props.valid ? 'text-text' : 'text-error-ink'
        }`}
        style={TABULAR_NUMS}
      />
      <Text className="shrink-0 text-xs text-text-muted">메포</Text>
    </View>
  )
}

/**
 * 저장 줄의 값을 시트로 올리는 훅. 수입 시트와 **같은 계약**이다.
 *
 * 콜백은 **최신 것을 ref 로 부른다**. 값째로 의존성에 넣으면 렌더마다 새 함수라 매번 다시
 * 올라가고, 그때마다 바닥 줄이 새로 그려진다.
 */
export function useSaveSlot(setSave: (slot: SpendSaveSlot) => void, slot: SpendSaveSlot): void {
  const latest = useRef(slot)
  useEffect(() => {
    latest.current = slot
  })

  const hasDelete = slot.onDelete !== undefined
  /*
    **그리기 전에 올린다.** 평범한 `useEffect` 로 올리면 시트가 한 프레임 동안 바닥 줄 없이
    그려진다. 그 프레임에는 줄이 설 자리도 안 비어 있어, 단계를 옮기는 순간 시트 아래쪽이
    통째로 빈 칸으로 보인다(사용자 보고).
  */
  useLayoutEffect(() => {
    setSave({
      showSave: slot.showSave,
      editing: slot.editing,
      canSave: slot.canSave,
      saving: slot.saving,
      onSave: () => latest.current.onSave(),
      onDelete: hasDelete ? () => latest.current.onDelete?.() : undefined,
    })
  }, [setSave, slot.showSave, slot.editing, slot.canSave, slot.saving, hasDelete])
}

/**
 * 저장 · 삭제 줄. **시트 바닥에 고정**되어 키보드가 떠도 보인다.
 *
 * **항목 격자에서는 버튼 없이 자리만 잡는다**(사용자 지시). 거기엔 셀 자리가 없지만, 바닥
 * 영역을 통째로 걷으면 단계를 오갈 때 시트의 아랫부분이 그 높이만큼 늘었다 줄었다 한다.
 * 자리를 그대로 두면 바닥의 기하가 안 바뀌므로 옮겨도 아래가 안 흔들린다.
 *
 * 삭제는 버튼처럼 안 생겼다. 이미 두 번 눌러야 여기까지 온다.
 */
export function SaveRow(props: {
  /** 셀 자리가 있나. 없으면 같은 높이의 빈 자리만 남는다. */
  showSave: boolean
  editing: boolean
  canSave: boolean
  saving: boolean
  onSave: () => void
  onDelete?: () => void
}): React.JSX.Element {
  if (!props.showSave) {
    // 버튼이 서던 자리. 상자만 남고 아무것도 안 그린다(전폭 · 44).
    return <View testID="spend-sheet-save-placeholder" className="h-11" />
  }

  return (
    <>
      <Pressable
        role="button"
        // 보이는 글자와 같아야 한다. 화면은 `수정` 인데 읽어 주는 것이 `저장` 이면 그 둘은
        // 다른 버튼이 된다.
        aria-label={props.editing ? '수정' : '저장'}
        disabled={!props.canSave || props.saving}
        onPress={props.onSave}
        className={`items-center rounded-xl py-3 ${props.canSave ? 'bg-primary' : 'bg-surface-2'}`}
      >
        <Text
          className={`text-sm font-bold ${
            props.canSave ? 'text-on-primary' : 'text-text-disabled'
          }`}
        >
          {props.editing ? '수정' : '저장'}
        </Text>
      </Pressable>

      {props.editing && props.onDelete !== undefined && (
        <Pressable
          role="button"
          aria-label="삭제"
          testID="spend-sheet-delete"
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
