/**
 * 선택 줄의 초상을 누르면 그 위로 튀어나오는 난이도 캡슐. 그 보스의 난이도 배지와 `제거` 가 한 줄이다.
 *
 * 고른 난이도는 선명하고 나머지는 흐리다. 테두리로 고름을 가르지 않는다. 꼬리 없는 알약 모양이고, 초상 10 위에
 * 가운데를 맞춰 아래쪽을 기준으로 0.7 배에서 튀어나온다(시안과 같은 값).
 */
import { useState } from 'react'
import { Modal, Pressable, useWindowDimensions, View } from 'react-native'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'

import { Badge, Text } from '../../components/atoms'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { supportedDifficultiesOf } from '../../lib/boss/bosses'
import type { PopoverAnchorRect } from '../../hooks/useAnchoredPopover'

/** 초상과 캡슐 사이 · 화면 가장자리 여백 */
const GAP = 10
const EDGE_GAP = 8

/**
 * 0.7 배 · 6 아래에서 튀어나온다. 넘치듯 멈추는 곡선.
 *
 * 시안은 아래쪽 가운데를 기준으로 커진다. 가운데 기준으로 0.7 배면 아래 끝이 높이의 15% 올라가므로, 그만큼
 * 내려 두고 시작한다(Animated.View 에 정적 스타일 `transformOrigin` 을 주면 버려진다).
 */
function popIn(height: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 6 + height * 0.15 }, { scale: 0.7 }] },
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
  const { width: windowWidth } = useWindowDimensions()
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const { anchor } = props
  const difficulties = supportedDifficultiesOf(props.bossKey)

  const left =
    size === null
      ? 0
      : Math.max(EDGE_GAP, Math.min(windowWidth - size.width - EDGE_GAP, anchor.left + anchor.width / 2 - size.width / 2))
  const top = size === null ? 0 : anchor.top - GAP - size.height

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      <Pressable aria-label="난이도 고르기 닫기" onPress={props.onClose} className="flex-1" />
      {/* 크기를 재기 전에는 안 보이게 그린다. 잰 뒤 다시 그리며 튀어나온다. */}
      {size === null ? (
        <View
          style={{ position: 'absolute', opacity: 0 }}
          onLayout={(event) => setSize(event.nativeEvent.layout)}
        >
          <Capsule {...props} difficulties={difficulties} />
        </View>
      ) : (
        // 자리는 바깥 View, 튀어나오는 움직임만 Animated.View. 한데 주면 자리가 버려진다.
        <View style={{ position: 'absolute', left, top }}>
          <Animated.View entering={popIn(size.height)}>
            <Capsule {...props} difficulties={difficulties} />
          </Animated.View>
        </View>
      )}
    </Modal>
  )
}

function Capsule(
  props: BossDifficultyPopoverProps & { difficulties: ReturnType<typeof supportedDifficultiesOf> },
): React.JSX.Element {
  return (
    <View
      role="dialog"
      aria-label="난이도 고르기"
      className="flex-row items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-lg"
    >
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
