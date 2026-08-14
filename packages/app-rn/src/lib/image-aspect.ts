/**
 * 「한 축만 정하고 나머지는 **그림이** 정한다」 — 웹 preflight `img { height: auto }` 의 짝
 * ([[ADR-135]]).
 *
 * ## RN 의 `<Image>` 는 우리가 이름을 부르지 않은 축을 **비워 두지 않는다**
 *
 * RN 0.86 의 `Image.ios.js`·`Image.android.js` 는 둘 다 스타일을 세 겹으로 쌓는다:
 *
 *     style = [{width: source.width, height: source.height}, styles.base, props.style]
 *
 * 맨 아래가 **그림의 고유 픽셀 크기**다([[ADR-129]] 로 번들에 들어온 에셋은 늘 자기 크기를 싣고
 * 온다). 우리 스타일이 맨 위라 **적은 축만** 이기고, 안 적은 축에는 그 고유 픽셀값이 그대로
 * 남는다 — 웹에서 `w-full` 한 줄로 끝난 이유가 preflight 의 `height: auto` 였고 RN 에는 그 말을
 * 대신 해 주는 것이 없다.
 *
 * **그래서 `aspectRatio` 도 함께 죽는다.** Yoga 는 두 축이 다 정해지면 종횡비를 쓰지 않는다 —
 * 「그림이 일그러진다」로 보이는 증상의 정체가 이것이고, `resizeMode` 를 무엇으로 바꿔도 안 낫는다
 * (상자가 이미 틀린 모양이라 `contain` 은 여백을 남기고 `stretch` 는 늘린다).
 *
 * ## 왜 «명시적 `undefined`» 가 답인가
 *
 * `undefined` 를 적는 것은 **안 적는 것과 다르다.** RN 의 스타일 병합이 그것을 «앞의 값을 지우는
 * 값»으로 읽는다 — `ReactNativeAttributePayload.js` 의 주석 그대로다(*"An explicit value of
 * undefined is treated as a null because it overrides any other preceding value"*), iOS 는
 * `flattenStyle` 의 `for…in` 이 같은 일을 한다. 지워진 축은 Yoga 에서 auto 가 되고 그제야
 * `aspectRatio` 가 그 자리를 채운다. **NativeWind 도 그 키를 보존한다**(실측 — `className="w-full"`
 * 과 함께 줘도 병합 결과에 `height` 키가 남는다).
 *
 * ## 왜 함수 하나로 모으나
 *
 * 호출부가 넷이고(월드 엠블럼 셋 + 안내 이미지) 전부 같은 세 줄이며, **틀려도 조용한** 종류다
 * ([[ADR-094]] 결정 1 의 두 조건). 사본을 두면 한 곳만 고쳐지는 사고가 열린다 — 실제로 [[ADR-135]]
 * 의 보고 넷이 같은 병의 서로 다른 증상이었다.
 *
 * **`media-card-art.ts` 의 `mediaArtNaturalSize` 와 겹치지 않는다.** 그쪽은 크롭 표의 퍼센트 기하를
 * 풀기 위해 **크기**가 필요하고, 여기는 **스타일**을 만든다. 공유하는 것은 `resolveAssetSource`
 * 호출 한 줄뿐이라 합칠 것이 없다(합치면 두 파일이 서로의 사정을 알아야 한다).
 */
import { Image, type ImageStyle } from 'react-native'

import type { ImageAssetRef } from '@core/types/image-asset'

/** 그림의 고유 픽셀 크기. */
export interface ImageNaturalSize {
  width: number
  height: number
}

/**
 * 번들 에셋의 고유 픽셀 크기 — 모르면 `null`.
 *
 * 검사가 `<= 0` 이 아니라 **`Number.isFinite`** 인 것은 `resolveMediaArtLayout` 이 step 5 에 밟은
 * 자리와 같다 — `undefined <= 0` 은 **false** 라 크기 없는 소스가 가드를 통과하면
 * `aspectRatio: NaN` 이 나가고, NaN 은 에러가 아니라 **레이아웃이 조용히 무너지는 값**이다.
 */
export function imageNaturalSize(source: ImageAssetRef): ImageNaturalSize | null {
  const resolved = Image.resolveAssetSource(source)
  if (resolved === null || resolved === undefined) return null
  if (!Number.isFinite(resolved.width) || resolved.width <= 0) return null
  if (!Number.isFinite(resolved.height) || resolved.height <= 0) return null
  return { width: resolved.width, height: resolved.height }
}

/** 퍼센트도 받는다 — 부모를 재지 않고 그대로 넘긴다(`media-card-art.ts` 와 같은 이유). */
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
 * 이유다) 샐 것이 애초에 없고, 없는 값을 지우겠다고 `undefined` 를 적으면 «무엇을 막고 있는지»가
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
