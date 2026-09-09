/**
 * 한 줄이 값 여럿을 지는 고르개. 고른 것은 알약이 되어 왼쪽에 쌓이고, 자리표시자는 남은 것만
 * 읽는다.
 *
 * 값마다 줄을 쓰면 값 하나가 줄 28 에 갭 12 를 진다. 사냥 시트는 그렇게 세 줄 84 에 갭 24 를
 * 쓰고 있었고, 이 부품이 그것을 28 짜리 한 줄로 바꾼다. 알약이 20 이고 값도 20 이라 무엇을
 * 골라도 줄 높이가 안 바뀐다.
 *
 * 목록과 그 자리잡기는 `SelectField` 것을 그대로 쓴다. 트리거만 이쪽이 그린다.
 *
 * @example
 * <ChainSelect
 *   testID="hunt-chain"
 *   steps={[
 *     { name: '캐릭터', options: characterOptions, selected: ocid, onSelect: selectCharacter },
 *     { name: '지역', options: regionOptions, selected: regionSlug, onSelect: selectRegion },
 *   ]}
 * />
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  Easing,
  LinearTransition,
  useSharedValue,
  withTiming,
  type EntryAnimationsValues,
  type LayoutAnimation,
} from 'react-native-reanimated'

import { ChevronDownIcon, Text } from '../../atoms'
import { SelectField, type SelectOption } from '../SelectField/SelectField'

export interface ChainStep {
  /** 자리표시자에 서는 이름. `캐릭터·지역·사냥터 선택` 의 그 낱말이다. */
  name: string
  options: readonly SelectOption[]
  selected: string | null
  onSelect: (value: string | null) => void
  /** 목록 한 줄을 그리는 법. `SelectField` 로 그대로 넘어간다. */
  renderOption?: (option: SelectOption, isSelected: boolean) => React.ReactNode
}

/**
 * 애니메이션이 붙는 상자. `Animated.View` 를 그대로 쓰면 안 된다.
 *
 * 앱이 `lib/nativewind-interop` 에서 `Animated.View` 를 NativeWind 에 등록해 두는데, 그러면
 * `style` 이 그쪽 처리를 한 번 거치면서 리애니메이티드가 넘긴 것이 안 붙는다.
 */
const AnimatedBox = Animated.createAnimatedComponent(View)

/** 알약이 자리표시자에서 제자리까지 미끄러지는 시간. */
const SLIDE_MS = 260

/** 고른 값의 이름. 목록에 없으면 빈 글자라 알약이 안 선다. */
function labelOf(step: ChainStep): string {
  return step.options.find((option) => option.value === step.selected)?.label ?? ''
}

export function ChainSelect(props: {
  steps: readonly ChainStep[]
  testID: string
}): React.JSX.Element {
  /**
   * 어느 단계의 목록을 열지. 알약을 누르면 그 단계이고, 자리표시자를 누르면 **안 고른 첫
   * 단계**다. 열기 전에 정해 두므로 목록이 뜰 때는 이미 그 단계의 보기가 들어 있다.
   */
  const [activeIndex, setActiveIndex] = useState(0)

  /**
   * 값이 `null` 인 보기(`선택 안함` · 안내 문구)를 고르면 **되돌리기**다.
   *
   * 이미 고른 단계였으면 그 값을 걷는다. 알약이 사라지고 뒤 단계도 함께 걷히므로(그 규칙은
   * 부르는 쪽에 있다) 자리표시자가 그 단계로 되돌아온다. 안 고른 단계였으면 걷을 것이 없어
   * 목록만 닫는다(`SelectField` 가 닫는다).
   */
  function pick(index: number, value: string | null): void {
    const step = props.steps[index]
    if (value === null && step.selected === null) return
    step.onSelect(value)
  }

  /** 줄의 폭. 새 알약이 어디서 출발할지를 이 값이 정한다. */
  const rowWidth = useSharedValue(0)

  /**
   * 새 알약은 **자리표시자가 있던 오른쪽 끝에서 나와** 제자리까지 미끄러진다. 방금 고른 값이
   * 어디에서 와서 어디에 놓였는지를 눈이 따라간다.
   *
   * 출발점은 줄의 오른쪽 끝에 붙인 자리다. 자리표시자의 정확한 위치가 아니라 그 줄에서 값을
   * 고르는 자리가 언제나 오른쪽 끝이라서 그렇게 잡는다. 줄 폭을 아직 못 쟀으면 제자리에서
   * 떠오르는 것으로 물러난다.
   */
  const 알약이온다 = (values: EntryAnimationsValues): LayoutAnimation => {
    'worklet'
    const 출발 = Math.max(values.targetOriginX, rowWidth.get() - values.targetWidth)
    return {
      initialValues: { originX: 출발, opacity: 0 },
      animations: {
        originX: withTiming(values.targetOriginX, {
          duration: SLIDE_MS,
          easing: Easing.out(Easing.cubic),
        }),
        opacity: withTiming(1, { duration: 90 }),
      },
    }
  }

  /**
   * 값이 있으면 고른 것이다. `선택 안함` 은 고른 것이 아니라 되돌린 것이라 여기 안 든다.
   *
   * 그래서 앞 단계를 안 고르면 뒤 단계에 닿을 수 없다. 자리표시자는 **안 고른 첫 단계**를 열고,
   * 알약은 고른 단계에만 서기 때문이다(사냥터를 고르려면 지역을, 지역을 고르려면 캐릭터를).
   */
  const isChosen = (step: ChainStep): boolean => step.selected !== null

  const 남은 = props.steps.filter((step) => !isChosen(step))
  const placeholder = 남은.length === 0 ? null : `${남은.map((step) => step.name).join(' · ')} 선택`
  const 첫빈칸 = props.steps.findIndex((step) => !isChosen(step))
  const active = props.steps[activeIndex] ?? props.steps[0]

  return (
    <SelectField
      label={active.name}
      options={active.options}
      selected={active.selected}
      onSelect={(value) => pick(activeIndex, value)}
      renderOption={active.renderOption}
      testID={props.testID}
      renderTrigger={(open) => (
        <View
          onLayout={(event) => rowWidth.set(event.nativeEvent.layout.width)}
          className="min-h-7 flex-row items-center gap-2 border-b border-border pb-2"
        >
          {/*
            새 알약은 오른쪽 끝에서 미끄러져 들어오고, 이미 선 알약들은 `LinearTransition` 이
            잇는다. 값이 어디에서 와서 어디에 놓였는지를 눈이 따라간다.
          */}
          <AnimatedBox
            layout={LinearTransition.duration(SLIDE_MS)}
            className="flex-row items-center gap-1.5"
          >
            {props.steps.map((step, index) =>
              !isChosen(step) || labelOf(step) === '' ? null : (
                <AnimatedBox
                  key={step.name}
                  entering={알약이온다}
                  layout={LinearTransition.duration(SLIDE_MS)}
                  className="shrink-0"
                >
                  <Pressable
                    role="button"
                    aria-label={`${step.name} 다시 고르기`}
                    testID={`${props.testID}-badge-${step.name}`}
                    onPress={() => {
                      setActiveIndex(index)
                      open()
                    }}
                    className="h-5 justify-center rounded-full bg-surface-2 px-2 active:opacity-60"
                  >
                    <Text className="text-chip font-semibold text-text">{labelOf(step)}</Text>
                  </Pressable>
                </AnimatedBox>
              ),
            )}
          </AnimatedBox>

          {placeholder !== null && (
            // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
            <Pressable
              role="button"
              aria-label={placeholder}
              testID={`${props.testID}-placeholder-trigger`}
              onPress={() => {
                setActiveIndex(첫빈칸)
                open()
              }}
              className="ml-auto min-w-0 shrink active:opacity-60"
            >
              <Text
                testID={`${props.testID}-placeholder`}
                numberOfLines={1}
                className="text-right text-sm text-text-disabled"
              >
                {placeholder}
              </Text>
            </Pressable>
          )}

          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-text-disabled${placeholder === null ? ' ml-auto' : ''}`}
            strokeWidth={2}
            aria-hidden
          />
        </View>
      )}
    />
  )
}
