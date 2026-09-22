/**
 * 두 시트가 함께 쓰는 폼 부품 셋.
 *
 * 지출·수입 시트는 뼈대가 같다. 라벨–값 줄과 스테퍼는 그 뼈대의 부품이라 한 벌만 둔다.
 *
 * 세 번째 스테퍼 모양을 만들지 않는 것이 여기 모아 둔 이유다. 시트마다 하나씩 두면 다음은
 * 셋이 된다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { MinusIcon, PlusIcon, Text } from '../../components/atoms'
import { DateSelect } from '../../components/molecules/DateSelect/DateSelect'
import { CalendarPopover } from '../../components/organisms/CalendarPopover/CalendarPopover'
import { ChainSelect } from '../../components/organisms/ChainSelect/ChainSelect'
import {
  acceptMesoText,
  mesoValueOf,
  settleMesoText,
} from '../../components/organisms/MesoPad/meso-pad'
import { MESO_QUICK_ADDS } from '../../constants/domain/meso-quick-adds'
import { openInputCard } from '../../features/input-card/store'
import type { InputCardIcon } from '../../components/organisms/InputCard/InputCard'
import { characterOptions } from './character-options'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { monthKeyOf } from '../../lib/calendar'
import { TABULAR_NUMS } from '../../constants/style/text-styles'

/**
 * 머리의 날짜 고르개. 두 시트가 함께 쓰고, 보스 직접 완료 시트와 같은 부품이다(`DateSelect` +
 * `CalendarPopover`).
 *
 * 적고 나서 날을 잘못 골랐다는 것을 아는 자리가 여기다. 그때 시트를 닫고 캘린더로 돌아가 다시
 * 여는 것은 친 것을 버리는 일이다.
 */
export function SheetDateField(props: {
  dateKey: string
  onChange: (next: string) => void
  /** 고를 수 있는 첫날 · 끝날(두 끝 포함). 화면이 읽어서 넘긴다(부품은 시계를 안 본다). */
  min: string
  max: string
  /** 날짜 글자의 `testID`. 두 시트가 자기 이름을 준다. */
  testID: string
}): React.JSX.Element {
  const { ref, isOpen, anchor, toggle, close } = useAnchoredPopover()
  const [monthKey, setMonthKey] = useState(monthKeyOf(props.dateKey))

  function open(): void {
    // 달력은 언제나 지금 고른 날이 든 달로 열린다. 지난번에 넘겨 둔 달이 남으면 고른 날이 안 보인다.
    setMonthKey(monthKeyOf(props.dateKey))
    toggle()
  }

  return (
    <>
      <DateSelect ref={ref} dateKey={props.dateKey} label="적는 날" onPress={open} testID={props.testID} />
      {isOpen && (
        <CalendarPopover
          selected={props.dateKey}
          min={props.min}
          max={props.max}
          monthKey={monthKey}
          anchor={anchor}
          onChangeMonth={setMonthKey}
          onSelect={(next) => {
            props.onChange(next)
            close()
          }}
          onClose={close}
        />
      )}
    </>
  )
}

/**
 * 캐릭터 줄. 두 시트의 폼 여섯이 함께 쓴다.
 *
 * 안 고르면 자리표시자가 `캐릭터 선택` 이고 고르면 그 이름이 알약으로 선다. 목록 맨 앞의
 * `선택 안함` 은 되돌리는 자리이고 그 상태가 계정 단위(`ocid = null`)다.
 *
 * 사냥 폼의 캐릭터·지역·사냥터와 **같은 부품**이다. 여기서는 단계가 캐릭터 하나뿐이라 줄 수가
 * 줄지는 않는다. 같은 모양인 것이 값이다. 한 시트의 갈래들이 첫 줄에서 저마다 다른 모양으로
 * 캐릭터를 물으면 갈래를 옮길 때마다 다른 화면으로 읽힌다.
 *
 * 폼 안에 사는 것은 갈래를 옮기면 폼이 언마운트되어 고른 것이 함께 사라지기 때문이다.
 * 껍데기에 두면 그것만 남아 **갈래를 옮겼는데 캐릭터는 그대로** 가 된다.
 */
export function CharacterField(props: {
  characters: ReadonlyArray<{ ocid: string; name: string }>
  selected: string | null
  onSelect: (next: string | null) => void
  /** `{testID}-badge-캐릭터` · `{testID}-option-{ocid}`. 두 시트가 자기 이름을 준다. */
  testID: string
}): React.JSX.Element {
  return (
    <ChainSelect
      testID={props.testID}
      steps={[
        {
          name: '캐릭터',
          options: characterOptions(props.characters),
          selected: props.selected,
          onSelect: props.onSelect,
        },
      ]}
    />
  )
}

/**
 * 금액을 받는 칸. **누르면 입력 카드가 받는다.**
 *
 * 줄에는 값만 서고 실제 입력은 카드에만 있다. 카드는 칸 하나를 받고 닫히므로 이 부품은 차례를
 * 안 든다.
 *
 * 앞자리 0 을 걷는 정리가 이 부품의 일이다. 칸마다 손으로 달면 한 곳이 빠졌을 때 그 칸만 조용히
 * 안 정리된다. 빈 칸과 0 을 갈라야 하는 자리(사냥의 조각 가격)는 `onConfirm` 을 직접 준다.
 *
 * @param label 카드 머리에 서는 칸 이름
 * @param context 칸 이름 아래 한 줄. 어느 아이템의 값인지처럼 시트에서만 아는 맥락
 */
export function AmountInput(props: {
  testID: string
  label: string
  value: string
  onChange: (next: string) => void
  context?: string
  /** 값 오른쪽 단위. 줄에는 부르는 쪽이 따로 적고 여기 준 것은 카드가 쓴다. */
  unit?: string
  /** 한국어 단위 읽기(`1200만`). 메소 금액에만 뜻이 있다. */
  reading?: boolean
  icon?: InputCardIcon
  chips?: readonly { label: string; value: number }[]
  placeholder?: string
}): React.JSX.Element {
  const empty = props.value === ''
  return (
    <Pressable
      testID={props.testID}
      role="button"
      aria-label={props.label}
      onPress={() =>
        openInputCard({
          label: props.label,
          context: props.context,
          icon: props.icon,
          unit: props.unit,
          reading: props.reading,
          chips: props.chips ?? MESO_QUICK_ADDS,
          placeholder: props.placeholder,
          value: props.value,
          onConfirm: (next) => props.onChange(settleMesoText(acceptMesoText(props.value, next))),
        })
      }
      className="h-5 flex-1"
    >
      <Text
        className={`text-right text-sm font-semibold ${empty ? 'text-text-disabled' : 'text-text'}`}
        style={TABULAR_NUMS}
      >
        {empty ? (props.placeholder ?? '0') : mesoValueOf(props.value).toLocaleString()}
      </Text>
    </Pressable>
  )
}

/**
 * 글자를 받는 칸. **누르면 입력 카드가 글자판으로 받는다.**
 *
 * 줄에는 오른쪽 정렬로 값만 서고 카드 안에서는 왼쪽 정렬이다. 오른쪽 정렬은 값을 읽는 자리의
 * 규칙이고, 치는 동안에는 커서가 글자를 따라가는 쪽이 읽힌다. 이슈 #428(이름 칸이 오른쪽
 * 정렬이라 끝 공백이 안 보인다)이 카드에서 사라지는 것도 그래서다.
 *
 * @param label 카드 머리에 서는 칸 이름
 */
export function TextField(props: {
  testID: string
  label: string
  value: string
  onChange: (next: string) => void
  placeholder: string
}): React.JSX.Element {
  const empty = props.value === ''
  return (
    <Pressable
      testID={props.testID}
      role="button"
      aria-label={props.label}
      onPress={() =>
        openInputCard({
          label: props.label,
          text: true,
          placeholder: props.placeholder,
          value: props.value,
          onConfirm: props.onChange,
        })
      }
      className="h-5 flex-1"
    >
      <Text numberOfLines={1} className={`text-right text-sm ${empty ? 'text-text-disabled' : 'text-text'}`}>
        {empty ? props.placeholder : props.value}
      </Text>
    </Pressable>
  )
}

/**
 * 라벨–값 한 줄. 큰 숫자 위는 전부 이 모양이다.
 *
 * 축이 하나로 정리되는 것이 이 줄의 일이다. 라벨–값, 오른쪽 큰 숫자, 오른쪽 칩이 번갈아
 * 나오면 눈이 좌우로 튄다.
 */
export function FieldRow(props: {
  label: string
  children: React.ReactNode
  testID?: string
  labelTestID?: string
}): React.JSX.Element {
  return (
    <View
      testID={props.testID}
      className="min-h-7 flex-row items-center gap-3 border-b border-border pb-2"
    >
      <Text testID={props.labelTestID} className="shrink-0 text-xs text-text-muted">
        {props.label}
      </Text>
      {/*
        값 자리가 남은 폭을 갖는다.

        `ml-auto` 면 폭이 내용만큼이고 그 안에서 입력의 `flex-1` 은 채울 자리가 없어 아무 일도
        안 한다. 칸 폭이 자리표시자 글자에 끌려다녀 `내용` 의 자리표시자가 줄 가운데 떠 보인다.
        남은 폭을 주고 `justify-end` 로 오른쪽에 붙인다. 칸이 없는 값(세그먼트)은 그대로
        오른쪽에 서고, `flex-1` 인 입력은 줄 끝까지 채운다.
      */}
      <View className="flex-1 flex-row items-center justify-end">{props.children}</View>
    </View>
  )
}

/**
 * 수 스테퍼. 숫자만 오르내린다.
 *
 * 단위(회 · 개 · 포인트 · 시간)를 `+` 오른쪽에 붙이면 알약의 좌우가 안 맞는다. 기타처럼
 * 단위가 없는 자리는 그 칸이 빈 채로 간격만 남아 더 그렇다.
 *
 * `PartySizeStepper` 로 접지 않는다. 그 molecule 은 `Users` 표식과 두 크기가 못박혀 있어 이
 * 자리의 셋째 모양을 담지 못한다.
 */
export function QuantityStepper(props: {
  value: number
  /** 상한. 사용자가 준 한도에서 온다. 없는 항목은 안 막는다. */
  max?: number
  onChange: (next: number) => void
  /** 읽어 주는 이름의 뿌리. 한 시트에 스테퍼가 둘이면 수량 하나로는 못 가른다. */
  label?: string
  testID?: string
}): React.JSX.Element {
  const label = props.label ?? '수량'
  // 바닥은 1 이다. 수량도 소재도 **0** 이 뜻이 없다(0 소재를 돌았다는 말은 성립하지 않는다).
  const canDecrease = props.value > 1
  const canIncrease = props.max === undefined || props.value < props.max
  return (
    <View className="h-9 flex-row items-center gap-3 rounded-full border border-border px-2">
      <Pressable
        role="button"
        aria-label={`${label} 줄이기`}
        disabled={!canDecrease}
        onPress={() => props.onChange(props.value - 1)}
        hitSlop={8}
      >
        {/* NativeWind 의 `disabled:` 는 RN 의 `disabled` 프롭과 안 이어져 있다. JS 조건으로 쓴다. */}
        <MinusIcon
          className={`h-4 w-4 ${canDecrease ? 'text-text' : 'text-text-disabled'}`}
          strokeWidth={2}
          aria-hidden
        />
      </Pressable>
      <Text
        testID={props.testID}
        className="min-w-6 text-center text-sm font-bold text-text"
        style={TABULAR_NUMS}
      >
        {props.value}
      </Text>
      <Pressable
        role="button"
        aria-label={`${label} 늘리기`}
        disabled={!canIncrease}
        onPress={() => props.onChange(props.value + 1)}
        hitSlop={8}
      >
        <PlusIcon
          className={`h-4 w-4 ${canIncrease ? 'text-text' : 'text-text-disabled'}`}
          strokeWidth={2}
          aria-hidden
        />
      </Pressable>
    </View>
  )
}
