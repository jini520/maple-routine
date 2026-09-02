/**
 * 한 축만 정하고 나머지는 그림이 정하게 하는 스타일 생성기. 호출부는 월드 엠블럼 셋과 안내 이미지다.
 *
 * RN 의 `<Image>` 는 **안 적은 축에 그림의 고유 픽셀 크기를 남긴다**. 두 축이 다 정해지면 Yoga 가
 * `aspectRatio` 를 안 쓰므로 그림이 일그러지고, `resizeMode` 를 무엇으로 바꿔도 안 낫는다.
 *
 * 그래서 나머지 축에 **명시적 `undefined`** 를 적는다. 안 적는 것과 다르다. RN 의 스타일 병합이
 * 그것을 앞의 값을 지우는 값으로 읽어서, 지워진 축이 auto 가 되고 그제야 `aspectRatio` 가 그 자리를
 * 채운다. NativeWind 도 그 키를 보존한다(실측).
 *
 * @see src/lib/image-crop.ts 크롭 표의 퍼센트 기하를 풀 때 `imageNaturalSize` 를 그대로 쓴다
 */
import { Image, type ImageStyle } from 'react-native'

import type { ImageAssetRef } from '../types/image-asset'

/** 그림의 고유 픽셀 크기. */
export interface ImageNaturalSize {
  width: number
  height: number
}

/**
 * 번들 에셋의 고유 픽셀 크기. 모르면 `null`.
 *
 * 검사가 `<= 0` 이 아니라 **`Number.isFinite`** 인 것은 `resolveImageCropLayout` 이 밟은 자리와 같다.
 * `undefined <= 0` 은 **false** 라 크기 없는 소스가 가드를 통과하면 `aspectRatio: NaN` 이 나가고,
 * NaN 은 에러가 아니라 **레이아웃이 조용히 무너지는 값**이다.
 */
export function imageNaturalSize(source: ImageAssetRef): ImageNaturalSize | null {
  const resolved = Image.resolveAssetSource(source)
  if (resolved === null || resolved === undefined) return null
  if (!Number.isFinite(resolved.width) || resolved.width <= 0) return null
  if (!Number.isFinite(resolved.height) || resolved.height <= 0) return null
  return { width: resolved.width, height: resolved.height }
}

/** 퍼센트도 받는다. 부모를 재지 않고 그대로 넘긴다(`image-crop.ts` 와 같은 이유). */
type AxisValue = number | `${number}%`

/** 정하는 축 **하나**. 둘을 주면 나머지 축을 그림이 정한다는 말 자체가 성립하지 않는다. */
export type NaturalAspectAxis = { width: AxisValue } | { height: AxisValue }

/**
 * 준 축을 그대로 두고 **나머지 축을 지운 뒤** 그림의 종횡비를 얹는다.
 *
 *     naturalAspectStyle(엠블럼, { height: 17 })   → { height: 17, width: undefined, aspectRatio: .92 }
 *     naturalAspectStyle(안내이미지, { width: '100%' }) → { width: '100%', height: undefined, aspectRatio: 2.72 }
 *
 * 고유 크기를 모르면 **준 축만** 돌려준다. 그때는 소스에도 크기가 없다는 뜻이라(그것이 `null` 인
 * 이유다) 샐 것이 애초에 없고, 없는 값을 지우겠다고 `undefined` 를 적으면 무엇을 막고 있는지가
 * 안 읽힌다.
 */
export function naturalAspectStyle(source: ImageAssetRef, given: NaturalAspectAxis): ImageStyle {
  const natural = imageNaturalSize(source)
  if (natural === null) return { ...given }

  const aspectRatio = natural.width / natural.height
  return 'height' in given
    ? { height: given.height, width: undefined, aspectRatio }
    : { width: given.width, height: undefined, aspectRatio }
}
