/**
 * 위젯 7 — **가격 미입력 드롭**.
 *
 * ## 이 타일이 옆 타일의 없음 을 설명한다
 *
 * 위젯 4(최고가 아이템)는 **기록된 판매가**만 줄 세우므로, 값을 안 적은 드롭은 순위에 아예 없다
 * (값을 모르는 것을 가장 싼 것으로 단정하지 않는다 —). 그래서 위젯 4가 가격이
 * 입력된 아이템이 없습니다 를 말하는 가장 흔한 이유가 안 팔았거나 안 적었다 이고, **그 답을 이
 * 타일이 든다.** 두 타일이 같은 격자에 나란히 있는 이유가 이것이고, 건수를 여기서만 말하는 이유도
 * 같다(정정 5 — 한 사실을 두 곳에서 말하지 않는다).
 *
 * ## 2x2 만 아이템 이름 을 보여 준다
 *
 * 값을 적어야지보다 **`그 연마석 얼마에 팔았지`** 가 손을 움직이는 문장이다. 건수만으로는 그
 * 문장이 안 나오므로 이름 셋까지 세우고 나머지는 외 N건 으로 접는다 — 타일은 목록이 아니라
 * 요약이고, 타일 안에서 스크롤하지 않는다.
 *
 * ## 0건이어도 타일은 남는다
 *
 * 좌표 배치라 자리를 빼면 아래 타일이 올라오지 않고 **빈 사각형**이 남고, 다음 주에 다시 나타나면
 * 새 기능 처럼 보인다. 그래서 사라지는 대신 전부 기록했습니다로 내용을 바꾼다.
 */

import { View } from 'react-native'

import { ChevronRightIcon, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { WidgetHeight } from '../../../lib/today/widget-layout'
import type { UnpricedDropView } from '../view-model'
import type { WidgetProps } from './types'

const TITLE = '가격 미입력'

/** 0건일 때 — 0건이 아니라 **끝났다는 사실**을 말한다(숫자 0은 할 일처럼 읽힌다). */
const DONE_NOTE = '전부 기록했습니다'

/** 세 크기가 공유하는 행동 유도 — 목적지는 레지스트리의 `target` 이 지고, 여기서는 말만 한다. */
const CTA = '기록하기'

/** 2x1 · 2x2 · 1x1 — 이름이 크기가 아니라 무엇을 그리는가 를 말한다. */
type Variant = 'mini' | 'compact' | 'tiny'

function variantOf(w: number, h: WidgetHeight): Variant {
  if (w === 1) return 'tiny'
  return h === 2 ? 'compact' : 'mini'
}

/**
 * 건수 배지 — 원 안의 숫자.
 *
 * 색은 `primary` 계열이 아니라 `surface-2` 다. 이 타일이 말하는 것은 성과 가 아니라 밀린 일 이고,
 * 격자에서 강조색은 결과를 말하는 타일들이 이미 쓴다.
 */
function CountBadge(props: { count: number; sizePx: number; textPx: number }): React.JSX.Element {
  return (
    <View
      testID="unpriced-badge"
      className="shrink-0 items-center justify-center rounded-full border border-border bg-surface-2"
      style={{ width: props.sizePx, height: props.sizePx }}
    >
      <Text
        fixed
        style={[TABULAR_NUMS, { fontSize: props.textPx }]}
        className="font-extrabold text-text"
        // 세 자리가 넘어도 배지 크기는 안 바뀐다 — 원이 커지면 옆 글자가 밀린다.
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {props.count}
      </Text>
    </View>
  )
}

/** `기록하기 ›` — 화살표는 아이콘이라 글자 검사에 안 걸린다(텍스트는 CTA 한 마디뿐이다). */
function Cta(props: { prefix?: string }): React.JSX.Element {
  return (
    <View testID="unpriced-cta" className="flex-row items-center gap-0.5">
      <Text fixed numberOfLines={1} className="text-[11.5px] font-semibold text-text-muted">
        {props.prefix === undefined ? CTA : `${props.prefix} · ${CTA}`}
      </Text>
      <ChevronRightIcon size={12} className="shrink-0 text-text-muted" />
    </View>
  )
}

/**
 * 아이템 한 줄 — **이름만**이다.
 *
 * 캐릭터·보스를 붙이면 2x2 에서 이름이 잘리는데, 이 타일이 답하는 질문은 무엇의 값을 적어야 하나
 * 라 이름이 먼저다. 반지 레벨은 이름의 일부라 함께 세운다(같은 반지의 다른 레벨은 다른 물건이다).
 */
function ItemRow(props: { drop: UnpricedDropView }): React.JSX.Element {
  return (
    <Text fixed testID="unpriced-item" numberOfLines={1} className="text-xs text-text">
      {props.drop.itemName}
      {props.drop.ringLevel !== undefined && ` ${props.drop.ringLevel}레벨`}
    </Text>
  )
}

/**
 * 0건 — **타일은 남고 내용만 바뀐다**.
 *
 * CTA 도 함께 사라진다: 기록할 것이 없는데 기록하기로 보내면 빈 화면에 도착한다.
 */
/**
 * 0건 표식 — **건수 배지가 서던 자리에 같은 크기의 원**을 세운다.
 *
 * 그래야 **7 → ✓** 가 자리를 안 옮기고 바뀌어, 값이 사라진 것이 아니라 **끝난 것**으로 읽힌다.
 * 색은 배지의 경고 톤이 아니라 `primary-ink` 다 — 남은 일이 아니라 마친 일이다.
 */
function DoneMark(props: { sizePx: number }): React.JSX.Element {
  return (
    <View
      testID="unpriced-done-mark"
      className="shrink-0 items-center justify-center rounded-full bg-surface-2"
      style={{ width: props.sizePx, height: props.sizePx }}
    >
      <Text fixed className="font-bold text-primary-ink" style={{ fontSize: props.sizePx * 0.45 }}>
        ✓
      </Text>
    </View>
  )
}

function Done(props: { variant: Variant }): React.JSX.Element {
  if (props.variant === 'tiny') {
    return (
      <View testID="widget-unpriced-drops" className="flex-1 items-center justify-center gap-1 p-2">
        <DoneMark sizePx={22} />
        {/* 타일 이름이 아니라 **끝났다는 사실**을 남긴다 — 1x1 에는 라벨이 없어서 이 한 줄이
            **무엇이 0건인가** 를 말하는 자리가 여기뿐이다. */}
        <Text
          fixed
          testID="unpriced-done"
          numberOfLines={3}
          className="text-center text-10 leading-[11px] text-text-muted"
        >
          {DONE_NOTE}
        </Text>
      </View>
    )
  }

  if (props.variant === 'compact') {
    return (
      <View testID="widget-unpriced-drops" className="flex-1 items-center justify-center gap-2.5 p-3">
        <DoneMark sizePx={36} />
        <Text
          fixed
          testID="unpriced-done"
          numberOfLines={2}
          className="text-center text-[11.5px] leading-[15px] text-text-muted"
        >
          {DONE_NOTE}
        </Text>
      </View>
    )
  }

  // 2x1 — 채워진 상태와 같은 **배지 좌 · 글자 우** 골격.
  return (
    <View testID="widget-unpriced-drops" className="flex-1 flex-row items-center gap-2.5 p-3">
      <DoneMark sizePx={32} />
      <View className="flex-1">
        <Text fixed className="text-11 font-semibold text-text-muted">{TITLE}</Text>
        <Text fixed testID="unpriced-done" numberOfLines={1} className="mt-0.5 text-11 text-text-muted">
          {DONE_NOTE}
        </Text>
      </View>
    </View>
  )
}

export function UnpricedDropsWidget({ w, h, data }: WidgetProps): React.JSX.Element {
  const variant = variantOf(w, h)
  const count = data.unpricedCount

  if (count === 0) return <Done variant={variant} />

  if (variant === 'tiny') {
    return (
      <View testID="widget-unpriced-drops" className="flex-1 items-center justify-center gap-1 p-2">
        <Text fixed style={TABULAR_NUMS} className="text-lg font-extrabold text-text">
          {count}
        </Text>
        <Text fixed numberOfLines={1} className="text-[9.5px] text-text-muted">
          {TITLE}
        </Text>
      </View>
    )
  }

  if (variant === 'compact') {
    const preview = data.unpricedPreview
    // 미리보기에 안 든 나머지 — 0이면 **외 0건** 대신 CTA 만 선다.
    const rest = count - preview.length

    return (
      <View testID="widget-unpriced-drops" className="flex-1 justify-center gap-2 p-3">
        <View className="flex-row items-center gap-2">
          <CountBadge count={count} sizePx={28} textPx={13} />
          <Text fixed numberOfLines={1} className="min-w-0 flex-1 text-11 font-bold text-text-muted">
            {TITLE}
          </Text>
        </View>
        <View testID="unpriced-preview" className="gap-0.5">
          {preview.map((drop, index) => (
            <ItemRow key={`${drop.ocid}|${drop.boss}|${drop.itemName}|${index}`} drop={drop} />
          ))}
        </View>
        <Cta prefix={rest > 0 ? `외 ${rest}건` : undefined} />
      </View>
    )
  }

  return (
    <View testID="widget-unpriced-drops" className="flex-1 flex-row items-center gap-2.5 p-3">
      <CountBadge count={count} sizePx={36} textPx={16} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text fixed numberOfLines={1} className="text-xs font-bold text-text">
          {TITLE}
        </Text>
        <Cta />
      </View>
    </View>
  )
}
