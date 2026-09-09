/**
 * 수입 기록 시트의 껍데기. 갈래가 안 바꾸는 것만 여기 있다.
 *
 * 제목 · 날짜 · 갈래 칩이 전부이고 그 아래는 갈래별 폼(`income/`)이 든다. 갈래를 옮기면 폼이
 * 언마운트되므로 고른 값이 함께 사라진다. **옮길 때 무엇을 지울까가 규칙이 아니라 기본값이다.**
 *
 * 여기 서는 것은 손입력 수익뿐이다. 보스 드롭은 안 들어온다. 이미 보스 수익 탭이 기록하고, 두
 * 곳에서 적으면 같은 판매가 두 벌이 된다.
 *
 * 뼈대는 지출 시트와 같다. 한 곳을 고치면 두 시트가 같이 고쳐진다.
 *
 * @see docs/features/cashbook.md 정책
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChevronLeftIcon, Text } from '../../components/atoms'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import type { MesoRateLoad } from '../../features/cashbook/meso-rate'
import type { LastHuntSelection } from '../../storage/last-hunt-selection'
import {
  type HuntInputMode,
  type IncomeCategory,
  type IncomeRecord,
} from '../../storage/income'
import { CategoryPicker } from './income/CategoryPicker'
import { CheckBox, DateStepper } from './sheet-fields'
import { EtcForm } from './income/EtcForm'
import { HuntCalculatorForm } from './income/HuntCalculatorForm'
import { ItemSaleForm } from './income/ItemSaleForm'
import { HuntManualForm } from './income/HuntManualForm'
import { SaveRow, type IncomeFormProps, type SaveSlot, type SheetCharacter } from './income/form-shared'

export type { IncomeDraft } from './income/form-shared'

export interface IncomeSheetProps {
  dateKey: string
  /**
   * 고를 수 있는 캐릭터. 화면이 읽어서 넘긴다(시트는 `storage/` 를 모른다). 비어 있으면
   * 고르개에 선택 안함 하나만 선다.
   *
   * `level` 은 사냥 계산기가 쓴다. 지역 목록을 거르고 레벨 차이 페널티를 낸다. 캐시에 없으면
   * `null` 이고 그때는 페널티 없이 계산하며 그 사실을 화면이 말한다.
   */
  characters: readonly SheetCharacter[]
  /**
   * 마지막으로 쓴 메소마켓 시세. 기타를 메포로 적을 때의 기본값이다. 지출 시트와 같은
   * 계약이라 화면이 한 값을 두 시트에 그대로 넘긴다.
   */
  lastPointRate: number | null
  /** 오늘. 머리의 날짜를 이 날 뒤로 못 옮긴다. 화면이 읽어서 넘긴다. */
  todayDateKey: string
  /** 캐릭터의 메소 획득량을 읽어 오는 콜백. 시트는 `nexon/` 도 `storage/` 도 모른다. 사냥 폼만 쓴다. */
  loadMesoRate: (ocid: string) => Promise<MesoRateLoad>
  /**
   * 마지막에 적은 사냥 자리(캐릭터 + 사냥터 이름). 사냥 계산기의 `사냥터 자동 입력` 이 쓴다.
   *
   * `null` 이면 한 번도 안 적었다는 뜻이라 그 버튼이 꺼진다. 시트는 `storage/` 를 모르므로
   * 화면이 읽어서 넘긴다.
   */
  lastHuntSelection: LastHuntSelection | null
  /**
   * 고칠 기록. 있으면 **수정 모드**다. 머리와 버튼 글자가 갈리고 삭제가 선다.
   */
  editing?: IncomeRecord
  onDelete?: () => void | Promise<void>
  /** 던지면 **안 닫는다**. 친 것을 잃지 않는다. 실패를 말하는 것은 화면 몫이다(토스트). */
  onSave: IncomeFormProps['onSave']
  onClose: () => void
}

export function IncomeSheet(props: IncomeSheetProps): React.JSX.Element {
  const editing = props.editing !== undefined
  /**
   * 무엇을 적나. `null` 이면 **아직 안 골랐다**이고 그때 이 시트는 갈래 고르개다.
   *
   * 수정으로 열면 기록이 정하므로 고르는 단계를 건너뛴다. 갈래를 바꾸면 그 기록은 다른 것이
   * 되고, 무엇이었는지는 제목이 이미 말한다.
   */
  const [category, setCategory] = useState<IncomeCategory | null>(props.editing?.category ?? null)
  /**
   * 어느 날에 적히나. 시트를 연 날로 시작하고 머리에서 바꾼다.
   *
   * 갈래 폼은 `key={category}` 로만 다시 심기므로 날짜를 바꿔도 친 것이 안 사라진다.
   */
  const [dateKey, setDateKey] = useState(props.dateKey)
  /**
   * 사냥을 어느 폼으로 적나. 수정으로 열면 기록이 정하고 안 바뀐다. 모드를 바꾸면 앱이 센
   * 합계가 사람이 친 값으로 둔갑한다.
   */
  const [huntMode, setHuntMode] = useState<HuntInputMode>(huntModeOf(props.editing))
  /**
   * 시트 바닥에 서는 저장 줄의 값. 폼이 마운트 뒤에 올린다.
   *
   * **처음부터 줄이 서 있어야 한다.** 폼이 올릴 때까지 비워 두면 시트가 열리는 도중에 바닥 줄이
   * 생기고, 그만큼 시트 키가 바뀌어 열리는 애니메이션 위에 크기 변화가 한 번 더 얹힌다. 그래서
   * 못 누르는 줄로 시작한다. 상자 크기는 손잡이가 붙기 전과 같다.
   */
  const [save, setSave] = useState<SaveSlot>({
    editing,
    canSave: false,
    saving: false,
    onSave: () => {},
    onDelete: props.onDelete === undefined ? undefined : () => {},
  })

  const formProps: IncomeFormProps = {
    setSave,
    dateKey,
    characters: props.characters,
    editing: props.editing,
    onDelete: props.onDelete,
    onSave: props.onSave,
    onClose: props.onClose,
  }

  if (category === null) {
    return (
      <BottomSheet
        testId="income-sheet"
        onClose={props.onClose}
        label="수입 기록"
      >
        {/*
          닫기의 자리와 상자는 다른 시트의 저장과 같다(전폭 · radius 12 · 44). 칠은 테마의
          `primary` 라 테마를 바꾸면 함께 바뀐다. 저장의 `rise-ink` 와 갈리는 것은 여기가 돈을
          적는 자리가 아니어서다.

          위 여백이 타일과의 간격보다 넓다. 고르는 것과 물러나는 것을 갈라 놓아야 손이 닫기로
          잘못 가지 않는다.
        */}
        <View className="gap-2 px-4 pb-2">
          <Text className="text-base font-bold text-text">수입 추가</Text>
          <CategoryPicker onSelect={setCategory} />
          <Pressable
            role="button"
            aria-label="닫기"
            testID="income-sheet-close"
            onPress={props.onClose}
            className="mt-7 items-center rounded-xl bg-primary py-3 active:opacity-60"
          >
            <Text className="text-sm font-bold text-on-primary">닫기</Text>
          </Pressable>
        </View>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet
      testId="income-sheet"
      onClose={props.onClose}
      label="수입 기록"
      // 치는 칸이 맨 아래에 모여 있다. 조각 개수와 조각 가격.
      scrollToEndOnKeyboard
      header={
        <View className="flex-row items-center justify-between gap-2">
          {/*
            제목이 곧 되돌아가는 누르개다. 갈래를 바꾸는 일이 1차 시트로 돌아가는 일이므로
            그 길이 제목에 붙는다(지출 시트의 둘째 화면과 같은 모양).

            수정 모드에는 안 붙는다. 그 기록의 갈래는 이미 정해졌고 바꾸면 다른 기록이 된다.
          */}
          {editing ? (
            <Text testID="income-sheet-title" numberOfLines={1} className="shrink text-base font-bold text-text">
              {category}
            </Text>
          ) : (
            <Pressable
              role="button"
              aria-label="갈래 다시 고르기"
              testID="income-sheet-back"
              onPress={() => setCategory(null)}
              hitSlop={8}
              className="-ml-1 shrink flex-row items-center gap-1 active:opacity-60"
            >
              <ChevronLeftIcon className="h-5 w-5 shrink-0 text-text" strokeWidth={2} aria-hidden />
              <Text testID="income-sheet-title" numberOfLines={1} className="shrink text-base font-bold text-text">
                {category}
              </Text>
            </Pressable>
          )}
          <DateStepper
            dateKey={dateKey}
            latest={props.todayDateKey}
            onChange={setDateKey}
            testID="income-sheet-date"
          />
        </View>
      }
      footer={<SaveRow {...save} />}
    >
      <View className="gap-3 px-4 pb-2">
        {/* 사냥만 갖는 줄. 계산기로 셀지, 획득 메소를 직접 적을지 고른다. */}
        {!editing && category === '사냥' && (
          // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
          <Pressable
            role="checkbox"
            aria-label="획득 메소 직접 입력"
            aria-checked={huntMode === 'manual'}
            onPress={() => setHuntMode(huntMode === 'manual' ? 'calculator' : 'manual')}
            hitSlop={8}
            // `self-start` 가 없으면 세로 스택의 자식이라 줄 끝까지 늘어난다. 빈 자리를 눌러도
            // 체크가 켜졌다(사용자 지적).
            className="flex-row items-center gap-2 self-start"
          >
            <CheckBox checked={huntMode === 'manual'} />
            <Text className="text-xs font-semibold text-text-muted">획득 메소 직접 입력</Text>
          </Pressable>
        )}

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
 * 이 기록을 어느 폼으로 여나. 기록에 박힌 값이 정한다.
 *
 * `hunt` 가 `null` 인 행은 계산기 도입 전에 적힌 것이라 수동으로 연다. 조각이 없어 합계가 곧
 * 획득 메소라 되짚을 수 있다. 새로 적을 때는 계산기로 시작한다.
 */
function huntModeOf(editing: IncomeRecord | undefined): HuntInputMode {
  if (editing === undefined) return 'calculator'
  return editing.hunt?.mode ?? 'manual'
}

/** 갈래 하나에 폼 하나. 고르는 자리는 여기 하나뿐이다. 사냥만 그 아래로 한 번 더 갈린다. */
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
    <HuntCalculatorForm
      {...props.formProps}
      loadMesoRate={props.loadMesoRate}
      lastHuntSelection={props.lastHuntSelection}
    />
  )
}
