/**
 * 보스 얼굴 하나. 줄 안의 아바타이거나(보스 관리 · 보스 수익) 격자의 타일이다(가계부 처치 타일).
 *
 * 크롭 기하를 **여기서 다시 계산하지 않는다**(`lib/image-crop`). 카드 bleed 와 크롭 표만 다르고
 * 값의 형태가 같아, 변환이 두 벌이 되면 한쪽만 고쳐지는 사고가 열린다.
 *
 * `FadedIllustration` 과 달리 필터·투명도·베일이 없다. 이 그림은 글자 뒤로 안 깔린다.
 *
 * @see. 원형 아이콘 전용 크롭 표를 따로 두는 이유가 거기 있다.
 */
import { Image, View } from 'react-native'

import { getBossPortraitIconCrop, getBossPortraitUrl } from '../../../lib/assets/asset-lookup'
import { imageNaturalSize } from '../../../lib/image-aspect'
import { imageCropStyle, resolveImageCropLayout, type ImageCrop } from '../../../lib/image-crop'

import { Text } from '../../atoms'

export interface BossPortraitProps {
  portraitSlug: string | null
  /** 읽어 주는 이름. 그림이 없어도 붙는다. */
  label: string
  /** 상자 한 변(px). 기본 40. */
  size?: number
  /** 안 주면 `portraitSlug` 로 원형 아이콘 표에서 찾는다. */
  crop?: ImageCrop
  /**
   * 모서리 모양. 기본 원형은 줄 안의 아바타 자리이고, `'square'` 는 격자에 서는 타일이다.
   * 원이 격자로 서면 네 모서리가 비어 칸 사이가 성겨 보인다.
   *
   * @see. 이 프롭이 거기서 생겼다.
   */
  shape?: 'circle' | 'square'
}

export function BossPortrait(props: BossPortraitProps): React.JSX.Element {
  const size = props.size ?? 40
  // 플레이스홀더도 같은 모양을 쓴다. 그림 유무로 모서리가 갈리면 격자에서 그 칸만 튄다.
  const shapeClass = props.shape === 'square' ? 'rounded-lg' : 'rounded-full'
  const url = getBossPortraitUrl(props.portraitSlug)

  if (url === null) {
    return (
      <View
        testID="boss-portrait"
        accessibilityLabel={props.label}
        style={{ width: size, height: size }}
        className={`shrink-0 items-center justify-center bg-surface-2 ${shapeClass}`}
      >
        <Text className="text-xs text-text-muted">?</Text>
      </View>
    )
  }

  const crop = props.crop ?? getBossPortraitIconCrop(props.portraitSlug)
  const layout = resolveImageCropLayout(crop, imageNaturalSize(url))

  return (
    <View
      testID="boss-portrait"
      role="img"
      accessibilityLabel={props.label}
      style={{ width: size, height: size }}
      // RN 의 `<Image>` 는 자식이라 부모의 둥근 모서리가 저절로 안 자른다. 명시적으로 잘라야 한다.
      className={`shrink-0 overflow-hidden ${shapeClass}`}
    >
      <Image
        testID="boss-portrait-image"
        source={url}
        // 상자를 종횡비로 이미 맞췄다. `contain` 은 반올림 오차에서 레터박스를 남기고 `cover` 는 잘라낸다.
        resizeMode={layout.kind === 'cover' ? 'cover' : 'stretch'}
        style={imageCropStyle(layout)}
      />
    </View>
  )
}
