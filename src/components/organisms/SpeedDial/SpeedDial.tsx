/**
 * 펼치는 ＋. 떠 있는 ＋ 하나가 받은 갈래들을 같은 폭 알약으로 펴는 앱 공용 부품.
 *
 * 갈래가 시트 **밖**에서 갈린다. 시트는 자기가 어느 갈래인지 모른 채 프롭으로 받은 것을 그린다.
 *
 * 지키는 것 셋.
 *
 * ① 반환 전체가 `<BottomBarOverlay>` 안이다. 화면 안에서 그리면 하단바가 그 위라 백드롭이 바를
 *    못 덮는다.
 * ② 접혀도 갈래는 **마운트된 채** 남고 `disabled` 로만 막는다. `aria-hidden` 은 쓰지 말 것.
 *    RNTL 이 그 노드를 숨김으로 보고 쿼리에서 걷어내 테스트가 못 잡는다.
 * ③ 알약 폭은 모두 같고 가장 긴 글자에 맞춘다. 글자는 접혀 있어도 그려 두고 `onLayout` 으로 잰다.
 */
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
} from 'react-native-reanimated'

import { BottomBarOverlay } from '../BottomBar/BottomBarOverlay'
import { tapFeedback } from '../../../native/haptics'
import { FAB_DARK_EDGE, FAB_SHADOW, useFabBottomPx } from '../../../lib/fab-metrics'
import { boxShadowOf } from '../../../lib/shadow'
import { useThemeAppearance } from '../../../theme/context'
import type { ThemeDefinition } from '../../../types/theme'
import { PlusIcon, Text } from '../../atoms'
import {
  DIAL_GAP_PX,
  DIAL_RISE_START_SCALE,
  FAB_OPEN_ROTATION_DEG,
  PILL_HEIGHT_PX,
  PILL_ICON_SLOT_PX,
  chromeTiming,
  dialTiming,
  pillWidth,
  riseOffsetPx,
  type DialStep,
} from './speed-dial-motion'

/**
 * 애니메이션이 붙는 상자. `nativewind-interop` 의 `AnimatedView` 를 쓰지 않는다.
 *
 * 그쪽은 `cssInterop` 에 등록된 `Animated.View` 이고, 정적 스타일과 애니메이션 스타일을 한 배열로
 * 넘기면 정적 쪽이 사라진다. 그래서 이 파일의 애니메이션 상자들은 색까지 `style` 로 준다.
 */
const AnimatedBox = Animated.createAnimatedComponent(View)

/** 앱이 이미 쓰는 감속 커브(`BottomBar` 의 `EASE` 와 같은 가족) */
const EASE_OUT = Easing.bezier(0.32, 0.72, 0, 1)
/** 접힘은 가속만. 끝에서 머뭇거리면 접히는 중이 길어 보인다 */
const EASE_IN = Easing.bezier(0.4, 0, 1, 1)
/** 원이 솟을 때 살짝 넘쳤다 자리 잡는다 */
const EASE_SPRING = Easing.bezier(0.34, 1.42, 0.64, 1)

/** 아이콘 원 지름과 알약 안 여백 */
const ICON_CIRCLE_PX = 42
const ICON_INSET_PX = (PILL_HEIGHT_PX - ICON_CIRCLE_PX) / 2
/** 글자를 재는 상자 폭. 글자가 여기서 줄바꿈되지 않을 만큼 넉넉하면 된다(알약이 잘라 보인다) */
const LABEL_BOX_PX = 360

/** 0(접힘) ↔ 1(펼침) 하나로 그 요소의 값을 내는 진행률 */
function useStepProgress(
  step: DialStep,
  isOpen: boolean,
  openEasing: EasingFunction | EasingFunctionFactory,
): SharedValue<number> {
  const progress = useSharedValue(0)
  const { delayMs, durationMs } = step

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withTiming(isOpen ? 1 : 0, { duration: durationMs, easing: isOpen ? openEasing : EASE_IN }),
    )
  }, [delayMs, durationMs, isOpen, openEasing, progress])

  return progress
}

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>

/** ＋ 가 펴는 갈래 하나 */
export interface SpeedDialAction {
  key: string
  /** 알약에 적는 이름 */
  label: string
  /** 이름 아래 한 줄. 없으면 이름만 */
  description?: string
  /** 스크린리더 이름. 없으면 `label` */
  accessibilityLabel?: string
  Icon: IconComponent
  onSelect: () => void
}

interface DialPillProps {
  action: SpeedDialAction
  index: number
  count: number
  width: number
  isOpen: boolean
  reduceMotion: boolean
  definition: ThemeDefinition
  onMeasure: (key: string, width: number) => void
  onPress: () => void
}

function DialPill(props: DialPillProps): React.JSX.Element {
  const { action, definition, reduceMotion } = props
  const timing = dialTiming(props.index, props.count, props.isOpen, reduceMotion)
  const rise = useStepProgress(timing.rise, props.isOpen, EASE_SPRING)
  const expand = useStepProgress(timing.expand, props.isOpen, EASE_OUT)
  const label = useStepProgress(timing.label, props.isOpen, Easing.linear)
  const offset = riseOffsetPx(props.count - 1 - props.index)
  const width = props.width

  // 움직임을 줄이면 솟음 · 늘어남 없이 펼친 알약이 페이드로만 나타난다.
  const riseStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: reduceMotion
      ? []
      : [
          { translateY: (1 - rise.value) * offset },
          { scale: DIAL_RISE_START_SCALE + rise.value * (1 - DIAL_RISE_START_SCALE) },
        ],
  }))
  const widthStyle = useAnimatedStyle(() => ({
    width: reduceMotion ? width : PILL_HEIGHT_PX + expand.value * (width - PILL_HEIGHT_PX),
  }))
  const labelStyle = useAnimatedStyle(() => ({ opacity: reduceMotion ? rise.value : label.value }))

  return (
    <Pressable
      testID={`speed-dial-row-${action.key}`}
      role="button"
      aria-label={action.accessibilityLabel ?? action.label}
      disabled={!props.isOpen}
      /*
       * 접혀 있으면 터치를 안 받는다. 접힌 줄은 마운트된 채 `opacity: 0` 일 뿐이라 그 자리가 그대로
       * 히트테스트에 걸린다. `disabled` 는 `onPress` 만 막고 터치를 통과시키지는 않는다.
       */
      pointerEvents={props.isOpen ? 'auto' : 'none'}
      onPress={props.onPress}
      className="items-end"
    >
      <AnimatedBox style={riseStyle}>
        <AnimatedBox
          testID={`speed-dial-pill-${action.key}`}
          style={[
            {
              height: PILL_HEIGHT_PX,
              borderRadius: PILL_HEIGHT_PX / 2,
              backgroundColor: definition.surface,
              overflow: 'hidden',
            },
            widthStyle,
          ]}
        >
          {/* 알약이 왼쪽으로 늘어나는 동안 원은 왼쪽 끝을 따라간다. */}
          <View
            testID={`speed-dial-icon-${action.key}`}
            style={{
              position: 'absolute',
              left: ICON_INSET_PX,
              top: ICON_INSET_PX,
              width: ICON_CIRCLE_PX,
              height: ICON_CIRCLE_PX,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: definition.primaryTint,
            }}
          >
            <action.Icon className="h-5 w-5 text-primary-ink" strokeWidth={2} />
          </View>
          <AnimatedBox
            style={[
              { position: 'absolute', left: PILL_ICON_SLOT_PX, top: 0, bottom: 0, width: LABEL_BOX_PX, justifyContent: 'center' },
              labelStyle,
            ]}
          >
            <View
              testID={`speed-dial-label-${action.key}`}
              onLayout={(event) => props.onMeasure(action.key, event.nativeEvent.layout.width)}
              style={{ alignSelf: 'flex-start' }}
            >
              <Text className="text-sm font-bold text-text" numberOfLines={1}>
                {action.label}
              </Text>
              {action.description !== undefined && (
                <Text testID={`speed-dial-description-${action.key}`} className="text-11 text-text-muted" numberOfLines={1}>
                  {action.description}
                </Text>
              )}
            </View>
          </AnimatedBox>
        </AnimatedBox>
      </AnimatedBox>
    </Pressable>
  )
}

export interface SpeedDialProps {
  /** 접혀 있을 때 ＋ 의 스크린리더 이름(`기록 추가` · `약속 추가`) */
  label: string
  /** 위에서 아래 순서. 마지막이 ＋ 에 가장 가깝다 */
  actions: readonly SpeedDialAction[]
}

export function SpeedDial(props: SpeedDialProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [labelWidths, setLabelWidths] = useState<Readonly<Record<string, number>>>({})
  const reduceMotion = useReducedMotion()
  const { definition } = useThemeAppearance()

  // 떠 있는 하단바 위에 앉는다. 화면 기준 `bottom: 0` 은 바 뒤라 거기 두면 반쯤 가린다.
  const dialBottomPx = useFabBottomPx()

  const chrome = chromeTiming(isOpen, reduceMotion)
  const scrim = useStepProgress(chrome.scrim, isOpen, Easing.linear)
  const fab = useStepProgress(chrome.fab, isOpen, EASE_SPRING)

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }))
  const fabStyle = useAnimatedStyle(() => ({
    transform: reduceMotion ? [] : [{ rotate: `${fab.value * FAB_OPEN_ROTATION_DEG}deg` }],
  }))

  const width = pillWidth(Math.max(0, ...props.actions.map((action) => labelWidths[action.key] ?? 0)))

  function measure(key: string, measured: number): void {
    setLabelWidths((current) => (current[key] === measured ? current : { ...current, [key]: measured }))
  }

  function select(onSelect: () => void): void {
    setIsOpen(false)
    onSelect()
  }

  return (
    <BottomBarOverlay>
      {/* 스크림은 접혀 있을 때 터치를 안 먹는다. 먹으면 판이 닫힌 채로 뒤 화면을 덮는다. */}
      <AnimatedBox
        testID="speed-dial-scrim"
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: definition.scrim }, scrimStyle]}
      >
        {/* 접근성 트리에서 뺀다. 닫는 방법을 이름으로 알리는 것은 ＋ 가 맡고, 배경까지 닫기라고 하면
            같은 이름이 둘이 되어 스크린리더에도 테스트의 이름 조회에도 모호해진다. */}
        <Pressable
          testID="speed-dial-scrim-button"
          accessible={false}
          onPress={() => setIsOpen(false)}
          style={StyleSheet.absoluteFill}
        />
      </AnimatedBox>

      <View
        testID="speed-dial-actions"
        // 줄 사이의 빈 자리와 오른쪽 여백도 이 상자의 넓이다. 상자가 터치를 먹으면 뒤 화면이 안 눌린다.
        pointerEvents="box-none"
        style={{ bottom: dialBottomPx, gap: DIAL_GAP_PX }}
        className="absolute right-4 items-end"
      >
        {props.actions.map((action, index) => (
          <DialPill
            key={action.key}
            action={action}
            index={index}
            count={props.actions.length}
            width={width}
            isOpen={isOpen}
            reduceMotion={reduceMotion}
            definition={definition}
            onMeasure={measure}
            onPress={() => select(action.onSelect)}
          />
        ))}
        {/* 그림자만 드는 상자. `DropPriceFab` 과 같은 물건으로 보여야 해서 같은 자리에 단다.
            모양은 `borderRadius` 에서 나온다. 없으면 둥근 원 뒤에 네모난 그림자가 깔린다. */}
        <View
          testID="speed-dial-fab-elevation"
          style={{ borderRadius: 999, boxShadow: boxShadowOf(definition.shadowColor, FAB_SHADOW) }}
        >
          <Pressable
            role="button"
            // 이름이 상태를 든다. 그림은 하나이고 각도만 다르므로 스크린리더에는 안 들린다.
            aria-label={isOpen ? '닫기' : props.label}
            onPress={() => {
              tapFeedback()
              setIsOpen((open) => !open)
            }}
            // 다크에서는 그림자가 거의 안 보여 테두리가 경계를 진다. 크기가 박힌 이 원이 들어야 자리가 안 움직인다.
            style={
              definition.mode === 'dark'
                ? { borderWidth: StyleSheet.hairlineWidth, borderColor: FAB_DARK_EDGE }
                : undefined
            }
            className="h-14 w-14 items-center justify-center rounded-full bg-primary"
          >
            <AnimatedBox style={fabStyle}>
              <PlusIcon className="h-6 w-6 text-on-primary" strokeWidth={2.2} aria-hidden />
            </AnimatedBox>
          </Pressable>
        </View>
      </View>
    </BottomBarOverlay>
  )
}
