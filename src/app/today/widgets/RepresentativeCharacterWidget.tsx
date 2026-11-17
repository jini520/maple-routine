/**
 * 위젯 1. 대표 캐릭터의 전신 그림 · 이름 · 레벨 · 직업 · 길드 · EXP 를 그리는 타일.
 *
 * 전신 그림은 그 캐릭터가 고른 행동과 표정을 이어 간다. 그림 칸을 누르면 고르는 시트가 열린다.
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

import { useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import { worldEmblemUrl } from '../../../lib/assets/asset-lookup'
import { worldNameOf } from '../../../lib/world/worlds'

import { ProgressBar, Text } from '../../../components/atoms'
import { UnavailableBadge } from '../../../components/molecules/UnavailableBadge/UnavailableBadge'
import { useAppFocused } from '../../../hooks/useAppFocused'
import { useScreenFocused } from '../../../hooks/useScreenFocused'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { FigureMotionSheet } from '../FigureMotionSheet'
import type { LookFrame } from '../../../types/figure-motion'
import type { RepresentativeView } from '../view-model'
import { SHEET_FRAMES } from './figure-motion'
import { FIGURE_HEIGHT, FIGURE_WIDTH, RepresentativeFigure } from './RepresentativeFigure'
import type { WidgetProps } from './types'
import { useFigureReady, useLookFramesReady } from './useFigureStep'

const EMBLEM_PX = 15
const NO_FRAMES: readonly LookFrame[] = []

function Figure(props: { view: RepresentativeView; onOpen: () => void }): React.JSX.Element {
  const screenFocused = useScreenFocused()
  const appFocused = useAppFocused()
  const reduceMotion = useReducedMotion()
  const view = props.view
  const ready = useFigureReady(view.imageUrl, view.motion, view.unavailable)
  // 시트의 칸 그림은 조합이 없어 캐릭터마다 일정하다. 시트를 열기 전에, 위젯 그림 다음으로 받아 둔다.
  useLookFramesReady(view.unavailable ? null : view.imageUrl, ready || reduceMotion ? SHEET_FRAMES : NO_FRAMES)

  return (
    // 왼쪽을 4 더 띄워 카드 끝에서 16 이다. 오른쪽 열과의 간격(16)과 같게 맞춘다(사용자 지정).
    // 휘두르는 무기는 글자 위로 지나간다(사용자 지정). 그래서 이 상자가 오른쪽 열보다 위에 선다.
    <View
      testID="representative-figure-box"
      style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT, zIndex: 1 }}
      className="ml-1 shrink-0"
    >
      {/* 누르는 곳은 그림 칸뿐이다. 실루엣은 멈춰 서 있어 고른 동작을 보여 줄 수 없다. */}
      {!view.unavailable && (
        <Pressable
          testID="representative-figure-press"
          role="button"
          aria-label="대표 캐릭터 동작"
          onPress={props.onOpen}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* 그림은 터치를 받지 않는다. 받으면 글자 위로 나간 무기를 눌러도 시트가 열린다. */}
      <View testID="representative-figure-layer" pointerEvents="none" style={StyleSheet.absoluteFill}>
        <RepresentativeFigure
          name={view.name}
          imageUrl={view.imageUrl}
          unavailable={view.unavailable}
          motion={view.motion}
          active={screenFocused && appFocused}
          ready={ready}
          testIdPrefix="representative-figure"
        />
      </View>
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
      <Text className="shrink-0 text-11 leading-tight text-text-muted">{`Lv. ${props.view.level}`}</Text>
      {props.view.jobClass !== undefined && (
        <Text
          testID="representative-job"
          numberOfLines={1}
          className="min-w-0 shrink text-11 leading-tight text-text-muted"
        >
          {props.view.jobClass}
        </Text>
      )}
    </View>
  )
}

function ExpBlock(props: { view: RepresentativeView }): React.JSX.Element | null {
  const rate = props.view.expRate
  // 조회를 못 하면 보여 줄 EXP 가 없다. 굳은 바가 서 있으면 지금의 진행도로 읽힌다.
  if (props.view.unavailable || rate === undefined) return null
  return (
    <View testID="representative-exp" className="flex-row items-center gap-2 rounded-[10px] bg-card-inset px-2.5 py-1.5">
      <Text className="text-11 text-text-muted">EXP</Text>
      <View className="min-w-0 flex-1">
        <ProgressBar percent={rate} aria={{ now: rate, max: 100 }} />
      </View>
      <Text numberOfLines={1} style={TABULAR_NUMS} className="text-xs font-bold text-text">
        {formatExpRate(rate)}
      </Text>
    </View>
  )
}

export function RepresentativeCharacterWidget({ data }: WidgetProps): React.JSX.Element {
  const view = data.representative
  const [picking, setPicking] = useState(false)

  if (view === null) {
    return (
      <View testID="widget-representative-character" className="grow justify-center p-3">
        <Text className="text-11 text-text-muted">추적 중인 캐릭터가 없습니다</Text>
      </View>
    )
  }

  return (
    <View testID="widget-representative-character" className="grow flex-row items-center gap-4 p-3">
      <Figure view={view} onOpen={() => setPicking(true)} />
      <View testID="representative-lines" className="min-w-0 flex-1 gap-1.5">
        <View className="gap-0.5">
          <NameLine view={view} />
          <CaptionLine view={view} />
        </View>
        <ExpBlock view={view} />
      </View>
      {/* 글자 열 밖에 서야 닉네임 · 레벨 줄이 알약 폭만큼 비켜 선다. 누를 것은 없다. 이 카드에는
          열 팝오버가 없다. */}
      {view.unavailable && (
        <UnavailableBadge testID="representative-issue" label="조회 불가" className="self-start" />
      )}
      {picking && (
        <FigureMotionSheet
          ocid={view.ocid}
          name={view.name}
          imageUrl={view.imageUrl}
          motion={view.motion}
          onClose={() => setPicking(false)}
        />
      )}
    </View>
  )
}
