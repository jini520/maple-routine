/**
 * 위젯 6 — **초기화 카운트다운**([[ADR-147]] 결정 6 · 정정 13).
 *
 * ## 목적지가 없는 유일한 타일이다
 *
 * 초기화 시각은 이 타일이 다 말하고 더 볼 화면이 없다 — 그래서 레지스트리에 `target` 이 없고
 * `WidgetGrid` 가 `Pressable` 로 감싸지 않는다(갈 데 없는 것을 누르게 두면 무반응이 «고장» 으로
 * 읽힌다).
 *
 * ## 시계를 읽는 유일한 위젯이다 ([[ADR-147]] 정정 39, 사용자 지시)
 *
 * 원래는 안 읽었다 — 뷰모델이 `now` 하나로 계산해 내려 주는 것이 결정 4 였다. **일일이 초까지 세고
 * 1초마다 다시 그리게 되면서** 그 규칙을 이 위젯에서만 뒤집는다. 뷰모델 전체를 1초마다 다시 만들면
 * 스케줄·수익·드롭이 같이 재계산되는데, 1초마다 갈리는 값은 아홉 위젯 중 이것 하나뿐이다.
 *
 * **기준은 `atMs`**(다음 초기화의 절대 시각)이지 «틱 수» 가 아니다. 틱을 세면 백그라운드에서 타이머가
 * 눌릴 때 **조용히 뒤처지고**, 그 오차는 화면을 다시 볼 때까지 안 드러난다. 절대 시각에서 빼면 몇
 * 번을 못 세도 다음 렌더가 맞는 값을 준다. `atMs` 는 [[ADR-147]] 구현 노트가 «지금 아무 위젯도 안
 * 읽는다» 로 남겨 둔 값이고, 여기서 처음 쓰인다.
 *
 * ## 셋 다 KST 기준이다 (실측 확인 2026-08-18)
 *
 * 뷰모델이 `getPeriodStartUtcMs(getCurrentKstDateKey(now)) + 1일`(일일) ·
 * `getMostRecentWeeklyResetKst`(주간, KST 목 00:00) · KST 월초(월간)로 계산하고, 세 함수 모두
 * `Date.UTC(...) − 9시간` 이라 **기기 타임존과 무관**하다. 이 위젯은 그 절대 시각에서 빼기만 하므로
 * 타임존이 끼어들 자리가 없다 — 그 사실을 테스트가 타임존을 바꿔 가며 지킨다.
 *
 * ## 임박을 색으로 말하지 않는다
 *
 * 1시간 미만에 `error` 를 빌리는 안이 시안에 있었으나 **색이 확정되지 않았다** — 실패가 아니라
 * 임박인데 이 앱에는 «경고» 축이 없다(`error` 는 실패의 색이고 그 뜻이 흐려진다). 값이 무엇이든
 * 이 타일의 글자 스타일은 같다.
 *
 * ## 크기가 버리는 것
 *
 * 2x1(기본)은 **월간**을 버린다 — 대개 멀어 지금 급한 것이 아니다. 1x1 은 일일만 남고 값도 **가장 큰
 * 단위 하나**로 접힌다(두 단위가 물리적으로 안 들어간다). 2x2 만 진행 바를 함께 그리고, 4x1 은 셋을
 * 가로로 세우며 숫자를 키운다.
 *
 * **초를 담을 수 있는 크기도 갈린다** — 2x1·2x2 만 일일을 초까지 그린다. 4x1 은 셋을 가로로 나눠 쓰느라
 * 한 칸이 좁고, 1x1 은 단위 하나뿐이다.
 */

import { useEffect, useState } from 'react'
import { View, type DimensionValue } from 'react-native'

import { Text } from '../../../components/atoms/Text/Text'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import type { WidgetHeight } from '../../../lib/widget-layout'
import type { ResetCountdown, ResetCountdownView } from '../view-model'
import type { WidgetProps } from './types'

const TITLE = '초기화까지'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const SECOND_MS = 1000

/**
 * 분 미만은 «0분» 이 아니다 — 아직 안 왔다는 사실이 0으로 읽히면 안 된다.
 *
 * **초를 그리는 곳에서는 안 쓴다**([[ADR-147]] 정정 39) — `43초` 가 그 말을 직접 한다.
 */
const IMMINENT = '1분 미만'

/**
 * 얼마나 잘게 그리나.
 *
 * - `'second'` — `12시간 34분 56초`. 일일만, 그리고 자리가 있는 크기에서만.
 * - `'minute'` — 위 두 단위(`2일 5시간` · `12시간 34분` · `43분`).
 * - `'largest'` — 가장 큰 단위 하나(1x1 에는 두 단위가 물리적으로 안 들어간다).
 */
type Granularity = 'second' | 'minute' | 'largest'

type CycleKey = keyof ResetCountdownView

const CYCLE_LABEL: Record<CycleKey, string> = {
  daily: '일일',
  weekly: '주간',
  monthly: '월간',
}

/** 2x1 · 2x2 · 4x1 · 1x1 — 이름이 크기가 아니라 «무엇을 그리는가» 를 말한다. */
type Variant = 'mini' | 'compact' | 'wide' | 'tiny'

function variantOf(w: number, h: WidgetHeight): Variant {
  if (w === 1) return 'tiny'
  if (w === 4) return 'wide'
  return h === 2 ? 'compact' : 'mini'
}

/**
 * 남은 시간 — 잘기는 `granularity` 가 정한다(위 타입).
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
    // 일일은 24시간을 안 넘어 «일» 이 설 자리가 없다. 그래도 넘어오면 시간으로 합쳐 말한다.
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
 * **1초마다 지금**([[ADR-147]] 정정 39).
 *
 * 뷰모델의 `remainingMs` 는 화면이 만들어진 시점의 값이라 그대로 두면 멈춘 시계다. 여기서 «지금» 을
 * 새로 읽고 `atMs` 에서 빼는 것이 살아 있는 값이다 — **틱을 세지 않는 이유**는 파일 머리에 있다.
 *
 * 간격을 1초로 두면 표시 초가 최대 1초 늦게 넘어갈 수 있다(경계에 맞춰 정렬하지 않는다) — 카운트다운
 * 이 매끄럽게 흐르는 것이 목적이지 초의 경계가 정확한 것이 목적은 아니다.
 */
function useNowMs(): number {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), SECOND_MS)
    return () => clearInterval(id)
  }, [])

  return nowMs
}

/** 남은 시간 — 뷰모델이 준 절대 시각과 «지금» 의 차. */
function remainingOf(countdown: ResetCountdown, nowMs: number): number {
  return Math.max(0, countdown.atMs - nowMs)
}

/** 주기의 어디쯤인가 — 지난 몫이다. `periodMs` 를 뷰모델이 함께 주는 이유는 그쪽 주석이 갖는다. */
function elapsedWidth(countdown: ResetCountdown, remainingMs: number): DimensionValue {
  if (countdown.periodMs <= 0) return '0%'
  const elapsed = Math.min(Math.max(countdown.periodMs - remainingMs, 0), countdown.periodMs)
  // 소수 둘로 끊는 것은 정밀도가 아니라 안정성 때문이다(위젯 3 의 스택 바와 같은 이유).
  return `${Number(((elapsed / countdown.periodMs) * 100).toFixed(2))}%`
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
 * **`className` 이 값에 따라 갈리지 않는다** — 임박을 색으로 말하지 않는다는 것이 파일 머리의
 * 결정이고, 그 계약은 «두 값에서 같은 클래스가 나오는가» 로 검사된다.
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

/** 2x2 만 그리는 진행 바 — 위젯 3 의 스택 바와 같은 트랙·같은 색이다. */
function ElapsedBar(props: { countdown: ResetCountdown; remainingMs: number }): React.JSX.Element {
  return (
    <View testID="reset-bar" className="h-1 w-full overflow-hidden rounded-full bg-track">
      <View
        testID="reset-bar-fill"
        className="h-1 bg-primary"
        style={{ width: elapsedWidth(props.countdown, props.remainingMs) }}
      />
    </View>
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
        <Label cycle={props.cycle} sizeClass="text-[10.5px]" />
        <View className="ml-auto">
          <Value
            cycle={props.cycle}
            remainingMs={remainingMs}
            // **일일만 초까지**([[ADR-147]] 정정 39) — 수십 시간 남은 값에 초를 붙이면 글자만 길어지고
            // 아무도 안 본다.
            granularity={props.cycle === 'daily' ? 'second' : 'minute'}
            sizeClass="text-[11.5px]"
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
        <Title sizeClass="text-[9px]" />
        <Label cycle="daily" sizeClass="text-[9.5px]" />
        {/* 1x1 은 초를 넣을 자리가 물리적으로 없다 — 가장 큰 단위 하나뿐이다. */}
        <Value
          cycle="daily"
          remainingMs={remainingOf(resets.daily, nowMs)}
          granularity="largest"
          sizeClass="text-[13px]"
        />
      </View>
    )
  }

  if (variant === 'wide') {
    return (
      <View testID="widget-reset-countdown" className="flex-1 justify-center gap-1 p-3">
        <Title sizeClass="text-[10px]" />
        <View className="flex-row items-center gap-2">
          {(['daily', 'weekly', 'monthly'] as const).map((cycle) => (
            <View key={cycle} testID={`reset-cell-${cycle}`} className="min-w-0 flex-1">
              <Label cycle={cycle} sizeClass="text-[10px]" />
              {/* 셋을 가로로 나눠 쓰느라 한 칸이 좁다 — 여기서는 일일도 분까지다. */}
              <Value
                cycle={cycle}
                remainingMs={remainingOf(resets[cycle], nowMs)}
                granularity="minute"
                sizeClass="text-[16px]"
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
        <Title sizeClass="text-[10px]" />
        {(['daily', 'weekly', 'monthly'] as const).map((cycle) => (
          <Row key={cycle} cycle={cycle} countdown={resets[cycle]} nowMs={nowMs} withBar />
        ))}
      </View>
    )
  }

  // 2x1 — 월간은 대개 멀어 지금 급한 것이 아니다.
  return (
    <View testID="widget-reset-countdown" className="flex-1 justify-center gap-1 p-3">
      <Title sizeClass="text-[10px]" />
      {(['daily', 'weekly'] as const).map((cycle) => (
        <Row key={cycle} cycle={cycle} countdown={resets[cycle]} nowMs={nowMs} withBar={false} />
      ))}
    </View>
  )
}
