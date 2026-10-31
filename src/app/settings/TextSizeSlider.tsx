/**
 * 글자 크기 페이지의 네 칸 슬라이더. 트랙을 단계 수만큼 똑같이 나누고, 눈금은 칸 가운데에 선다.
 *
 * 손잡이를 끌면 손가락이 든 칸의 눈금으로 옮겨 가고, 칸을 지날 때마다 그 단계를 알리며 햅틱을 낸다. 칸을 누르면 그
 * 단계로 간다. 끌기는 가로로 움직일 때만 잡는다.
 * 세로 끌기는 페이지 스크롤이 가져가야 한다.
 */
import { useState } from 'react'
import { Pressable, View, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import { TEXT_SIZES, TEXT_SIZE_LABELS } from '../../lib/text-size'
import { selectionFeedback } from '../../native/haptics'
import type { TextSize } from '../../types/text-size'

import { Text } from '../../components/atoms'

/** 손잡이 지름. 트랙(높이 24)의 한가운데에 앉는다. */
const THUMB_PX = 22

/** 가로 위치가 든 칸. 폭을 아직 모르면 `-1` 이다. */
function stopIndexAt(x: number, width: number): number {
  if (width <= 0) return -1
  return Math.min(TEXT_SIZES.length - 1, Math.max(0, Math.floor((x / width) * TEXT_SIZES.length)))
}

/** 칸 가운데의 가로 위치(%). */
function stopCenterPercent(index: number): number {
  return ((2 * index + 1) / (2 * TEXT_SIZES.length)) * 100
}

export function TextSizeSlider(props: { value: TextSize; onChange: (size: TextSize) => void }): React.JSX.Element {
  const [width, setWidth] = useState(0)
  const index = TEXT_SIZES.indexOf(props.value)
  /**
   * 끄는 동안 마지막으로 알린 칸. 끌지 않을 때는 `null` 이다.
   *
   * `value` 는 부모가 다시 그려야 바뀌어서, 그 전에 온 이벤트가 `value` 와 견주면 같은 칸을 두 번 알린다.
   */
  const [dragged, setDragged] = useState<number | null>(null)

  /** 바뀌었을 때만 알리고 햅틱을 낸다. */
  function commit(next: number, current: number): boolean {
    const size = TEXT_SIZES[next]
    if (size === undefined || next === current) return false
    selectionFeedback()
    props.onChange(size)
    return true
  }

  function drag(x: number): void {
    const next = stopIndexAt(x, width)
    if (commit(next, dragged ?? index)) setDragged(next)
  }

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart((event) => drag(event.x))
    .onUpdate((event) => drag(event.x))
    .onFinalize(() => setDragged(null))
    .withTestId('text-size-pan')

  function adjust(event: AccessibilityActionEvent): void {
    commit(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1), index)
  }

  const first = stopCenterPercent(0)
  const now = stopCenterPercent(index)

  return (
    <View className="flex-row items-start gap-3.5">
      <Text aria-hidden className="mt-0.5 w-4 text-center text-xs font-semibold text-text-muted">
        가
      </Text>

      <GestureDetector gesture={pan}>
        <View
          testID="text-size-track"
          accessible
          role="slider"
          aria-label="글자 크기"
          accessibilityValue={{ min: 0, max: TEXT_SIZES.length - 1, now: index, text: TEXT_SIZE_LABELS[props.value] }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={adjust}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          className="flex-1"
        >
          <View className="absolute top-2.5 h-1 rounded-full bg-track" style={{ left: `${first}%`, right: `${first}%` }} />
          <View className="absolute top-2.5 h-1 rounded-full bg-primary" style={{ left: `${first}%`, width: `${now - first}%` }} />

          <View className="flex-row">
            {TEXT_SIZES.map((size, i) => (
              <Pressable
                key={size}
                role="button"
                aria-label={TEXT_SIZE_LABELS[size]}
                onPress={() => commit(i, index)}
                className="flex-1 items-center gap-2.5"
              >
                <View className="h-6 items-center justify-center">
                  <View className={`h-1.5 w-1.5 rounded-full ${i <= index ? 'bg-primary' : 'bg-text-disabled'}`} />
                </View>
                <Text className={`text-xs ${i === index ? 'font-semibold text-text' : 'text-text-muted'}`}>
                  {TEXT_SIZE_LABELS[size]}
                </Text>
              </Pressable>
            ))}
          </View>

          <View
            pointerEvents="none"
            className="absolute top-px rounded-full bg-primary shadow-md"
            style={{ width: THUMB_PX, height: THUMB_PX, left: `${now}%`, marginLeft: -THUMB_PX / 2 }}
          />
        </View>
      </GestureDetector>

      <Text aria-hidden className="-mt-0.5 w-5 text-center text-lg font-semibold text-text-muted">
        가
      </Text>
    </View>
  )
}
