/**
 * 선택 줄의 초상을 누르면 튀어나오는 난이도 캡슐. 그 보스의 난이도 배지와 `제거` 가 한 줄이다.
 *
 * 고른 난이도는 선명하고 나머지는 흐리다. 테두리로 고름을 가르지 않는다. 알약 모양이고 꼬리가 초상을 가리킨다. 초상 위아래 중
 * 빈 공간이 넓은 쪽 10 에 가운데를 맞춰, 초상 쪽 변을 기준으로 0.7 배에서 튀어나온다(시안과 같은 값).
 */
import { useState } from 'react'
import { Pressable, View, type LayoutChangeEvent } from 'react-native'
import { vars } from 'nativewind'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'

import { useScreenLayout } from '../../../lib/screen-layout'
import { Badge, Text } from '../../atoms'
import { PopoverCaret, PopoverLayer } from '../../molecules/Popover/Popover'
import { DIFFICULTY_NAME } from '../../../constants/domain/boss-difficulty'
import { activeDifficultiesNow, supportedDifficultiesOf } from '../../../lib/boss/bosses'
import type { PopoverAnchorRect } from '../../../hooks/useAnchoredPopover'
import { usePopoverPlacement } from '../../../hooks/usePopoverPlacement'
import { CARET_WIDTH, centerBubble } from '../../../lib/popover-anchor'
import { useThemeAppearance } from '../../../theme/context'
import { buildPopoverScopeVariables } from '../../../theme/theme-vars'

/** 초상과 캡슐 사이 · 화면 가장자리 여백 */
const GAP = 10
const EDGE_GAP = 8

/**
 * 0.7 배 · 초상 쪽으로 6 에서 튀어나온다. 넘치듯 멈추는 곡선.
 *
 * 시안은 초상 쪽 변의 가운데를 기준으로 커진다. 가운데 기준으로 0.7 배면 그 변이 높이의 15% 안쪽으로
 * 들어가므로, 그만큼 초상 쪽으로 밀어 두고 시작한다(Animated.View 에 정적 스타일 `transformOrigin` 을 주면 버려진다).
 */
function popIn(height: number, below: boolean) {
  const offset = (6 + height * 0.15) * (below ? -1 : 1)
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: offset }, { scale: 0.7 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.bezier(0.3, 1.4, 0.5, 1) },
  }).duration(220)
}

export interface BossDifficultyPopoverProps {
  bossKey: string
  difficulty: string
  anchor: PopoverAnchorRect
  onSelect: (difficulty: string) => void
  onRemove: () => void
  onClose: () => void
}

export function BossDifficultyPopover(props: BossDifficultyPopoverProps): React.JSX.Element {
  const { contentWidthPx } = useScreenLayout()
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const { anchor } = props
  const placement = usePopoverPlacement(anchor, GAP)
  const difficulties = activeDifficultiesNow(props.bossKey)

  // 꼬리는 알약의 둥근 끝(높이의 반)을 피한다.
  const geometry = centerBubble({
    containerWidth: contentWidthPx,
    anchorCenterX: anchor.left + anchor.width / 2,
    bubbleWidth: size?.width ?? 0,
    caretSize: CARET_WIDTH,
    edgeGap: EDGE_GAP,
    caretInset: (size?.height ?? 0) / 2,
  })
  const left = size === null ? 0 : geometry.left

  function onLayout(event: LayoutChangeEvent): void {
    setSize(event.nativeEvent.layout)
    placement.onLayout(event)
  }

  return (
    <PopoverLayer closeLabel="난이도 고르기 닫기" onClose={props.onClose}>
      {/* 크기를 재기 전에는 안 보이게 그린다. 잰 뒤 다시 그리며 튀어나온다. */}
      {size === null || !placement.measured ? (
        <View testID="boss-difficulty-popover" style={{ position: 'absolute', opacity: 0 }} onLayout={onLayout}>
          <Capsule {...props} difficulties={difficulties} />
        </View>
      ) : (
        // 자리는 바깥 View, 튀어나오는 움직임만 Animated.View. 한데 주면 자리가 버려진다.
        <View testID="boss-difficulty-popover" style={{ position: 'absolute', left, top: placement.top }}>
          <Animated.View entering={popIn(size.height, placement.side === 'below')}>
            <Capsule
              {...props}
              difficulties={difficulties}
              // 화면 가운데로 옮겼으면 가리킬 초상이 없다.
              caret={
                placement.side === 'center'
                  ? undefined
                  : { edge: placement.side === 'above' ? 'bottom' : 'top', left: geometry.caretLeft }
              }
            />
          </Animated.View>
        </View>
      )}
    </PopoverLayer>
  )
}

function Capsule(
  props: BossDifficultyPopoverProps & {
    difficulties: ReturnType<typeof supportedDifficultiesOf>
    /** 크기를 재는 동안과 화면 가운데로 옮긴 때는 없다 */
    caret?: { edge: 'top' | 'bottom'; left: number }
  },
): React.JSX.Element {
  const { definition } = useThemeAppearance()
  return (
    <View
      role="dialog"
      aria-label="난이도 고르기"
      // 다른 팝오버처럼 다크에서는 시트보다 한 단 더 올린다. 꼬리도 이 색이다.
      style={vars(buildPopoverScopeVariables(definition))}
      className="flex-row items-center gap-1 rounded-full bg-surface p-1 shadow-lg"
    >
      {props.caret !== undefined && (
        <PopoverCaret testID="boss-difficulty-popover-caret" edge={props.caret.edge} left={props.caret.left} />
      )}
      {props.difficulties.map((difficulty) => (
        <Pressable
          key={difficulty}
          role="button"
          aria-label={DIFFICULTY_NAME[difficulty]}
          aria-selected={difficulty === props.difficulty}
          onPress={() => props.onSelect(difficulty)}
          hitSlop={4}
          style={{ opacity: difficulty === props.difficulty ? 1 : 0.35 }}
        >
          <Badge variant={difficulty}>{DIFFICULTY_NAME[difficulty]}</Badge>
        </Pressable>
      ))}
      <Pressable role="button" aria-label="제거" onPress={props.onRemove} hitSlop={6} className="px-1.5">
        <Text className="text-11 font-semibold text-error-ink">제거</Text>
      </Pressable>
    </View>
  )
}
