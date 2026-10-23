/**
 * 위젯 6. 일일 · 주간 초기화까지 남은 시간을 세는 타일.
 *
 * 지키는 것 셋.
 *
 * ① **시계를 읽는 위젯은 이것뿐이다.** 1초마다 갈리는 값이 위젯 중 여기 하나라, 뷰모델 전체를
 *    1초마다 다시 만들지 않으려고 이 위젯에서만 규칙을 뒤집는다.
 * ② 기준은 **`atMs`**(다음 초기화의 절대 시각)이지 틱 수가 아니다. 틱을 세면 백그라운드에서 타이머가
 *    눌릴 때 조용히 뒤처지고, 그 오차는 화면을 다시 볼 때까지 안 드러난다.
 * ③ 임박을 색으로 말하지 않는다. 이 앱에 경고 축이 없어 `error` 를 빌리면 실패의 뜻이 흐려진다.
 *
 * 월간은 그리지 않는다. 대개 멀어 지금 급한 것이 아니다. 두 줄은 `card-inset` 칸 하나에 묶는다.
 * 목적지가 없어 `WidgetGrid` 가 `Pressable` 로 안 감싼다.
 */

import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { ResetCountdown } from '../view-model'
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
 * - `'second'`. `12시간 34분 56초`. 일일만.
 * - `'minute'`. 위 두 단위(`2일 5시간` · `12시간 34분` · `43분`).
 */
type Granularity = 'second' | 'minute'

type CycleKey = 'daily' | 'weekly'

const CYCLE_LABEL: Record<CycleKey, string> = {
  daily: '일일',
  weekly: '주간',
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

  if (days > 0) return `${days}일 ${hours}시간`
  if (hours > 0) return `${hours}시간 ${minutes}분`
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
 * 한 줄. 라벨과 값이 한 줄에 서고, 값이 오른쪽 끝에 붙는다(세로로 훑을 때 숫자가 같은 x 에 온다).
 *
 * 값의 `className` 이 남은 시간에 따라 갈리지 않는다. 임박을 색으로 말하지 않는 것이 이 타일의 규칙이다.
 */
function Row(props: { cycle: CycleKey; countdown: ResetCountdown; nowMs: number }): React.JSX.Element {
  return (
    <View testID={`reset-row-${props.cycle}`} className="flex-row items-baseline">
      <Text testID={`reset-label-${props.cycle}`} className="text-[11.5px] text-text-muted">
        {CYCLE_LABEL[props.cycle]}
      </Text>
      <Text
        testID={`reset-value-${props.cycle}`}
        numberOfLines={1}
        style={TABULAR_NUMS}
        className="ml-auto text-[12.5px] font-bold text-text"
      >
        {formatResetRemaining(remainingOf(props.countdown, props.nowMs), props.cycle === 'daily' ? 'second' : 'minute')}
      </Text>
    </View>
  )
}

export function ResetCountdownWidget({ data }: WidgetProps): React.JSX.Element {
  const { resets } = data
  const nowMs = useNowMs()

  return (
    <View testID="widget-reset-countdown" className="flex-1 justify-center gap-1 px-3 py-2.5">
      <Text className="text-10 font-bold text-text-muted">{TITLE}</Text>
      <View className="gap-0.5 rounded-lg bg-card-inset px-2 py-1">
        <Row cycle="daily" countdown={resets.daily} nowMs={nowMs} />
        <Row cycle="weekly" countdown={resets.weekly} nowMs={nowMs} />
      </View>
    </View>
  )
}
