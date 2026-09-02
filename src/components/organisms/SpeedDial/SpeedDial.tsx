/**
 * 펼침판. 떠 있는 ＋ 하나가 갈래 둘을 편다.
 *
 * ## 갈래가 시트 **밖**에서 갈린다
 *
 * ＋ 를 누르면 시트가 아니라 두 갈래가 먼저 펼쳐지고, 고른 뒤에 시트가 열린다. 검토한 대안
 * (시트 맨 위 세그먼트)은 탭이 하나 적었는데도 이쪽을 고른 이유가 이것이다. **시트가 자기가
 * 어느 갈래인지 모른 채** 프롭으로 받은 것을 그리게 된다(이
 * 격자와 계산을 가른 것과 같은 모양). 나중에 진입점을 바꿔도 시트를 안 건드린다.
 *
 * ## 모양이 뜻을 든다
 *
 * - **원 + 라벨 칩.** 통짜 알약보다 원이 FAB 와 같은 축에 정렬돼 세로선이 반듯하고, 누르는 과녁은
 *   **칩까지 포함한 한 줄**이라 원보다 넓다.
 * - **원은 solid, 칩은 무채색.** 색을 양쪽에 다 주면 서로 싸운다. 의미는 원이, 이름은 칩이 든다.
 * - **수입이 위, 지출이 아래.** 칸의 두 줄과 같은 순서이고(위가 수익) 덕분에 **잦은 지출이 FAB 에
 *   더 가깝다**. 엄지가 올라오며 먼저 닿는다. 펼침판이 진 탭 하나 를 배치로 깎는다.
 * - **열리면 FAB 가 물러난다**. 주황 채움이 `surface-2` 로 빠져 강한 색 셋이 안 겹친다.
 * - **＋ 를 45° 돌리면 그대로 ✕ 다.** 아이콘이 하나뿐이라 두 그림이 어긋날 자리가 없다.
 *
 * ## 아이콘은 이 앱이 이미 고른 둘이다
 *
 * 수입은 `ProfitIcon`(원통형 동전 더미. 이 수익 을 가리키는 자리 셋에 쓰라고 정한
 * 커스텀), 지출은 `ShoppingCartIcon`(가 지운 지출 탭이 쓰던 그림). **새로
 * 만든 그림이 0개**이고, lucide `coins` 를 쓰면 안 된다. 그것도 동전 더미라 `ProfitIcon` 과
 * 거의 같은데 미묘하게 다른 동전 두 개 가 된다.
 *
 * ## 접혀도 갈래 둘은 **마운트된 채** 남는다
 *
 * 접히는 움직임을 보여주려면 사라지면 안 된다. 대신 `disabled` 로 막는다. **`aria-hidden` 은
 * 안 쓴다**: RNTL 이 그 노드를 숨김으로 보고 쿼리에서 걷어내 테스트가 못 잡는다(열지도 바탕과
 * 목요일 경계선에서 이미 두 번 겪은 자리).
 *
 * ## 이 그림은 화면이 아니라 **바 위 슬롯**에 그려진다
 *
 * 반환 전체가 `<BottomBarOverlay>` 안이다. 화면 안에서 그리면 하단바가 그 위라 **백드롭이 바를 못 덮고**,
 * 펼친 채로 바를 눌러 다른 탭으로 갈 수 있었다. 스크림만 올릴 수는 없다. ＋ 와 줄은 스크림 위여야
 * 하므로 셋이 한 덩어리로 올라간다. 자리 계산(`dialBottomPx`)은 창 기준이라 부모가 바뀌어도 그대로다.
 *
 * 움직임 값은 여기 없다. `speed-dial-motion.ts` 가 든다.
 */
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated'

import { FAB_LIFT_PX } from './speed-dial-metrics'
import { BottomBarOverlay } from '../../../navigation/BottomBarOverlay'
import { resolveBottomBarMetrics } from '../../../lib/bottom-bar-metrics'
import { useBottomSafeAreaPx } from '../../../lib/safe-area'
import { useThemeAppearance } from '../../../theme/context'
import type { ThemeDefinition } from '../../../types/theme'
import { PlusIcon, ProfitIcon, ShoppingCartIcon, Text } from '../../atoms'
import {
  DIAL_MOTION,
  DIAL_RISE_PX,
  DIAL_SLIDE_PX,
  DIAL_START_SCALE,
  FAB_OPEN_ROTATION_DEG,
  dialTiming,
  type DialStep,
} from './speed-dial-motion'

/**
 * 애니메이션이 붙는 상자. **`nativewind-interop` 의 `AnimatedView` 를 쓰지 않는다.**
 *
 * 그쪽은 `cssInterop` 에 등록된 `Animated.View` 이고, 등록된 컴포넌트에 **정적 스타일과 애니메이션
 * 스타일을 한 배열로** 넘기면 **정적 쪽이 사라진다**(iOS 실측 2026-08-25. 원이 44px 도 채움색도
 * 없이 아이콘만 남았고, 애니메이션 스타일만 떼면 즉시 정상이었다). 스크림에서는 그 탓에
 * `position: absolute` 가 사라져 화면을 통째로 밀어냈다.
 *
 * `BottomSheet` 의 `SheetScrim` 이 처음부터 `Animated.createAnimatedComponent(Pressable)` 로
 * **직접 만든** 컴포넌트를 쓰는 것이 같은 자리다. 여기도 그 형태를 따른다.
 * 대가는 `className` 을 못 쓰는 것이고, 그래서 이 파일의 애니메이션 상자들은 색까지 `style` 로 준다.
 */
const AnimatedBox = Animated.createAnimatedComponent(View)

/** 앱이 이미 쓰는 스택 전환 커브. `BottomBar` 의 `EASE` 와 같은 가족이다. */
const EASE = Easing.bezier(0.32, 0.72, 0, 1)
/** 닫힘은 가속만. 끝에서 머뭇거리면 접히는 중 이 길어 보인다. */
const EASE_IN = Easing.bezier(0.4, 0, 1, 1)

/** 0(접힘) ↔ 1(펼침) 하나로 그 요소의 모든 값을 만든다. */
function useDialProgress(step: DialStep, isOpen: boolean, reduceMotion: boolean): SharedValue<number> {
  const progress = useSharedValue(0)

  useEffect(() => {
    const { delay, duration } = dialTiming(step, isOpen, reduceMotion)
    progress.value = withDelay(
      delay,
      withTiming(isOpen ? 1 : 0, { duration, easing: isOpen ? EASE : EASE_IN }),
    )
  }, [isOpen, progress, reduceMotion, step])

  return progress
}

/** 원의 지름. 아래 FAB(56)보다 작다. 위계가 크기로 드러난다. */
const CIRCLE_PX = 44

interface DialRowProps {
  kind: 'income' | 'expense'
  label: string
  isOpen: boolean
  reduceMotion: boolean
  definition: ThemeDefinition
  onPress: () => void
}

function DialRow(props: DialRowProps): React.JSX.Element {
  const isIncome = props.kind === 'income'
  const circle = useDialProgress(
    isIncome ? DIAL_MOTION.incomeCircle : DIAL_MOTION.expenseCircle,
    props.isOpen,
    props.reduceMotion,
  )
  const chip = useDialProgress(
    isIncome ? DIAL_MOTION.incomeChip : DIAL_MOTION.expenseChip,
    props.isOpen,
    props.reduceMotion,
  )

  // **움직임을 줄이면 이동·스케일을 전부 끄고 불투명도만 남긴다**.
  const circleStyle = useAnimatedStyle(() => ({
    opacity: circle.value,
    transform: props.reduceMotion
      ? []
      : [
          { translateY: (1 - circle.value) * DIAL_RISE_PX },
          { scale: DIAL_START_SCALE + circle.value * (1 - DIAL_START_SCALE) },
        ],
  }))
  const chipStyle = useAnimatedStyle(() => ({
    opacity: chip.value,
    transform: props.reduceMotion ? [] : [{ translateX: (1 - chip.value) * DIAL_SLIDE_PX }],
  }))

  const Icon = isIncome ? ProfitIcon : ShoppingCartIcon
  const { definition } = props

  return (
    <Pressable
      testID={`speed-dial-row-${props.kind}`}
      role="button"
      aria-label={props.label}
      disabled={!props.isOpen}
      /*
       * **접혀 있으면 터치를 안 받는다**(사용자 보고 2026-08-27).
       *
       * 접힌 줄은 **마운트된 채** `opacity: 0` 일 뿐이라 RN 에서는 그 자리가 그대로 히트테스트에
       * 걸린다. `disabled` 는 `onPress` 만 막고 터치를 통과시키지는 않는다. 그래서 떠 있는 ＋
       * 위쪽이 통째로 **눌리지 않는 구역** 이 되어 **뒤의 목록 줄이 안 눌렸다.**
       *
       * 스크림은 이미 같은 처방을 쓰고 있었다. 줄에만 빠져 있었다.
       */
      pointerEvents={props.isOpen ? 'auto' : 'none'}
      onPress={props.onPress}
      className="flex-row items-center gap-2"
    >
      {/*
        색과 치수를 `style` 로 주는 이유는 위 `AnimatedBox` 주석에 있다. 이 상자는 `className` 을
        못 받는다.
      */}
      <AnimatedBox
        style={[
          {
            borderRadius: 999,
            borderWidth: 1,
            borderColor: definition.border,
            backgroundColor: definition.surface,
            paddingHorizontal: 12,
            paddingVertical: 6,
          },
          chipStyle,
        ]}
      >
        <Text className="text-xs font-semibold text-text">{props.label.replace(' 추가', '')}</Text>
      </AnimatedBox>
      <AnimatedBox
        style={[
          {
            width: CIRCLE_PX,
            height: CIRCLE_PX,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isIncome ? definition.riseInk : definition.fallInk,
          },
          circleStyle,
        ]}
      >
        {/* 원이 색을 드므로 그림은 바탕에서 파낸 것처럼 어둡게 둔다. */}
        <Icon className="h-5 w-5 text-bg" strokeWidth={2} aria-hidden />
      </AnimatedBox>
    </Pressable>
  )
}

export interface SpeedDialProps {
  onSelectIncome: () => void
  onSelectExpense: () => void
}

export function SpeedDial(props: SpeedDialProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const { definition } = useThemeAppearance()

  /**
   * **떠 있는 하단바 위에 앉는다.**
   *
   * 바는 화면 상자 **밖**이 아니라 그 위에 떠 있어서, 화면 기준 `bottom: 0` 은 바
   * 뒤다. 처음에 그렇게 뒀더니 FAB 가 캡슐에 반쯤 가려 안 보였다(실기기 확인 2026-08-25).
   *
   * 값은 `ScreenScroll` 이 콘텐츠 끝에 남기는 몫과 **같은 함수에서 나온다**
   * (`bottomSafeAreaPx + barSpacePx`, `bottom-inset.ts`). 손으로 옮겨 적으면 기기마다 갈린다.
   * 바 높이가 창 폭의 함수이기 때문이다.
   *
   * 이 컴포넌트는 **탭 화면에 선다고 전제한다.** 바가 없는 하위 페이지에 놓을 일이 생기면 그때
   * 프롭으로 가른다(지금은 쓰는 자리가 하나다).
   */
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const { width: windowWidthPx } = useWindowDimensions()
  const dialBottomPx =
    bottomSafeAreaPx + resolveBottomBarMetrics(windowWidthPx).spacePx + FAB_LIFT_PX

  const scrim = useDialProgress(DIAL_MOTION.scrim, isOpen, reduceMotion)
  const fab = useDialProgress(DIAL_MOTION.fab, isOpen, reduceMotion)

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }))
  const fabStyle = useAnimatedStyle(() => ({
    transform: reduceMotion ? [] : [{ rotate: `${fab.value * FAB_OPEN_ROTATION_DEG}deg` }],
  }))

  function select(onSelect: () => void): void {
    setIsOpen(false)
    onSelect()
  }

  return (
    <BottomBarOverlay>
      {/*
        스크림은 **접혀 있을 때 터치를 안 먹는다**. 먹으면 판이 닫힌 채로 캘린더를 덮어 날짜를
        고를 수 없게 된다(투명해서 원인이 안 보이는 종류의 결함이다).
      */}
      <AnimatedBox
        testID="speed-dial-scrim"
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: definition.scrim }, scrimStyle]}
      >
        {/*
          **접근성 트리에서 뺀다**(`accessible={false}`). 닫는 방법을 이름으로 알리는 것은 FAB 이
          맡고(`aria-label` 이 `닫기`로 바뀐다), 배경까지 `닫기`라고 하면 **같은 이름이 둘**이 되어
          스크린리더에도, 테스트의 이름 조회에도 모호해진다. 터치는 그대로 받는다.
        */}
        <Pressable
          testID="speed-dial-scrim-button"
          accessible={false}
          onPress={() => setIsOpen(false)}
          style={StyleSheet.absoluteFill}
        />
      </AnimatedBox>

      <View
        testID="speed-dial-actions"
        /*
         * **상자는 자기 자리를 안 먹는다.** 줄 사이의 빈 자리와 오른쪽 여백도 이 상자의 넓이라,
         * 상자가 터치를 받으면 줄을 `none` 으로 두어도 같은 결함이 남는다. `box-none` 은
         * **자식은 눌리되 나는 통과** 다.
         */
        pointerEvents="box-none"
        style={{ bottom: dialBottomPx }}
        className="absolute right-4 items-end gap-3"
      >
        <DialRow
          kind="income"
          label="수입 추가"
          isOpen={isOpen}
          reduceMotion={reduceMotion}
          definition={definition}
          onPress={() => select(props.onSelectIncome)}
        />
        <DialRow
          kind="expense"
          label="지출 추가"
          isOpen={isOpen}
          reduceMotion={reduceMotion}
          definition={definition}
          onPress={() => select(props.onSelectExpense)}
        />
        <Pressable
          role="button"
          // 이름이 상태를 든다. 그림은 하나이고 **각도만** 다르므로 스크린리더에는 안 들린다.
          aria-label={isOpen ? '닫기' : '기록 추가'}
          onPress={() => setIsOpen((open) => !open)}
          className={`h-14 w-14 items-center justify-center rounded-full ${
            isOpen ? 'bg-surface-2' : 'bg-primary'
          }`}
        >
          <AnimatedBox style={fabStyle}>
            <PlusIcon
              className={`h-6 w-6 ${isOpen ? 'text-text-muted' : 'text-on-primary'}`}
              strokeWidth={2.2}
              aria-hidden
            />
          </AnimatedBox>
        </Pressable>
      </View>
    </BottomBarOverlay>
  )
}
