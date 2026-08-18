/**
 * 위젯 3 — **이번 주 보스 수익**([[ADR-146]] 결정 6 · 정정 4·13).
 *
 * ## 이 타일에는 증감이 없다 ([[ADR-146]] 정정 4)
 *
 * `rise`/`fall` 토큰도 `previousPeriodTotalMeso` 도 쓰지 않는다 — 그것들은 보스 수익 화면에 그대로
 * 살아 있고([[ADR-087]]) **여기서만** 안 쓴다. 그 자리를 채우는 것은 시간축 비교가 아니라 **구성
 * 비교**다: 이번 주 수익이 결정석에서 왔는지 아이템 판매에서 왔는지는 그 자체로 이번 주의 사실이라
 * 다른 기간을 조회하지 않는다. 색은 [[ADR-142]] 링과 같은 짝이다(`primary` = 결정석 · `third` = 아이템).
 *
 * ## 0 을 그리는 유일한 위젯이다
 *
 * «큰 0 을 그리지 않는다»([[ADR-146]] 결정 5)를 이 타일에서만 뒤집는다(사용자 지시). 그 규칙이
 * 지키려던 것 — «없다» 와 «모른다» 를 가르는 일 — 은 옆의 한 줄(*아직 이번 주 기록이 없습니다*)이
 * 진다. 그때는 **스택 바와 분해 금액도 함께 사라진다**: 0/0 인 바와 「결정석 0 · 아이템 0」은 분해할
 * 것이 없는데 분해한 척이다.
 *
 * ## 금액은 접고, 굴리지 않는다
 *
 * `formatMesoShort` 를 쓴다 — 접는 규칙을 두 벌로 만들면 이 타일과 보스 수익 화면이 다르게 접는다.
 * 그래서 **카운트업(`AnimatedMeso`)도 안 쓴다**: 그쪽은 `toLocaleString()` 의 자릿수 전체를 굴리는
 * 물건이라 접힌 표기(`12.0억`)와 애초에 짝이 맞지 않고, [[ADR-087]] 결정 6이 카운트업을 건 범위도
 * 보스 수익 화면이다.
 *
 * ## 크기가 버리는 것
 *
 * 4x3 은 전부 · 4x2 는 캐릭터 행의 **내역** · 2x2 는 **캐릭터 목록**(158 폭에 「이름 + 금액」 행이 안
 * 들어간다) · 2x1 은 **금액만**. 단위 「메소」는 큰 금액 뒤에만 붙고 목록 행에는 안 붙는다 — 머리가
 * 이미 말했다([[ADR-146]] 정정 4).
 */

import { Text, View, type DimensionValue } from 'react-native'

import { formatMesoShort } from '@core/lib/boss-profit-delta'

import { TABULAR_NUMS } from '../../../lib/text-styles'
import type { WidgetHeight } from '../../../lib/widget-layout'
import type { ProfitSplit, WeeklyProfitCharacterView, WeeklyProfitView } from '../view-model'
import type { WidgetProps } from './types'

/** 기록이 없을 때 옆에 서는 한 줄 — 큰 `0` 이 «없다» 로 읽히지 않게 하는 유일한 장치다. */
const NO_RECORD_NOTE = '아직 이번 주 기록이 없습니다'

const PERIOD_LABEL = '이번 주'

/** 스택 바의 두 조각. 조립하지 않는다 — `ProgressBar` 파일 머리 ①과 같은 이유(스캔에 안 잡힌다). */
const SEGMENT_CLASS = {
  crystal: 'h-1.5 bg-primary',
  item: 'h-1.5 bg-third',
} as const

const LEGEND_DOT_CLASS = {
  crystal: 'h-1.5 w-1.5 rounded-full bg-primary',
  item: 'h-1.5 w-1.5 rounded-full bg-third',
} as const

const SEGMENT_LABEL = { crystal: '결정석', item: '아이템' } as const

type SegmentKey = keyof typeof SEGMENT_CLASS

/** 4x3 · 4x2 · 2x2 · 2x1 — 그리는 것이 갈리므로 이름이 크기가 아니라 밀도를 말한다. */
type Variant = 'full' | 'wide' | 'compact' | 'mini'

function variantOf(w: number, h: WidgetHeight): Variant {
  if (w === 2) return h === 2 ? 'compact' : 'mini'
  return h === 3 ? 'full' : 'wide'
}

function splitOf(split: ProfitSplit): { key: SegmentKey; meso: number }[] {
  return [
    { key: 'crystal', meso: split.crystalMeso },
    { key: 'item', meso: split.itemMeso },
  ]
}

/**
 * 스택 조각의 폭.
 *
 * 소수 둘로 끊는 것은 정밀도가 아니라 **안정성** 때문이다 — `0.8 * 100` 이 부동소수점에서
 * `80.00000000000001` 이라, 안 끊으면 그 꼴이 폭 문자열과 스냅샷에 그대로 굳는다.
 */
function percentWidth(meso: number, sum: number): DimensionValue {
  return `${Number(((meso / sum) * 100).toFixed(2))}%`
}

function Amount(props: { meso: number; sizeClass: string }): React.JSX.Element {
  return (
    <Text testID="profit-amount" numberOfLines={1} className="text-text">
      <Text style={TABULAR_NUMS} className={`font-extrabold text-text ${props.sizeClass}`}>
        {formatMesoShort(props.meso)}
      </Text>
      {/* 숫자와 단위 사이는 마진이 아니라 **실제 공백 문자**다([[ADR-046]] 트레이드오프). */}
      <Text className="text-[11px] font-semibold text-text-muted"> 메소</Text>
    </Text>
  )
}

/**
 * 결정석/아이템 스택 바.
 *
 * 두 조각의 폭은 **둘의 합 기준 비율**이라 더하면 언제나 트랙을 꽉 채운다(뷰모델이 그 합을 총액과
 * 같게 보장한다). 합이 0 인 경우(기록은 있는데 가격 미확정 보스뿐)는 나누지 않고 **빈 트랙**을
 * 남긴다 — 0 을 임의의 비율로 그리는 것보다 아무것도 안 그리는 편이 사실이다.
 */
function StackBar(props: { split: ProfitSplit }): React.JSX.Element {
  const segments = splitOf(props.split)
  const sum = segments.reduce((total, segment) => total + segment.meso, 0)

  return (
    <View testID="profit-stack-bar" className="h-1.5 w-full flex-row overflow-hidden rounded-full bg-track">
      {sum > 0 &&
        segments.map((segment) => (
          <View
            key={segment.key}
            testID={`profit-fill-${segment.key}`}
            className={SEGMENT_CLASS[segment.key]}
            style={{ width: percentWidth(segment.meso, sum) }}
          />
        ))}
    </View>
  )
}

/** 분해 금액 — 같은 두 색 점을 달아 바를 읽는 법을 말한다. 좁은 타일에서는 세로로 선다. */
function Breakdown(props: { split: ProfitSplit; column: boolean }): React.JSX.Element {
  return (
    <View
      testID="profit-breakdown"
      className={props.column ? 'gap-0.5' : 'flex-row items-center gap-3'}
    >
      {splitOf(props.split).map((segment) => (
        <View key={segment.key} className="flex-row items-center gap-1">
          <View className={LEGEND_DOT_CLASS[segment.key]} />
          <Text className="text-[10px] text-text-muted">{SEGMENT_LABEL[segment.key]}</Text>
          <Text style={TABULAR_NUMS} className="text-[10px] font-semibold text-text">
            {formatMesoShort(segment.meso)}
          </Text>
        </View>
      ))}
    </View>
  )
}

function Note(): React.JSX.Element {
  return (
    <Text testID="profit-note" numberOfLines={1} className="text-[10px] text-text-muted">
      {NO_RECORD_NOTE}
    </Text>
  )
}

/** 바 + 분해 금액, 또는 그 자리에 서는 미기록 한 줄. */
function SplitBlock(props: { profit: WeeklyProfitView; column: boolean }): React.JSX.Element {
  if (!props.profit.hasRecords) return <Note />

  return (
    <View className="w-full gap-1.5">
      <StackBar split={props.profit} />
      <Breakdown split={props.profit} column={props.column} />
    </View>
  )
}

/**
 * 캐릭터 한 줄. **내역은 4x3 에만 선다** — 4x2 의 오른쪽 열은 폭이 타일의 절반도 안 돼 이름과 금액이
 * 먼저다.
 */
function CharacterRow(props: {
  character: WeeklyProfitCharacterView
  withSplit: boolean
}): React.JSX.Element {
  return (
    <View testID="profit-character-row" className="flex-row items-center gap-2 py-1">
      <Text
        testID="profit-character-name"
        numberOfLines={1}
        className="min-w-0 flex-1 text-[11.5px] font-semibold text-text"
      >
        {props.character.characterName}
      </Text>
      {props.withSplit && (
        <Text testID="profit-character-split" numberOfLines={1} className="shrink-0 text-[10px] text-text-muted">
          {splitOf(props.character)
            .map((segment) => `${SEGMENT_LABEL[segment.key]} ${formatMesoShort(segment.meso)}`)
            .join(' · ')}
        </Text>
      )}
      {/* 목록 행에는 「메소」를 안 붙인다 — 머리가 이미 단위를 말했다([[ADR-146]] 정정 4). */}
      <Text style={TABULAR_NUMS} className="shrink-0 text-[11.5px] font-bold text-text">
        {formatMesoShort(props.character.totalMeso)}
      </Text>
    </View>
  )
}

function CharacterList(props: {
  characters: WeeklyProfitCharacterView[]
  withSplit: boolean
}): React.JSX.Element | null {
  if (props.characters.length === 0) return null

  return (
    <View testID="profit-characters">
      {props.characters.map((character) => (
        <CharacterRow key={character.ocid} character={character} withSplit={props.withSplit} />
      ))}
    </View>
  )
}

function PeriodLabel(): React.JSX.Element {
  return <Text className="text-[11px] font-bold text-text-muted">{PERIOD_LABEL}</Text>
}

export function WeeklyBossProfitWidget({ w, h, data }: WidgetProps): React.JSX.Element {
  const variant = variantOf(w, h)
  const { profit } = data

  if (variant === 'mini') {
    return (
      <View testID="widget-weekly-boss-profit" className="flex-1 justify-center gap-0.5 p-3">
        <PeriodLabel />
        <Amount meso={profit.totalMeso} sizeClass="text-[20px]" />
        {!profit.hasRecords && <Note />}
      </View>
    )
  }

  if (variant === 'compact') {
    return (
      <View testID="widget-weekly-boss-profit" className="flex-1 justify-center gap-2 p-3">
        <View className="gap-0.5">
          <PeriodLabel />
          <Amount meso={profit.totalMeso} sizeClass="text-[22px]" />
        </View>
        <SplitBlock profit={profit} column />
      </View>
    )
  }

  if (variant === 'wide') {
    return (
      <View testID="widget-weekly-boss-profit" className="flex-1 flex-row gap-3 p-3">
        <View className="flex-1 justify-center gap-2">
          <View className="gap-0.5">
            <PeriodLabel />
            <Amount meso={profit.totalMeso} sizeClass="text-[24px]" />
          </View>
          <SplitBlock profit={profit} column={false} />
        </View>
        <View className="w-[42%] justify-center">
          <CharacterList characters={profit.topCharacters} withSplit={false} />
        </View>
      </View>
    )
  }

  return (
    <View testID="widget-weekly-boss-profit" className="flex-1 gap-2 p-3">
      <View className="gap-0.5">
        <PeriodLabel />
        <Amount meso={profit.totalMeso} sizeClass="text-[32px]" />
      </View>
      <SplitBlock profit={profit} column={false} />
      {profit.topCharacters.length > 0 && (
        <View className="mt-0.5 border-t border-border pt-0.5">
          <CharacterList characters={profit.topCharacters} withSplit />
        </View>
      )}
    </View>
  )
}
