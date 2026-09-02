/**
 * `선택됨` 층의 행 목록. 순서를 끌어서 바꾸는 자리.
 *
 * 카드 자체는 `CharacterRow` 그대로이고 이 파일이 더하는 것은 셋이다. 핸들의 끌기 제스처 · 끄는
 * 동안의 자동 스크롤 · 그 둘을 못 쓰는 사람을 위한 접근성 액션.
 *
 * 지키는 것 넷.
 *
 * ① 끌기는 **핸들에서만** 시작한다. 행 전체를 시작점으로 두면 목록을 굴리려던 손가락이 행을 집는다.
 * ② 배열은 **놓을 때 한 번만** 바뀐다. 끄는 동안은 그림만 미리 그린다. 도중에 취소되면 아무 일도
 *    없었던 것이 되고 저장 활성 판정도 안 깜빡인다.
 * ③ 제스처 콜백은 JS 스레드에서 돈다(`runOnJS(true)`). 손가락을 따라가는 그림만 shared value 라
 *    프레임마다 리스트를 다시 그리지는 않는다.
 * ④ 제스처에 물리는 함수를 **한 번 만들고 안 바꾼다**(`useMemo`). 끄는 도중 다시 그려질 때마다 새
 *    제스처를 붙이면 끌던 손가락을 놓친다. 지금 값은 `latestRef` 가 갖는다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useWindowDimensions, View, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { SelectedCharacterView } from '../../../features/character-manage/derivations'

import { AnimatedView } from '../../../lib/nativewind-interop'
import { CharacterRow } from '../../organisms/CharacterRow/CharacterRow'
import { DragHandle } from '../../organisms/CharacterRow/DragHandle'
import { RemoveButton } from '../../organisms/CharacterRow/RemoveButton'
import { RepresentativeStar } from '../../organisms/CharacterRow/RepresentativeStar'
import { resolveAutoScrollStepPx, resolveDropIndex, resolveRowShiftSteps } from './reorder'
import type { ReorderScroll } from './use-reorder-scroll'

/** 행 사이 간격. 컨테이너의 `gap-2` 와 같은 값이어야 칸 높이가 맞는다. */
const GAP_PX = 8
/** 화면 위·아래 이만큼 안쪽부터 자동 스크롤 구간이다. */
const AUTO_SCROLL_ZONE_PX = 72
/** 그 구간 끝에서의 한 프레임 이동량. */
const AUTO_SCROLL_MAX_STEP_PX = 12
/** 끌기로 판정하는 세로 이동 거리. 핸들을 그냥 누른 것과 가른다. */
const ACTIVATE_OFFSET_PX = 4

/** 접근성 액션 식별자. 사람이 듣는 것은 `label` 이고 이 이름은 우리끼리 쓴다. */
const MOVE_UP = 'moveUp'
const MOVE_DOWN = 'moveDown'

interface DragState {
  fromIndex: number
  toIndex: number
  /** 끌기가 시작될 때의 스크롤 오프셋. 그 뒤 흐른 만큼이 보정값이다. */
  startOffsetPx: number
  translationPx: number
  pointerYPx: number
}

/** 제스처가 살아 있는 동안에도 계속 최신이어야 하는 값들. */
interface LatestValues {
  count: number
  scroll: ReorderScroll
  onMove: (fromIndex: number, toIndex: number) => void
  topPx: number
  bottomPx: number
}

export interface SelectedCharacterListProps {
  views: SelectedCharacterView[]
  representativeOcid: string | null
  /** 자동 스크롤이 만질 화면의 스크롤 뷰(`use-reorder-scroll`). */
  scroll: ReorderScroll
  /** 놓았을 때 · 접근성 액션일 때. **같은 문**이다(`moveOcid` 를 부른다). */
  onMove: (fromIndex: number, toIndex: number) => void
  onRemove: (ocid: string) => void
  onSelectRepresentative: (ocid: string) => void
}

export function SelectedCharacterList(props: SelectedCharacterListProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const { height: windowHeightPx } = useWindowDimensions()
  const count = props.views.length

  // 그림이 바뀌는 두 순간만 상태다. 칸 높이를 처음 쟀을 때와 드롭 위치가 한 칸 넘어갈 때.
  const [pitchPx, setPitchPx] = useState(0)
  const [drop, setDrop] = useState<{ fromIndex: number; toIndex: number } | null>(null)

  const dragY = useSharedValue(0)
  const pitchRef = useRef(0)
  const dragRef = useRef<DragState | null>(null)
  const frameRef = useRef<number | null>(null)

  const latestRef = useRef<LatestValues>({
    count,
    scroll: props.scroll,
    onMove: props.onMove,
    topPx: insets.top,
    bottomPx: windowHeightPx - insets.bottom,
  })
  // deps 를 두지 않는다. **매 렌더 뒤 최신으로** 가 이 effect 의 전부이고, 목록에 얹히는 값이
  // 하나 늘 때마다 deps 를 고쳐야 하는 자리를 만들면 빠뜨린 값이 조용히 낡는다.
  useEffect(() => {
    latestRef.current = {
      count,
      scroll: props.scroll,
      onMove: props.onMove,
      topPx: insets.top,
      bottomPx: windowHeightPx - insets.bottom,
    }
  })

  useEffect(() => {
    const frame = frameRef
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])

  const drag = useMemo(() => {
    /** 지금 좌표로 그림과 드롭 위치를 맞춘다. 손가락이 움직일 때와 스크롤이 흐를 때 둘 다 부른다. */
    function apply(): void {
      const state = dragRef.current
      if (state === null) return
      const { count: rowCount, scroll } = latestRef.current

      // 스크롤이 흐르면 손가락은 그대로인데 행이 콘텐츠를 따라 올라간다. 흐른 만큼을 더해야
      // 행이 손가락 밑에 남는다.
      const offsetPx = state.translationPx + (scroll.offsetPx() - state.startOffsetPx)
      dragY.value = offsetPx

      const next = resolveDropIndex(state.fromIndex, offsetPx, pitchRef.current, rowCount)
      if (next !== state.toIndex) {
        state.toIndex = next
        setDrop({ fromIndex: state.fromIndex, toIndex: next })
      }
    }

    function tick(): void {
      if (dragRef.current === null) {
        frameRef.current = null
        return
      }

      const { scroll, topPx, bottomPx } = latestRef.current
      const stepPx = resolveAutoScrollStepPx({
        pointerYPx: dragRef.current.pointerYPx,
        topPx,
        bottomPx,
        zonePx: AUTO_SCROLL_ZONE_PX,
        maxStepPx: AUTO_SCROLL_MAX_STEP_PX,
      })
      if (stepPx !== 0) scroll.scrollToPx(Math.max(0, scroll.offsetPx() + stepPx))
      apply()

      frameRef.current = requestAnimationFrame(tick)
    }

    return {
      begin(fromIndex: number, pointerYPx: number): void {
        dragRef.current = {
          fromIndex,
          toIndex: fromIndex,
          startOffsetPx: latestRef.current.scroll.offsetPx(),
          translationPx: 0,
          pointerYPx,
        }
        dragY.value = 0
        setDrop({ fromIndex, toIndex: fromIndex })
        if (frameRef.current === null) frameRef.current = requestAnimationFrame(tick)
      },

      update(translationPx: number, pointerYPx: number): void {
        const state = dragRef.current
        if (state === null) return
        state.translationPx = translationPx
        state.pointerYPx = pointerYPx
        apply()
      },

      /** 놓았을 때·취소됐을 때 모두 여기로 온다. 시작하지 않은 제스처면 아무 일도 없다. */
      end(): void {
        const state = dragRef.current
        dragRef.current = null
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current)
          frameRef.current = null
        }
        dragY.value = 0
        if (state === null) return

        setDrop(null)
        if (state.toIndex !== state.fromIndex) {
          latestRef.current.onMove(state.fromIndex, state.toIndex)
        }
      },
    }
  }, [dragY])

  function measure(event: LayoutChangeEvent): void {
    if (count === 0) return
    const next = (event.nativeEvent.layout.height + GAP_PX) / count
    pitchRef.current = next
    // 재는 값이 소수점에서 흔들리므로 의미 있는 변화에만 다시 그린다.
    if (Math.abs(next - pitchPx) > 0.5) setPitchPx(next)
  }

  return (
    <View className="gap-2" onLayout={measure}>
      {props.views.map((view, index) => (
        <SelectedRow
          key={view.ocid}
          view={view}
          index={index}
          count={count}
          isRepresentative={props.representativeOcid === view.ocid}
          // 하나가 채워지면 나머지는 흐려진다. 비활성이 아니라 톤만 낮춘다(결정 4).
          dimmed={props.representativeOcid !== null && props.representativeOcid !== view.ocid}
          dragY={dragY}
          drop={drop}
          pitchPx={pitchPx}
          drag={drag}
          onMove={props.onMove}
          onRemove={props.onRemove}
          onSelectRepresentative={props.onSelectRepresentative}
        />
      ))}
    </View>
  )
}

interface DragHandlers {
  begin: (fromIndex: number, pointerYPx: number) => void
  update: (translationPx: number, pointerYPx: number) => void
  end: () => void
}

interface SelectedRowProps {
  view: SelectedCharacterView
  index: number
  count: number
  isRepresentative: boolean
  dimmed: boolean
  dragY: SharedValue<number>
  drop: { fromIndex: number; toIndex: number } | null
  pitchPx: number
  drag: DragHandlers
  onMove: (fromIndex: number, toIndex: number) => void
  onRemove: (ocid: string) => void
  onSelectRepresentative: (ocid: string) => void
}

function SelectedRow(props: SelectedRowProps): React.JSX.Element {
  const { count, drag, dragY, drop, index, view } = props
  const isDragging = drop !== null && drop.fromIndex === index
  const shiftPx =
    drop === null ? 0 : resolveRowShiftSteps(index, drop.fromIndex, drop.toIndex) * props.pitchPx

  const animatedStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: isDragging ? dragY.value : shiftPx }] }),
    [isDragging, shiftPx],
  )

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // 위 파일 머리 `제스처 콜백은 JS 스레드에서 돈다`.
        .runOnJS(true)
        // 세로로 움직여야 끌기다. 그 전에는 아래의 `ScrollView` 가 손가락을 갖는다.
        .activeOffsetY([-ACTIVATE_OFFSET_PX, ACTIVATE_OFFSET_PX])
        .onStart((event) => drag.begin(index, event.absoluteY))
        .onUpdate((event) => drag.update(event.translationY, event.absoluteY))
        // `onEnd` 가 아니라 `onFinalize`. 취소(다른 제스처가 가져감·손가락 이탈)도 같은 문으로
        // 들어와야 끌리던 행이 그 자리에 얼어붙지 않는다.
        .onFinalize(() => drag.end()),
    [drag, index],
  )

  // **할 수 있는 것만 준다**. 첫 행에 `위로 옮기기`를 주면 눌러도 아무 일이 없다.
  const reorderActions = [
    ...(index > 0 ? [{ name: MOVE_UP, label: '위로 옮기기' }] : []),
    ...(index < count - 1 ? [{ name: MOVE_DOWN, label: '아래로 옮기기' }] : []),
  ]

  return (
    <AnimatedView style={animatedStyle} className={isDragging ? 'z-10' : undefined}>
      <CharacterRow
        name={view.name}
        level={view.level}
        jobClass={view.jobClass}
        world={view.world}
        imageUrl={view.imageUrl}
        unavailable={view.unavailable}
        leading={
          <GestureDetector gesture={pan}>
            {/* 끌기와 같은 결과를 내는 **화면 밖 경로**. 스크린리더가 이
                핸들에 서면 로터에 `위로/아래로 옮기기`가 뜬다. 두 경로가 `onMove` 하나를 부른다. */}
            <View
              accessible
              accessibilityLabel={`${view.name} 순서 변경`}
              accessibilityActions={reorderActions}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === MOVE_UP) props.onMove(index, index - 1)
                if (event.nativeEvent.actionName === MOVE_DOWN) props.onMove(index, index + 1)
              }}
            >
              <DragHandle />
            </View>
          </GestureDetector>
        }
        trailing={
          <View className="shrink-0 flex-row items-center gap-1">
            <RepresentativeStar
              label={view.name}
              filled={props.isRepresentative}
              dimmed={props.dimmed}
              onPress={() => props.onSelectRepresentative(view.ocid)}
            />
            <RemoveButton label={view.name} onPress={() => props.onRemove(view.ocid)} />
          </View>
        }
      />
    </AnimatedView>
  )
}
