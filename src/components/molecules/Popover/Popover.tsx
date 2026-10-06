/**
 * 팝오버를 띄우는 층과 앵커에 붙는 상자.
 *
 * 닫기 층은 이 층이 쥔다. 팝오버를 연 컴포넌트 안에 깔면 그 컴포넌트 영역만 덮어서 바깥을 눌러도
 * 안 닫힌다. 내용도 같은 `Modal` 안에 그린다. 다른 창에 두면 닫기 층이 상자 위에 깔려 상자 안을
 * 누르는 것이 전부 닫기로 먹힌다.
 */
import { useState, type ReactNode } from 'react'
import { Modal, Pressable, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native'

import type { PopoverAnchorRect } from '../../../hooks/useAnchoredPopover'
import { usePopoverPlacement } from '../../../hooks/usePopoverPlacement'
import { anchorPopover } from '../../../lib/popover-anchor'

const EDGE_GAP = 12
const CARET_SIZE = 8
/** 앵커 밑변과 상자 윗변 사이. 꼬리(8 의 절반이 삐져나온다)가 닿아 보이는 최소값 */
const POPOVER_GAP = 8

/** 투명 `Modal` 과 화면 전체를 덮는 닫기 층. 내용은 `children` 으로 그 위에 그린다 */
export function PopoverLayer(props: {
  /** 닫기 층의 접근성 이름 */
  closeLabel: string
  onClose: () => void
  /** 앵커를 버리고 가운데로 옮겼을 때 까는 옅은 스크림 */
  scrim?: boolean
  closeTestID?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      <Pressable
        testID={props.closeTestID}
        aria-label={props.closeLabel}
        onPress={props.onClose}
        className={`flex-1${props.scrim === true ? ' bg-scrim' : ''}`}
        style={props.scrim === true ? { opacity: 0.5 } : undefined}
      />
      {props.children}
    </Modal>
  )
}

/**
 * 앵커 아래에 꼬리를 달고 뜨는 상자. 아래가 모자라면 위로 뒤집고, 둘 다 모자라면 가운데로 옮긴다.
 *
 * @example
 * <AnchoredPopover testID="manual-completion-popover" ariaLabel="직접 기록 설명" closeLabel="설명 닫기"
 *   anchor={anchor} width={248} onClose={close} className="p-3">…</AnchoredPopover>
 */
export function AnchoredPopover(props: {
  /** `null` 이면 아직 못 쟀다. 그리되 보이지 않는다 */
  anchor: PopoverAnchorRect | null
  onClose: () => void
  closeLabel: string
  ariaLabel: string
  testID: string
  /** 고정 폭. 안 주면 내용이 정하고 화면 안쪽이 상한이다 */
  width?: number
  /** 상자의 안쪽 여백 등 */
  className?: string
  children: ReactNode
}): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions()
  const { anchor } = props
  const placement = usePopoverPlacement(anchor, POPOVER_GAP)
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)
  const boxWidth = props.width ?? measuredWidth ?? 0

  const geometry = anchorPopover({
    containerWidth: windowWidth,
    anchorCenterX: anchor === null ? 0 : anchor.left + anchor.width / 2,
    popoverWidth: boxWidth,
    edgeGap: EDGE_GAP,
    caretSize: CARET_SIZE,
  })
  const center = placement.side === 'center'
  const hasWidth = props.width !== undefined || measuredWidth !== null
  const shown = placement.measured && hasWidth

  function onLayout(event: LayoutChangeEvent): void {
    setMeasuredWidth(event.nativeEvent.layout.width)
    placement.onLayout(event)
  }

  return (
    <PopoverLayer closeLabel={props.closeLabel} onClose={props.onClose} scrim={center} closeTestID={`${props.testID}-scrim`}>
      <View
        testID={props.testID}
        role="dialog"
        aria-label={props.ariaLabel}
        onLayout={onLayout}
        style={{
          // 내용 폭을 재기 전에는 왼쪽 끝에 둔다. 오른쪽에 두고 재면 남은 폭에 맞춰 줄이 접힌 폭을 잰다.
          left: !hasWidth ? 0 : center ? (windowWidth - boxWidth) / 2 : geometry.left,
          top: placement.top,
          width: props.width,
          maxWidth: windowWidth - EDGE_GAP * 2,
          opacity: shown ? undefined : 0,
        }}
        className={`absolute rounded-[12px] border border-border bg-surface shadow-lg ${props.className ?? ''}`}
      >
        {!center && (
          <View
            testID={`${props.testID}-caret`}
            aria-hidden
            style={{
              left: geometry.caretLeft,
              width: CARET_SIZE,
              height: CARET_SIZE,
              ...(placement.side === 'below' ? { top: -4 } : { bottom: -4 }),
            }}
            className={`absolute rotate-45 border-border bg-surface ${
              placement.side === 'below' ? 'border-l border-t' : 'border-b border-r'
            }`}
          />
        )}
        {props.children}
      </View>
    </PopoverLayer>
  )
}
