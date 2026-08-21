// 프레임 한 장을 화면 어디에 얼마나 크게 놓는가 — 웹의 `transform` 문자열을 **RN 배치 값**으로 옮긴다.
//
// ## 왜 `dropFrameTransform` 을 그대로 못 쓰나
//
// core 의 그 함수는 CSS 문자열(`translate(..px, ..px) scale(s)`)을 만들고 `transformOrigin: '0 0'`
// 과 짝으로 쓴다. RN 에도 `transform`·`transformOrigin` 이 있지만, 이 저장소는 이번 전환에서
// **퍼센트·transformOrigin 같은 «되는지 확실치 않은» 스타일에 기대면 조용히 안 그려지는** 사례를
// 반복해서 겪었다(시트 스킨 3종·NativeWind 조건부 transform). 그래서 같은 결과를 **레이아웃 값**
// (`left`·`top`·`width`·`height`)으로 낸다 — 계산은 곱셈 두 번이고, 안 그려질 자리가 없다.
//
// 수식은 core 와 같다: origin 점이 앵커에 오도록 스케일된 origin 만큼 되민다.
//
//   left = -originX * scale,  top = -originY * scale,  size = 비트맵 크기 * scale
//
// ## 비트맵 크기는 왜 인자인가
//
// [[ADR-048]] 의 origin 은 **그 프레임 비트맵 좌표계**의 점이라, 되밀 거리를 구하려면 크기가
// 필요하다. 웹은 `<img>` 가 자기 크기를 알아서 `scale()` 한 번으로 끝났지만 RN 의 `<Image>` 는
// 명시 크기가 없으면 0 이다. 번들 에셋은 `Image.resolveAssetSource` 로 크기를 알 수 있고
// ([[ADR-129]] 이후 프레임이 번들에 있다), 그 조회는 컴포넌트가 해서 여기로 넘긴다 — 이 파일이
// 순수하게 남아야 검사할 수 있다.

import type { DropEffectOrigin } from '../../../lib/drop-effect-layout'

export interface FrameBitmapSize {
  width: number
  height: number
}

export interface FramePlacement {
  left: number
  top: number
  width: number
  height: number
}

/** 소수 origin × 스케일의 부동소수 꼬리를 자른다 — core `dropFrameTransform` 과 같은 자리·같은 규칙. */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * 앵커(부모의 좌상단)에 origin 점이 오도록 프레임을 놓는다.
 *
 * 크기를 모르면(`null`) **놓지 않는다** — 웹이 `el.complete` 가 false 인 동안 좌표를 그대로 두고
 * 표시도 켜지 않던 것과 같은 판단이다. 크기 없이 그리면 프레임마다 최대 26px 씩 튄다([[ADR-048]]).
 */
export function placeDropFrame(
  origin: DropEffectOrigin,
  scale: number,
  bitmap: FrameBitmapSize | null,
): FramePlacement | null {
  if (bitmap === null) return null
  if (!Number.isFinite(bitmap.width) || bitmap.width <= 0) return null
  if (!Number.isFinite(bitmap.height) || bitmap.height <= 0) return null

  return {
    left: round2(-origin[0] * scale),
    top: round2(-origin[1] * scale),
    width: round2(bitmap.width * scale),
    height: round2(bitmap.height * scale),
  }
}

/**
 * ScreenEff 는 origin 테이블이 없다 — 크롭이 이미 버스트 원점 기준 중앙이라 **화면 중앙 정렬**이면
 * 되고, 배율만 전 프레임에 똑같이 걸린다([[ADR-048]] 결정 5).
 *
 * 웹은 `translate(-50%,-50%)` 였지만 여기서는 같은 이유로 음수 마진을 쓴다(위 주석).
 */
export function centerDropFrame(scale: number, bitmap: FrameBitmapSize | null): FramePlacement | null {
  if (bitmap === null) return null
  if (!Number.isFinite(bitmap.width) || bitmap.width <= 0) return null
  if (!Number.isFinite(bitmap.height) || bitmap.height <= 0) return null

  const width = round2(bitmap.width * scale)
  const height = round2(bitmap.height * scale)
  return { left: round2(-width / 2), top: round2(-height / 2), width, height }
}
