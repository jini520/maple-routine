/**
 * 스프라이트 프레임 한 장을 화면 어디에 얼마나 크게 놓을지 내는 계산.
 *
 * CSS `transform` 문자열이 아니라 **레이아웃 값**(`left` · `top` · `width` · `height`)으로 낸다.
 * 퍼센트나 `transformOrigin` 처럼 되는지 확실치 않은 스타일에 기대면 조용히 안 그려지는 사례를
 * 반복해 겪었다. 계산은 곱셈 두 번이고 안 그려질 자리가 없다.
 *
 * ```
 * left = -originX * scale,  top = -originY * scale,  size = 비트맵 크기 * scale
 * ```
 *
 * 비트맵 크기를 인자로 받는 것은 origin 이 그 프레임 좌표계의 점이라 되밀 거리를 구하려면 크기가
 * 필요해서다. RN 의 `<Image>` 는 명시 크기가 없으면 0 이고, 번들 에셋의 크기는
 * `Image.resolveAssetSource` 가 준다. 그 조회는 컴포넌트가 해서 여기로 넘긴다. 이 파일이 순수해야
 * 검사할 수 있다.
 */

import { DROP_EFFECT_FRAMES } from './drop-effect-layout'
import {
  DROP_EFFECT_ORIGINS,
  DROP_PILLAR_SCALE,
  type DropEffectOrigin,
  type DropEffectPhase,
} from './drop-effect-layout'
import type { ImageAssetRef } from '../../../types/image-asset'

export interface FrameBitmapSize {
  width: number
  height: number
}

interface FramePlacement {
  left: number
  top: number
  width: number
  height: number
}

/** 소수 origin × 스케일의 부동소수 꼬리를 자른다. 웹도 같은 자리에서 같은 규칙을 썼다. */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * 앵커(부모의 좌상단)에 origin 점이 오도록 프레임을 놓는다.
 *
 * 크기를 모르면(`null`) **놓지 않는다**. 웹이 `el.complete` 가 false 인 동안 좌표를 그대로 두고
 * 표시도 켜지 않던 것과 같은 판단이다. 크기 없이 그리면 프레임마다 최대 26px 씩 튄다.
 */
function placeDropFrame(
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
 * ScreenEff 는 origin 테이블이 없다. 크롭이 이미 버스트 원점 기준 중앙이라 **화면 중앙 정렬**이면
 * 되고, 배율만 전 프레임에 똑같이 걸린다.
 *
 * 웹은 `translate(-50%,-50%)` 였지만 여기서는 같은 이유로 음수 마진을 쓴다(위 주석).
 */
function centerDropFrame(scale: number, bitmap: FrameBitmapSize | null): FramePlacement | null {
  if (bitmap === null) return null
  if (!Number.isFinite(bitmap.width) || bitmap.width <= 0) return null
  if (!Number.isFinite(bitmap.height) || bitmap.height <= 0) return null

  const width = round2(bitmap.width * scale)
  const height = round2(bitmap.height * scale)
  return { left: round2(-width / 2), top: round2(-height / 2), width, height }
}


/**
 * 스프라이트 한 장. 어느 그림을 어디에 의 최소 단위.
 *
 * 이 목록이 필요한 이유는 이다. 재생이 `source` 를 갈아끼우는 대신 **전 프레임을
 * 마운트해 두고 `opacity` 로 한 장만 켜기** 때문에, 켜기 전에 39+16 장의 자리를 미리 다 알아야 한다.
 */
export interface SpriteFrame {
  key: string
  source: ImageAssetRef
  placement: FramePlacement
}

/** 비트맵 크기를 못 구한 프레임은 **빼 버린다**. 크기 없이 그리면 프레임마다 최대 26px 튄다. */
type SizeOf = (source: ImageAssetRef) => FrameBitmapSize | null

/** DropEff 기둥 39장. 각자 자기 origin 으로 놓인다. */
export function buildPillarFrames(sizeOf: SizeOf): SpriteFrame[] {
  const phases: DropEffectPhase[] = ['pre', 'loop', 'end']
  return phases.flatMap((phase) =>
    DROP_EFFECT_FRAMES[phase].flatMap((source, i) => {
      const placement = placeDropFrame(
        DROP_EFFECT_ORIGINS[phase][i] ?? [0, 0],
        DROP_PILLAR_SCALE,
        sizeOf(source),
      )
      return placement === null ? [] : [{ key: `${phase}-${i}`, source, placement }]
    }),
  )
}

/** ScreenEff 16장. 전 프레임 같은 배율로 화면 중앙. */
export function buildScreenFrames(scale: number, sizeOf: SizeOf): SpriteFrame[] {
  return DROP_EFFECT_FRAMES.screen.flatMap((source, i) => {
    const placement = centerDropFrame(scale, sizeOf(source))
    return placement === null ? [] : [{ key: `screen-${i}`, source, placement }]
  })
}
