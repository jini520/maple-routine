/**
 * 두 시트가 함께 쓰는 **폼 부품 둘**([[ADR-173]] 결정 1·18).
 *
 * 지출·수입 시트는 뼈대가 같다(결정 10) — 라벨–값 줄과 스테퍼는 그 뼈대의 부품이라 한 벌만 둔다.
 * 원래 `SpendSheet` 안에 살았고, 사냥 계산기가 같은 줄·같은 스테퍼를 쓰게 되면서 여기로 나왔다
 * ([[ADR-175]]). **모양은 한 글자도 안 바뀌었다** — 옮기기만 했다.
 *
 * 세 번째 스테퍼 모양을 만들지 않는 것이 옮긴 이유다. 결정 18 이 «앱에 스테퍼가 두 모양이 됐다»
 * 를 문제로 적었는데, 시트마다 하나씩 두면 다음은 셋이 된다.
 */
import { Pressable, View } from 'react-native'

import { Text } from '../../components/atoms/Text/Text'
import { TextInput, type TextInputProps } from '../../components/atoms/TextInput/TextInput'
import { formatDayLabel, shiftDateKey } from '../../lib/calendar-month'
import { ChevronLeftIcon, ChevronRightIcon, MinusIcon, PlusIcon } from '../../lib/icons'
import { TABULAR_NUMS } from '../../lib/text-styles'

/**
 * 라벨–값 줄의 **값 칸**([[ADR-178]] 결정 1 · 정정 4).
 *
 * ## 무엇이 어긋났나
 *
 * 같은 줄에 선 값과 단위(`10` · `개`)의 세로가 안 맞는다는 보고가 **세 번** 있었다. 세 번 다 단위
 * 쪽을 고쳤고 세 번 다 빗나갔다. 네 번째 화면이 변수를 갈라 줬다:
 *
 * | 값의 정체 | 단위와 맞나 |
 * |---|---|
 * | `Text`(획득 메소) | **맞는다** |
 * | `TextInput`(조각 · 조각 가격) | 안 맞는다 |
 *
 * 같은 줄·같은 정렬·같은 단위인데 **값이 `TextInput` 일 때만** 어긋난다. 즉 문제는 정렬도 단위도
 * 아니고 **`TextInput` 의 글자가 `Text` 와 다른 자리에 앉는다**는 것이다(플랫폼이 칸 안에서 글자를
 * 세우는 방식이 글자 노드와 다르다).
 *
 * ## 그래서 보이는 글자는 **언제나 `Text`** 다
 *
 * 칸은 그 위에 **글자색을 투명하게** 해서 얹는다 — 입력·커서만 맡고 그리지는 않는다. 그러면 값이
 * 맞아 보이던 그 줄(`Text`)과 **같은 조건**이 되므로, 두 글꼴 크기의 차이를 픽셀로 맞출 일이 없다.
 *
 * **조합이 도는 칸(글자 키보드)에는 안 쓴다.** 한글은 IME 가 칸 안에서 조합을 쥐고 있어
 * ([[ADR-170]] 정정 12) 부모 상태가 한 글자 늦는데, 그리는 쪽이 부모 상태면 **조합 중인 글자가
 * 안 보인다**. 그런 칸은 옆에 단위도 없다 — 어긋날 짝이 없다.
 */
function isNumeric(keyboardType: TextInputProps['keyboardType']): boolean {
  return (
    keyboardType === 'number-pad' ||
    keyboardType === 'numeric' ||
    keyboardType === 'decimal-pad' ||
    keyboardType === 'phone-pad'
  )
}

/** 칸을 글자 위에 정확히 겹친다 — 자리는 글자가 정하고 칸은 입력만 맡는다. */
const OVERLAY = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const

export function FieldTextInput({ style, ...rest }: TextInputProps): React.JSX.Element {
  if (!isNumeric(rest.keyboardType)) return <TextInput {...rest} style={style} />

  const value = typeof rest.value === 'string' ? rest.value : ''
  return (
    <View className="flex-1">
      {/*
        **보이는 글자** — 자리도 이 글자가 정한다. 비어 있으면 빈 칸 하나로 높이를 지킨다(칸의
        자리표시자가 그 위에 그려진다 — `placeholderTextColor` 는 글자색과 따로 논다).
      */}
      <Text aria-hidden className={rest.className} style={style}>
        {value === '' ? ' ' : value}
      </Text>
      <TextInput {...rest} style={[style, OVERLAY, { color: 'transparent' }]} />
    </View>
  )
}

/**
 * 머리의 **날짜 고르개**([[ADR-178]] 정정 6, 사용자 지정 2026-08-29) — **두 시트가 함께 쓴다**.
 *
 * 종전에는 «날짜는 캘린더에서 고르는 것» 이라 시트가 그것을 **적기만** 했다 — 시트에 고르개를 또
 * 두면 같은 값을 정하는 자리가 둘이 되기 때문이었다. 그런데 **적고 나서 날을 잘못 골랐다는 것을
 * 아는 자리가 여기**다: 그때 시트를 닫고 캘린더로 돌아가 다시 여는 것은 친 것을 버리는 일이다.
 *
 * **하루씩 옮긴다.** 실제로 필요한 것은 «어제 것을 오늘 칸에서 적고 있었다» 같은 한두 칸이고,
 * 멀리 뛰는 것은 캘린더가 이미 한다 — 그 일을 시트가 두 벌로 갖지 않는다.
 */
export function DateStepper(props: {
  dateKey: string
  onChange: (next: string) => void
  /** `{testID}` · `{testID}-prev` · `{testID}-next` — 두 시트가 자기 이름을 준다. */
  testID: string
}): React.JSX.Element {
  return (
    <View className="shrink-0 flex-row items-center gap-1">
      <Pressable
        role="button"
        aria-label="하루 앞으로"
        testID={`${props.testID}-prev`}
        onPress={() => props.onChange(shiftDateKey(props.dateKey, -1))}
        hitSlop={8}
      >
        <ChevronLeftIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
      </Pressable>
      <Text testID={props.testID} className="text-xs text-text-muted" style={TABULAR_NUMS}>
        {formatDayLabel(props.dateKey)}
      </Text>
      <Pressable
        role="button"
        aria-label="하루 뒤로"
        testID={`${props.testID}-next`}
        onPress={() => props.onChange(shiftDateKey(props.dateKey, 1))}
        hitSlop={8}
      >
        <ChevronRightIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
      </Pressable>
    </View>
  )
}

/**
 * 라벨–값 한 줄([[ADR-173]] 결정 1) — 큰 숫자 위는 **전부 이 모양**이다.
 *
 * 축이 하나로 정리되는 것이 이 줄의 일이다. 전에는 라벨–값, 오른쪽 큰 숫자, 오른쪽 칩이 번갈아
 * 나와 눈이 좌우로 튀었다.
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
        **값 자리가 남은 폭을 갖는다**([[ADR-170]] 정정 14 ③).

        종전에는 `ml-auto` 라 폭이 **내용만큼**이었고, 그 안에서 입력의 `flex-1` 은 채울 자리가
        없어 아무 일도 안 했다 — 칸 폭이 자리표시자 글자에 끌려다녀 「사용처」 의 자리표시자가
        줄 가운데 떠 보였다(사용자 보고). 남은 폭을 주고 `justify-end` 로 오른쪽에 붙인다:
        칸이 없는 값(세그먼트)은 그대로 오른쪽에 서고, `flex-1` 인 입력은 줄 끝까지 채운다.
      */}
      <View className="flex-1 flex-row items-center justify-end">{props.children}</View>
    </View>
  )
}

/**
 * 수 스테퍼 — **숫자만 오르내린다**([[ADR-173]] 결정 18, 사용자 지정 2026-08-27).
 *
 * 단위(회 · 개 · 포인트 · 시간)를 `+` 오른쪽에 붙이고 있었는데 **알약의 좌우가 안 맞았다** —
 * 「기타」처럼 단위가 없는 자리는 그 칸이 빈 채로 간격만 남아 더 그랬다. 무엇보다 이 앱의 스테퍼가
 * 두 모양이 됐다(`PartySizeStepper` 의 기본 크기는 「인」 을 그렸다). **둘 다 숫자만 그린다.**
 *
 * `PartySizeStepper` 로 접지 않는 것은 그대로다 — 그 molecule 은 `Users` 표식과 두 크기가
 * [[ADR-121]] 결정 7 로 못박혀 있어 이 자리의 셋째 모양을 담지 못한다.
 */
export function QuantityStepper(props: {
  value: number
  /** 상한 — 사용자가 준 한도에서 온다. 없는 항목은 안 막는다([[ADR-006]]). */
  max?: number
  onChange: (next: number) => void
  /** 읽어 주는 이름의 뿌리 — 한 시트에 스테퍼가 둘이면 「수량」 하나로는 못 가른다. */
  label?: string
  testID?: string
}): React.JSX.Element {
  const label = props.label ?? '수량'
  // 바닥은 1 이다 — 수량도 소재도 «0» 이 뜻이 없다(0 소재를 돌았다는 말은 성립하지 않는다).
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
        {/* NativeWind 의 `disabled:` 는 RN 의 `disabled` 프롭과 안 이어져 있다 — JS 조건으로 쓴다
            (`PartySizeStepper` ① 과 같은 함정). */}
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
