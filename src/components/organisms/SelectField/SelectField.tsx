/**
 * 라벨과 값이 한 줄에 서는 커스텀 드롭다운. 가계부 시트의 캐릭터 고르개가 첫 호출부다.
 *
 * `AccountSelect` 가 이미 푼 것을 그대로 따른다. 스크림 없이 바깥 탭으로만 닫고, 오버레이는
 * `react-native` 의 `Modal` 이며(RN 의 `absolute` 는 부모 상자에 갇힌다. 이 자리는 바텀시트 안이라
 * 더 그렇다), 좌표와 목록 높이가 둘 다 온 뒤에 그린다. 회전하면 잰 좌표가 거짓이 되어 닫는다.
 *
 * 세로 배치는 `AccountSelect` 의 `placeDropdown` 을 **그대로 부른다**. 같은 규칙이 두 벌이 되면
 * 한쪽만 고쳐진다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, { Easing, Keyframe, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ChevronDownIcon, Text } from '../../atoms'
import { boxShadowOf, DROPDOWN_SHADOW } from '../../../lib/shadow'
import { useThemeAppearance } from '../../../theme/context'
import { placeDropdown } from '../../../lib/place-dropdown'

/** 목록이 화면 가장자리에 붙지 않게 남기는 여백. `AccountSelect` 와 같은 값이다. */
const EDGE_GAP_PX = 12
/** 트리거와 목록 사이. 목록은 트리거를 덮지 않고 그 아래에 뜬다 */
const LIST_GAP_PX = 6

/** 열리고 닫힐 때의 곡선. 빨리 출발해 부드럽게 멈춘다 */
const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1)

/**
 * 닫힌 줄의 상자. 흰 카드색(`surface`) 바탕 · 반경 12 이고 테두리가 없다. 자리마다 내용이 달라도
 * (라벨–값 · 배지 사슬 · 캐릭터 줄) 상자는 이것 하나다. `tall` 은 48 높이다.
 */
function triggerBoxClass(tall: boolean): string {
  return `${tall ? 'min-h-12' : 'min-h-10'} flex-row items-center gap-2.5 rounded-xl bg-surface px-3 py-2`
}

/**
 * 열리면 뒤집히는 화살표. 내용을 직접 그리는 트리거(`renderTrigger`)도 이것을 끝에 둔다.
 *
 * Animated.View 에는 움직임만 준다. 정적 스타일을 함께 주면 버려진다.
 *
 * @param props.className 화살표 색(기본 흐린 글자색)
 */
export function SelectChevron(props: { open: boolean; className?: string }): React.JSX.Element {
  const turn = useDerivedValue(() => withTiming(props.open ? 180 : 0, { duration: 250, easing: EASE_OUT }))
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  return (
    <Animated.View style={style}>
      <ChevronDownIcon className={`h-4 w-4 ${props.className ?? 'text-text-muted'}`} strokeWidth={2} aria-hidden />
    </Animated.View>
  )
}

/** 목록 상자. 0.85 배 · 6 위에서 위쪽 가운데를 기준으로 펼쳐진다(가운데 기준 배율을 위로 당겨 맞춘다) */
function listEntering(height: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: -LIST_GAP_PX - height * 0.075 }, { scaleY: 0.85 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scaleY: 1 }], easing: EASE_OUT },
  }).duration(220)
}

/** 목록의 칸 하나. 위에서 4 내려오며 나타나고, 칸마다 40ms 씩 늦게 시작한다 */
function itemEntering(index: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: -4 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
  })
    .duration(200)
    .delay(index * 40)
}

export interface SelectOption {
  /** `null` 은 안 고름 이다. 고르개마다 그 뜻이 다르므로 라벨은 호출부가 준다. */
  value: string | null
  label: string
  /** 묶음 이름. 앞 보기와 다르면 그 앞에 라벨 줄이 선다. */
  group?: string
}

export interface SelectFieldProps {
  label: string
  options: readonly SelectOption[]
  selected: string | null
  onSelect: (value: string | null) => void
  /** 트리거와 목록을 집는 이름의 뿌리. */
  testID: string
  /**
   * 목록 한 줄을 그리는 법. 없으면 라벨 한 줄이다.
   *
   * 사냥터 줄에는 포스 배지·레벨·마릿수가 함께 서야 하는데 그것을 라벨 문자열에 밀어 넣으면
   * 배지를 못 그리고 읽어 주는 이름까지 그 글자가 된다. 그리는 일만 호출부로 넘기고 나머지
   * (눌림·고름 표시·닫기·읽어 주는 이름)는 여기 그대로 둔다.
   *
   * 트리거(닫힌 줄)는 안 바뀐다. 거기까지 넓히면 라벨–값 줄의 모양이 고르개마다 갈린다.
   */
  renderOption?: (option: SelectOption, isSelected: boolean) => React.ReactNode
  /**
   * 닫힌 줄의 상자 **안**을 다시 그리는 법. 없으면 라벨–값 한 줄이다.
   *
   * 배지 사슬처럼 한 줄이 값 여럿을 지는 자리가 쓴다. 상자(바탕 · 테두리 · 열림 색)는 이 파일이 두르고,
   * 목록은 그 상자에 붙어 상자 폭으로 선다. 여는 일은 받은 손잡이를 부르는 쪽이 정하고, 끝에
   * `SelectChevron` 을 둔다.
   */
  renderTrigger?: (open: () => void, isOpen: boolean) => React.ReactNode
  /** 조금 더 높은 줄. 시트 바탕 위에 바로 서는 자리(보스 추가) */
  tall?: boolean
}

/** `null` 도 받는 키. 목록의 첫 칸이 대개 그것이다. */
function keyOf(value: string | null): string {
  return value ?? ''
}

export function SelectField(props: SelectFieldProps): React.JSX.Element {
  const triggerRef = useRef<View | null>(null)
  const { definition } = useThemeAppearance()
  const [isOpen, setIsOpen] = useState(false)
  const [anchor, setAnchor] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()

  const close = useCallback((): void => {
    setIsOpen(false)
    setAnchor(null)
    setContentHeight(null)
  }, [])

  function open(): void {
    setIsOpen(true)
  }

  /**
   * 열린 뒤에 잰다. 여는 손잡이가 `ref` 를 안 읽어야 트리거를 **렌더 중에 그리는** 배지 사슬로
   * 넘길 수 있다(React 컴파일러가 렌더 중 ref 접근으로 잡는다).
   */
  useEffect(() => {
    if (!isOpen) return
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ left: x, top: y, width, height })
    })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const subscription = Dimensions.addEventListener('change', close)
    return () => subscription.remove()
  }, [isOpen, close])

  // 고른 값이 목록에 없을 수 있다(캐릭터 목록이 갱신되는 순간). 렌더 중에 던지지 않는다.
  // 첫 칸(대개 안 고름)으로 읽어 준다.
  const selectedLabel =
    props.options.find((option) => option.value === props.selected)?.label ??
    props.options[0]?.label ??
    ''

  const placement =
    anchor === null
      ? null
      : placeDropdown({
          anchorTop: anchor.top,
          anchorHeight: anchor.height,
          contentHeight: contentHeight ?? 0,
          windowHeight,
          safeTop: insets.top,
          safeBottom: insets.bottom,
          edgeGap: EDGE_GAP_PX,
          gap: LIST_GAP_PX,
        })
  const isPlaced = placement !== null && contentHeight !== null

  function renderOptions(animate: boolean): React.ReactNode {
    return props.options.map((option, index) => {
      const isSelected = option.value === props.selected
      const opensGroup = option.group !== undefined && option.group !== props.options[index - 1]?.group
      const body = (
        <>
          {opensGroup && (
            // 첫 묶음 말고는 위에 선을 긋는다. 라벨만으로는 앞 묶음의 끝이 안 보인다.
            <Text
              testID={`${props.testID}-group-${option.group}`}
              className={`px-2.5 pb-1 pt-2.5 text-11 font-semibold text-text-disabled${
                index === 0 ? '' : ' border-t border-surface-2'
              }`}
            >
              {option.group}
            </Text>
          )}
          <Pressable
            testID={`${props.testID}-option-${keyOf(option.value)}`}
            role="button"
            aria-label={option.label}
            aria-selected={isSelected}
            onPress={() => {
              props.onSelect(option.value)
              close()
            }}
            className={`rounded-[10px] px-2.5 py-[9px] active:bg-card-body${isSelected ? ' bg-primary-tint' : ''}`}
          >
            {props.renderOption === undefined ? (
              <Text
                numberOfLines={1}
                className={`text-sm ${isSelected ? 'font-semibold text-primary-ink' : 'font-semibold text-text'}`}
              >
                {option.label}
              </Text>
            ) : (
              props.renderOption(option, isSelected)
            )}
          </Pressable>
        </>
      )
      return animate ? (
        <Animated.View key={keyOf(option.value)} entering={itemEntering(index)}>
          {body}
        </Animated.View>
      ) : (
        <View key={keyOf(option.value)}>{body}</View>
      )
    })
  }

  return (
    <>
      {props.renderTrigger === undefined ? (
        <Pressable
          ref={triggerRef}
          testID={`${props.testID}-trigger`}
          role="button"
          aria-label={props.label}
          aria-expanded={isOpen}
          onPress={open}
          className={`${triggerBoxClass(props.tall === true)} active:opacity-60`}
        >
          <Text className="shrink-0 text-xs text-text-muted">{props.label}</Text>
          <Text numberOfLines={1} className="flex-1 text-15 font-bold text-text">
            {selectedLabel}
          </Text>
          <SelectChevron open={isOpen} />
        </Pressable>
      ) : (
        <View ref={triggerRef} testID={`${props.testID}-trigger`} className={triggerBoxClass(props.tall === true)}>
          {props.renderTrigger(open, isOpen)}
        </View>
      )}

      {isOpen && (
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <Modal
          testID={`${props.testID}-modal`}
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={close}
        >
          {/* **색이 없다**. 잡기만 한다. */}
          <Pressable
            testID={`${props.testID}-backdrop`}
            aria-label={`${props.label} 목록 닫기`}
            onPress={close}
            className="flex-1"
          />

          {isPlaced ? (
            // 자리는 바깥 View, 펼쳐지는 움직임만 Animated.View. 한데 주면 자리가 버려진다.
            <View
              style={{ position: 'absolute', left: anchor?.left ?? 0, top: placement.top, width: anchor?.width }}
            >
              <Animated.View entering={listEntering(Math.min(contentHeight, placement.maxHeight))}>
                {/* 그림자는 바깥 상자가 든다. 모서리를 자르는 안쪽 상자에 주면 iOS 가 그림자까지 자른다. */}
                <View style={{ borderRadius: 14, boxShadow: boxShadowOf(definition.shadowColor, DROPDOWN_SHADOW) }}>
                  <View
                    testID={`${props.testID}-list`}
                    role="menu"
                    aria-label={props.label}
                    style={{ maxHeight: placement.maxHeight }}
                    className="overflow-hidden rounded-[14px] bg-surface"
                  >
                    <ScrollView contentContainerStyle={{ padding: 6 }}>{renderOptions(true)}</ScrollView>
                  </View>
                </View>
              </Animated.View>
            </View>
          ) : (
            // 자리를 재기 전. 같은 목록을 안 보이게 그려 자연 높이를 재고, 잰 뒤에 펼쳐지는 목록으로 갈아 끼운다.
            <View
              testID={`${props.testID}-list`}
              role="menu"
              aria-label={props.label}
              style={{ position: 'absolute', left: 0, top: 0, width: anchor?.width, opacity: 0 }}
            >
              <View
                style={{ padding: 6 }}
                onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
              >
                {renderOptions(false)}
              </View>
            </View>
          )}
        </Modal>
      )}
    </>
  )
}
