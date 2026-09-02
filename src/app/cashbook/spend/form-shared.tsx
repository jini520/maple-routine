/**
 * 지출 시트의 **갈래별 폼이 함께 쓰는 것**.
 *
 * 머리줄 · 갈래 칩 · 캐릭터 줄 · 시세 줄 · 저장·삭제 줄은 갈래가 안 바꾼다. 세 벌로 갈리면 한쪽만
 * 고쳐지는 자리가 생기므로 한 벌만 둔다.
 */
import { Pressable, View } from 'react-native'

import { ChevronLeftIcon, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { SelectField } from '../../../components/organisms/SelectField/SelectField'
import { characterOptions } from '../character-options'
import { DateStepper } from '../sheet-fields'
import { SPEND_CATEGORIES, type SpendCategory, type SpendRecord } from '../../../storage/spend'
import { SheetTextInput } from '../../../components/molecules/SheetTextInput/SheetTextInput'

/** 저장할 값에서 **어댑터가 아니라 화면이 정하는 것 둘**(`id`·`recordedAt`)을 뺀 나머지. */
export type SpendDraft = Omit<SpendRecord, 'id' | 'recordedAt'>

/** 갈래별 폼이 **전부 받는 것**. */
export interface SpendFormProps {
  dateKey: string
  characters: ReadonlyArray<{ ocid: string; name: string }>
  /** 갈래 칩이 쓰는 값. 칩은 폼이 그린다(갈래마다 서는 자리가 달라서다). */
  category: SpendCategory
  onSelectCategory: (next: SpendCategory) => void
  editing?: SpendRecord
  onDelete?: () => void | Promise<void>
  lastPointRate: number | null
  onSave: (draft: SpendDraft) => void | Promise<void>
  onClose: () => void
  /** 시트 껍데기의 스크롤을 되돌릴 열쇠. 목록 갈래가 단계를 오갈 때 부른다. */
  onScrollKeyChange: (key: string) => void
  /** 머리에서 날짜를 바꾼다. 수입 시트와 같은 계약이다. */
  onDateChange: (next: string) => void
}

/**
 * 머리줄. **지금 어디인지를 말한다**(사용자 지정 2026-08-25).
 *
 * ①에서는 지출 추가다. ②로 들어가면 그 자리가 **고른 것의 이름**으로 바뀌고 왼쪽에 돌아가는
 * 자리가 선다. 제목을 그대로 두고 본문에 돌아가는 줄을 따로 두면 같은 것(지금 무엇을 고르는
 * 중인가)을 말하는 자리가 둘이 되고 시트 위쪽 한 줄이 통째로 낭비된다.
 *
 * `items-baseline` 이 아니라 `items-center` 다. 화살촉은 글자가 아니라 밑줄이 없다.
 */
export function SpendHeader(props: {
  title: string
  dateKey: string
  /** 머리에서 날짜를 바꾼다. 수입 시트와 **같은 부품**이다. */
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
            testID="spend-sheet-choice"
            numberOfLines={1}
            className="shrink text-base font-bold text-text"
          >
            {props.title}
          </Text>
        </Pressable>
      )}
      <DateStepper
        dateKey={props.dateKey}
        onChange={props.onDateChange}
        testID="spend-sheet-date"
      />
    </View>
  )
}

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
        props.selected ? 'border-transparent bg-primary' : 'border-border'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${props.selected ? 'text-on-primary' : 'text-text-muted'}`}
      >
        {props.label}
      </Text>
    </Pressable>
  )
}

/**
 * 갈래 칩. **고르는 화면에만 선다**.
 *
 * 둘째 화면에서는 머리의 `‹` 가 이미 되돌아가는 길이다. **수정 모드에도 없다**(결정 15).
 * 갈래를 바꾸면 그 기록은 다른 것 이 되고, 무엇이었는지는 제목이 이미 말한다.
 */
export function CategoryChips(props: {
  selected: SpendCategory
  onSelect: (next: SpendCategory) => void
}): React.JSX.Element {
  return (
    // **테스트가 이 줄을 지목할 수 있어야 한다**. `기타`가 갈래 이름이자 `아이템 구매`의
    // 종류 이름이라 라벨만으로는 둘이 안 갈린다.
    <View testID="spend-sheet-categories" className="flex-row flex-wrap gap-1.5">
      {SPEND_CATEGORIES.map((each) => (
        <CategoryChip
          key={each}
          label={each}
          selected={each === props.selected}
          onPress={() => props.onSelect(each)}
        />
      ))}
    </View>
  )
}

/**
 * 캐릭터 줄. **기본은 `선택 안함`**(사용자 지정 2026-08-26).
 *
 * **고를 것을 고르는 화면(타일 격자)에는 안 선다**. 거기엔 아직 적을 기록이 없다.
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
        className={`flex-1 text-right text-sm font-semibold ${
          props.valid ? 'text-text' : 'text-error-ink'
        }`}
        style={TABULAR_NUMS}
      />
      <Text className="shrink-0 text-xs text-text-muted">메포</Text>
    </View>
  )
}

/**
 * 저장 · 삭제 줄. 큰 숫자 **바로 아래**다.
 *
 * **타일 격자에는 저장이 없다**. 거기엔 셀 자리 자체가 없다. 그래서 `showSave` 를 받는다.
 * 삭제는 **버튼처럼 안 생겼다**. 이미 두 번 눌러야 여기까지 온다.
 */
export function SaveRow(props: {
  showSave: boolean
  editing: boolean
  canSave: boolean
  saving: boolean
  onSave: () => void
  onDelete?: () => void
}): React.JSX.Element {
  return (
    <>
      {props.showSave && (
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <Pressable
          role="button"
          // **보이는 글자와 같아야 한다**. 화면은 `수정`인데 읽어 주는 것이 `저장`이면
          // 그 둘은 다른 버튼이 된다.
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
      )}

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
