/**
 * 하단바 칸 하나의 그림(아이콘 · 라벨)과 ← 화살표. 바와 설정의 하단 탭 순서 미리보기가 같이 쓴다.
 *
 * 누르기는 여기 없다. 바는 이것을 `Pressable` 로 감싸고 미리보기는 그대로 그린다.
 */
import { View } from 'react-native'

import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarIcon,
  MenuIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ProfitIcon,
  SwordsIcon,
  Text,
  TrendingUpIcon,
  BackpackIcon,
  WalletIcon,
  WrenchIcon,
} from '../../atoms'
import type { GroupId } from '../../../navigation/bar-groups'
import type { TabRouteName } from '../../../navigation/routes'

/**
 * 아이콘 선 굵기.
 *
 * 크기·간격·라벨은 클래스에 박혀 있는데 이것만 상수인 것은 `strokeWidth` 가 className 이
 * 아니라 프롭이기 때문이다. 항목 아이콘과 ← 가 같은 값을 써야 해서 이름을 준다.
 */
const ICON_STROKE = 1.5
/**
 * 활성인데 채울 수 없는 그림의 획 굵기.
 *
 * 채우기가 통하는 다섯(대시보드·렌치·장바구니·톱니·수익)은 면으로 활성을 말한다. 나머지
 * (달력·지갑·목록·검·조준경)는 안쪽 선이 의미를 져서 채울 수 없으므로 굵기로 말한다. 둘을
 * 같이 주면 채운 그림이 과해지므로 배타다. `activeStroke` 가 그것을 한 자리에서 고른다.
 *
 * 안쪽에 선이 많은 그림일수록 굵은 획이 칸을 메워 형태가 뭉갠다. 그런 그림은 아래 표가 한 단계 낮춘다.
 */
const ICON_STROKE_ACTIVE = 2.2

/** 활성 굵기를 낮추는 그림. 달력 + 시계는 2.2 에서 안쪽 선이 칸을 메운다 */
const LIGHT_ACTIVE_STROKE: ReadonlyMap<IconComponent, number> = new Map([[CalendarClockIcon, 1.8]])

type IconComponent = React.ComponentType<{
  className?: string
  color?: string
  fill?: string
  strokeWidth?: number
}>

/**
 * 그룹·하위가 쓰는 아이콘.
 *
 * 컨텐츠·보스·설정과 보스 수익은 앱이 이미 쓰던 그림 그대로다(보스 수익은 커스텀
 * `ProfitIcon`. 도메인 아이덴티티를 임의의 lucide 로 대체하지 않는다).
 */
const ICONS: Readonly<Record<GroupId | TabRouteName, IconComponent>> = {
  today: LayoutDashboardIcon,
  schedule: CalendarCheckIcon,
  ledger: WalletIcon,
  utility: WrenchIcon,
  // 톱니바퀴는 더보기 머리로 옮겨 갔다. 같은 그림이 두 자리에 있으면 어느 쪽이 설정인지
  // 흐려진다. **자리표시자다** - 사용자가 고를 그림이 정해지면 바꾼다.
  settings: MenuIcon,
  Today: LayoutDashboardIcon,
  Content: ListChecksIcon,
  Boss: SwordsIcon,
  // 시각이 붙은 달력. 스케줄 그룹(`CalendarCheck`)과 한 식구로 읽히게 골랐다.
  Appointments: CalendarClockIcon,
  Profit: ProfitIcon,
  // 가계부 = 장부. 달력 계열(`CalendarCheck` = 스케줄러 그룹)과 겹치지 않게 골랐다.
  Cashbook: CalendarIcon,
  // 오르는 화살표. 기간을 모아 흐름을 보는 자리라 장부(달력)와 갈린다.
  Stats: TrendingUpIcon,
  // 게임의 인벤토리가 가방이다(사용자 지정).
  Inventory: BackpackIcon,
  Utility: WrenchIcon,
  Settings: MenuIcon,
}

/**
 * 활성일 때 면으로 채우는 아이콘. 나머지는 선 그대로 둔다.
 *
 * 채우기가 통하는 것은 안쪽에 의미가 없는 그림뿐이다. fill 과 stroke 가 같은 색이라 안쪽에
 * 선이 있는 아이콘은 채우는 순간 그 선이 통째로 사라진다.
 *
 * 살아남는 것은 대시보드(사각 넷) · 렌치(실루엣 하나) · 검(칼날이 면으로 차고 손잡이 선은
 * 남는다). 무너지는 것은 톱니(가운데 구멍이 메워진다) · 달력·지갑(안쪽 체크·주머니를 잃는다) ·
 * 목록·장부(선뿐이라 채울 면이 없다) · 수익(`ProfitIcon` 은 열린 호로 그린 커스텀이라
 * `fill="none"` 이 규격이다).
 *
 * 아이콘 컴포넌트로 잡는 이유는 같은 그림이 두 자리에 쓰이기 때문이다(today 는 그룹과 페이지,
 * 렌치는 유틸리티 그룹과 페이지). 라우트 키로 잡으면 한쪽만 채워지는 사고가 난다.
 */
const FILLED_ICONS: ReadonlySet<IconComponent> = new Set([
  LayoutDashboardIcon,
  WrenchIcon,
  SwordsIcon,
  // 수익은 우리가 그린 아이콘이라 **채울 자리를 고를 수 있다** - 동전 두 개만 면이 되고 단을
  // 그리는 호는 선으로 남는다.
  //
  // 톱니(`GearIcon`)가 여기서 빠진 것은 그 그림이 하단 바를 떠나 더보기 머리로 갔기 때문이다.
  // 자리를 물려받은 `MenuIcon` 은 선 셋이라 채울 안쪽이 없다.
  ProfitIcon,
])

/** 활성 아이콘이 쓸 `fill`. 채우지 않는 그림은 `none` 그대로다. */
function activeFill(Icon: IconComponent, active: boolean, accent: string): string {
  return active && FILLED_ICONS.has(Icon) ? accent : 'none'
}

/** 채우지 못하는 그림만 활성일 때 굵어진다. 채우는 그림은 기본 굵기 그대로다(배타). */
function activeStroke(Icon: IconComponent, active: boolean): number {
  if (!active || FILLED_ICONS.has(Icon)) return ICON_STROKE
  return LIGHT_ACTIVE_STROKE.get(Icon) ?? ICON_STROKE_ACTIVE
}

export interface BarGlyphProps {
  id: GroupId | TabRouteName
  label: string
  active: boolean
  /** 활성일 때 아이콘·라벨이 **함께** 쓰는 색(`bar-colors.ts` 의 `accent`). */
  accent: string
  /** 비활성 색(`bar-colors.ts` 의 `muted`). */
  muted: string
}

export function BarGlyph({ id, label, active, accent, muted }: BarGlyphProps): React.JSX.Element {
  const Icon = ICONS[id]

  return (
    <View className="items-center gap-[4px]">
      {/* 아이콘과 라벨은 **같은 색**이다. 강조색을 그대로 쓰면 테마에 따라 대비가 1.89 까지
          내려가므로, **읽힐 때까지 민** 값을 `bar-colors.ts` 가 계산해 준다. */}
      <Icon
        className="h-[25px] w-[25px]"
        color={active ? accent : muted}
        fill={activeFill(Icon, active, accent)}
        strokeWidth={activeStroke(Icon, active)}
      />
      <Text
        numberOfLines={1}
        // `includeFontPadding` 은 안드로이드에서만 읽히는 값이고, 기본(참)일 때 글자 상자에
        // 폰트 메트릭 여백을 더해 iOS 보다 큰 상자를 만든다. 아이콘→라벨이 27 → 30px
        // 이 되고 블록이 5px 자라 아이콘이 3px 위로 밀린다. iOS 는 이 값을 무시한다.
        style={{ color: active ? accent : muted, includeFontPadding: false }}
        className="text-10 font-normal tracking-[-0.01em]"
      >
        {label}
      </Text>
    </View>
  )
}

/** 하위 행 첫 칸의 ←. 항목 아이콘과 같은 굵기다 */
export function BarBackGlyph(props: { color: string }): React.JSX.Element {
  return <ArrowLeftIcon className="h-[25px] w-[25px]" color={props.color} strokeWidth={ICON_STROKE} />
}

/** 바 밖에서 칸을 가리킬 때 쓰는 그 칸의 아이콘. 하단 탭 순서 페이지의 줄이 쓴다 */
export function BarIcon(props: {
  id: GroupId | TabRouteName
  className: string
  color: string
  strokeWidth: number
}): React.JSX.Element {
  const Icon = ICONS[props.id]
  return <Icon className={props.className} color={props.color} strokeWidth={props.strokeWidth} />
}
