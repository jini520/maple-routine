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
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'

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
   * 사용자가 만진 단계. `선택 안함` 도 고른 것이라 값은 `null` 인데 자리표시자에서는 빠져야 한다.
   * 값만 보면 그 둘이 같아지므로 만졌다는 사실을 여기서 든다.
   *
   * 앞 단계를 다시 고르면 뒤 단계는 만진 적 없는 상태로 돌아간다. 뒤가 앞에 매여 있어서
   * (사냥터는 지역에 매인다) 앞이 바뀌면 뒤는 고른 것이 아니게 된다.
   */
  const [touched, setTouched] = useState<readonly number[]>([])

  function pick(index: number, value: string | null): void {
    setTouched((current) => [...current.filter((each) => each < index), index])
    props.steps[index].onSelect(value)
  }

  const isChosen = (step: ChainStep, index: number): boolean =>
    step.selected !== null || touched.includes(index)

  const 남은 = props.steps.filter((step, index) => !isChosen(step, index))
  const placeholder = 남은.length === 0 ? null : `${남은.map((step) => step.name).join(' · ')} 선택`
  const 첫빈칸 = props.steps.findIndex((step, index) => !isChosen(step, index))
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
        <View className="min-h-7 flex-row items-center gap-2 border-b border-border pb-2">
          {/*
            알약이 늘고 줄면 남은 것들이 왼쪽으로 미끄러진다. `LinearTransition` 이 그 자리
            변화를 잇고, 새 알약은 그 자리에서 떠오른다. 값이 어디로 갔는지를 눈이 따라간다.
          */}
          <Animated.View layout={LinearTransition} className="flex-row items-center gap-1.5">
            {props.steps.map((step, index) =>
              !isChosen(step, index) || labelOf(step) === '' ? null : (
                <Animated.View
                  key={step.name}
                  entering={FadeIn.duration(140)}
                  layout={LinearTransition.duration(220)}
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
                </Animated.View>
              ),
            )}
          </Animated.View>

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
