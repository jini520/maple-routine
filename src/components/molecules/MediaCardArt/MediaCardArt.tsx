// 일러스트 카드의 bleed 레이어와 껍데기 — **값과 기하는 `media-card-art.ts` 가 갖는다**(그 파일
// 머리에 CSS 배경 → RN 변환의 근거가 전부 있다). 여기는 그것을 그리는 두 컴포넌트뿐이다.
import { MEDIA_ART_OPACITY } from '@core/lib/media-card'
import type { ImageAssetRef } from '@core/types/image-asset'
import { Image, View } from 'react-native'
import { vars } from 'nativewind'

import { withAlpha } from '../../../lib/color-alpha'
import { LinearGradient } from '../../../lib/nativewind-interop'
import { useThemeAppearance } from '../../../theme/context'
import { buildMediaScopeVariables } from '../../../theme/theme-vars'
import { Card } from '../../atoms/Card/Card'
import {
  MEDIA_ART_FILTER_STYLE,
  MEDIA_ART_VEIL_ALPHAS,
  MEDIA_ART_VEIL_LOCATIONS,
  mediaArtImageStyle,
  mediaArtNaturalSize,
  resolveMediaArtLayout,
  type MediaArtCrop,
  type MediaArtVariant,
} from './media-card-art'

export interface MediaCardArtProps {
  /** 없으면 **아무것도 그리지 않는다** — 웹이 아트 `div` 자체를 안 그리던 것과 같다. */
  source: ImageAssetRef | null
  crop: MediaArtCrop
  /** 페이드 끝점을 고른다 — 기본은 카드(`MEDIA_ART_MASK_CARD`), 모달 히어로는 `'hero'`. */
  variant?: MediaArtVariant
}

export function MediaCardArt(props: MediaCardArtProps): React.JSX.Element | null {
  const { definition } = useThemeAppearance()
  if (props.source === null) return null

  const veilLocations = MEDIA_ART_VEIL_LOCATIONS[props.variant ?? 'card']
  const layout = resolveMediaArtLayout(props.crop, mediaArtNaturalSize(props.source))
  // 베일은 카드 자신의 표면색이어야 한다 — 이 카드가 `.media-scope` 안이라 그 값은 `surface` 가
  // 아니라 `mediaSurface` 다([[ADR-064]] 결정 5). 클래스로는 못 낸다(그라데이션 색은 값이다).
  const veil = definition.mediaSurface

  return (
    <>
      {/* 색 처리(`filter`)와 투명도는 **감싸는 View 가 진다** — RN 의 `ImageStyle` 에는 `filter` 가
          없고 `ViewStyle` 에만 있다(실측: tsc 가 `Array.prototype.filter` 로 읽어 거부한다). 웹도
          같은 모양이었다(배경 이미지를 얹은 `div` 하나가 필터·투명도·마스크를 전부 졌다). 이
          래퍼가 카드와 같은 상자라, 안쪽 `<Image>` 의 퍼센트가 여전히 **카드 기준**으로 풀린다. */}
      <View
        testID="media-card-art"
        aria-hidden
        pointerEvents="none"
        className="absolute inset-0"
        style={{ opacity: MEDIA_ART_OPACITY, filter: [...MEDIA_ART_FILTER_STYLE] }}
      >
        <Image
          source={props.source}
          // 상자를 종횡비로 이미 맞췄으므로 `stretch` 가 왜곡을 만들지 않는다 — `contain` 은 반올림
          // 오차에서 레터박스를 남기고 `cover` 는 반대로 잘라낸다.
          resizeMode={layout.kind === 'cover' ? 'cover' : 'stretch'}
          style={mediaArtImageStyle(layout)}
        />
      </View>

      <LinearGradient
        testID="media-card-art-veil"
        aria-hidden
        pointerEvents="none"
        className="absolute inset-0"
        colors={[
          withAlpha(veil, MEDIA_ART_VEIL_ALPHAS[0]),
          withAlpha(veil, MEDIA_ART_VEIL_ALPHAS[1]),
          withAlpha(veil, MEDIA_ART_VEIL_ALPHAS[2]),
          withAlpha(veil, MEDIA_ART_VEIL_ALPHAS[3]),
        ]}
        locations={[...veilLocations]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
    </>
  )
}

export interface MediaCardProps {
  /** 카드 토큰(`rounded-[14px] border bg-surface`) **위에** 얹는 레이아웃 — 보통 높이와 클리핑. */
  className?: string
  children: React.ReactNode
  testID?: string
}

/**
 * 일러스트 카드의 껍데기 — 웹의 `<Card className="media-scope …">` 한 줄이다.
 *
 * **`MediaScope` 를 쓰지 않는 이유**는 그 컴포넌트가 벌거벗은 `View` 를 그려서, 여기서 쓰면 카드
 * 토큰 문자열(`rounded-[14px] border border-border bg-surface`)을 다시 적게 되기 때문이다 —
 * [[ADR-094]] 결정 3 이 `Card` atom 으로 모은 바로 그 값이다. 대신 `Card` 에 같은 변수를 얹는다:
 * 스코프의 내용은 여전히 `buildMediaScopeVariables` 한 곳에서 오므로([[ADR-064]] 결정 5) 진실이
 * 갈리지 않고, `MediaScope` 와 렌더 결과도 같다(둘 다 `className` + `vars()` 를 단 View 하나다).
 */
export function MediaCard(props: MediaCardProps): React.JSX.Element {
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
