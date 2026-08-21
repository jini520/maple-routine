/**
 * 위젯 1 — **대표 캐릭터**([[ADR-147]] 결정 6 · 정정 2·7·8·13).
 *
 * ## 세 크기가 같은 구조다
 *
 * 4x1 · 4x2 · 2x2 셋 모두 «월드 엠블럼 + 두 줄 + EXP» 이고([[ADR-147]] 정정 7 · 38), 갈리는 것은
 * **밀도와 EXP 의 자리**뿐이다 — 4x1 은 오른쪽 100px 열, 나머지는 아래 전폭. 큰 타일이 작은 타일을
 * 확대한 것이 아니라 같은 사실을 다른 밀도로 말한다(`widgets/types.ts` 규약).
 *
 * ## 길드는 닉네임 옆이다 ([[ADR-147]] 정정 38, 사용자 지시)
 *
 * ```
 * [초상화] [엠블럼] 단풍루틴  백호단          EXP 80.300%
 *          Lv. 291  아크메이지(불,독)   ══════════════════
 * ```
 *
 * 셋째 줄에 혼자 서던 값인데 **길드는 «누구인가» 의 일부**지 별도 항목이 아니다. 4x1 은 내부 높이가
 * 52 뿐이라 그 한 줄이 크다.
 *
 * **자리가 모자라면 닉네임이 줄어든다** — 길드는 잘리면 다른 길드로 읽히지만, 닉네임은 초상화가
 * 이미 «누구인가» 를 말한다.
 *
 * ## 없는 것을 그리지 않는다
 *
 * - **«대표 없음» 상태는 없다**([[ADR-147]] 정정 2) — `resolveDisplayRepresentative` 가 미지정이면
 *   목록의 첫 번째를 세운다. `representative === null` 은 **추적 캐릭터가 하나도 없을 때뿐**이라
 *   그때만 한 줄로 그 사실을 말한다. «임시 대표» 라는 표시도 하지 않는다([[ADR-144]] 결정 4).
 * - **`expRate` 가 없으면 EXP 줄 자체를 안 그린다**([[ADR-147]] 정정 8) — 0% 바를 그리면 «경험치가
 *   0» 으로 읽힌다. 그 상태를 «설계된 갈래» 로 두지는 않는다: 옛 캐시 엔트리에 그 필드가 없는 것에
 *   대한 **방어적 기본값**이다.
 * - 엠블럼·직업·길드도 같다 — 모르면 그 자리를 비운다(`CharacterRow` 와 같은 규칙).
 *
 * ## `character_exp`(누적 절대값)는 그리지 않는다
 *
 * 레벨이 오를수록 커지는 값이라 «얼마나 남았나» 를 말하지 못한다. 카드가 답하는 것은 진행률 하나고,
 * 소수 3자리는 **API 가 준 그대로**다 — 반올림하면 `99.999%` 가 `100%` 가 되어 «다 찼다» 고 거짓을
 * 말한다.
 *
 * ## 엠블럼은 번들 에셋이라 두 축을 다 이름 부른다
 *
 * `naturalAspectStyle` 이 없으면 폭에 그림의 고유 픽셀값이 남아 좌우 여백이 생긴다([[ADR-135]]) —
 * `CharacterRow` 가 이미 밟은 자리라 그 함수를 그대로 쓴다.
 */

import { Image, View } from 'react-native'

import { worldEmblemUrl } from '../../../lib/world-emblem'

import { ProgressBar } from '../../../components/atoms/ProgressBar/ProgressBar'
import { Text } from '../../../components/atoms/Text/Text'
import { faceCropStyle } from '../../../lib/face-crop'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import type { WidgetHeight } from '../../../lib/widget-layout'
import type { RepresentativeView } from '../view-model'
import type { WidgetProps } from './types'

/** 크기마다 갈리는 것은 **치수와 글자 크기**뿐이다 — 그리는 순서·줄 구성은 셋이 같다. */
const VARIANT = {
  /** 4x1(기본) — 내부 높이 52 에 초상화 44 가 들어간다([[ADR-147]] 정정 7). */
  row: {
    portraitPx: 44,
    emblemPx: 15,
    name: 'text-[13px]',
    caption: 'text-[10.5px]',
    guild: 'text-[10px]',
  },
  /** 4x2 — 같은 구조를 크게. EXP 바가 아래 전폭이다. */
  large: {
    portraitPx: 72,
    emblemPx: 20,
    name: 'text-[19px]',
    caption: 'text-[13px]',
    guild: 'text-xs',
  },
  /** 2x2 — 가운데 정렬. 158 폭이라 **직업이 잘린다**([[ADR-147]] 열린 질문). */
  compact: {
    portraitPx: 56,
    emblemPx: 16,
    name: 'text-sm',
    caption: 'text-[10.5px]',
    guild: 'text-[10px]',
  },
} as const

type Variant = keyof typeof VARIANT

function variantOf(w: number, h: WidgetHeight): Variant {
  if (w === 2) return 'compact'
  return h === 2 ? 'large' : 'row'
}

/** `"80.300%"` — API 가 준 소수 3자리를 그대로 둔다(파일 머리). */
function formatExpRate(rate: number): string {
  return `${rate.toFixed(3)}%`
}

function Portrait(props: { view: RepresentativeView; sizePx: number }): React.JSX.Element {
  return (
    <View
      className="shrink-0 overflow-hidden rounded-full"
      style={{ width: props.sizePx, height: props.sizePx }}
    >
      <Image
        testID="representative-face"
        accessibilityLabel={props.view.name}
        source={{ uri: props.view.imageUrl }}
        style={{ position: 'absolute', ...faceCropStyle(props.sizePx) }}
      />
    </View>
  )
}

function NameLine(props: {
  view: RepresentativeView
  variant: Variant
  center: boolean
}): React.JSX.Element {
  const spec = VARIANT[props.variant]
  const emblem = props.view.world === undefined ? null : worldEmblemUrl(props.view.world)

  return (
    <View
      testID="representative-name-line"
      className={`flex-row items-center gap-1${props.center ? ' justify-center' : ''}`}
    >
      {emblem !== null && (
        <View testID="representative-emblem" className="shrink-0">
          <Image
            accessibilityLabel={props.view.world ?? ''}
            source={emblem}
            style={naturalAspectStyle(emblem, { height: spec.emblemPx })}
            resizeMode="contain"
          />
        </View>
      )}
      <Text
        fixed
        testID="representative-name"
        numberOfLines={1}
        className={`min-w-0 shrink font-semibold leading-tight text-text ${spec.name}`}
      >
        {props.view.name}
      </Text>
      {/* 길드는 «모르는 것»(undefined)과 «미가입»(null)이 둘 다 그릴 것이 없다([[ADR-057]]) —
          이 카드가 가르는 자리는 아니라 둘 다 비운다. */}
      {props.view.guildName !== undefined && props.view.guildName !== null && (
        <Text
          fixed
          testID="representative-guild"
          numberOfLines={1}
          className={`shrink-0 leading-tight text-text-muted ${spec.guild}`}
        >
          {props.view.guildName}
        </Text>
      )}
    </View>
  )
}

/** 2줄 — `Lv. N` + 직업. 직업만 잘린다(레벨은 짧고 언제나 있다). */
function CaptionLine(props: {
  view: RepresentativeView
  variant: Variant
  center: boolean
}): React.JSX.Element {
  const spec = VARIANT[props.variant]

  return (
    <View className={`flex-row items-center gap-1.5${props.center ? ' justify-center' : ''}`}>
      <Text fixed className={`shrink-0 leading-tight text-text-muted ${spec.caption}`}>
        {`Lv. ${props.view.level}`}
      </Text>
      {props.view.jobClass !== undefined && (
        <Text
          fixed
          testID="representative-job"
          numberOfLines={1}
          className={`min-w-0 shrink leading-tight text-text-muted ${spec.caption}`}
        >
          {props.view.jobClass}
        </Text>
      )}
    </View>
  )
}

/**
 * EXP — 4x1 은 오른쪽 **100px 열**, 나머지는 아래 전폭.
 *
 * 100 은 70 에서 늘린 값이다([[ADR-147]] 정정 38, 사용자 지시) — 바가 짧아 진행률이 눈에 안
 * 들어왔다. 늘어난 30px 은 이름 줄에서 가져오고, 그래서 닉네임이 먼저 줄어든다(`NameLine`).
 *
 * `null` 을 돌려주는 갈래가 곧 «EXP 줄 자체가 없다» 는 계약이다([[ADR-147]] 정정 8).
 */
function ExpBlock(props: {
  view: RepresentativeView
  variant: Variant
}): React.JSX.Element | null {
  const rate = props.view.expRate
  if (rate === undefined) return null

  const compactColumn = props.variant === 'row'

  return (
    <View
      testID="representative-exp"
      className={compactColumn ? 'w-[100px] shrink-0 gap-1' : 'w-full gap-1'}
    >
      <View className="flex-row items-center gap-1">
        <Text fixed className="text-[10px] font-semibold text-text-muted">EXP</Text>
        <Text
          fixed
          numberOfLines={1}
          style={TABULAR_NUMS}
          className="ml-auto text-[10px] font-semibold text-text"
        >
          {formatExpRate(rate)}
        </Text>
      </View>
      <ProgressBar percent={rate} aria={{ now: rate, max: 100 }} />
    </View>
  )
}

function Lines(props: {
  view: RepresentativeView
  variant: Variant
  center: boolean
}): React.JSX.Element {
  return (
    <View className={`min-w-0 ${props.center ? 'w-full items-center' : 'flex-1'} gap-0.5`}>
      <NameLine view={props.view} variant={props.variant} center={props.center} />
      <CaptionLine view={props.view} variant={props.variant} center={props.center} />
    </View>
  )
}

export function RepresentativeCharacterWidget({ w, h, data }: WidgetProps): React.JSX.Element {
  const variant = variantOf(w, h)
  const view = data.representative

  // 이 자리는 «대표를 안 골랐다» 가 아니라 «추적 캐릭터가 없다» 다 — CTA 를 두지 않는 이유는
  // 위젯이 사라지지도 커지지도 않기 때문이고, 그 안내는 스케줄러·설정이 이미 한다.
  if (view === null) {
    return (
      <View testID="widget-representative-character" className="flex-1 justify-center p-3">
        <Text fixed className="text-xs text-text-muted">추적 중인 캐릭터가 없습니다</Text>
      </View>
    )
  }

  if (variant === 'compact') {
    return (
      // 간격이 8이면 세 줄 + EXP 가 164(2x2 높이)를 3px 넘긴다 — 내용을 빼는 대신 간격을 줄인다.
      <View testID="widget-representative-character" className="flex-1 items-center gap-1.5 p-3">
        <Portrait view={view} sizePx={VARIANT.compact.portraitPx} />
        <Lines view={view} variant="compact" center />
        <ExpBlock view={view} variant="compact" />
      </View>
    )
  }

  if (variant === 'large') {
    return (
      <View testID="widget-representative-character" className="flex-1 justify-center gap-3 p-3">
        <View className="flex-row items-center gap-3">
          <Portrait view={view} sizePx={VARIANT.large.portraitPx} />
          <Lines view={view} variant="large" center={false} />
        </View>
        <ExpBlock view={view} variant="large" />
      </View>
    )
  }

  return (
    <View testID="widget-representative-character" className="flex-1 flex-row items-center gap-2.5 p-3">
      <Portrait view={view} sizePx={VARIANT.row.portraitPx} />
      <Lines view={view} variant="row" center={false} />
      <ExpBlock view={view} variant="row" />
    </View>
  )
}
