/**
 * 펼침판 — 떠 있는 ＋ 하나가 갈래 둘을 편다([[ADR-170]] 결정 5·6·7·8·9).
 *
 * ## 갈래가 시트 **밖**에서 갈린다
 *
 * ＋ 를 누르면 시트가 아니라 두 갈래가 먼저 펼쳐지고, 고른 뒤에 시트가 열린다. 검토한 대안
 * («시트 맨 위 세그먼트»)은 탭이 하나 적었는데도 이쪽을 고른 이유가 이것이다 — **시트가 자기가
 * 어느 갈래인지 모른 채** 프롭으로 받은 것을 그리게 된다([[ADR-147]] 결정 8 · [[ADR-169]] 결정 7 이
 * 격자와 계산을 가른 것과 같은 모양). 나중에 진입점을 바꿔도 시트를 안 건드린다.
 *
 * ## 모양이 뜻을 든다
 *
 * - **원 + 라벨 칩.** 통짜 알약보다 원이 FAB 와 같은 축에 정렬돼 세로선이 반듯하고, 누르는 과녁은
 *   **칩까지 포함한 한 줄**이라 원보다 넓다.
 * - **원은 solid, 칩은 무채색.** 색을 양쪽에 다 주면 서로 싸운다 — 의미는 원이, 이름은 칩이 든다.
 * - **수입이 위, 지출이 아래.** 칸의 두 줄과 같은 순서이고(위가 수익) 덕분에 **잦은 지출이 FAB 에
 *   더 가깝다** — 엄지가 올라오며 먼저 닿는다. 펼침판이 진 «탭 하나» 를 배치로 깎는다.
 * - **열리면 FAB 가 물러난다** — 주황 채움이 `surface-2` 로 빠져 강한 색 셋이 안 겹친다.
 * - **＋ 를 45° 돌리면 그대로 ✕ 다.** 아이콘이 하나뿐이라 두 그림이 어긋날 자리가 없다.
 *
 * ## 아이콘은 이 앱이 이미 고른 둘이다 ([[ADR-170]] 결정 9)
 *
 * 수입은 `ProfitIcon`(원통형 동전 더미 — [[ADR-066]] 이 «수익» 을 가리키는 자리 셋에 쓰라고 정한
 * 커스텀), 지출은 `ShoppingCartIcon`([[ADR-169]] 결정 2 가 지운 「지출」 탭이 쓰던 그림). **새로
 * 만든 그림이 0개**이고, lucide `coins` 를 쓰면 안 된다 — 그것도 동전 더미라 `ProfitIcon` 과
 * «거의 같은데 미묘하게 다른 동전 두 개» 가 된다.
 *
 * ## 접혀도 갈래 둘은 **마운트된 채** 남는다
 *
 * 접히는 움직임을 보여주려면 사라지면 안 된다. 대신 `disabled` 로 막는다 — **`aria-hidden` 은
 * 안 쓴다**: RNTL 이 그 노드를 숨김으로 보고 쿼리에서 걷어내 테스트가 못 잡는다(열지도 바탕과
 * 목요일 경계선에서 이미 두 번 겪은 자리).
 *
 * 움직임 값은 여기 없다 — `speed-dial-motion.ts` 가 든다([[ADR-147]] 결정 8).
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated'

import { ProfitIcon } from '../../atoms/ProfitIcon/ProfitIcon'
import { Text } from '../../atoms/Text/Text'
import { AnimatedView } from '../../../lib/nativewind-interop'
import { PlusIcon, ShoppingCartIcon } from '../../../lib/icons'
import {
  DIAL_MOTION,
  DIAL_RISE_PX,
  DIAL_SLIDE_PX,
  DIAL_START_SCALE,
  FAB_OPEN_ROTATION_DEG,
  dialTiming,
  type DialStep,
} from './speed-dial-motion'

/** 앱이 이미 쓰는 스택 전환 커브([[ADR-120]]) — `BottomBar` 의 `EASE` 와 같은 가족이다. */
const EASE = Easing.bezier(0.32, 0.72, 0, 1)
/** 닫힘은 가속만 — 끝에서 머뭇거리면 «접히는 중» 이 길어 보인다. */
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

interface DialRowProps {
  kind: 'income' | 'expense'
  label: string
  isOpen: boolean
  reduceMotion: boolean
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

  // **움직임을 줄이면 이동·스케일을 전부 끄고 불투명도만 남긴다**([[ADR-170]] 결정 8).
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

  return (
    <Pressable
      testID={`speed-dial-row-${props.kind}`}
      role="button"
      aria-label={props.label}
      disabled={!props.isOpen}
      onPress={props.onPress}
      className="flex-row items-center gap-2"
    >
      <AnimatedView
        style={chipStyle}
        className="rounded-full border border-border bg-surface px-3 py-1.5"
      >
        <Text className="text-xs font-semibold text-text">{props.label.replace(' 추가', '')}</Text>
      </AnimatedView>
      <AnimatedView
        style={circleStyle}
        className={`h-11 w-11 items-center justify-center rounded-full ${
          isIncome ? 'bg-rise-ink' : 'bg-fall-ink'
        }`}
      >
        {/* 원이 색을 드므로 그림은 바탕에서 파낸 것처럼 어둡게 둔다. */}
        <Icon className="h-5 w-5 text-bg" strokeWidth={2} aria-hidden />
      </AnimatedView>
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
    <>
      {/*
        스크림은 **접혀 있을 때 터치를 안 먹는다** — 먹으면 판이 닫힌 채로 캘린더를 덮어 날짜를
        고를 수 없게 된다(투명해서 원인이 안 보이는 종류의 결함이다).
      */}
      <AnimatedView
        testID="speed-dial-scrim"
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={scrimStyle}
        className="absolute bottom-0 left-0 right-0 top-0 bg-scrim"
      >
        {/*
          **접근성 트리에서 뺀다**(`accessible={false}`) — 닫는 방법을 이름으로 알리는 것은 FAB 이
          맡고(`aria-label` 이 「닫기」로 바뀐다), 배경까지 「닫기」라고 하면 **같은 이름이 둘**이 되어
          스크린리더에도, 테스트의 이름 조회에도 모호해진다. 터치는 그대로 받는다.
        */}
        <Pressable
          testID="speed-dial-scrim-button"
          accessible={false}
          onPress={() => setIsOpen(false)}
          className="h-full w-full"
        />
      </AnimatedView>

      <View className="absolute bottom-4 right-4 items-end gap-3">
        <DialRow
          kind="income"
          label="수입 추가"
          isOpen={isOpen}
          reduceMotion={reduceMotion}
          onPress={() => select(props.onSelectIncome)}
        />
        <DialRow
          kind="expense"
          label="지출 추가"
          isOpen={isOpen}
          reduceMotion={reduceMotion}
          onPress={() => select(props.onSelectExpense)}
        />
        <Pressable
          role="button"
          // 이름이 상태를 든다 — 그림은 하나이고 **각도만** 다르므로 스크린리더에는 안 들린다.
          aria-label={isOpen ? '닫기' : '기록 추가'}
          onPress={() => setIsOpen((open) => !open)}
          className={`h-14 w-14 items-center justify-center rounded-full ${
            isOpen ? 'bg-surface-2' : 'bg-primary'
          }`}
        >
          <AnimatedView style={fabStyle}>
            <PlusIcon
              className={`h-6 w-6 ${isOpen ? 'text-text-muted' : 'text-on-primary'}`}
              strokeWidth={2.2}
              aria-hidden
            />
          </AnimatedView>
        </Pressable>
      </View>
    </>
  )
}
