/**
 * 위젯 1. 대표 캐릭터의 초상화 · 이름 · 레벨 · 직업 · 길드 · EXP 를 그리는 타일.
 *
 * 초상화 오른쪽 열에 닉네임 줄 · 레벨 줄 · EXP 칸을 쌓는다. EXP 칸은 이 열과 같은 폭이다. 오른쪽 끝의
 * 좁은 열에 두면 바가 짧아 진행이 잘 안 보인다. 자리가 모자라면 길드가 아니라 **닉네임이 줄어든다**.
 * 길드는 잘리면 다른 길드로 읽히고, 닉네임은 초상화가 이미 누구인지 말한다.
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
import { CharacterAvatar } from '../../../components/molecules/CharacterAvatar/CharacterAvatar'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { RepresentativeView } from '../view-model'
import type { WidgetProps } from './types'

/** 초상화. 오른쪽 열이 세 줄(닉네임 · 레벨 · EXP 칸)이라 그 높이에 맞춘다 */
const PORTRAIT_PX = 52
const EMBLEM_PX = 15

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
      <CharacterAvatar
        imageTestID="representative-face"
        imageUrl={view.imageUrl}
        name={view.name}
        size={PORTRAIT_PX}
        className="shrink-0"
        unavailable={view.unavailable}
      />
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
