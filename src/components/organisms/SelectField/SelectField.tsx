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
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ChevronDownIcon, Text } from '../../atoms'
import { placeDropdown } from '../AccountSelect/place-dropdown'

/** 목록이 화면 가장자리에 붙지 않게 남기는 여백. `AccountSelect` 와 같은 값이다. */
const EDGE_GAP_PX = 12

export interface SelectOption {
  /** `null` 은 안 고름 이다. 고르개마다 그 뜻이 다르므로 라벨은 호출부가 준다. */
  value: string | null
  label: string
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
}

/** `null` 도 받는 키. 목록의 첫 칸이 대개 그것이다. */
function keyOf(value: string | null): string {
  return value ?? ''
}

export function SelectField(props: SelectFieldProps): React.JSX.Element {
  const triggerRef = useRef<View | null>(null)
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
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ left: x, top: y, width, height })
    })
  }

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
        })
  const isPlaced = placement !== null && contentHeight !== null

  return (
    <>
      <Pressable
        ref={triggerRef}
        testID={`${props.testID}-trigger`}
        role="button"
        aria-label={props.label}
        aria-expanded={isOpen}
        onPress={open}
        className="flex-row items-center gap-3 border-b border-border pb-2 active:opacity-60"
      >
        <Text className="shrink-0 text-xs text-text-muted">{props.label}</Text>
        <Text numberOfLines={1} className="ml-auto shrink text-sm text-text">
          {selectedLabel}
        </Text>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-text-disabled" strokeWidth={2} aria-hidden />
      </Pressable>

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

          <View
            testID={`${props.testID}-list`}
            role="menu"
            aria-label={props.label}
            style={{
              left: anchor?.left ?? 0,
              top: placement?.top ?? 0,
              width: anchor?.width,
              maxHeight: placement?.maxHeight,
            }}
            className={`absolute overflow-hidden rounded-xl border border-border bg-surface shadow-lg${
              isPlaced ? '' : ' opacity-0'
            }`}
          >
            <ScrollView>
              {/* 자연 높이를 재는 자리. `ScrollView` 안이라 바깥 `maxHeight` 에 안 눌린다. */}
              <View onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}>
                {props.options.map((option) => {
                  const isSelected = option.value === props.selected
                  return (
                    <Pressable
                      key={keyOf(option.value)}
                      testID={`${props.testID}-option-${keyOf(option.value)}`}
                      role="button"
                      aria-label={option.label}
                      aria-selected={isSelected}
                      onPress={() => {
                        props.onSelect(option.value)
                        close()
                      }}
                      className={`px-3 py-2.5 active:bg-surface-2${
                        isSelected ? ' bg-primary-tint' : ''
                      }`}
                    >
                      {props.renderOption === undefined ? (
                        <Text
                          numberOfLines={1}
                          className={`text-sm ${
                            isSelected ? 'font-semibold text-primary-ink' : 'text-text'
                          }`}
                        >
                          {option.label}
                        </Text>
                      ) : (
                        props.renderOption(option, isSelected)
                      )}
                    </Pressable>
                  )
                })}
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}
    </>
  )
}
