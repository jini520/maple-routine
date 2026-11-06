/**
 * 위젯 1. 대표 캐릭터의 전신 그림 · 이름 · 레벨 · 직업 · 길드 · EXP 를 그리는 타일.
 *
 * 전신 그림은 다섯 동작을 무작위로 이어 간다. 고르는 규칙은 `figure-motion.ts` 가 든다.
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

import { Image as CachedImage } from 'expo-image'
import { Image, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import { unknownCharacterAsset, worldEmblemUrl } from '../../../lib/assets/asset-lookup'
import { worldNameOf } from '../../../lib/world/worlds'

import { ProgressBar, Text } from '../../../components/atoms'
import { UnavailableBadge } from '../../../components/molecules/UnavailableBadge/UnavailableBadge'
import { useAppFocused } from '../../../hooks/useAppFocused'
import { useScreenFocused } from '../../../hooks/useScreenFocused'
import { LOOK_FRAMES, lookFrameHeadShift, lookFrameUrl } from '../../../lib/character-look'
import { FIGURE_BOX, figureCropStyle } from '../../../lib/figure-crop'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { RepresentativeView } from '../view-model'
import type { WidgetProps } from './types'
import { FIGURE_CACHE_POLICY, useFigureStep, useLookFramesReady } from './useFigureStep'

/** 전신 그림 높이. 오른쪽 열이 세 줄(닉네임 · 레벨 · EXP 칸)이라 그 높이에 맞춘다 */
const FIGURE_HEIGHT = 76
const FIGURE_SCALE = FIGURE_HEIGHT / FIGURE_BOX.height
/** 칸 좌우에서 잘라 내는 몫. 단상 칸은 무기가 들어갈 만큼 넓어 이 좁은 자리에서는 캐릭터 양옆이 빈다 */
const FIGURE_SIDE_TRIM = 0.2
const FIGURE_WIDTH = FIGURE_BOX.width * (1 - FIGURE_SIDE_TRIM * 2) * FIGURE_SCALE
/** 자르는 칸을 아래로 내리는 거리(그림 px). 넥슨 그림의 캐릭터는 칸 바닥(발끝)에 붙어 서서, 칸 그대로면 머리 위만 빈다 */
const FIGURE_DROP = 10
const FIGURE_CROP = figureCropStyle(FIGURE_SCALE, true)
/** 조회 불가면 서는 흰 실루엣의 칸. 전신 그림과 같은 몫을 잘라 내고 같은 거리만큼 내려야 발이 같은 줄에 닿는다 */
const SILHOUETTE_CROP = figureCropStyle(FIGURE_SCALE, false)
const EMBLEM_PX = 15

const SIDE_TRIM_PX = FIGURE_BOX.width * FIGURE_SIDE_TRIM * FIGURE_SCALE
const DROP_PX = FIGURE_DROP * FIGURE_SCALE
const FIGURE_LEFT = FIGURE_CROP.left - SIDE_TRIM_PX
const FIGURE_TOP = FIGURE_CROP.top - DROP_PX

/** 프레임 전부를 겹쳐 깔고 지금 칸만 보이는 층. 주소를 그때 바꾸면 그림을 다시 그리는 동안 깜빡인다 */
function FigureFrames(props: { view: RepresentativeView }): React.JSX.Element {
  const screenFocused = useScreenFocused()
  const appFocused = useAppFocused()
  const step = useFigureStep(screenFocused && appFocused)
  const current = step?.frame ?? LOOK_FRAMES[0]

  return (
    <View
      testID="representative-figure-frame"
      // 뒤집은 뒤에 올린다. 뒤집기 전에 올려도 위아래는 같지만, 순서를 고정해야 값을 읽기 쉽다.
      style={{
        width: FIGURE_WIDTH,
        height: FIGURE_HEIGHT,
        overflow: 'visible',
        transform: [{ translateY: -(step?.liftPx ?? 0) }, { scaleX: -1 }],
      }}
    >
      {LOOK_FRAMES.map((frame, index) => (
        <CachedImage
          key={frame}
          testID={`representative-figure-${frame}`}
          accessibilityLabel={index === 0 ? props.view.name : undefined}
          source={{ uri: lookFrameUrl(props.view.imageUrl, frame) }}
          cachePolicy={FIGURE_CACHE_POLICY}
          contentFit="fill"
          style={{
            position: 'absolute',
            ...FIGURE_CROP,
            // 뒤집은 칸 안이라 그림 기준 값이다.
            left: FIGURE_LEFT - lookFrameHeadShift(frame) * FIGURE_SCALE,
            top: FIGURE_TOP,
            opacity: frame === current ? 1 : 0,
          }}
        />
      ))}
    </View>
  )
}

/** 전신 그림. 통계 단상과 같은 칸을 자른다. 조회 불가면 흰 실루엣이 같은 칸에 선다 */
function StillFigure(props: { view: RepresentativeView }): React.JSX.Element {
  const unavailable = props.view.unavailable
  return (
    <View
      testID="representative-figure-frame"
      style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT, overflow: 'hidden', transform: [{ scaleX: -1 }] }}
    >
      {unavailable ? (
        <Image
          testID="representative-figure-unknown"
          accessibilityLabel={props.view.name}
          source={unknownCharacterAsset() ?? undefined}
          style={{
            position: 'absolute',
            ...SILHOUETTE_CROP,
            left: SILHOUETTE_CROP.left - SIDE_TRIM_PX,
            top: SILHOUETTE_CROP.top - DROP_PX,
          }}
        />
      ) : (
        <Image
          testID="representative-figure"
          accessibilityLabel={props.view.name}
          source={{ uri: props.view.imageUrl }}
          style={{ position: 'absolute', ...FIGURE_CROP, left: FIGURE_LEFT, top: FIGURE_TOP }}
        />
      )}
    </View>
  )
}

function Figure(props: { view: RepresentativeView }): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const canMove = !props.view.unavailable && !reduceMotion
  const framesReady = useLookFramesReady(canMove ? props.view.imageUrl : null)

  return (
    // 왼쪽을 4 더 띄워 카드 끝에서 16 이다. 오른쪽 열과의 간격(16)과 같게 맞춘다(사용자 지정).
    // 휘두르는 무기는 글자 위로 지나간다(사용자 지정). 그래서 이 상자가 오른쪽 열보다 위에 선다.
    <View
      testID="representative-figure-box"
      pointerEvents="none"
      style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT, zIndex: 1 }}
      className="ml-1 shrink-0"
    >
      {/* 좌우를 뒤집어 캐릭터가 오른쪽 열(닉네임 · 레벨)을 바라보게 한다(사용자 지정). 자르는 몫이 좌우 같아 칸은 그대로다. */}
      {framesReady ? <FigureFrames view={props.view} /> : <StillFigure view={props.view} />}
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

  if (view === null) {
    return (
      <View testID="widget-representative-character" className="grow justify-center p-3">
        <Text className="text-11 text-text-muted">추적 중인 캐릭터가 없습니다</Text>
      </View>
    )
  }

  return (
    <View testID="widget-representative-character" className="grow flex-row items-center gap-4 p-3">
      <Figure view={view} />
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
    </View>
  )
}
