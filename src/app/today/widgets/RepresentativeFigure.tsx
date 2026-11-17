/**
 * 대표 캐릭터의 전신 그림. 위젯과 동작 고르기 시트의 미리보기가 같은 크기로 쓴다.
 *
 * 고른 행동 · 표정의 그림을 다 받으면 움직이고, 못 받았거나 움직일 수 없으면 기본 그림 한 장으로 선다.
 */
import { Image as CachedImage } from 'expo-image'
import { Image, View } from 'react-native'

import { unknownCharacterAsset } from '../../../lib/assets/asset-lookup'
import { lookFrameKey, lookFrameUrl } from '../../../lib/character-look'
import { FIGURE_BOX, figureCropStyle } from '../../../lib/figure-crop'
import type { FigureMotion, LookFrame } from '../../../types/figure-motion'
import { FIGURE_CACHE_POLICY, useFigureSteps } from './useFigureStep'

/** 전신 그림 높이. 오른쪽 열이 세 줄(닉네임 · 레벨 · EXP 칸)이라 그 높이에 맞춘다 */
export const FIGURE_HEIGHT = 76
const FIGURE_SCALE = FIGURE_HEIGHT / FIGURE_BOX.height
/** 그림 자리 폭에서 칸 좌우를 빼는 몫. 단상 칸은 무기가 들어갈 만큼 넓어 이 좁은 자리에서는 캐릭터 양옆이 빈다 */
const FIGURE_SIDE_TRIM = 0.2
export const FIGURE_WIDTH = FIGURE_BOX.width * (1 - FIGURE_SIDE_TRIM * 2) * FIGURE_SCALE
/** 칸을 아래로 내리는 거리(그림 px). 넥슨 그림의 캐릭터는 칸 바닥(발끝)에 붙어 서서, 칸 그대로면 머리 위만 빈다 */
const FIGURE_DROP = 10
const FIGURE_CROP = figureCropStyle(FIGURE_SCALE, true)
/** 조회 불가면 서는 흰 실루엣의 칸. 전신 그림과 같은 몫을 빼고 같은 거리만큼 내려야 발이 같은 줄에 닿는다 */
const SILHOUETTE_CROP = figureCropStyle(FIGURE_SCALE, false)

const SIDE_TRIM_PX = FIGURE_BOX.width * FIGURE_SIDE_TRIM * FIGURE_SCALE
const DROP_PX = FIGURE_DROP * FIGURE_SCALE
const FIGURE_LEFT = FIGURE_CROP.left - SIDE_TRIM_PX
const FIGURE_TOP = FIGURE_CROP.top - DROP_PX

export interface RepresentativeFigureProps {
  name: string
  imageUrl: string
  unavailable: boolean
  motion: FigureMotion
  /** 화면이나 앱이 안 보이면 거짓. 멈춘다 */
  active: boolean
  /** 고른 값의 그림을 다 받았으면 참. 거짓이면 기본 그림 한 장으로 선다 */
  ready: boolean
  /** 그림마다 붙는 testID 의 앞부분 */
  testIdPrefix: string
}

/** 멈춰 있을 때 서는 그림. 고른 첫 행동의 첫 장이다 */
function stillFrameOf(motion: FigureMotion): LookFrame {
  return { action: motion.actions[0], frame: 0, emotion: motion.emotions[0], emotionFrame: 0 }
}

/** 그림 전부를 겹쳐 깔고 지금 칸만 보이는 층. 주소를 그때 바꾸면 그림을 다시 그리는 동안 깜빡인다 */
function FigureFrames(props: RepresentativeFigureProps): React.JSX.Element {
  const { step, layers } = useFigureSteps(props.active, props.motion)
  const still = stillFrameOf(props.motion)
  const shownKey = lookFrameKey(step?.frame ?? still)
  const stack = layers.length > 0 ? layers : [still]

  return (
    <View
      testID={`${props.testIdPrefix}-frame`}
      // 뒤집은 뒤에 올린다. 뒤집기 전에 올려도 위아래는 같지만, 순서를 고정해야 값을 읽기 쉽다.
      style={{
        width: FIGURE_WIDTH,
        height: FIGURE_HEIGHT,
        overflow: 'visible',
        transform: [{ translateY: -(step?.liftPx ?? 0) }, { scaleX: -1 }],
      }}
    >
      {stack.map((frame, index) => {
        const key = lookFrameKey(frame)
        return (
          <CachedImage
            key={key}
            testID={`${props.testIdPrefix}-${key}`}
            accessibilityLabel={index === 0 ? props.name : undefined}
            source={{ uri: lookFrameUrl(props.imageUrl, frame) }}
            cachePolicy={FIGURE_CACHE_POLICY}
            contentFit="fill"
            style={{ position: 'absolute', ...FIGURE_CROP, left: FIGURE_LEFT, top: FIGURE_TOP, opacity: key === shownKey ? 1 : 0 }}
          />
        )
      })}
    </View>
  )
}

/** 멈춘 전신 그림. 통계 단상과 같은 칸에 서고 칸 밖도 자르지 않는다. 조회 불가면 흰 실루엣이 같은 칸에 선다 */
function StillFigure(props: RepresentativeFigureProps): React.JSX.Element {
  return (
    <View
      testID={`${props.testIdPrefix}-frame`}
      style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT, transform: [{ scaleX: -1 }] }}
    >
      {props.unavailable ? (
        <Image
          testID={`${props.testIdPrefix}-unknown`}
          accessibilityLabel={props.name}
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
          testID={props.testIdPrefix}
          accessibilityLabel={props.name}
          source={{ uri: props.imageUrl }}
          style={{ position: 'absolute', ...FIGURE_CROP, left: FIGURE_LEFT, top: FIGURE_TOP }}
        />
      )}
    </View>
  )
}

/** 좌우를 뒤집어 캐릭터가 오른쪽(닉네임 · 레벨)을 바라보게 한다. 빼는 몫이 좌우 같아 칸은 그대로다 */
export function RepresentativeFigure(props: RepresentativeFigureProps): React.JSX.Element {
  return props.ready && !props.unavailable ? <FigureFrames {...props} /> : <StillFigure {...props} />
}

