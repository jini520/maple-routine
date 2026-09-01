/**
 * 크롭 표 한 줄을 RN 의 절대 배치로 푼다.
 *
 * 크롭 표(`boss-portrait-crops` · `boss-portrait-icon-crops` · `daily-quest-region-crops`)는 CSS
 * `background-size`/`background-position` 문법인데, RN 에는 배경 이미지가 없어 `<Image>` 를 손으로
 * 앉혀야 한다. 그 변환이 여기 있다.
 *
 * 조회(`boss-icons` · `daily-quest-backgrounds`)와 그리기(`FadedIllustration` · `BossPortrait`)
 * **양쪽이 쓰기 때문에** `lib/` 에 있다. `components/` 에 두면 조회 쪽이 위 계층을 import 하게 된다.
 *
 * @see [[ADR-018]] 결정 8 · 9 — 크롭 표를 둔 이유와 표가 둘로 갈린 이유
 * @see [[ADR-135]] — 두 축을 다 이름 부른다
 */
import type { ImageStyle } from 'react-native'

import type { ImageNaturalSize } from './image-aspect'

/** 크롭 표의 한 줄. 조회 함수 셋이 이 모양을 돌려준다. */
export interface ImageCrop {
  size: string
  position: string
}

/** `cover` 는 크롭 표에 없는 슬러그의 기본값이자 고유 크기를 못 읽었을 때의 폴백이다. */
export type ImageCropLayout =
  | { kind: 'cover' }
  | {
      kind: 'sized'
      /** 부모 폭 기준. */
      width: `${number}%`
      aspectRatio: number
      left: `${number}%`
      top: `${number}%`
      /** 자기 크기 기준. `left` 와 짝을 이뤄 `background-position` 퍼센트가 된다. */
      translateX: `${number}%`
      translateY: `${number}%`
    }

const SIZE_PATTERN = /^(\d+(?:\.\d+)?)%\s+auto$/
const POSITION_PATTERN = /^(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/

/**
 * 크롭 한 줄 + 고유 크기 → RN 절대 배치.
 *
 * CSS `background-position: X% Y%` 는 `left = (부모폭 − 그림폭) × X%` 인데, 그것이
 * `left: X%`(부모 기준) + `translateX: -X%`(자기 기준)와 **같은 값**이다. RN 도 두 퍼센트의 기준이
 * CSS 와 같아서 **부모를 안 재도 된다**(`onLayout` 을 쓰면 첫 프레임에 그림이 없다).
 *
 * 모르면 `cover` 로 떨어진다. 크롭은 어디를 보여줄지의 조정값이지 그림의 존재 조건이 아니다.
 *
 * 크기 검사가 `<= 0` 이 아니라 `Number.isFinite` 인 것은 `undefined <= 0` 이 **false** 라 가드를
 * 통과해 `aspectRatio: NaN` 이 나가던 것을 고친 자리다. NaN 은 에러가 아니라 레이아웃만 무너뜨린다.
 */
export function resolveImageCropLayout(
  crop: ImageCrop,
  natural: ImageNaturalSize | null,
): ImageCropLayout {
  if (natural === null) return { kind: 'cover' }
  if (!Number.isFinite(natural.width) || natural.width <= 0) return { kind: 'cover' }
  if (!Number.isFinite(natural.height) || natural.height <= 0) return { kind: 'cover' }

  const size = SIZE_PATTERN.exec(crop.size)
  const position = POSITION_PATTERN.exec(crop.position)
  if (size === null || position === null) return { kind: 'cover' }

  const widthPercent = Number(size[1])
  const x = Number(position[1])
  const y = Number(position[2])

  return {
    kind: 'sized',
    width: `${widthPercent}%`,
    aspectRatio: natural.width / natural.height,
    left: `${x}%`,
    top: `${y}%`,
    translateX: `${-x}%`,
    translateY: `${-y}%`,
  }
}

/**
 * 배치를 `<Image>` 스타일로. 위 함수를 순수하게 남겨 단위 테스트가 되도록 갈랐다.
 *
 * **두 갈래 다 두 축의 이름을 부른다.** 안 적은 축에는 그림의 고유 크기가 남아, `sized` 는 종횡비를
 * 잃고 `cover` 는 상자를 안 채운다. 둘 다 에러가 안 난다.
 *
 * @see [[ADR-135]]
 */
export function imageCropStyle(layout: ImageCropLayout): ImageStyle {
  if (layout.kind === 'cover') {
    return {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: undefined,
      height: undefined,
    }
  }

  return {
    position: 'absolute',
    width: layout.width,
    height: undefined,
    aspectRatio: layout.aspectRatio,
    left: layout.left,
    top: layout.top,
    transform: [{ translateX: layout.translateX }, { translateY: layout.translateY }],
  }
}
