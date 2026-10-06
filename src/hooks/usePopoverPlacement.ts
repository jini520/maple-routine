/**
 * 앵커에 붙는 팝오버가 자기 높이를 재서 아래, 위, 가운데 중 어디에 설지 정하는 훅.
 *
 * 달력 팝오버 둘이 쓴다. 높이를 재기 전에는 자리를 모르므로 `measured` 가 거짓인 동안 상자를
 * 그리되 보이지 않게 둔다(앵커를 재기 전과 같은 규약).
 */
import { useState } from 'react'
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { overlayWindowHeightPx } from '../lib/modal-metrics'
import { placePopover } from '../lib/place-dropdown'
import type { PopoverAnchorRect } from './useAnchoredPopover'

/** 상자가 화면 위아래 안전영역에서 띄우는 여백. 드롭다운과 같은 값이다. */
const EDGE_GAP_PX = 12

export interface PopoverPlacement {
  side: 'below' | 'above' | 'center'
  top: number
  /** 앵커와 상자 높이를 둘 다 쟀는가. 거짓이면 상자를 숨긴다. */
  measured: boolean
  /** 상자의 `onLayout`. 높이가 바뀌면(달 이동으로 줄 수가 바뀌면) 다시 고른다. */
  onLayout: (event: LayoutChangeEvent) => void
}

/** 팝오버 자리. `gap` 은 앵커와 상자 사이 간격이다. */
export function usePopoverPlacement(anchor: PopoverAnchorRect | null, gap: number): PopoverPlacement {
  const window = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [height, setHeight] = useState<number | null>(null)

  function onLayout(event: LayoutChangeEvent): void {
    setHeight(event.nativeEvent.layout.height)
  }

  if (anchor === null || height === null) {
    return { side: 'below', top: anchor === null ? 0 : anchor.top + anchor.height + gap, measured: false, onLayout }
  }

  const placed = placePopover({
    anchorTop: anchor.top,
    anchorHeight: anchor.height,
    contentHeight: height,
    windowHeight: overlayWindowHeightPx(window.height),
    safeTop: insets.top,
    safeBottom: insets.bottom,
    edgeGap: EDGE_GAP_PX,
    gap,
  })
  return { ...placed, measured: true, onLayout }
}
