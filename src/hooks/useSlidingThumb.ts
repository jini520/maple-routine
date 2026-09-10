/**
 * 고른 조각 뒤를 미끄러지는 상자. 세그먼트 부품들이 나눠 쓴다.
 *
 * **치수를 재서 쓴다. 등분하지 않는다.** 조각 폭을 글자가 정하는 자리가 있어서다. 등분으로
 * 바꾸면 조각 둘짜리는 헐렁해지고 다섯짜리는 좁아진다.
 *
 * 쓰는 쪽은 상자 하나와 조각들을 **같은 부모** 안에 두어야 한다. `onLayout` 이 주는 `x` 도
 * 절대 배치의 기준점도 그 부모라, 다른 부모에 두면 상자가 엉뚱한 자리에 선다. 그 부모에는
 * 테두리도 안쪽 여백도 없어야 한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayoutChangeEvent, ViewStyle } from 'react-native'
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated'

/** 미끄러지는 시간. 앱의 스택 전환과 같은 가족이라 다른 것으로 안 읽힌다. */
const SLIDE_MS = 200

/** `BottomBar` 의 `EASE` 와 같은 곡선. */
const EASE = Easing.bezier(0.32, 0.72, 0, 1)

export interface ThumbSlot {
  x: number
  width: number
}

export interface ThumbPlacement {
  slot: ThumbSlot
  /** 미끄러질지. 처음 서는 자리에서는 `false` 다. */
  slides: boolean
}

/**
 * 다음에 상자가 설 자리. **애니메이션 스타일과 갈라 둔 것은 이 판정만 검증할 수 있게 하기
 * 위해서다.** 렌더된 애니메이션 스타일은 마운트 시점의 한 벌로 굳어 jest 에서 안 움직인다.
 *
 * @param previous 지금 서 있는 자리. 아직 안 섰으면 `null`
 * @param slot 고른 조각의 잰 자리. 못 쟀거나 고른 것이 없으면 `undefined`
 * @returns 설 자리. `null` 이면 안 보인다. 같은 자리면 **받은 것을 그대로** 돌려준다
 */
export function nextThumbPlacement(
  previous: ThumbPlacement | null,
  slot: ThumbSlot | undefined,
): ThumbPlacement | null {
  // 아직 못 잰 자리다. 0 폭으로 그리면 왼쪽 끝에 실선 하나가 번쩍인다.
  if (slot === undefined) return null

  // 새 객체를 내면 스타일이 다시 계산돼 제자리에서 한 번 더 움직인다.
  if (previous !== null && previous.slot.x === slot.x && previous.slot.width === slot.width) {
    return previous
  }

  // 처음 서는 자리에서는 안 미끄러진다. 미끄러짐은 여기서 저기로 갔다는 말이라, 열자마자
  // 왼쪽 끝에서 달려오면 사용자가 안 누른 이동을 보게 된다.
  return { slot, slides: previous !== null }
}

export interface SlidingThumb {
  /** 조각이 자기 자리를 알리는 자리. `onLayout` 에 그대로 잇는다. */
  onItemLayout: (index: number, event: LayoutChangeEvent) => void
  /** 미끄러지는 상자에 주는 스타일. 폭·가로 자리·보임을 든다. */
  style: AnimatedStyle<ViewStyle>
}

/**
 * 고른 조각을 덮는 상자의 자리.
 *
 * @param selectedIndex 고른 조각. 고른 것이 없으면 -1 이고 상자가 안 보인다
 */
export function useSlidingThumb(selectedIndex: number): SlidingThumb {
  // 잰 자리는 렌더를 다시 돌릴 이유가 아니다. 자리가 바뀌어 **설 곳이 달라질 때만** 아래
  // 상태가 움직인다.
  const slots = useRef(new Map<number, ThumbSlot>())
  const [placement, setPlacement] = useState<ThumbPlacement | null>(null)
  const reduceMotion = useReducedMotion()

  const settle = useCallback((index: number) => {
    const slot = index < 0 ? undefined : slots.current.get(index)
    setPlacement((previous) => nextThumbPlacement(previous, slot))
  }, [])

  useEffect(() => {
    settle(selectedIndex)
  }, [selectedIndex, settle])

  const onItemLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout
      const known = slots.current.get(index)
      if (known?.x === x && known.width === width) return

      slots.current.set(index, { x, width })
      // 다른 조각이 자란 것은 이 상자와 상관없다. 고른 조각의 자리가 바뀔 때만 따라간다.
      if (index === selectedIndex) settle(selectedIndex)
    },
    [selectedIndex, settle],
  )

  const style = useAnimatedStyle(() => {
    if (placement === null) return { opacity: 0, width: 0, transform: [{ translateX: 0 }] }

    const duration = placement.slides && !reduceMotion ? SLIDE_MS : 0
    return {
      opacity: 1,
      width: withTiming(placement.slot.width, { duration, easing: EASE }),
      transform: [{ translateX: withTiming(placement.slot.x, { duration, easing: EASE }) }],
    }
  }, [placement, reduceMotion])

  return { onItemLayout, style }
}
