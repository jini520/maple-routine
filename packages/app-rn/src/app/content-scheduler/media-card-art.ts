// 일러스트 카드의 **bleed 레이어**([[ADR-018]] 레시피 · [[ADR-020]]·[[ADR-021]] 이 쓰는 자리) —
// 웹의 `background-image` + `background-size`/`position` + `filter` + `mask-image` 네 줄을 RN 기하로
// 옮긴 것이다.
//
// ══ 왜 파일이 하나 더 생겼나 ═══════════════════════════════════════════════════════
//
// 웹에서는 그 네 줄이 **인라인 style 객체**라 카드 일곱 개에 그대로 복붙돼 있었다(값도 전부 같다).
// 옮기면 한 벌이 15줄이 아니라 30줄짜리 기하 계산이 되고, 그것이 일곱 벌이면 한 곳만 어긋나도
// 그림이 조용히 다르게 잘린다. **호출부 일곱 + 취약 구조**라 [[ADR-094]] 결정 1 의 두 조건을 넉넉히
// 넘긴다. 화면 폴더 안에 두는 것은 이 레시피가 컨텐츠 카드 둘만의 것이기 때문이고, 세 번째 호출부
// (보스 카드·파티 인원 모달 히어로)가 붙는 단계에서 `components/` 로 올릴 자리다.
//
// ══ CSS 배경 → RN `<Image>` 로 옮기는 법 ═══════════════════════════════════════════
//
// RN 에는 배경 이미지가 없어 `<Image>` 를 **손으로 앉혀야** 한다. 크롭 표(`daily-quest-region-crops`
// ·`boss-portrait-crops`)의 값은 두 형태뿐이고([[ADR-006]] — 사용자가 눈으로 맞춘 값이라 손대지
// 않는다), 둘 다 정확히 옮길 수 있다.
//
// | 크롭 | 뜻(CSS) | RN |
// |---|---|---|
// | `size: "220% auto"` | 컨테이너 **폭의 220%**, 높이는 종횡비 유지 | `width: '220%'` + `aspectRatio` |
// | `position: "60% 40%"` | 그림의 60%/40% 지점이 컨테이너의 60%/40% 지점에 온다 | 아래 |
// | `size: "cover"`·`position: "center"` | 덮기 | `resizeMode="cover"` + `inset-0` |
//
// **position 퍼센트가 요점이다.** CSS 정의를 풀면 `left = (W − dw) × X%` 이고, 이것은
// `left: X%`(부모 폭 기준) + `translateX: −X%`(**자기 폭** 기준)와 같다 — RN 도 두 퍼센트의 기준이
// CSS 와 같으므로 식이 그대로 성립한다. 그래서 **컨테이너를 재지 않아도 된다**(`onLayout` 을 쓰면
// 첫 프레임에 그림이 없고, 그 한 프레임이 [[ADR-101]] 이 없앤 "모르는 사실을 그리는 프레임"과 같은
// 종류가 된다). 필요한 실측은 **그림의 고유 크기** 하나뿐이고 번들 에셋이라 동기로 읽힌다
// ([[ADR-129]] 로 그림이 번들에 들어오면서 가능해졌다).
//
// ══ 마스크가 없어 **그라데이션을 뒤집어 얹는다** ═══════════════════════════════════
//
// 웹은 아트 레이어의 알파를 오른쪽으로 깎았다(`mask-image`). RN 에는 마스크가 없지만, **카드 배경이
// 불투명한 단색**이라 같은 결과를 덧칠로 낼 수 있다. 마스크 알파를 m 이라 하면
//
//     웹   = bg(1 − 0.65·m) + art·0.65·m
//     덧칠 = [bg(1 − 0.65) + art·0.65] 위에 bg 를 알파 (1 − m) 로 → 같은 식
//
// 정확히 같은 색이 나온다(근사가 아니다). 그래서 아트 위에 **표면색 그라데이션**을 마스크의 반대
// 알파로 얹는다. 끝 색을 `transparent`(= 투명 **검정**)로 두지 않는 것은 `PageHeader` 의 경계 페이드와
// 같은 이유다 — 네이티브 그라데이션은 미리 곱해진 알파로 보간하지 않아 중간이 어두워진다.
// **값과 기하만 있는 절반이다.** 컴포넌트는 `MediaCardArt.tsx` 에 있다 — 컴포넌트 파일이 값을
// 함께 export 하면 fast refresh 가 깨진다(`Button/variants.ts`·`row-class.ts` 와 같은 판단).
//
import type { ImageStyle } from 'react-native'


/** 크롭 표의 한 줄. 두 조회 함수(`daily-quest-backgrounds`·`boss-icons`)가 같은 모양을 돌려준다. */
export interface MediaArtCrop {
  size: string
  position: string
}

/** 그림의 고유 픽셀 크기 — `Image.resolveAssetSource` 가 번들 에셋에서 읽어 준다. */
export interface MediaArtNaturalSize {
  width: number
  height: number
}

/**
 * 웹 `MEDIA_ART_FILTER`(`'saturate(.85) brightness(.8)'`)의 RN 짝.
 *
 * 문자열을 런타임에 파싱하지 않는 대신 **테스트가 core 의 그 상수를 읽어 이 값과 대조한다** —
 * 값을 두 벌로 적어 두고 조용히 어긋나는 것을 막는 자리가 파서가 아니라 테스트다
 * (`PageHeader` 의 페이드 정지점과 같은 방식).
 */
export const MEDIA_ART_FILTER_STYLE = [{ saturate: 0.85 }, { brightness: 0.8 }] as const

/**
 * 웹 `MEDIA_ART_MASK_CARD`(`linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)`)를
 * **뒤집은** 정지점 — 마스크가 1인 구간은 덧칠이 0이다.
 *
 * 마지막 정지점 `1` 은 웹에 없다. CSS 마스크는 마지막 정지점 뒤를 그 값으로 유지하지만
 * `expo-linear-gradient` 는 정지점 사이만 보간하므로, 76% 이후에도 완전히 덮이도록 끝을 못 박는다.
 */
export const MEDIA_ART_VEIL_LOCATIONS = [0, 0.38, 0.76, 1] as const
export const MEDIA_ART_VEIL_ALPHAS = [0, 0, 1, 1] as const

/** `cover`/`center` — 크롭 표에 없는 슬러그의 기본값이자, 고유 크기를 모를 때의 폴백. */
export type MediaArtLayout =
  | { kind: 'cover' }
  | {
      kind: 'sized'
      /** 부모 폭 기준. */
      width: `${number}%`
      aspectRatio: number
      left: `${number}%`
      top: `${number}%`
      /** 자기 크기 기준 — CSS `background-position` 퍼센트의 나머지 절반(파일 머리). */
      translateX: `${number}%`
      translateY: `${number}%`
    }

const SIZE_PATTERN = /^(\d+(?:\.\d+)?)%\s+auto$/
const POSITION_PATTERN = /^(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/

/**
 * 크롭 한 줄 + 그림 고유 크기 → RN 배치.
 *
 * **모르면 `cover` 로 떨어진다.** 형식이 다르거나(`cover`) 고유 크기를 못 읽으면 그림을 안 그리는
 * 대신 덮어서 그린다 — 크롭은 "어디를 보여줄까"의 조정값이지 그림의 존재 조건이 아니다.
 */
export function resolveMediaArtLayout(
  crop: MediaArtCrop,
  natural: MediaArtNaturalSize | null,
): MediaArtLayout {
  if (natural === null || natural.width <= 0 || natural.height <= 0) return { kind: 'cover' }

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

/** 배치를 `<Image>` 스타일로. 분리해 두는 이유는 위 함수가 순수하게 남아 단위 테스트가 되기 때문. */
export function mediaArtImageStyle(layout: MediaArtLayout): ImageStyle {
  if (layout.kind === 'cover') {
    return { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }
  }

  return {
    position: 'absolute',
    width: layout.width,
    aspectRatio: layout.aspectRatio,
    left: layout.left,
    top: layout.top,
    transform: [{ translateX: layout.translateX }, { translateY: layout.translateY }],
  }
}
