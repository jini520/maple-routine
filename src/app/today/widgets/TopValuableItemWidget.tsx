/**
 * 위젯 4 — **이번 주 최고가 아이템**([[ADR-147]] 결정 9 · 정정 5·11·13).
 *
 * ## 「가장 비싼」은 시세가 아니라 **기록된 판매가** 순위다
 *
 * 앱은 아이템 시세표를 갖고 있지 않다 — 금액은 사용자가 입력한 실제 판매가에서만 온다
 * ([[ADR-124]]). 그래서 이 타일의 뜻은 정확히 «이번 주에 기록된 판매가 중 가장 큰 것» 이고,
 * **가격을 아직 안 적은 드롭은 순위에 없다**(뷰모델이 이미 거른다 — 값을 모르는 것을 가장 싼 것으로
 * 단정하는 일이다).
 *
 * ## 미입력 건수를 여기서 말하지 않는다 ([[ADR-147]] 정정 5)
 *
 * 이 타일이 «없음» 을 말하는 가장 흔한 이유가 «안 팔았거나 안 적었다» 라서 그 답을 옆 타일(위젯 7)이
 * 들고 있는데, **옆 타일이 들고 있으면 이 타일이 또 들 이유가 없다.** 0건 문구도 한 줄뿐이다.
 *
 * ## 크기가 버리는 것
 *
 * 2x1(기본)은 **아이템 이름**을 버린다 — 이름은 잘려야 들어가고, 잘린 한 조각보다 «얼마였나» 가 이
 * 타일이 답하는 질문이다. 1x1 은 **단위 「메소」까지** 버린다(정정 11 — 물리적으로 안 들어간다).
 * 4x2 만 2~5위를 함께 그린다.
 *
 * ## 아이콘은 `slot` 과 함께 묻는다
 *
 * `getItemIconUrl(name, slot)` 이 규약이고, 안 넘겨서 나는 실패는 에러가 아니라 **조용한 폴백 원**이다
 * (지금 데이터에 `iconFileBySlot` 이 없다는 사실에 기대지 않는다).
 */

import { Image, View } from 'react-native'

import { formatMesoShort } from '../../../lib/boss-profit-delta'
import { getItemIconUrl } from '../../../lib/artwork'

import { Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { WidgetHeight } from '../../../lib/widget-layout'
import type { PricedDropView } from '../view-model'
import type { WidgetProps } from './types'

/** 「N건이 값을 기다립니다」를 여기 두지 않는다 — 건수는 위젯 7의 몫이다([[ADR-147]] 정정 5). */
const EMPTY_NOTE = '가격이 입력된 아이템이 없습니다'

const TITLE = '이번 주 최고가'

/** 4x2 · 2x2 · 2x1 · 1x1 — 이름이 크기가 아니라 «무엇을 그리는가» 를 말한다. */
type Variant = 'wide' | 'compact' | 'mini' | 'tiny'

function variantOf(w: number, h: WidgetHeight): Variant {
  if (w === 4) return 'wide'
  if (w === 1) return 'tiny'
  return h === 2 ? 'compact' : 'mini'
}

function Icon(props: { drop: PricedDropView; sizePx: number }): React.JSX.Element {
  const url = getItemIconUrl(props.drop.itemName, props.drop.slot)

  if (url === null) {
    // `ItemRevenuePopover` 와 같은 폴백 — 빈 상자다. 다른 아이템 그림을 대신 세우면 «이 아이템» 으로
    // 읽힌다.
    return (
      <View
        testID="top-item-icon-fallback"
        className="shrink-0 rounded-md border border-border bg-surface-2"
        style={{ width: props.sizePx, height: props.sizePx }}
      />
    )
  }

  return (
    <Image
      testID="top-item-icon"
      accessibilityLabel={props.drop.itemName}
      source={url}
      resizeMode="contain"
      className="shrink-0"
      style={{ width: props.sizePx, height: props.sizePx }}
    />
  )
}

/** `12.0억 메소` — 1x1 만 단위를 버린다([[ADR-147]] 정정 11). */
function Amount(props: { meso: number; sizeClass: string; unit: boolean }): React.JSX.Element {
  return (
    <Text fixed testID="top-item-amount" numberOfLines={1} className="text-text">
      <Text fixed style={TABULAR_NUMS} className={`font-extrabold text-text ${props.sizeClass}`}>
        {formatMesoShort(props.meso)}
      </Text>
      {props.unit && <Text fixed className="text-11 font-semibold text-text-muted"> 메소</Text>}
    </Text>
  )
}

/** 아이템 이름 — **한 줄**이다. 두 줄로 접으면 행 높이가 데이터에 따라 흔들린다(정정 5). */
function ItemName(props: { drop: PricedDropView; sizeClass: string }): React.JSX.Element {
  return (
    <Text
      fixed
      testID="top-item-name"
      numberOfLines={1}
      className={`font-semibold text-text ${props.sizeClass}`}
    >
      {props.drop.itemName}
      {props.drop.ringLevel !== undefined && ` ${props.drop.ringLevel}레벨`}
    </Text>
  )
}

/**
 * 캐릭터 · 보스.
 *
 * 캐릭터 이름은 프로필 캐시에 있을 때만 온다 — 없으면 보스만 선다(ocid 를 대신 넣지 않는다).
 */
/**
 * «2인 분배» — **4x2 에만 선다.**
 *
 * 금액이 분배 후 실수령액이라([[ADR-147]] 정정 21) 사용자가 입력한 총액보다 작다. 그 차이를
 * 설명하지 않으면 «숫자가 틀렸다» 로 읽힌다 — 실제로 이 위젯이 두 번 그렇게 신고됐다.
 *
 * 그런데 **2x2 아래로는 이 한 줄을 넣을 폭이 없다**(158px 안에 아이콘 40 + 금액 78 이 이미 들어가
 * 있다). 억지로 넣으면 말줄임에 먹혀 «2인 분...» 이 되어 설명이 아니라 잡음이 된다. 그래서 자리가
 * 실제로 있는 크기에만 두고, 나머지는 금액만 말한다.
 *
 * 단독(1인)이면 그리지 않는다 — 나눈 적이 없는데 «1인 분배» 라고 적으면 없는 사건을 말하는 것이다.
 */
function ShareNote(props: { drop: PricedDropView }): React.JSX.Element | null {
  if (props.drop.shareCount <= 1) return null

  return (
    <Text fixed testID="top-item-share" numberOfLines={1} className="text-[10.5px] text-text-disabled">
      {props.drop.shareCount}인 분배
    </Text>
  )
}

function Origin(props: { drop: PricedDropView }): React.JSX.Element {
  const parts = [props.drop.characterName, props.drop.boss].filter(
    (part): part is string => part !== undefined,
  )

  return (
    <Text fixed testID="top-item-origin" numberOfLines={1} className="text-11 text-text-muted">
      {parts.join(' · ')}
    </Text>
  )
}

/** 2~5위 — 4x2 의 오른쪽 열만 쓴다. 항목이 모자라면 있는 만큼만 선다. */
function RestList(props: { rest: PricedDropView[] }): React.JSX.Element | null {
  if (props.rest.length === 0) return null

  return (
    <View testID="top-item-rest" className="gap-1">
      {props.rest.map((drop, index) => (
        <View
          key={`${drop.ocid}|${drop.boss}|${drop.itemName}|${index}`}
          testID="top-item-rest-row"
          className="flex-row items-center gap-1.5"
        >
          <Icon drop={drop} sizePx={18} />
          <Text fixed numberOfLines={1} className="min-w-0 flex-1 text-[11.5px] text-text">
            {drop.itemName}
          </Text>
          {/* 목록 행에는 단위를 안 붙인다 — 왼쪽 1위가 이미 말했다. */}
          <Text fixed style={TABULAR_NUMS} className="shrink-0 text-[11.5px] font-bold text-text">
            {formatMesoShort(drop.payoutMeso)}
          </Text>
        </View>
      ))}
    </View>
  )
}

/**
 * 빈 상태 — **채워진 상태의 골격을 그대로 쓴다.**
 *
 * 글자만 남기면 자리가 무너져 «타일이 비었다» 가 아니라 «타일이 고장났다» 로 보인다. 아이콘이
 * 서던 자리에 **같은 크기의 빈 슬롯**을 세우면 값이 들어왔을 때 자리가 안 움직이고, 지금이
 * «들어올 곳이 있는데 아직 없다» 로 읽힌다([[ADR-060]] 의 빈 상태 태도).
 *
 * 슬롯은 점선이다 — 실선 상자는 «내용이 있는 무엇» 으로 보이고, 점선은 그 자리가 비어 있다는 관례다.
 */
function EmptySlot(props: { sizePx: number }): React.JSX.Element {
  return (
    <View
      testID="top-item-empty-slot"
      className="shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-surface-2"
      style={{ width: props.sizePx, height: props.sizePx }}
    >
      <Text fixed className="font-bold text-text-disabled" style={{ fontSize: props.sizePx * 0.42 }}>
        ―
      </Text>
    </View>
  )
}

function Empty(props: { variant: Variant }): React.JSX.Element {
  // 1x1 도 **문구를 남긴다.** 슬롯만 세우면 «무엇이 없는지» 를 말하지 못해 타일이 그냥 고장난
  // 것처럼 보인다 — 이 크기의 채워진 상태에는 라벨이 없어서 더 그렇다.
  if (props.variant === 'tiny') {
    return (
      <View testID="widget-top-valuable-item" className="flex-1 items-center justify-center gap-1.5 p-2">
        <EmptySlot sizePx={22} />
        <Text
          fixed
          testID="top-item-empty"
          numberOfLines={3}
          className="text-center text-10 leading-[11px] text-text-muted"
        >
          {EMPTY_NOTE}
        </Text>
      </View>
    )
  }

  // 2x1 은 채워진 상태와 같은 «아이콘 좌 · 글자 우» 골격이라 값이 들어와도 줄이 안 흔들린다.
  if (props.variant === 'mini') {
    return (
      <View testID="widget-top-valuable-item" className="flex-1 flex-row items-center gap-2.5 p-3">
        <EmptySlot sizePx={32} />
        <Text fixed testID="top-item-empty" numberOfLines={2} className="flex-1 text-11 text-text-muted">
          {EMPTY_NOTE}
        </Text>
      </View>
    )
  }

  return (
    <View testID="widget-top-valuable-item" className="flex-1 items-center justify-center gap-2.5 p-3">
      <EmptySlot sizePx={36} />
      <Text
        fixed
        testID="top-item-empty"
        numberOfLines={2}
        className="text-center text-[11.5px] leading-[15px] text-text-muted"
      >
        {EMPTY_NOTE}
      </Text>
    </View>
  )
}

export function TopValuableItemWidget({ w, h, data }: WidgetProps): React.JSX.Element {
  const variant = variantOf(w, h)
  const view = data.topItem

  if (view === null) return <Empty variant={variant} />

  if (variant === 'tiny') {
    return (
      <View testID="widget-top-valuable-item" className="flex-1 items-center justify-center gap-1 p-2">
        <Icon drop={view.top} sizePx={28} />
        <Amount meso={view.top.payoutMeso} sizeClass="text-13" unit={false} />
      </View>
    )
  }

  if (variant === 'mini') {
    return (
      <View testID="widget-top-valuable-item" className="flex-1 flex-row items-center gap-2.5 p-3">
        <Icon drop={view.top} sizePx={36} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text fixed className="text-10 font-bold text-text-muted">{TITLE}</Text>
          <Amount meso={view.top.payoutMeso} sizeClass="text-15" unit />
        </View>
      </View>
    )
  }

  if (variant === 'compact') {
    return (
      <View testID="widget-top-valuable-item" className="flex-1 justify-center gap-2 p-3">
        <Text fixed className="text-10 font-bold text-text-muted">{TITLE}</Text>
        {/* 아이콘을 40 으로 줄여 `12.0억 메소` 가 **한 줄**에 들어간다([[ADR-147]] 정정 11). */}
        <View className="flex-row items-center gap-2">
          <Icon drop={view.top} sizePx={40} />
          <View className="min-w-0 flex-1">
            <Amount meso={view.top.payoutMeso} sizeClass="text-15" unit />
          </View>
        </View>
        <View className="gap-0.5">
          <ItemName drop={view.top} sizeClass="text-[12.5px]" />
          <Origin drop={view.top} />
        </View>
      </View>
    )
  }

  return (
    <View testID="widget-top-valuable-item" className="flex-1 flex-row gap-3 p-3">
      <View className="min-w-0 flex-1 justify-center gap-1">
        <Text fixed className="text-10 font-bold text-text-muted">{TITLE}</Text>
        <View className="flex-row items-center gap-2">
          <Icon drop={view.top} sizePx={44} />
          <View className="min-w-0 flex-1 gap-0.5">
            <Amount meso={view.top.payoutMeso} sizeClass="text-lg" unit />
            <ItemName drop={view.top} sizeClass="text-[12.5px]" />
            <Origin drop={view.top} />
            <ShareNote drop={view.top} />
          </View>
        </View>
      </View>
      <View className="w-[44%] justify-center">
        <RestList rest={view.rest} />
      </View>
    </View>
  )
}
