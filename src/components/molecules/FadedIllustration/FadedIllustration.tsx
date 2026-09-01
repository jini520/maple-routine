/**
 * 일러스트 카드의 두 부품. 크롭 기하는 `lib/image-crop.ts` 가 갖는다.
 *
 * @see [[ADR-018]] 결정 8 — bleed 레시피(38%/76% 페이드 · 블러 없음)
 * @see [[ADR-064]] 결정 5 — 카드 안은 색 기준이 `media-scope` 로 갈린다
 */
import { MEDIA_ART_OPACITY } from '../../../lib/media-card'
import type { ImageAssetRef } from '../../../types/image-asset'
import { Image, View } from 'react-native'
import { vars } from 'nativewind'

import { withAlpha } from '../../../lib/color-alpha'
import { LinearGradient } from '../../../lib/nativewind-interop'
import { useThemeAppearance } from '../../../theme/context'
import { buildMediaScopeVariables } from '../../../theme/theme-vars'
import { Card } from '../../atoms'
import { imageNaturalSize } from '../../../lib/image-aspect'
import { imageCropStyle, resolveImageCropLayout, type ImageCrop } from '../../../lib/image-crop'
/**
 * 웹 `MEDIA_ART_FILTER`(`saturate(.85) brightness(.8)`)의 RN 짝. CSS 문자열을 런타임에 파싱하지 않고
 * 값으로 적는다. 두 벌이 어긋나는 것은 테스트가 `lib/media-card` 의 원본과 대조해 막는다.
 */
const VEIL_FILTER = [{ saturate: 0.85 }, { brightness: 0.8 }]

/**
 * 베일 그라데이션. `lib/media-card` 의 웹 마스크를 **뒤집은** 값이라, 마스크가 1인 구간이 덧칠 0 이다.
 *
 * RN 에는 마스크가 없다. 대신 카드 표면색을 반대 알파로 덧칠하면 **같은 색이 나온다**(근사가 아니다).
 * 마스크 알파를 m 이라 할 때 `bg(1−0.65m) + art·0.65m` 와 `[bg(1−0.65) + art·0.65]` 위에 알파 `1−m`
 * 로 `bg` 를 얹은 것이 같은 식이다.
 *
 * 마지막 정지점 `1` 은 웹에 없다. `expo-linear-gradient` 가 정지점 **사이만** 보간해서, 안 적으면
 * 끝점 뒤가 안 덮인다. 알파는 두 자리가 같고 갈리는 것은 정지점뿐이다.
 */
const VEIL_ALPHAS = [0, 0, 1, 1]
const VEIL_LOCATIONS = {
  card: [0, 0.38, 0.76, 1],
  hero: [0, 0.42, 0.82, 1],
} as const

/** 정지점을 고르는 축. 히어로는 넓고 낮아 카드 값을 쓰면 그림이 너무 일찍 끊긴다. */
export type IllustrationVariant = keyof typeof VEIL_LOCATIONS

export interface FadedIllustrationProps {
  /** `null` 이면 아무것도 안 그린다. */
  source: ImageAssetRef | null
  crop: ImageCrop
  /** 페이드 끝점. 기본은 카드, 모달 히어로는 `'hero'`. */
  variant?: IllustrationVariant
}

export function FadedIllustration(props: FadedIllustrationProps): React.JSX.Element | null {
  const { definition } = useThemeAppearance()
  if (props.source === null) return null

  const veilLocations = VEIL_LOCATIONS[props.variant ?? 'card']
  const layout = resolveImageCropLayout(props.crop, imageNaturalSize(props.source))
  // 카드 안이라 표면색이 `surface` 가 아니라 `mediaSurface` 다. 그라데이션 색은 값이라 클래스로 못 낸다.
  const veil = definition.mediaSurface

  return (
    <>
      {/* `filter` 와 투명도를 감싸는 View 가 진다. RN 은 `filter` 가 `ViewStyle` 에만 있다.
          이 래퍼가 카드와 같은 상자라 안쪽 `<Image>` 의 퍼센트는 여전히 카드 기준으로 풀린다. */}
      <View
        testID="faded-illustration"
        aria-hidden
        pointerEvents="none"
        className="absolute inset-0"
        style={{ opacity: MEDIA_ART_OPACITY, filter: VEIL_FILTER }}
      >
        <Image
          source={props.source}
          // 상자를 종횡비로 이미 맞췄다. `contain` 은 반올림 오차에서 레터박스를 남기고 `cover` 는 잘라낸다.
          resizeMode={layout.kind === 'cover' ? 'cover' : 'stretch'}
          style={imageCropStyle(layout)}
        />
      </View>

      <LinearGradient
        testID="faded-illustration-veil"
        aria-hidden
        pointerEvents="none"
        className="absolute inset-0"
        colors={[
          withAlpha(veil, VEIL_ALPHAS[0]),
          withAlpha(veil, VEIL_ALPHAS[1]),
          withAlpha(veil, VEIL_ALPHAS[2]),
          withAlpha(veil, VEIL_ALPHAS[3]),
        ]}
        locations={[...veilLocations]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
    </>
  )
}

export interface IllustratedCardProps {
  /** 카드 토큰 위에 얹는 레이아웃. 보통 높이와 `overflow-hidden` 이다. */
  className?: string
  children: React.ReactNode
  testID?: string
}

/**
 * 일러스트가 깔릴 카드. `Card` 에 `media-scope` 변수를 얹어 안쪽 색 기준을 바꾼다.
 *
 * `MediaScope` 를 안 쓰는 이유는 그것이 벌거벗은 `View` 라, 여기서 쓰면 [[ADR-094]] 결정 3 이
 * `Card` atom 으로 모아 둔 카드 토큰을 다시 적게 되기 때문이다. 변수는 어느 쪽이든
 * `buildMediaScopeVariables` 한 곳에서 온다.
 */
export function IllustratedCard(props: IllustratedCardProps): React.JSX.Element {
  const { definition } = useThemeAppearance()

  return (
    <Card
      testID={props.testID}
      className={props.className}
      style={vars(buildMediaScopeVariables(definition))}
    >
      {props.children}
    </Card>
  )
}
