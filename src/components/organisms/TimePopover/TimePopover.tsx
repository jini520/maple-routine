/**
 * 시각을 고르는 팝오버. 누른 칸 아래로 열리고 5분 휠과 `확인` 을 든다.
 *
 * 상자는 `CalendarPopover` 와 같은 반경 12 · 테두리 · 꼬리 · 그림자이고, 폭은 휠에 맞춘다.
 *
 * 휠을 돌리는 동안은 팝오버 안의 값만 바뀐다. `확인` 을 눌러야 밖으로 나간다. 휠은 멈출 때마다 값을
 * 내므로, 돌리는 도중의 값으로 시트가 흔들리지 않게 한다.
 */
import { useState } from 'react'
import { Modal, Pressable, useWindowDimensions, View } from 'react-native'

import { Text } from '../../atoms'
import { TimeWheel } from '../../molecules/TimeWheel/TimeWheel'
import { anchorPopover } from '../../../lib/popover-anchor'
import type { PopoverAnchorRect } from '../../../hooks/useAnchoredPopover'

const EDGE_GAP = 12
const CARET_SIZE = 8
const POPOVER_GAP = 8

export interface TimePopoverProps {
  /** 분. 시각이면 그 날 0시부터, `units` 를 주면 그 길이 */
  minutes: number
  step: number
  /** 열 뒤 단위 글자. 시각이 아니라 길이(`1 시간 15 분 전`)를 고를 때 */
  units?: { hour: string; minute: string }
  /** 고를 수 없는 칸. 흐리게 그리고, 거기서 멈추면 `확인` 을 막는다 */
  isDisabled?: (minutes: number) => boolean
  onConfirm: (minutes: number) => void
  /** `null` 이면 아직 못 쟀다. 그리되 보이지 않는다 */
  anchor: PopoverAnchorRect | null
  onClose: () => void
}

export function TimePopover(props: TimePopoverProps): React.JSX.Element {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [value, setValue] = useState(props.minutes)
  // 상자 크기. 폭은 휠에 맞춰 재야 안다. 재기 전에는 숨기고, 재고 나서 아래가 모자라면 위로 뒤집는다.
  const [box, setBox] = useState({ width: 0, height: 0 })
  const boxHeight = box.height
  const { anchor, isDisabled } = props

  const geometry = anchorPopover({
    containerWidth: windowWidth,
    anchorCenterX: anchor === null ? 0 : anchor.left + anchor.width / 2,
    popoverWidth: box.width,
    edgeGap: EDGE_GAP,
    caretSize: CARET_SIZE,
  })
  const blocked = isDisabled?.(value) === true
  const below = anchor === null ? 0 : anchor.top + anchor.height + POPOVER_GAP
  const above = anchor !== null && boxHeight > 0 && below + boxHeight > windowHeight - EDGE_GAP
  const top = anchor === null ? 0 : above ? anchor.top - POPOVER_GAP - boxHeight : below

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      <Pressable aria-label="시각 고르기 닫기" onPress={props.onClose} className="flex-1" />
      <View
        testID="time-popover"
        role="dialog"
        aria-label="시각 고르기"
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout
          setBox({ width, height })
        }}
        style={{ left: geometry.left, top }}
        className={`absolute rounded-[12px] border border-border bg-surface px-3 pb-2 pt-3 shadow-lg${
          anchor === null || boxHeight === 0 ? ' opacity-0' : ''
        }`}
      >
        {/* 꼬리는 누른 칸 쪽을 가리킨다. 위로 뒤집히면 상자 아래에 선다. */}
        <View
          aria-hidden
          style={{
            left: geometry.caretLeft,
            width: CARET_SIZE,
            height: CARET_SIZE,
            ...(above ? { bottom: -4 } : { top: -4 }),
          }}
          className={`absolute rotate-45 bg-surface ${
            above ? 'border-b border-r border-border' : 'border-l border-t border-border'
          }`}
        />
        <TimeWheel
          units={props.units}
          hour={Math.floor(value / 60)}
          minute={value % 60}
          step={props.step}
          isDisabled={isDisabled === undefined ? undefined : (hour, minute) => isDisabled(hour * 60 + minute)}
          onChange={(next) => setValue(next.hour * 60 + next.minute)}
        />
        <View className="mt-1 flex-row justify-end">
          <Pressable
            role="button"
            aria-label="확인"
            disabled={blocked}
            onPress={() => props.onConfirm(value)}
            hitSlop={8}
            className={`px-2 py-1${blocked ? ' opacity-40' : ''}`}
          >
            <Text className="text-sm font-bold text-primary-ink">확인</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
