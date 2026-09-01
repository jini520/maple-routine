/**
 * 위젯 8 — **아이템 드롭 가뭄**([[ADR-071]] 결정 4·8·9 · [[ADR-147]] 정정 6·10·13·14).
 *
 * ## 위젯 4와 겹쳐 보이지만 **묻는 것이 다르다**
 *
 * 최고가 아이템은 «얼마였나» 를 묻고 여기는 «언제 마지막이었나» 를 묻는다. 그래서 가격이 한 건도
 * 없어도 이 타일은 말할 것이 있다 — 고가 판정(`isValuableDrop`)이 **이름 기반**이라 값 입력과
 * 무관하게 선다([[ADR-147]] 결정 9).
 *
 * ## 단풍잎이 늙는 것으로 가뭄을 말한다
 *
 * 단계(`tier`)가 색·기울기·투명도를 한꺼번에 고른다 — 값 하나가 두 축을 같이 움직여야 "색은 슬픈데
 * 문구는 신난" 어긋남이 안 생긴다. 그 단계는 **`getValuableDroughtTier(weeksSince)` 의 값**이고
 * (뷰모델이 이미 풀어 `DroughtView.tier` 로 준다 — 위젯이 다시 계산하면 판정이 두 벌이 된다),
 * 표는 `lib/drought-tier-styles` 에 있어 드롭 히스토리 화면과 **같은 한 벌**이다(양쪽이 각자 들면
 * 한 단계가 두 화면에서 다른 색으로 늙는다).
 *
 * **0단계만 배경이 바뀐다**(`primary-tint`) — 격자에서 축하하는 타일이 그것뿐이라 그 한 자리에만
 * 강조색을 쓴다. 나머지 단계는 기본 배경이고, 슬픔은 잎이 진다.
 *
 * ## 문구는 마운트당 한 번 고른다
 *
 * 단계마다 풀이 여럿이고([[ADR-147]] 정정 6·10) 그중 하나가 무작위로 나온다. 렌더마다 고르면
 * 리렌더 때 문구가 깜빡이므로 `useState` 초기화 함수로 인스턴스당 한 번만 뽑는다 — 무작위는 화면
 * (경계)에만 두고 `lib` 은 순수하게 유지한다는 그 파일의 규칙 그대로다.
 *
 * ## 「물욕」이라고 하지 않는다 ([[ADR-147]] 정정 14)
 *
 * 화면에 보이는 한국어는 **「아이템 드롭」**이다. 영문 식별자(`valuable-drought` ·
 * `summarizeValuableDrought`)는 그대로 둔다 — 코어 API 이름까지 바꾸면 [[ADR-038]]·[[ADR-071]] 이
 * 건 계약이 이름만 다른 두 벌이 된다.
 */

import { useState } from 'react'
import { View } from 'react-native'

import { formatValuableDroughtHeadline } from '../../../lib/drop-history'

import { MapleLeaf, Text } from '../../../components/atoms'
import { DROUGHT_GLOW_FILTER, DROUGHT_TIER_STYLES } from '../../../lib/drought-tier-styles'
import type { WidgetHeight } from '../../../lib/widget-layout'
import type { DroughtView } from '../view-model'
import type { WidgetProps } from './types'

/**
 * 고가 기록이 **한 건도 없을 때**([[ADR-071]] — 기준점이 없으면 요약이 `null` 이다).
 *
 * 「0주째」로 위장하지 않는다 — 0주는 «이번 주에 먹었다» 는 뜻이라 정반대의 사실이 된다. 안 먹은
 * 것과 안 적은 것은 다르다.
 */
const NO_RECORD_NOTE = '아직 아이템 드롭 기록이 없습니다'



/** 4x1 · 2x2 · 2x1 — 이름이 크기가 아니라 «무엇을 그리는가» 를 말한다. */
type Variant = 'wide' | 'compact' | 'mini'

/** 잎 한 변(px). 이 요소의 감정을 잎이 지고 있어 2x2 는 크게 세운다([[ADR-147]] 정정 6). */
const LEAF_PX: Record<Variant, number> = { wide: 26, compact: 54, mini: 22 }

function variantOf(w: number, h: WidgetHeight): Variant {
  if (w === 4) return 'wide'
  return h === 2 ? 'compact' : 'mini'
}

/**
 * 기간 길이 — **0주는 «이번 주» 다.**
 *
 * 「0주째」는 셈은 맞지만 뜻이 없다(그 주에 먹었다는 것이 0주의 정의다). 히스토리 화면이 0주에서
 * 「마지막 에픽 빔!」을 떼는 것과 같은 판단이다.
 */
function weeksLabel(weeksSince: number): string {
  return weeksSince === 0 ? '이번 주' : `${weeksSince}주째`
}

/** 2x2 의 상태 한 줄 — 「N주째 아이템 드롭 없음」. 0주는 없음이 아니라 있음이라 문장이 갈린다. */
function statusLine(weeksSince: number): string {
  return weeksSince === 0 ? '이번 주에 획득했습니다' : `${weeksSince}주째 아이템 드롭 없음`
}

/**
 * 4x1 의 아래 줄 — 「마지막 · 7월 3주차 · 생명의 연마석 외 1개」.
 *
 * 0주에는 「마지막」을 붙이지 않는다 — 아직 진행 중인 주를 «마지막» 이라 부르면 어색하다(히스토리
 * 화면과 같은 규칙). 아이템 이름이 비면(그럴 일은 없지만 요약이 빈 배열을 줄 수 있다) 그 조각째 뺀다.
 */
function lastLine(view: DroughtView): string {
  const parts = [view.weeksSince === 0 ? undefined : '마지막', view.periodLabel, view.itemsLabel]
  return parts.filter((part) => part !== undefined && part !== '').join(' · ')
}

/**
 * 늙어 가는 단풍잎.
 *
 * **기울기·투명도·글로우는 감싸는 `View` 가 진다** — `<Svg>` 의 `style.filter` 는 SVG 속성
 * (`url(#id)`)으로 해석되어 배열을 주면 던진다(히스토리 화면이 실측으로 적어 둔 함정이다).
 * 높이 비율은 원본 뷰박스(127×130)를 따른다.
 */
function Leaf(props: { tier: number; sizePx: number }): React.JSX.Element {
  const style = DROUGHT_TIER_STYLES[props.tier]

  return (
    <View
      testID="drought-leaf"
      aria-hidden
      style={{
        transform: [{ rotate: `${style.rotate}deg` }],
        opacity: style.opacity,
        ...(style.glow ? { filter: DROUGHT_GLOW_FILTER } : {}),
      }}
    >
      <MapleLeaf size={props.sizePx} fill={style.leaf} />
    </View>
  )
}

/** 기간 길이 칩 — 4x1·2x1 이 쓴다. 잎이 이미 슬픔을 말하므로 색은 얹지 않는다. */
function WeeksChip(props: { weeksSince: number }): React.JSX.Element {
  return (
    <View
      testID="drought-weeks"
      className="shrink-0 rounded-full border border-border bg-surface-2 px-1.5 py-0.5"
    >
      <Text fixed numberOfLines={1} className="text-11 font-bold text-text-muted">
        {weeksLabel(props.weeksSince)}
      </Text>
    </View>
  )
}

/**
 * 기록 자체가 없을 때의 잎 — **단계 램프를 안 탄다.**
 *
 * 단계는 «몇 주째 못 먹었나» 인데 여기는 셀 기록이 아예 없다. 가장 슬픈 단계의 잎을 빌려 쓰면
 * «오래 못 먹었다» 로 읽혀 [[ADR-147]] 이 금지한 위장(«0주째» 로 그리지 않는다)을 색으로 다시
 * 저지르는 셈이다. 그래서 **중립색 하나**로 그리고 기울이지 않는다 — 아직 시작하지 않은 잎이다.
 */
function BlankLeaf(props: { sizePx: number }): React.JSX.Element {
  return (
    <View testID="drought-blank-leaf" aria-hidden style={{ opacity: 0.28 }}>
      {/* 색이 테마 토큰이라 `fill` 이 아니라 클래스로 준다. 잎 램프의 하드코딩 hex 를 여기서
          흉내 내면 라이트·다크 한쪽에서 반드시 죽는다. */}
      <MapleLeaf size={props.sizePx} className="text-text-disabled" />
    </View>
  )
}

function NoRecord(props: { variant: Variant }): React.JSX.Element {
  // 4x1 — 채워진 상태와 같은 «잎 좌 · 글자 우» 골격이라 기록이 생겨도 줄이 안 흔들린다.
  if (props.variant === 'wide') {
    return (
      <View testID="widget-valuable-drought" className="flex-1 flex-row items-center gap-3 p-3">
        <BlankLeaf sizePx={24} />
        <Text fixed testID="drought-no-record" numberOfLines={1} className="flex-1 text-xs text-text-muted">
          {NO_RECORD_NOTE}
        </Text>
      </View>
    )
  }

  if (props.variant === 'compact') {
    return (
      <View testID="widget-valuable-drought" className="flex-1 items-center justify-center gap-2.5 p-3">
        <BlankLeaf sizePx={44} />
        <Text
          fixed
          testID="drought-no-record"
          numberOfLines={2}
          className="text-center text-[11.5px] leading-[15px] text-text-muted"
        >
          {NO_RECORD_NOTE}
        </Text>
      </View>
    )
  }

  return (
    <View testID="widget-valuable-drought" className="flex-1 flex-row items-center gap-2.5 p-3">
      <BlankLeaf sizePx={20} />
      <Text fixed testID="drought-no-record" numberOfLines={2} className="flex-1 text-11 text-text-muted">
        {NO_RECORD_NOTE}
      </Text>
    </View>
  )
}

export function ValuableDroughtWidget({ w, h, data }: WidgetProps): React.JSX.Element {
  const variant = variantOf(w, h)
  const view = data.drought

  // **마운트당 한 번**이라 리렌더에도 문구가 안 바뀐다. 요약이 없어도 훅은 부른다 — 조건부 호출은
  // 규칙 위반이고, 그 경우 인덱스는 아무도 안 읽는다.
  const [headlineIndex] = useState(() => Math.floor(Math.random() * (view?.headlineCount ?? 1)))

  if (view === null) return <NoRecord variant={variant} />

  const ink = DROUGHT_TIER_STYLES[view.tier].ink
  const headline = formatValuableDroughtHeadline(view.weeksSince, headlineIndex)
  // 0단계만 배경으로 축하한다 — 나머지는 기본 표면이고 슬픔은 잎이 진다.
  //
  // **모서리를 함께 둥글린다.** `Card` 는 `rounded-[14px]` 를 갖되 `overflow-hidden` 은 **일부러**
  // 안 건다(클리핑은 호출부의 일이라고 그 atom 이 적어 뒀다 — 미디어 스코프·글로우가 그 자유를
  // 쓴다). 그래서 타일 전체를 칠하는 배경이 사각이면 **네 모서리에서 카드의 둥근 테두리 안쪽을
  // 덮어** 테두리가 잘려 보인다. today 에서 타일 전면을 칠하는 위젯은 이것뿐이다.
  //
  // 반지름이 13인 것은 14가 아니라서다 — 배경은 테두리 **안쪽** 상자를 채우므로 바깥 반지름에서
  // 테두리 1px 을 뺀 값이 정확히 겹친다.
  const surface = view.tier === 0 ? 'rounded-[13px] bg-primary-tint' : ''

  if (variant === 'compact') {
    return (
      <View
        testID="widget-valuable-drought"
        aria-label={`아이템 드롭 미획득 ${view.tier}단계`}
        className={`flex-1 items-center justify-center gap-1.5 p-3 ${surface}`}
      >
        <Leaf tier={view.tier} sizePx={LEAF_PX.compact} />
        <Text fixed testID="drought-headline" numberOfLines={1} className={`text-sm font-bold ${ink}`}>
          {headline}
        </Text>
        <Text
          fixed
          testID="drought-status"
          numberOfLines={1}
          className="text-[11.5px] text-text-muted"
        >
          {statusLine(view.weeksSince)}
        </Text>
      </View>
    )
  }

  if (variant === 'mini') {
    return (
      <View
        testID="widget-valuable-drought"
        aria-label={`아이템 드롭 미획득 ${view.tier}단계`}
        className={`flex-1 flex-row items-center gap-2 p-3 ${surface}`}
      >
        <Leaf tier={view.tier} sizePx={LEAF_PX.mini} />
        <Text fixed testID="drought-headline" numberOfLines={1} className={`min-w-0 flex-1 text-13 font-bold ${ink}`}>
          {headline}
        </Text>
        <WeeksChip weeksSince={view.weeksSince} />
      </View>
    )
  }

  return (
    <View
      testID="widget-valuable-drought"
      aria-label={`아이템 드롭 미획득 ${view.tier}단계`}
      className={`flex-1 flex-row items-center gap-2.5 p-3 ${surface}`}
    >
      <Leaf tier={view.tier} sizePx={LEAF_PX.wide} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text fixed testID="drought-headline" numberOfLines={1} className={`text-sm font-bold ${ink}`}>
          {headline}
        </Text>
        <Text fixed testID="drought-last" numberOfLines={1} className="text-[11.5px] text-text-muted">
          {lastLine(view)}
        </Text>
      </View>
      <WeeksChip weeksSince={view.weeksSince} />
    </View>
  )
}
