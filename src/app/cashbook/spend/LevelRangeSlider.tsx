/**
 * 심볼 강화의 레벨 칸 슬라이더. 칸 하나가 레벨 하나이고 왼쪽 손잡이가 강화 전, 오른쪽이 강화 후다.
 *
 * 손잡이를 끌거나 칸을 눌러 옮긴다. 한 칸 옮길 때마다 햅틱이 난다. 끌기는 가로로 움직일 때만
 * 잡는다. 세로 끌기는 시트가 가져가야 시트를 내릴 수 있다.
 */
import { useState } from 'react'
import { Pressable, View, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import { Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { selectionFeedback } from '../../../native/haptics'
import {
  cellCenterPercent,
  dragRange,
  grabThumb,
  levelAt,
  tapRange,
  type LevelRange,
  type Thumb,
} from './level-range'

/** 손잡이 상자. 칸(높이 32)보다 위아래로 8 씩 크다. 아케인은 칸 폭이 약 16 이라 이웃 칸을 조금 덮는다. */
const HANDLE = { width: 32, height: 48 }

export function LevelRangeSlider(props: {
  /** 최고 레벨. 아케인 20 · 어센틱 11. */
  max: number
  from: number
  to: number
  /** 심볼을 안 골랐다. 칸만 흐리게 서고 손잡이가 없다. */
  disabled?: boolean
  onChange: (next: LevelRange) => void
}): React.JSX.Element {
  const [width, setWidth] = useState(0)
  /**
   * 끌기 중에 잡은 손잡이. 끌지 않을 때는 `null` 이다.
   *
   * 콜백은 렌더마다 새 제스처로 갈아 끼워진다. 잡은 직후 다시 렌더되기 전에 온 이벤트는 `null` 을 보고
   * 건너뛴다(한 프레임 이내). 옛 손잡이로 옮기는 것보다 낫다.
   */
  const [grabbed, setGrabbed] = useState<Thumb | null>(null)
  const range = { from: props.from, to: props.to }

  /** 바뀌었을 때만 알리고 햅틱을 낸다. 같은 칸에 머무는 끌기는 조용하다. */
  function commit(next: LevelRange): void {
    if (next.from === props.from && next.to === props.to) return
    selectionFeedback()
    props.onChange(next)
  }

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(props.disabled !== true)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart((event) => {
      const thumb = grabThumb(range, levelAt(event.x - event.translationX, width, props.max), event.translationX)
      setGrabbed(thumb)
      commit(dragRange(range, thumb, levelAt(event.x, width, props.max)))
    })
    .onUpdate((event) => {
      if (grabbed !== null) commit(dragRange(range, grabbed, levelAt(event.x, width, props.max)))
    })
    .onFinalize(() => setGrabbed(null))
    .withTestId('level-range-pan')

  function adjust(thumb: Thumb, event: AccessibilityActionEvent): void {
    const level = (thumb === 'from' ? props.from : props.to) + (event.nativeEvent.actionName === 'increment' ? 1 : -1)
    if (level < 1 || level > props.max) return
    commit(dragRange(range, thumb, level))
  }

  const levels = Array.from({ length: props.max }, (_, index) => index + 1)

  function handle(thumb: Thumb, label: string, level: number): React.JSX.Element {
    return (
      <View
        accessible
        role="slider"
        aria-label={label}
        accessibilityValue={{ min: 1, max: props.max, now: level, text: `Lv.${level}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => adjust(thumb, event)}
        pointerEvents="none"
        className="absolute top-0 items-center justify-center rounded-[10px] bg-primary shadow-md"
        style={{ ...HANDLE, left: `${cellCenterPercent(level, props.max)}%`, marginLeft: -HANDLE.width / 2 }}
      >
        <Text className="text-sm font-bold text-on-primary" style={TABULAR_NUMS}>
          {level}
        </Text>
      </View>
    )
  }

  return (
    <GestureDetector gesture={pan}>
      <View
        testID="level-range-track"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        // 손잡이가 끝 칸 밖으로 8 나간다. 그만큼 안쪽으로 들인다.
        className={`mx-2.5 h-12 justify-center ${props.disabled === true ? 'opacity-40' : ''}`}
      >
        <View className="h-8 flex-row gap-0.5">
          {levels.map((level) => {
            const inside = props.disabled !== true && level >= props.from && level <= props.to
            return (
              <Pressable
                key={level}
                role="button"
                aria-label={`Lv.${level}`}
                disabled={props.disabled}
                onPress={() => commit(tapRange(range, level))}
                className={`flex-1 items-center justify-center rounded-md ${inside ? 'bg-primary-tint' : 'bg-track'}`}
              >
                <Text
                  className={`text-11 ${inside ? 'font-bold text-primary-ink' : 'font-semibold text-text-disabled'}`}
                  style={TABULAR_NUMS}
                >
                  {level}
                </Text>
              </Pressable>
            )
          })}
        </View>
        {props.disabled !== true && handle('from', '강화 전 레벨', props.from)}
        {props.disabled !== true && handle('to', '강화 후 레벨', props.to)}
      </View>
    </GestureDetector>
  )
}
