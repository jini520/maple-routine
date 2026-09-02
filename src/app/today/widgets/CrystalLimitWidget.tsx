/**
 * 위젯 5. 주간 결정석 판매 한도를 월드별로 그리는 타일.
 *
 * 지키는 것 넷.
 *
 * ① 한도는 계정이 아니라 **월드마다** 각각이라 분모도 월드마다다. **절대 합치지 않는다.** 합친
 *    수는 어느 월드에서도 팔 수 있는 양이 아니라 게임에 없는 수치다.
 * ② **한도 숫자가 이 파일에 한 번도 안 나온다**(주석 포함, 테스트가 검사한다). 뷰모델이
 *    `CrystalLimitView.limit` 에 실어 준다. 여기 적으면 참조 데이터가 바뀌어도 화면만 옛 한도를 말한다.
 * ③ 링은 칸이 아니라 **연속 호**다. 이 한도는 캐릭터당 주간 보스 한도의 몇 배라 쪼개면 읽을 수 없는
 *    톱니가 된다.
 * ④ 링 안의 분자와 분모는 줄 높이를 0.92 로 낮춰 **바싹 붙인다**. 벌어지면 두 값으로 읽힌다.
 *
 * @see docs/features/today.md 위젯 정책
 */

import { View } from 'react-native'

import { ProgressRing, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { WidgetHeight } from '../../../lib/today/widget-layout'
import { useThemeAppearance } from '../../../theme/context'
import type { CrystalLimitView } from '../view-model'
import type { WidgetProps } from './types'

const TITLE = '결정석 판매'

/**
 * 집계할 것이 없을 때의 한 줄.
 *
 * 이유가 둘인데(이번 주 처치 기록이 없다 / 월드를 아는 행이 하나도 없다. 구버전 캐시,
 * ) **어느 쪽인지 말하지 않는다**: 판매 0개라고 쓰면 없는 사실을 단정하고,
 * 월드를 모릅니다는 그 사용자가 할 수 있는 일이 없는 내부 사정이다.
 */
const EMPTY_NOTE = '집계할 기록이 없습니다'

/** 4x1 이 나란히 세우는 월드 수. 그보다 많으면 그냥 잘린다(타일은 스크롤하지 않는다). */
const SIDE_BY_SIDE_WORLDS = 3

/** 링 굵기와 크기. 크기는 배치가 정한 타일에 맞춘 값이라 변형마다 다르다. */
const RING_STROKE = 4
const RING_PX = { mini: 42, wide: 38, compact: 56, tiny: 44 } as const

/** 2x1 · 4x1 · 2x2 · 1x1. 이름이 크기가 아니라 무엇을 그리는가 를 말한다. */
type Variant = keyof typeof RING_PX

function variantOf(w: number, h: WidgetHeight): Variant {
  if (w === 1) return 'tiny'
  if (w === 4) return 'wide'
  return h === 2 ? 'compact' : 'mini'
}

/** 남은 개수는 음수가 되지 않는다. 추적 밖 캐릭터 때문에 한도를 넘겨 셀 일은 없지만, 넘겨도 −3개 남음 은 말이 안 된다. */
function remainingOf(view: CrystalLimitView): number {
  return Math.max(0, view.limit - view.cleared)
}

function ratioOf(view: CrystalLimitView): number {
  if (view.limit <= 0) return 0
  return Math.min(Math.max(view.cleared / view.limit, 0), 1)
}

/**
 * 소진량 링 + 그 안의 분수.
 *
 * 링을 채우는 셈은 `atoms/ProgressRing` 이 든다. 여기 남는 것은 이 타일의
 * 치수와 가운데 분수다. 색은 링·위젯 3 스택 바와 같은 짝이다(`primary` = 결정석).
 */
function Ring(props: { view: CrystalLimitView; sizePx: number }): React.JSX.Element {
  const { definition } = useThemeAppearance()

  // 링 크기가 변형마다 달라 글자도 함께 따라간다. 비율로 묶어 두면 **42 링의 글자** 를 따로 정하는
  // 자리가 안 생긴다. 분모는 분자보다 한 단계 작다(같은 값의 두 부분이지 두 값이 아니다).
  const numeratorPx = Math.round(props.sizePx * 0.27)
  const denominatorPx = Math.round(props.sizePx * 0.2)

  return (
    <View
      testID="crystal-ring"
      role="img"
      aria-label={`${props.view.world} 주간 결정석 판매 ${props.view.cleared} / ${props.view.limit}`}
      className="shrink-0 items-center justify-center"
      style={{ width: props.sizePx, height: props.sizePx }}
    >
      {/* 링은 상자를 꽉 채우고 분수가 그 위에 앉는다. 12시에서 시계방향으로 차는 것은 atom 몫이다. */}
      <View className="absolute inset-0">
        <ProgressRing
          size={props.sizePx}
          stroke={RING_STROKE}
          direction="cw"
          track={definition.track}
          fill={definition.primary}
          progress={{ kind: 'continuous', ratio: ratioOf(props.view) }}
        />
      </View>

      {/* 정정 15. 두 줄이지만 한 값이다. 줄 높이를 글자보다 낮춰 분수로 읽히게 한다. */}
      <Text
        fixed
        testID="crystal-ring-numerator"
        style={{ fontSize: numeratorPx, lineHeight: numeratorPx * 0.92, ...TABULAR_NUMS }}
        className="font-extrabold text-text"
      >
        {props.view.cleared}
      </Text>
      <Text
        fixed
        testID="crystal-ring-denominator"
        style={{ fontSize: denominatorPx, lineHeight: denominatorPx * 0.92, ...TABULAR_NUMS }}
        className="text-text-muted"
      >
        {`/${props.view.limit}`}
      </Text>
    </View>
  )
}

function WorldName(props: { world: string; sizeClass: string }): React.JSX.Element {
  return (
    <Text fixed testID="crystal-world" numberOfLines={1} className={`text-text ${props.sizeClass}`}>
      {props.world}
    </Text>
  )
}

/** `56개 남음`. 이 타일이 답하는 질문이 더 팔 수 있나 라서 소진량이 아니라 잔량이 글자가 된다. */
function Remaining(props: { view: CrystalLimitView; sizeClass: string }): React.JSX.Element {
  return (
    <Text fixed testID="crystal-remaining" numberOfLines={1} className={`text-text-muted ${props.sizeClass}`}>
      <Text fixed style={TABULAR_NUMS} className="font-bold text-text">
        {remainingOf(props.view)}
      </Text>
      개 남음
    </Text>
  )
}

function Title(props: { sizeClass: string }): React.JSX.Element {
  return <Text fixed className={`font-bold text-text-muted ${props.sizeClass}`}>{TITLE}</Text>
}

/**
 * 2x2 의 나머지 월드 한 줄.
 *
 * 하나면 이름과 잔량을 그대로 말하고, 둘 이상이면 **개수만** 말한다. 158 폭에 이름 둘과 숫자 둘을
 * 밀어 넣으면 전부 잘려서 아무것도 안 읽힌다.
 */
function RestWorlds(props: { rest: CrystalLimitView[] }): React.JSX.Element | null {
  if (props.rest.length === 0) return null

  return (
    <Text fixed testID="crystal-rest" numberOfLines={1} className="text-11 text-text-muted">
      {props.rest.length === 1
        ? `${props.rest[0].world} ${remainingOf(props.rest[0])}개 남음`
        : `외 ${props.rest.length}개 월드`}
    </Text>
  )
}

function Empty(props: { variant: Variant }): React.JSX.Element {
  return (
    <View testID="widget-crystal-limit" className="flex-1 justify-center gap-1 p-3">
      {props.variant !== 'tiny' && <Title sizeClass="text-10" />}
      <Text fixed testID="crystal-empty" numberOfLines={2} className="text-11 text-text-muted">
        {EMPTY_NOTE}
      </Text>
    </View>
  )
}

export function CrystalLimitWidget({ w, h, data }: WidgetProps): React.JSX.Element {
  const variant = variantOf(w, h)
  const worlds = data.crystalLimits

  if (worlds.length === 0) return <Empty variant={variant} />

  const [first, ...rest] = worlds

  // 월드 이름이 사라지는 크기는 이것뿐이다. 월드가 여럿이면 첫 월드만 말하는 셈이라 **월드가 하나인
  // 사용자에게만 정직하다.** 접근성 이름은 링이 계속 월드를 말한다.
  if (variant === 'tiny') {
    return (
      <View testID="widget-crystal-limit" className="flex-1 items-center justify-center p-2">
        <Ring view={first} sizePx={RING_PX.tiny} />
      </View>
    )
  }

  if (variant === 'mini') {
    return (
      <View testID="widget-crystal-limit" className="flex-1 flex-row items-center gap-2.5 p-3">
        <Ring view={first} sizePx={RING_PX.mini} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Title sizeClass="text-10" />
          <WorldName world={first.world} sizeClass="text-[12.5px] font-semibold" />
          <Remaining view={first} sizeClass="text-11" />
        </View>
      </View>
    )
  }

  if (variant === 'compact') {
    return (
      <View testID="widget-crystal-limit" className="flex-1 items-center justify-center gap-1.5 p-3">
        {/* 2x1 이 말하는 것을 더 큰 타일이 안 말할 이유가 없다. 제목은 여기서도 선다. */}
        <Title sizeClass="text-10" />
        <Ring view={first} sizePx={RING_PX.compact} />
        <View className="items-center gap-0.5">
          <WorldName world={first.world} sizeClass="text-13 font-semibold" />
          <Remaining view={first} sizeClass="text-11" />
        </View>
        <RestWorlds rest={rest} />
      </View>
    )
  }

  // 4x1. 제목을 버리고 그 폭을 월드에 쓴다. 넷째부터는 잘린다(타일은 스크롤하지 않는다).
  return (
    <View testID="widget-crystal-limit" className="flex-1 flex-row items-center gap-2 p-3">
      {worlds.slice(0, SIDE_BY_SIDE_WORLDS).map((view) => (
        <View key={view.world} testID="crystal-world-cell" className="min-w-0 flex-1 flex-row items-center gap-1.5">
          <Ring view={view} sizePx={RING_PX.wide} />
          <View className="min-w-0 flex-1 gap-0.5">
            <WorldName world={view.world} sizeClass="text-xs font-semibold" />
            <Remaining view={view} sizeClass="text-11" />
          </View>
        </View>
      ))}
    </View>
  )
}
