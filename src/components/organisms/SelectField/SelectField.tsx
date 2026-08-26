/**
 * 라벨–값 줄 모양의 **커스텀 드롭다운**([[ADR-173]] 결정 14) — 가계부 시트의 캐릭터 고르개가
 * 첫 호출부다.
 *
 * ## 왜 새로 만드나
 *
 * 이 앱에 여는 목록은 하나뿐이다 — `AccountSelect`(메이플 ID). 그것은 계정 요약이라는 **한 데이터
 * 모양**에 붙어 있어(초상·월드 엠블럼·월드별 개수) 재사용할 수 없다. 대신 그 파일이 이미 푼 것들을
 * 그대로 따른다:
 *
 * - **스크림이 없다**([[ADR-144]] 결정 6 ①) — 값 하나를 고르는 일이라 모달의 무게를 안 준다.
 *   바깥 탭으로 닫는 성질만 남기고 칠하는 일을 뺀다.
 * - **`Modal` 을 쓴다** — RN 의 `absolute` 는 부모 상자에 갇혀 아래 층을 못 덮는다. 이 자리는
 *   **바텀시트 안**이라 더 그렇다.
 * - **측정이 비동기다** — 좌표(`measureInWindow`)와 목록 높이(`onLayout`)가 **둘 다** 와야
 *   뒤집을지가 정해진다. 그전에는 `opacity-0` 으로 기다린다. (jest 는 레이아웃을 안 재므로
 *   테스트가 보는 목록은 늘 투명하고, 내용·배선 단언은 그대로 성립한다.)
 * - **회전하면 잰 좌표가 거짓이 된다** — 닫는다.
 *
 * 세로 배치는 `AccountSelect` 의 `placeDropdown` 을 **그대로 부른다** — 같은 규칙이 두 벌이 되면
 * 한쪽만 고쳐진다(그 파일이 컴포넌트 밖에 사는 이유가 그것이다).
 *
 * ## 트리거가 곧 그 줄이다
 *
 * 시트의 다른 칸들과 **같은 라벨–값 줄**이라, 목록도 그 줄의 폭에 맞춰 열린다. 값 자리만 눌리는
 * 것이 아니라 **줄 전체**가 눌린다 — 좁은 글자 하나를 겨냥하게 두지 않는다.
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

import { ChevronDownIcon } from '../../../lib/icons'
import { Text } from '../../atoms/Text/Text'
import { placeDropdown } from '../AccountSelect/place-dropdown'

/** 목록이 화면 가장자리에 붙지 않게 남기는 여백 — `AccountSelect` 와 같은 값이다. */
const EDGE_GAP_PX = 12

export interface SelectOption {
  /** `null` 은 «안 고름» 이다 — 고르개마다 그 뜻이 다르므로 라벨은 호출부가 준다. */
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
}

/** `null` 도 키가 되어야 한다 — 목록의 첫 칸이 대개 그것이다. */
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

  // 고른 값이 목록에 없을 수 있다(캐릭터 목록이 갱신되는 순간). **렌더 중에 던지지 않는다** —
  // 첫 칸(대개 «안 고름»)으로 읽어 준다.
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
          {/* **색이 없다** — 잡기만 한다([[ADR-144]] 결정 6 ①). */}
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
              {/* 자연 높이를 재는 자리 — `ScrollView` 안이라 바깥 `maxHeight` 에 안 눌린다. */}
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
                      <Text
                        numberOfLines={1}
                        className={`text-sm ${
                          isSelected ? 'font-semibold text-primary-ink' : 'text-text'
                        }`}
                      >
                        {option.label}
                      </Text>
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
