/**
 * 위젯 5 — **주간 결정석 판매 한도**([[ADR-054]] · [[ADR-147]] 결정 6 · 정정 13·15).
 *
 * ## 한도는 계정이 아니라 **월드마다** 각각이다 ([[ADR-054]] 결정 1)
 *
 * 그래서 월드가 둘이면 **분모도 둘**이고, 이 타일은 그것을 **절대 합치지 않는다**. 보스 수익 화면은
 * 좁은 헤드라인 한 줄에 밀어 넣느라 합계(`46 / 180`)를 쓰지만([[ADR-054]] 정정 2), 여기서는 4x1 이
 * 월드를 나란히 세울 수 있어 «어느 월드가 찼는가» 를 그대로 보여 준다. 합친 수는 어느 월드에서도
 * 팔 수 있는 양이 아니라 게임에 없는 수치다.
 *
 * ## 분모를 이 파일이 정하지 않는다
 *
 * 뷰모델이 `CrystalLimitView.limit` 에 `WEEKLY_CRYSTAL_SALE_LIMIT`(참조 데이터 `weekly-bosses.json`)
 * 을 실어 준다 — 여기에 숫자를 적으면 참조 데이터가 바뀌어도 화면만 옛 한도를 말한다([[ADR-006]]).
 * **그래서 이 파일에는 한도 숫자가 한 번도 안 나온다**(주석 포함 — 테스트가 그것을 검사한다).
 *
 * ## 링은 «칸» 이 아니라 **연속 호**다
 *
 * [[ADR-054]] 정정 1의 칸 링은 캐릭터당 주간 보스 한도(12)를 쪼갠 것이고, 그쪽은 칸을 셀 수 있어
 * 뜻이 있었다. 이 한도는 그 몇 배라 같은 방식으로 쪼개면 **읽을 수 없는 톱니**가 된다 — 비율을
 * 말하는 링은 연속 호라는 [[ADR-142]] 결정 3의 갈래가 그대로 적용된다.
 *
 * ## 링 안은 두 줄이지만 **한 값**이다 ([[ADR-147]] 정정 15)
 *
 * 분자와 분모가 벌어지면 «34» 와 «/한도» 가 **두 값**으로 읽힌다. 줄 높이를 글자보다 낮춰(0.92) 바싹
 * 붙여야 분수로 읽힌다. 값이 바뀐 것이 아니라 읽히는 단위가 바뀐 것이다.
 *
 * ## 크기가 버리는 것
 *
 * 2x1(기본)은 **첫 월드 하나**, 4x1 은 **월드 셋**(제목을 버리고 폭을 월드에 쓴다), 2x2 는 큰 링
 * 하나 + 나머지 월드 한 줄, 1x1 은 **링만**이라 월드 이름이 사라진다 — 그 크기는 **월드가 하나인
 * 사용자에게만 정직하다.** 여러 월드를 보려면 4x1 이나 2x2 로 키우는 것이 이 격자의 답이다.
 */

import { View } from 'react-native'
import { Circle } from 'react-native-svg'

import { Text } from '../../../components/atoms/Text/Text'
import { Svg } from '../../../lib/nativewind-interop'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import type { WidgetHeight } from '../../../lib/widget-layout'
import { useThemeAppearance } from '../../../theme/context'
import type { CrystalLimitView } from '../view-model'
import type { WidgetProps } from './types'

const TITLE = '결정석 판매'

/**
 * 집계할 것이 없을 때의 한 줄.
 *
 * 이유가 둘인데(이번 주 처치 기록이 없다 / 월드를 아는 행이 하나도 없다 — 구버전 캐시,
 * [[ADR-054]] 결정 6) **어느 쪽인지 말하지 않는다**: 「판매 0개」라고 쓰면 없는 사실을 단정하고,
 * 「월드를 모릅니다」는 그 사용자가 할 수 있는 일이 없는 내부 사정이다.
 */
const EMPTY_NOTE = '집계할 기록이 없습니다'

/** 4x1 이 나란히 세우는 월드 수 — 그보다 많으면 그냥 잘린다(타일은 스크롤하지 않는다). */
const SIDE_BY_SIDE_WORLDS = 3

/** 링 굵기와 크기 — 크기는 배치가 정한 타일에 맞춘 값이라 변형마다 다르다. */
const RING_STROKE = 4
const RING_PX = { mini: 42, wide: 38, compact: 56, tiny: 44 } as const

/** 2x1 · 4x1 · 2x2 · 1x1 — 이름이 크기가 아니라 «무엇을 그리는가» 를 말한다. */
type Variant = keyof typeof RING_PX

function variantOf(w: number, h: WidgetHeight): Variant {
  if (w === 1) return 'tiny'
  if (w === 4) return 'wide'
  return h === 2 ? 'compact' : 'mini'
}

/** 남은 개수는 음수가 되지 않는다 — 추적 밖 캐릭터 때문에 한도를 넘겨 셀 일은 없지만, 넘겨도 «−3개 남음» 은 말이 안 된다. */
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
 * 색은 [[ADR-142]] 링·위젯 3 스택 바와 같은 짝이다(`primary` = 결정석). 링 색이 `className` 이
 * 아니라 `stroke` 프롭인 이유는 `CharacterAvatar` 가 적어 둔 그대로다 — `react-native-svg` 의 도형은
 * `cssInterop` 에 등록돼 있지 않고, 등록해도 한 `<Svg>` 안에서 두 색을 못 쓴다.
 */
function Ring(props: { view: CrystalLimitView; sizePx: number }): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const radius = (props.sizePx - RING_STROKE) / 2
  const circumference = 2 * Math.PI * radius
  const filled = circumference * ratioOf(props.view)

  // 링 크기가 변형마다 달라 글자도 함께 따라간다 — 비율로 묶어 두면 «42 링의 글자» 를 따로 정하는
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
      {/* 12시에서 시작해 시계방향으로 찬다 — SVG 원은 3시에서 시작하므로 상자를 4분의 1 바퀴
          되돌린다(`270deg` 로 적는 것은 이 파일에 한도 숫자와 헷갈릴 값을 남기지 않기 위해서다). */}
      <Svg
        width={props.sizePx}
        height={props.sizePx}
        viewBox={`0 0 ${props.sizePx} ${props.sizePx}`}
        style={{ position: 'absolute', transform: [{ rotate: '270deg' }] }}
      >
        <Circle
          testID="crystal-ring-track"
          cx={props.sizePx / 2}
          cy={props.sizePx / 2}
          r={radius}
          fill="none"
          strokeWidth={RING_STROKE}
          stroke={definition.track}
        />
        {/* 소진이 0이면 호를 그리지 않는다 — `round` 캡이 점 하나를 찍어 «조금 팔았다» 로 보인다
            (`portraitRingArcPath` 가 같은 이유로 빈 경로를 돌려준다). */}
        {filled > 0 && (
          <Circle
            testID="crystal-ring-fill"
            cx={props.sizePx / 2}
            cy={props.sizePx / 2}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            stroke={definition.primary}
            strokeDasharray={`${filled} ${circumference - filled}`}
          />
        )}
      </Svg>

      {/* 정정 15 — 두 줄이지만 한 값이다. 줄 높이를 글자보다 낮춰 분수로 읽히게 한다. */}
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

/** `56개 남음` — 이 타일이 답하는 질문이 «더 팔 수 있나» 라서 소진량이 아니라 잔량이 글자가 된다. */
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
 * 2x2 의 «나머지 월드» 한 줄.
 *
 * 하나면 이름과 잔량을 그대로 말하고, 둘 이상이면 **개수만** 말한다 — 158 폭에 이름 둘과 숫자 둘을
 * 밀어 넣으면 전부 잘려서 아무것도 안 읽힌다([[ADR-054]] 정정 2가 칩에 수치만 남긴 것과 같은 판단).
 */
function RestWorlds(props: { rest: CrystalLimitView[] }): React.JSX.Element | null {
  if (props.rest.length === 0) return null

  return (
    <Text fixed testID="crystal-rest" numberOfLines={1} className="text-[11px] text-text-muted">
      {props.rest.length === 1
        ? `${props.rest[0].world} ${remainingOf(props.rest[0])}개 남음`
        : `외 ${props.rest.length}개 월드`}
    </Text>
  )
}

function Empty(props: { variant: Variant }): React.JSX.Element {
  return (
    <View testID="widget-crystal-limit" className="flex-1 justify-center gap-1 p-3">
      {props.variant !== 'tiny' && <Title sizeClass="text-[10px]" />}
      <Text fixed testID="crystal-empty" numberOfLines={2} className="text-[11px] text-text-muted">
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

  // 월드 이름이 사라지는 유일한 크기다 — 월드가 여럿이면 첫 월드만 말하는 셈이라 **월드가 하나인
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
          <Title sizeClass="text-[10px]" />
          <WorldName world={first.world} sizeClass="text-[12.5px] font-semibold" />
          <Remaining view={first} sizeClass="text-[11px]" />
        </View>
      </View>
    )
  }

  if (variant === 'compact') {
    return (
      <View testID="widget-crystal-limit" className="flex-1 items-center justify-center gap-1.5 p-3">
        {/* 2x1 이 말하는 것을 더 큰 타일이 안 말할 이유가 없다 — 제목은 여기서도 선다. */}
        <Title sizeClass="text-[10px]" />
        <Ring view={first} sizePx={RING_PX.compact} />
        <View className="items-center gap-0.5">
          <WorldName world={first.world} sizeClass="text-[13px] font-semibold" />
          <Remaining view={first} sizeClass="text-[11px]" />
        </View>
        <RestWorlds rest={rest} />
      </View>
    )
  }

  // 4x1 — 제목을 버리고 그 폭을 월드에 쓴다. 넷째부터는 잘린다(타일은 스크롤하지 않는다).
  return (
    <View testID="widget-crystal-limit" className="flex-1 flex-row items-center gap-2 p-3">
      {worlds.slice(0, SIDE_BY_SIDE_WORLDS).map((view) => (
        <View key={view.world} testID="crystal-world-cell" className="min-w-0 flex-1 flex-row items-center gap-1.5">
          <Ring view={view} sizePx={RING_PX.wide} />
          <View className="min-w-0 flex-1 gap-0.5">
            <WorldName world={view.world} sizeClass="text-[12px] font-semibold" />
            <Remaining view={view} sizeClass="text-[11px]" />
          </View>
        </View>
      ))}
    </View>
  )
}
