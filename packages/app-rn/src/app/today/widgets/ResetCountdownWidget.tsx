/**
 * 위젯 6 — **초기화 카운트다운**([[ADR-146]] 결정 6 · 정정 13).
 *
 * ## 목적지가 없는 유일한 타일이다
 *
 * 초기화 시각은 이 타일이 다 말하고 더 볼 화면이 없다 — 그래서 레지스트리에 `target` 이 없고
 * `WidgetGrid` 가 `Pressable` 로 감싸지 않는다(갈 데 없는 것을 누르게 두면 무반응이 «고장» 으로
 * 읽힌다).
 *
 * ## 시계를 여기서 읽지 않는다
 *
 * `new Date()` 를 부르지 않는다 — 남은 시간도 다음 초기화 시각도 뷰모델이 `now` 하나로 계산해
 * 내려 준다([[ADR-146]] 결정 4). 타일마다 시계를 따로 읽으면 같은 화면의 두 타일이 다른 시각을
 * 말하고, 테스트도 고정되지 않는다.
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
 */

import { Text, View, type DimensionValue } from 'react-native'

import { TABULAR_NUMS } from '../../../lib/text-styles'
import type { WidgetHeight } from '../../../lib/widget-layout'
import type { ResetCountdown, ResetCountdownView } from '../view-model'
import type { WidgetProps } from './types'

const TITLE = '초기화까지'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** 분 미만은 «0분» 이 아니다 — 아직 안 왔다는 사실이 0으로 읽히면 안 된다. */
const IMMINENT = '1분 미만'

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
 * 남은 시간 — **위 두 단위**(`2일 5시간` · `12시간 34분` · `43분`).
 *
 * `compact` 는 가장 큰 단위 하나만 남긴다(1x1 에는 두 단위가 안 들어간다). 초는 어느 크기에서도
 * 그리지 않는다 — 이 타일은 «지금 급한가» 에 답하지 스톱워치가 아니고, 초를 그리려면 1초마다 다시
 * 그려야 한다.
 */
function formatResetRemaining(remainingMs: number, compact: boolean): string {
  if (remainingMs < MINUTE_MS) return IMMINENT

  const days = Math.floor(remainingMs / DAY_MS)
  const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS)
  const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS)

  if (days > 0) return compact ? `${days}일` : `${days}일 ${hours}시간`
  if (hours > 0) return compact ? `${hours}시간` : `${hours}시간 ${minutes}분`
  return `${minutes}분`
}

/** 주기의 어디쯤인가 — 지난 몫이다. `periodMs` 를 뷰모델이 함께 주는 이유는 그쪽 주석이 갖는다. */
function elapsedWidth(countdown: ResetCountdown): DimensionValue {
  if (countdown.periodMs <= 0) return '0%'
  const elapsed = Math.min(Math.max(countdown.periodMs - countdown.remainingMs, 0), countdown.periodMs)
  // 소수 둘로 끊는 것은 정밀도가 아니라 안정성 때문이다(위젯 3 의 스택 바와 같은 이유).
  return `${Number(((elapsed / countdown.periodMs) * 100).toFixed(2))}%`
}

function Label(props: { cycle: CycleKey; sizeClass: string }): React.JSX.Element {
  return (
    <Text testID={`reset-label-${props.cycle}`} className={`text-text-muted ${props.sizeClass}`}>
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
function Value(props: { cycle: CycleKey; countdown: ResetCountdown; sizeClass: string; compact?: boolean }): React.JSX.Element {
  return (
    <Text
      testID={`reset-value-${props.cycle}`}
      numberOfLines={1}
      style={TABULAR_NUMS}
      className={`font-bold text-text ${props.sizeClass}`}
    >
      {formatResetRemaining(props.countdown.remainingMs, props.compact === true)}
    </Text>
  )
}

/** 2x2 만 그리는 진행 바 — 위젯 3 의 스택 바와 같은 트랙·같은 색이다. */
function ElapsedBar(props: { countdown: ResetCountdown }): React.JSX.Element {
  return (
    <View testID="reset-bar" className="h-1 w-full overflow-hidden rounded-full bg-track">
      <View testID="reset-bar-fill" className="h-1 bg-primary" style={{ width: elapsedWidth(props.countdown) }} />
    </View>
  )
}

/** 라벨과 값이 한 줄에 서고, 값이 오른쪽 끝에 붙는다(세로로 훑을 때 숫자가 같은 x 에 온다). */
function Row(props: { cycle: CycleKey; countdown: ResetCountdown; withBar: boolean }): React.JSX.Element {
  return (
    <View testID={`reset-row-${props.cycle}`} className="gap-0.5">
      <View className="flex-row items-baseline">
        <Label cycle={props.cycle} sizeClass="text-[10.5px]" />
        <View className="ml-auto">
          <Value cycle={props.cycle} countdown={props.countdown} sizeClass="text-[11.5px]" />
        </View>
      </View>
      {props.withBar && <ElapsedBar countdown={props.countdown} />}
    </View>
  )
}

function Title(props: { sizeClass: string }): React.JSX.Element {
  return <Text className={`font-bold text-text-muted ${props.sizeClass}`}>{TITLE}</Text>
}

export function ResetCountdownWidget({ w, h, data }: WidgetProps): React.JSX.Element {
  const variant = variantOf(w, h)
  const { resets } = data

  if (variant === 'tiny') {
    return (
      <View testID="widget-reset-countdown" className="flex-1 items-center justify-center gap-0.5 p-2">
        <Title sizeClass="text-[9px]" />
        <Label cycle="daily" sizeClass="text-[9.5px]" />
        <Value cycle="daily" countdown={resets.daily} sizeClass="text-[13px]" compact />
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
              <Value cycle={cycle} countdown={resets[cycle]} sizeClass="text-[16px]" />
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
          <Row key={cycle} cycle={cycle} countdown={resets[cycle]} withBar />
        ))}
      </View>
    )
  }

  // 2x1 — 월간은 대개 멀어 지금 급한 것이 아니다.
  return (
    <View testID="widget-reset-countdown" className="flex-1 justify-center gap-1 p-3">
      <Title sizeClass="text-[10px]" />
      {(['daily', 'weekly'] as const).map((cycle) => (
        <Row key={cycle} cycle={cycle} countdown={resets[cycle]} withBar={false} />
      ))}
    </View>
  )
}
