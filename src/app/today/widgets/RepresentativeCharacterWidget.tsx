/**
 * 위젯 1. 대표 캐릭터의 전신 그림 · 이름 · 레벨 · 직업 · 길드 · EXP 를 그리는 타일.
 *
 * 전신 그림 오른쪽 열에 닉네임 줄 · 레벨 줄 · EXP 칸을 쌓는다. EXP 칸은 이 열과 같은 폭이다. 오른쪽 끝의
 * 좁은 열에 두면 바가 짧아 진행이 잘 안 보인다. 자리가 모자라면 길드가 아니라 **닉네임이 줄어든다**.
 * 길드는 잘리면 다른 길드로 읽히고, 닉네임은 그림이 이미 누구인지 말한다.
 *
 * 없는 것은 안 그린다. `expRate` 가 없으면 EXP 칸 자체를 빼고(0% 바는 경험치가 0 으로 읽힌다),
 * 엠블럼 · 직업 · 길드도 모르면 그 자리를 비운다. `대표 없음` 상태는 없다. 미지정이면
 * `resolveDisplayRepresentative` 가 목록의 첫 번째를 세우고, `null` 은 추적 캐릭터가 하나도 없을
 * 때뿐이다.
 *
 * 진행률의 소수 3자리는 **API 가 준 그대로**다. 반올림하면 `99.999%` 가 `100%` 가 되어 다 찼다고
 * 거짓을 말한다.
 */

import { Image, View } from 'react-native'

import { worldEmblemUrl } from '../../../lib/assets/asset-lookup'
import { worldNameOf } from '../../../lib/world/worlds'

import { ProgressBar, Text } from '../../../components/atoms'
import { UnavailableBadge } from '../../../components/molecules/UnavailableBadge/UnavailableBadge'
import { UnavailableFaceMark } from '../../../components/molecules/CharacterAvatar/UnavailableFaceMark'
import { FIGURE_BOX, figureCropStyle } from '../../../lib/figure-crop'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { RepresentativeView } from '../view-model'
import type { WidgetProps } from './types'

/** 전신 그림 높이. 오른쪽 열이 세 줄(닉네임 · 레벨 · EXP 칸)이라 그 높이에 맞춘다 */
const FIGURE_HEIGHT = 76
const FIGURE_SCALE = FIGURE_HEIGHT / FIGURE_BOX.height
/** 칸 좌우에서 잘라 내는 몫. 단상 칸은 무기가 들어갈 만큼 넓어 이 좁은 자리에서는 캐릭터 양옆이 빈다 */
const FIGURE_SIDE_TRIM = 0.2
const FIGURE_WIDTH = FIGURE_BOX.width * (1 - FIGURE_SIDE_TRIM * 2) * FIGURE_SCALE
/** 자르는 칸을 아래로 내리는 거리(그림 px). 넥슨 그림의 캐릭터는 칸 바닥(발끝)에 붙어 서서, 칸 그대로면 머리 위만 빈다 */
const FIGURE_DROP = 10
const FIGURE_CROP = figureCropStyle(FIGURE_SCALE, true)
const MARK_PX = 16
const EMBLEM_PX = 15

/** 전신 그림. 통계 단상과 같은 칸을 자른다 */
function Figure(props: { view: RepresentativeView }): React.JSX.Element {
  return (
    // 왼쪽을 더 띄운다. 칸 좌우를 잘라 캐릭터가 카드 여백(12)에 거의 붙는다
    <View style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT }} className="ml-2 shrink-0">
      {/* 좌우를 뒤집어 캐릭터가 오른쪽 열(닉네임 · 레벨)을 바라보게 한다(사용자 지정). 자르는 몫이 좌우 같아 칸은 그대로다. */}
      <View
        testID="representative-figure-frame"
        style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT, overflow: 'hidden', transform: [{ scaleX: -1 }] }}
      >
        <Image
          testID="representative-figure"
          accessibilityLabel={props.view.name}
          source={{ uri: props.view.imageUrl }}
          style={{
            position: 'absolute',
            ...FIGURE_CROP,
            left: FIGURE_CROP.left - FIGURE_BOX.width * FIGURE_SIDE_TRIM * FIGURE_SCALE,
            top: FIGURE_CROP.top - FIGURE_DROP * FIGURE_SCALE,
          }}
        />
      </View>
      {props.view.unavailable && (
        <View className="absolute bottom-0 right-0">
          <UnavailableFaceMark size={MARK_PX} />
        </View>
      )}
    </View>
  )
}

function formatExpRate(rate: number): string {
  return `${rate.toFixed(3)}%`
}

function NameLine(props: { view: RepresentativeView }): React.JSX.Element {
  const emblem = worldEmblemUrl(props.view.worldKey)
  return (
    <View testID="representative-name-line" className="flex-row items-center gap-1">
      {emblem !== null && (
        <View testID="representative-emblem" className="shrink-0">
          <Image
            accessibilityLabel={worldNameOf(props.view.worldKey, '')}
            source={emblem}
            style={naturalAspectStyle(emblem, { height: EMBLEM_PX })}
            resizeMode="contain"
          />
        </View>
      )}
      <Text
        testID="representative-name"
        numberOfLines={1}
        className="min-w-0 shrink text-sm font-semibold leading-tight text-text"
      >
        {props.view.name}
      </Text>
      {/* 길드는 모르는 것(undefined)과 미가입(null)이 둘 다 그릴 것이 없다. 이 카드가 가르는
          자리는 아니라 둘 다 비운다. */}
      {props.view.guildName !== undefined && props.view.guildName !== null && (
        <Text testID="representative-guild" numberOfLines={1} className="shrink-0 text-11 leading-tight text-text-muted">
          {props.view.guildName}
        </Text>
      )}
    </View>
  )
}

function CaptionLine(props: { view: RepresentativeView }): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="shrink-0 text-[11.5px] leading-tight text-text-muted">{`Lv. ${props.view.level}`}</Text>
      {props.view.jobClass !== undefined && (
        <Text
          testID="representative-job"
          numberOfLines={1}
          className="min-w-0 shrink text-[11.5px] leading-tight text-text-muted"
        >
          {props.view.jobClass}
        </Text>
      )}
    </View>
  )
}

function ExpBlock(props: { view: RepresentativeView }): React.JSX.Element | null {
  const rate = props.view.expRate
  if (props.view.unavailable) {
    return (
      <View testID="representative-issue-block" className="items-start rounded-[10px] bg-card-inset px-2.5 py-1.5">
        {/* 보스 수익의 금액 자리에 서는 것과 **같은 알약**이다(사용자 지정). 그쪽도 여기도
            금액을 말할 수 없어 그 칸을 대신 차지한 것이라 같은 말이 같은 그림으로 선다.
            누를 것은 없다. 이 카드에는 열 팝오버가 없다. */}
        <UnavailableBadge testID="representative-issue" label="조회 불가" />
      </View>
    )
  }
  if (rate === undefined) return null
  return (
    <View testID="representative-exp" className="flex-row items-center gap-2 rounded-[10px] bg-card-inset px-2.5 py-1.5">
      <Text className="text-11 font-semibold text-text-muted">EXP</Text>
      <View className="min-w-0 flex-1">
        <ProgressBar percent={rate} aria={{ now: rate, max: 100 }} />
      </View>
      <Text numberOfLines={1} style={TABULAR_NUMS} className="text-11 font-semibold text-text">
        {formatExpRate(rate)}
      </Text>
    </View>
  )
}

export function RepresentativeCharacterWidget({ data }: WidgetProps): React.JSX.Element {
  const view = data.representative

  if (view === null) {
    return (
      <View testID="widget-representative-character" className="grow justify-center p-3">
        <Text className="text-13 text-text-muted">추적 중인 캐릭터가 없습니다</Text>
      </View>
    )
  }

  return (
    <View testID="widget-representative-character" className="grow flex-row items-center gap-3 p-3">
      <Figure view={view} />
      <View testID="representative-lines" className="min-w-0 flex-1 gap-1.5">
        <View className="gap-0.5">
          <NameLine view={view} />
          <CaptionLine view={view} />
        </View>
        <ExpBlock view={view} />
      </View>
    </View>
  )
}
