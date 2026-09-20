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

import { CheckIcon, MinusIcon, PlusIcon, Text } from '../../components/atoms'
import { DateSelect } from '../../components/molecules/DateSelect/DateSelect'
import { CalendarPopover } from '../../components/organisms/CalendarPopover/CalendarPopover'
import { ChainSelect } from '../../components/organisms/ChainSelect/ChainSelect'
import {
  acceptMesoText,
  settleMesoText,
} from '../../components/organisms/MesoPad/meso-pad'
import { SheetTextInput } from '../../components/molecules/SheetTextInput/SheetTextInput'
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
 * 라벨–값 한 줄. 큰 숫자 위는 전부 이 모양이다.
 *
 * 축이 하나로 정리되는 것이 이 줄의 일이다. 라벨–값, 오른쪽 큰 숫자, 오른쪽 칩이 번갈아
 * 나오면 눈이 좌우로 튄다.
 */
/**
 * 체크박스의 네모 하나. 라벨은 부르는 쪽이 붙인다.
 *
 * 끈 것도 상자가 보인다. 맨 테두리 하나면 어두운 배경에서 그 선이 잘 안 보여 켜짐과 꺼짐이
 * 색 하나로만 갈린다. 끈 쪽에 옅은 바탕을 깔면 상자가 먼저 눈에 들고 그 안이 차는 것이 곧
 * 켜짐이 된다.
 *
 * 모서리는 `rounded-md`(6px)다. 4px 는 각지고 완전한 원은 고르는 하나로 읽힌다. 획이 얇아야
 * 12px 안에서 안 뭉갠다. 3 은 체크가 삼각형처럼 보인다.
 */
export function CheckBox(props: { checked: boolean }): React.JSX.Element {
  return (
    <View
      className={`h-[18px] w-[18px] items-center justify-center rounded-md border ${
        props.checked ? 'border-primary bg-primary' : 'border-border bg-surface-2'
      }`}
    >
      {props.checked && (
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <CheckIcon className="h-3 w-3 text-on-primary" strokeWidth={2.5} aria-hidden />
      )}
    </View>
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
 * 금액을 받는 칸. 글자를 들고 셈은 부르는 쪽이 한다.
 *
 * 커서가 빠질 때 앞자리 0 을 걷는 것이 이 부품의 일이다. 칸마다 손으로 달면 한 곳이 빠졌을 때
 * 그 칸만 조용히 안 정리된다.
 *
 * 키보드는 숫자판 그대로다. 값이 글자가 된 것과 무엇으로 치느냐는 다른 이야기다.
 */
export function AmountInput(props: {
  testID: string
  value: string
  onChange: (next: string) => void
}): React.JSX.Element {
  return (
    <SheetTextInput
      testID={props.testID}
      value={props.value}
      onChangeText={(text) => props.onChange(acceptMesoText(props.value, text))}
      onBlur={() => props.onChange(settleMesoText(props.value))}
      keyboardType="number-pad"
      placeholder="0"
      className="h-5 flex-1 text-right text-sm font-semibold text-text"
      style={TABULAR_NUMS}
    />
  )
}

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
