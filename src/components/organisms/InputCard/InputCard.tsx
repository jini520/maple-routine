/**
 * 시트의 칸 하나를 키보드 위에서 받는 카드.
 *
 * 시트는 키보드에 반응하지 않는다. 칸을 누르면 시트를 한 겹 더 덮고 이 카드가 떠서 그 칸만
 * 받는다. 시트의 칸은 값을 보여 주는 누르개가 되고 실제 입력은 여기에만 있다.
 *
 * **칸 하나를 받고 닫힌다.** 다음 칸으로 넘기는 버튼이 없어서 이전 버튼도 없다. 다음 칸은 시트의
 * 그 줄을 다시 눌러 새 카드를 연다. 그래서 폼이 치는 칸의 차례를 들 일이 없다. 조건에 따라
 * 섰다 말았다 하는 줄이 여럿이라 그 목록은 고정으로 둘 수 없는 것이었다.
 *
 * **셈한 결과를 안 그린다.** 합계는 확인을 누르고 시트로 돌아가면 큰 숫자 자리에 이미 서 있다.
 *
 * 정리(앞자리 0 걷기 · 빈 칸과 0 가르기)는 **호출부가 한다**. 폼마다 규칙이 갈려서다. 사냥의
 * 조각 가격은 빈 칸이 보관이고 0 은 0 메소에 판 것이다.

 *
 * @example
 * <InputCard
 *   label="조각 가격"
 *   context="솔 에르다 조각 · 개당"
 *   icon="meso"
 *   unit="메소"
 *   reading
 *   chips={MESO_QUICK_ADDS}
 *   value={fragmentPriceText}
 *   onConfirm={(next) => setFragmentPriceText(optionalMesoTextOf(optionalMesoValueOf(next)))}
 *   onCancel={() => setEditing(null)}
 * />
 */
import { useState } from 'react'
import { Image, Keyboard, Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'

import { getItemIconUrlByFile } from '../../../lib/assets/asset-lookup'
import { formatMesoUnits } from '../../../lib/drop/drop-price'
import { Text, TextInput, XIcon } from '../../atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { MAX_MESO, acceptMesoText, mesoTextOf, mesoValueOf } from '../MesoPad/meso-pad'

/** 머리에 서는 표식. 메소를 받는 칸은 주머니, 조각 개수는 조각이다. */
export type InputCardIcon = 'meso' | 'fragment'

/**
 * 값 칸 아래 수 고르개. 라벨도 접미사도 호출부가 준다.
 *
 * `value` 는 **씨앗**이다. 그 뒤의 수는 카드가 들고, 확인이 친 값과 함께 내보낸다. 친 값과 같은
 * 자리에 두는 것이 요점이다. 호출부가 들면 한 번 누를 때마다 카드를 다시 열어야 한다.
 */
export interface StepperSpec {
  label: string
  value: number
  min: number
  max: number
  /** 수 뒤에 붙는 글자. `인` · `개`. 안 주면 수만 선다. */
  suffix?: string
}

/**
 * 수 고르개 한 줄. 알약 안에 `−` 값 `+` 다.
 *
 * 크기 22px 은 `PartySizeStepper` 의 두 크기(관리 행 24 · 모달 32) 중 어느 쪽도 아니다. 카드가
 * 키보드 위 좁은 자리라 그보다 작다. 넷째 모양을 만들지 않으려고 그 molecule 로 접지 않는다.
 */
function StepperRow(props: StepperSpec & { value: number; onChange: (next: number) => void }): React.JSX.Element {
  const atMin = props.value <= props.min
  const atMax = props.value >= props.max
  return (
    <View className="mt-3 flex-row items-center justify-between gap-2.5">
      <Text className="text-xs font-semibold text-text-muted">{props.label}</Text>
      <View className="h-8 flex-row items-center gap-2.5 rounded-full border border-border px-1.5">
        <Pressable
          testID="input-card-stepper-down"
          role="button"
          onPress={() => props.onChange(props.value - 1)}
          disabled={atMin}
          aria-label={`${props.label} 감소`}
          className={`h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-2${
            atMin ? ' opacity-40' : ''
          }`}
        >
          <Text className="text-text">−</Text>
        </Pressable>
        <Text
          testID="input-card-stepper-value"
          className="min-w-[30px] text-center text-13 font-semibold text-text"
          style={TABULAR_NUMS}
        >
          {`${props.value}${props.suffix ?? ''}`}
        </Text>
        <Pressable
          testID="input-card-stepper-up"
          role="button"
          onPress={() => props.onChange(props.value + 1)}
          disabled={atMax}
          aria-label={`${props.label} 증가`}
          className={`h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-2${
            atMax ? ' opacity-40' : ''
          }`}
        >
          <Text className="text-text">+</Text>
        </Pressable>
      </View>
    </View>
  )
}

export interface InputCardProps {
  /** 칸 이름. 머리의 큰 글자. */
  label: string
  /** 칸 이름 아래 한 줄. 어느 아이템의 값인지처럼 시트에서만 알 수 있는 맥락. */
  context?: string
  /**
   * 반드시 있어야 하는 칸. 별표가 채워도 안 사라진다. `지금 비었다` 가 아니라 `이 칸은 반드시
   * 있어야 한다` 를 말하기 때문이다.
   */
  required?: boolean
  icon?: InputCardIcon
  /** 값 오른쪽 단위. `메소` · `개` · `%` · `메포`. */
  unit?: string
  placeholder?: string
  /** 시트가 든 지금 글자. 카드는 이것을 씨앗으로만 받는다. */
  value: string
  /**
   * 한국어 단위 읽기(`1200만`)를 값 왼쪽에 적을지. 메소 금액에만 뜻이 있다. 개수 · 비율 · 시세는
   * 자릿수가 작아 읽어 줄 것이 없고, 그 자리는 맥락 줄이 대신 진다.
   */
  reading?: boolean
  /** 글자 칸. 글자판이 뜨고 값이 왼쪽 정렬이며 칩이 안 선다. */
  text?: boolean
  /** 값에 더하는 눈금. 글자 칸에서는 무시된다. */
  chips?: readonly { label: string; value: number }[]
  /**
   * 값 칸 아래에 서는 **수 고르개 하나**. 넘기면 카드가 칸 둘을 받는 모양이 된다.
   *
   * 라벨은 호출부가 준다. 부품은 그 수가 무엇인지 모른다. 드롭 판매가가 `분배 인원` 으로 쓴다.
   */
  stepper?: StepperSpec
  /** 확인 버튼의 글자. 기본은 `확인`. 값을 곧 저장하는 자리에서는 `저장` 이다. */
  confirmLabel?: string
  /**
   * 확인 왼쪽에 서는 곁들이. 값을 안 쓰고 **다른 상태로 끝내는** 길이다. 드롭 판매가의
   * `기록 안함` 이 쓴다.
   */
  exclude?: { label: string; onPress: () => void }
  /**
   * 확인 오른쪽에 서는 곁들이. **아무것도 안 쓰고** 다음으로 넘긴다. 친 값은 버려지는데,
   * 확인 없이 닫으면 버린다는 규칙과 같다.
   */
  next?: { label: string; onPress: () => void }
  /**
   * 확인. 친 글자를 그대로 준다. 정리는 받는 쪽이 한다.
   *
   * 둘째 인자는 **스테퍼를 넘겼을 때만** 온다. 안 넘긴 카드는 인자 하나로 부른다. 없는 수를
   * `0` 으로 채워 보내면 받는 쪽이 그것을 값으로 읽을 수 있다.
   */
  onConfirm: (next: string, stepper?: number) => void
  /**
   * 버리고 닫기. **닫기 버튼(✕)과 안드로이드 뒤로가기**가 부른다.
   *
   * 스크림 탭은 안 부른다(사용자 지정). 실수로 판 밖을 눌러 치던 값이 날아가는 것을 막는다.
   */
  onCancel: () => void
  /**
   * 카드 판을 띄우는 자리. `InputCardLayer` 가 키보드 높이를 여기로 준다.
   *
   * **스크림이 아니라 판만 띄운다.** 바깥 상자에 여백을 주면 그 안에 사는 스크림이 여백 위에서
   * 끊겨 키보드와 카드 사이에 안 덮인 띠가 남는다(사용자가 실기 화면에서 잡았다).
   */
  panelStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>
}

/** 표식 이름에서 그림으로. 없는 그림은 없는 채로 둔다. */
function iconSourceOf(icon: InputCardIcon | undefined): ReturnType<typeof getItemIconUrlByFile> {
  if (icon === undefined) return null
  return getItemIconUrlByFile(icon === 'meso' ? 'meso_pouch.webp' : 'sol_erda_fragment.webp')
}

export function InputCard(props: InputCardProps): React.JSX.Element {
  const [draft, setDraft] = useState(props.value)
  const [step, setStep] = useState(props.stepper?.value ?? 0)

  const isText = props.text === true
  const chips = isText ? [] : (props.chips ?? [])
  const iconSource = iconSourceOf(props.icon)

  /**
   * 칸에 보이는 글자. **숫자는 콤마로 끊는다**(사용자 지정). 자릿수가 커서 안 끊으면 억인지
   * 조인지 눈으로 세야 한다.
   *
   * 들고 있는 값(`draft`)은 숫자만이다. 콤마는 보이는 자리에서만 붙이고, 돌아올 때 `acceptMesoText`
   * 가 걷는다. `0` 을 빈 칸으로 접지 않는 것은 사냥의 조각 가격에서 **빈 칸은 보관이고 0 은 0 메소에
   * 판 것**이라 뜻이 갈리기 때문이다.
   */
  const shown = isText || draft === '' ? draft : mesoValueOf(draft).toLocaleString()

  function change(next: string): void {
    setDraft(isText ? next : acceptMesoText(draft, next))
  }

  function add(step: number): void {
    setDraft(mesoTextOf(Math.min(MAX_MESO, mesoValueOf(draft) + step)))
  }

  return (
    // 자리는 `InputCardLayer` 가 준다. 카드는 자기가 키보드 위 어디에 앉는지 모른다.
    <View className="flex-1 justify-end" testID="input-card">
      {/*
        시트 위에 한 겹 더. **누르면 키보드만 내린다**(사용자 지정). 카드는 안 닫힌다. 닫는 것은
        ✕ 뿐이다. 판의 빈 자리와 같은 일을 하므로 카드 안팎이 같은 규칙이 된다.

        터치는 여기서 멈춘다. 카드가 열려 있는 동안 뒤의 시트는 안 눌린다.
      */}
      <Pressable
        testID="input-card-scrim"
        onPress={Keyboard.dismiss}
        className="absolute inset-0 bg-scrim"
      />

      {/*
        띄우는 상자와 그리는 상자를 **가른다**. 한 상자에 `style` 과 `className` 을 함께 주면
        NativeWind 가 클래스를 `style` 로 푸는 바람에 한쪽이 덮여, 판의 바탕·모서리·여백이
        통째로 사라진다(시뮬레이터에서 두 번 그렇게 났다).
      */}
      <Animated.View style={props.panelStyle}>
        {/*
          판의 **빈 자리를 누르면 키보드만 내린다**(사용자 지정). 카드는 제자리에 남는다. 자리는
          마지막으로 잰 키보드 높이를 붙들고 있어 안 흔들린다.

          누르개가 아니면 아무 일도 안 일어난다. RN 은 터치가 닿은 가장 위 뷰에서 멈추고 뒤의
          스크림으로 흘려보내지 않는다. 그래서 손에 익은 **입력 칸 밖을 누르면 키보드가 내려간다**
          가 저절로는 성립하지 않았다.
        */}
        <Pressable
          testID="input-card-panel"
          onPress={Keyboard.dismiss}
          className="mx-3 mb-3 rounded-2xl border border-border-strong bg-surface p-4"
        >
          <View className="flex-row items-center gap-2.5">
            {iconSource !== null && (
              // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
              <Image source={iconSource} resizeMode="contain" className="h-7 w-7 shrink-0" aria-hidden />
            )}
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-sm font-bold text-text">
                {props.label}
                {props.required === true && (
                  <Text testID="input-card-required" className="text-error-ink">
                    {' *'}
                  </Text>
                )}
              </Text>
              {props.context !== undefined && (
                <Text testID="input-card-context" numberOfLines={1} className="text-11 text-text-muted">
                  {props.context}
                </Text>
              )}
            </View>
            <Pressable
              testID="input-card-close"
              role="button"
              aria-label="닫기"
              onPress={props.onCancel}
              className="-mr-2.5 h-11 w-11 items-center justify-center"
            >
              <XIcon className="h-5 w-5 text-text-muted" aria-hidden />
            </Pressable>
          </View>

          {/*
            읽기 칸은 값이 비어도 자리를 지킨다. 사라지면 첫 타건에 값이 왼쪽으로 밀린다.
            글자 칸에는 읽어 줄 단위가 없어 그 자리를 아예 안 세운다.
          */}
          {/*
          **높이를 못박지 않고 여백으로 만든다.** 상자에 `h-14`, 안쪽 칸에 `h-9` 를 주면 둘의
          가운데가 서로 어긋나 글자가 위로 붙었다(사용자 지적). 위아래 여백을 같은 값으로 주고
          줄 높이가 상자를 정하면 대칭이 구조로 보장된다. `min-h-14` 는 값이 짧아도 상자가
          작아지지 않게 하는 바닥이다.
        */}
        <View className="mt-3 min-h-14 flex-row items-center gap-2 rounded-xl border-[1.5px] border-primary bg-bg px-3.5 py-2.5">
            {props.reading === true && (
              <Text testID="input-card-reading" className="shrink-0 text-xs text-text-muted" style={TABULAR_NUMS}>
                {draft === '' ? '' : formatMesoUnits(mesoValueOf(draft))}
              </Text>
            )}
            <TextInput
              testID="input-card-value"
              aria-label={props.label}
              value={shown}
              onChangeText={change}
              keyboardType={isText ? undefined : 'number-pad'}
              placeholder={props.placeholder ?? (isText ? '' : '0')}
              autoFocus
              /*
                **글자와 숫자의 크기가 다르다.** 숫자는 자릿수를 세는 값이라 크게 두고, 글자는
                한 줄에 이름이 다 들어가야 해서 한 단계 작다. 둘을 같은 크기로 두면 글자 칸에서
                자리표시자까지 카드를 꽉 채운다.
              */
              /*
                **줄 높이를 아예 안 준다.** `text-*` 가 함께 넣는 `lineHeight` 가 iOS 에서 줄 상자를
                아래로 밀어 위아래 여백이 어긋났고(위 18 · 아래 14.7 로 쟀다), `leading-none` 으로
                글자 크기와 같게 맞췄더니 이번엔 숫자 윗부분이 잘렸다(사용자 지적). 크기만 주고
                줄 높이는 글꼴이 정하게 두면 둘 다 안 난다.

                **높이 `h-9` 는 못박는 값이다.** 안 주면 iOS 가 담은 글자의 종류대로 칸 키를 재서
                한글을 칠 때와 숫자를 칠 때 상자가 다른 높이가 된다. 36 + 위아래 여백 20 이 상자의
                바닥 `min-h-14`(56)와 같아서 지금 보이는 모양은 안 바뀐다. 글자는 이 36 안에서
                가운데 선다.
              */
              className={`h-9 flex-1 text-text ${isText ? 'text-left font-semibold' : 'text-right font-bold'}`}
              style={[isText ? null : TABULAR_NUMS, { fontSize: isText ? 16 : 20 }]}
            />
            {props.unit !== undefined && (
              <Text className="shrink-0 text-xs font-semibold text-text-muted">{props.unit}</Text>
            )}
          </View>

          {chips.length > 0 && (
            <View className="mt-2 flex-row flex-wrap justify-end gap-1.5">
              {chips.map((chip) => (
                <Pressable
                  key={chip.label}
                  role="button"
                  onPress={() => add(chip.value)}
                  className="h-7 justify-center rounded-full border border-border px-2.5 active:bg-surface-2"
                >
                  <Text className="text-11 font-semibold text-text-muted" style={TABULAR_NUMS}>
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {props.stepper !== undefined && (
            <StepperRow
              {...props.stepper}
              value={step}
              onChange={(next) =>
                setStep(Math.min(props.stepper?.max ?? next, Math.max(props.stepper?.min ?? next, next)))
              }
            />
          )}

          {/*
            버튼 줄. 곁들이가 없으면 확인 혼자 줄을 채운다(`flex-1`). 셋이 서면 확인이 가장
            넓다. 셋 다 지금 것을 처리하고 끝내는 길이라 층을 안 나누고 한 줄에 둔다.
          */}
          <View className="mt-3 h-11 flex-row items-center gap-2">
            {props.exclude !== undefined && (
              <Pressable
                testID="input-card-exclude"
                role="button"
                onPress={props.exclude.onPress}
                className="h-11 shrink-0 justify-center rounded-xl border border-border px-3.5 active:bg-surface-2"
              >
                <Text className="text-xs font-semibold text-text-muted">{props.exclude.label}</Text>
              </Pressable>
            )}
            <Pressable
              testID="input-card-confirm"
              role="button"
              onPress={() => {
                if (props.stepper === undefined) props.onConfirm(draft)
                else props.onConfirm(draft, step)
              }}
              className="h-11 flex-1 items-center justify-center rounded-xl bg-primary"
            >
              <Text className="text-sm font-bold text-on-primary">{props.confirmLabel ?? '확인'}</Text>
            </Pressable>
            {props.next !== undefined && (
              <Pressable
                testID="input-card-next"
                role="button"
                onPress={props.next.onPress}
                className="h-11 shrink-0 justify-center rounded-xl border border-border px-3.5 active:bg-surface-2"
              >
                <Text className="text-xs font-semibold text-text-muted" style={TABULAR_NUMS}>
                  {props.next.label}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  )
}
