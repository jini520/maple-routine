/**
 * 위젯 6. 일일 · 주간 · 월간 초기화까지 남은 시간을 세는 타일.
 *
 * 지키는 것 셋.
 *
 * ① **시계를 읽는 위젯은 이것뿐이다.** 1초마다 갈리는 값이 아홉 위젯 중 여기 하나라, 뷰모델 전체를
 *    1초마다 다시 만들지 않으려고 이 위젯에서만 규칙을 뒤집는다.
 * ② 기준은 **`atMs`**(다음 초기화의 절대 시각)이지 틱 수가 아니다. 틱을 세면 백그라운드에서 타이머가
 *    눌릴 때 조용히 뒤처지고, 그 오차는 화면을 다시 볼 때까지 안 드러난다.
 * ③ 임박을 색으로 말하지 않는다. 이 앱에 경고 축이 없어 `error` 를 빌리면 실패의 뜻이 흐려진다.
 *
 * 목적지가 없어 `WidgetGrid` 가 `Pressable` 로 안 감싼다. 초기화 시각은 이 타일이 다 말한다.
 *
 * @see docs/features/today.md 위젯 정책
 */

import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { ProgressBar, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { WidgetHeight } from '../../../lib/today/widget-layout'
import type { ResetCountdown, ResetCountdownView } from '../view-model'
import type { WidgetProps } from './types'

const TITLE = '초기화까지'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const SECOND_MS = 1000

/**
 * 분 미만은 0분 이 아니다. 아직 안 왔다는 사실이 0 으로 읽히면 안 된다.
 *
 * 초를 그리는 곳에서는 안 쓴다. `43초` 가 그 말을 직접 한다.
 */
const IMMINENT = '1분 미만'

/**
 * 얼마나 잘게 그리나.
 *
 * - `'second'`. `12시간 34분 56초`. 일일만, 그리고 자리가 있는 크기에서만.
 * - `'minute'`. 위 두 단위(`2일 5시간` · `12시간 34분` · `43분`).
 * - `'largest'`. 가장 큰 단위 하나(1x1 에는 두 단위가 물리적으로 안 들어간다).
 */
type Granularity = 'second' | 'minute' | 'largest'

type CycleKey = keyof ResetCountdownView

const CYCLE_LABEL: Record<CycleKey, string> = {
  daily: '일일',
  weekly: '주간',
  monthly: '월간',
}

/** 2x1 · 2x2 · 4x1 · 1x1. 이름이 크기가 아니라 무엇을 그리는가 를 말한다. */
type Variant = 'mini' | 'compact' | 'wide' | 'tiny'

function variantOf(w: number, h: WidgetHeight): Variant {
  if (w === 1) return 'tiny'
  if (w === 4) return 'wide'
  return h === 2 ? 'compact' : 'mini'
}

/**
 * 남은 시간. 잘기는 `granularity` 가 정한다(위 타입).
 *
 * 앞의 0 단위는 뗀다: `43분 12초` 이지 `0시간 43분 12초` 가 아니다.
 */
function formatResetRemaining(remainingMs: number, granularity: Granularity): string {
  const clamped = Math.max(0, remainingMs)
  const days = Math.floor(clamped / DAY_MS)
  const hours = Math.floor((clamped % DAY_MS) / HOUR_MS)
  const minutes = Math.floor((clamped % HOUR_MS) / MINUTE_MS)

  if (granularity === 'second') {
    const seconds = Math.floor((clamped % MINUTE_MS) / SECOND_MS)
    // 일일은 24시간을 안 넘어 **일** 이 설 자리가 없다. 그래도 넘어오면 시간으로 합쳐 말한다.
    const totalHours = days * 24 + hours
    if (totalHours > 0) return `${totalHours}시간 ${minutes}분 ${seconds}초`
    if (minutes > 0) return `${minutes}분 ${seconds}초`
    return `${seconds}초`
  }

  if (clamped < MINUTE_MS) return IMMINENT

  const largest = granularity === 'largest'
  if (days > 0) return largest ? `${days}일` : `${days}일 ${hours}시간`
  if (hours > 0) return largest ? `${hours}시간` : `${hours}시간 ${minutes}분`
  return `${minutes}분`
}

/**
 * 1초마다 지금.
 *
 * 뷰모델의 `remainingMs` 는 화면이 만들어진 시점의 값이라 그대로 두면 멈춘 시계다. 여기서
 * 지금을 새로 읽고 `atMs` 에서 빼는 것이 살아 있는 값이다.
 *
 * 간격을 1초로 두면 표시 초가 최대 1초 늦게 넘어갈 수 있다. 카운트다운이 매끄럽게 흐르는
 * 것이 목적이지 초의 경계가 정확한 것이 목적은 아니다.
 */
function useNowMs(): number {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), SECOND_MS)
    return () => clearInterval(id)
  }, [])

  return nowMs
}

/** 남은 시간. 뷰모델이 준 절대 시각과 지금 의 차. */
function remainingOf(countdown: ResetCountdown, nowMs: number): number {
  return Math.max(0, countdown.atMs - nowMs)
}

/**
 * 주기의 어디쯤인가. 지난 몫이다. `periodMs` 를 뷰모델이 함께 주는 이유는 그쪽 주석이 갖는다.
 * 0~100 으로 자르는 것은 `ProgressBar` 가 클램프하지 않기 때문이다.
 */
function elapsedPercent(countdown: ResetCountdown, remainingMs: number): number {
  if (countdown.periodMs <= 0) return 0
  const elapsed = Math.min(Math.max(countdown.periodMs - remainingMs, 0), countdown.periodMs)
  // 소수 둘로 끊는 것은 정밀도가 아니라 안정성 때문이다(위젯 3 의 스택 바와 같은 이유).
  return Number(((elapsed / countdown.periodMs) * 100).toFixed(2))
}

function Label(props: { cycle: CycleKey; sizeClass: string }): React.JSX.Element {
  return (
    <Text fixed testID={`reset-label-${props.cycle}`} className={`text-text-muted ${props.sizeClass}`}>
      {CYCLE_LABEL[props.cycle]}
    </Text>
  )
}

/**
 * 남은 시간 글자.
 *
 * `className` 이 값에 따라 갈리지 않는다. 임박을 색으로 말하지 않는 것이 이 타일의 규칙이고,
 * 그 계약은 두 값에서 같은 클래스가 나오는가 로 검사된다.
 */
function Value(props: {
  cycle: CycleKey
  remainingMs: number
  granularity: Granularity
  sizeClass: string
}): React.JSX.Element {
  return (
    <Text
      fixed
      testID={`reset-value-${props.cycle}`}
      numberOfLines={1}
      style={TABULAR_NUMS}
      className={`font-bold text-text ${props.sizeClass}`}
    >
      {formatResetRemaining(props.remainingMs, props.granularity)}
    </Text>
  )
}

/** 2x2 만 그리는 진행 바. `aria` 를 안 주는 것은 바로 위 `Value` 가 같은 값을 글자로 말해서다. */
function ElapsedBar(props: { countdown: ResetCountdown; remainingMs: number }): React.JSX.Element {
  return (
    <ProgressBar
      percent={elapsedPercent(props.countdown, props.remainingMs)}
      height="thin"
      fillTestId="reset-bar-fill"
    />
  )
}

/** 라벨과 값이 한 줄에 서고, 값이 오른쪽 끝에 붙는다(세로로 훑을 때 숫자가 같은 x 에 온다). */
function Row(props: {
  cycle: CycleKey
  countdown: ResetCountdown
  nowMs: number
  withBar: boolean
}): React.JSX.Element {
  const remainingMs = remainingOf(props.countdown, props.nowMs)

  return (
    <View testID={`reset-row-${props.cycle}`} className="gap-0.5">
      <View className="flex-row items-baseline">
        <Label cycle={props.cycle} sizeClass="text-[11.5px]" />
        <View className="ml-auto">
          <Value
            cycle={props.cycle}
            remainingMs={remainingMs}
            // 일일만 초까지. 수십 시간 남은 값에 초를 붙이면 글자만 길어지고 아무도 안 본다.
            granularity={props.cycle === 'daily' ? 'second' : 'minute'}
            sizeClass="text-[12.5px]"
          />
        </View>
      </View>
      {props.withBar && <ElapsedBar countdown={props.countdown} remainingMs={remainingMs} />}
    </View>
  )
}

function Title(props: { sizeClass: string }): React.JSX.Element {
  return <Text fixed className={`font-bold text-text-muted ${props.sizeClass}`}>{TITLE}</Text>
}

export function ResetCountdownWidget({ w, h, data }: WidgetProps): React.JSX.Element {
  const variant = variantOf(w, h)
  const { resets } = data
  const nowMs = useNowMs()

  if (variant === 'tiny') {
    return (
      <View testID="widget-reset-countdown" className="flex-1 items-center justify-center gap-0.5 p-2">
        <Title sizeClass="text-9" />
        <Label cycle="daily" sizeClass="text-[10.5px]" />
        {/* 1x1 은 초를 넣을 자리가 물리적으로 없다. 가장 큰 단위 하나뿐이다. */}
        <Value
          cycle="daily"
          remainingMs={remainingOf(resets.daily, nowMs)}
          granularity="largest"
          sizeClass="text-sm"
        />
      </View>
    )
  }

  if (variant === 'wide') {
    return (
      <View testID="widget-reset-countdown" className="flex-1 justify-center gap-1 p-3">
        <Title sizeClass="text-10" />
        <View className="flex-row items-center gap-2">
          {(['daily', 'weekly', 'monthly'] as const).map((cycle) => (
            <View key={cycle} testID={`reset-cell-${cycle}`} className="min-w-0 flex-1">
              <Label cycle={cycle} sizeClass="text-11" />
              {/* 셋을 가로로 나눠 쓰느라 한 칸이 좁다. 여기서는 일일도 분까지다. */}
              <Value
                cycle={cycle}
                remainingMs={remainingOf(resets[cycle], nowMs)}
                granularity="minute"
                sizeClass="text-base"
              />
            </View>
          ))}
        </View>
      </View>
    )
  }

  if (variant === 'compact') {
    return (
      <View testID="widget-reset-countdown" className="flex-1 justify-center gap-2 p-3">
        <Title sizeClass="text-10" />
        {(['daily', 'weekly', 'monthly'] as const).map((cycle) => (
          <Row key={cycle} cycle={cycle} countdown={resets[cycle]} nowMs={nowMs} withBar />
        ))}
      </View>
    )
  }

  // 2x1. 월간은 대개 멀어 지금 급한 것이 아니다.
  return (
    <View testID="widget-reset-countdown" className="flex-1 justify-center gap-1 p-3">
      <Title sizeClass="text-10" />
      {(['daily', 'weekly'] as const).map((cycle) => (
        <Row key={cycle} cycle={cycle} countdown={resets[cycle]} nowMs={nowMs} withBar={false} />
      ))}
    </View>
  )
}
