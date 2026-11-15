/**
 * 2겹 스플래시의 자리 계산. 화면 크기와 상단 인셋을 받아 그림 · 잎과 이름 묶음 · 눈 조각의 크기와 위치를 낸다.
 *
 * 렌더와 떼어 둔 것은 바형 폰 · 낮은 화면 · 가로로 펼친 화면에서의 자리를 렌더 없이 보기 위해서다.
 */

/** `assets/splash/body.png` 의 픽셀 크기. 떨어진 눈 조각을 지운 본체다. */
export const BODY_PX = { width: 1145, height: 1178 }

/**
 * `assets/splash/body-wide.png` 의 픽셀 크기. 본체 양옆을 이어 그린 그림이고 본체가 가로 가운데에 있다. 윗줄은 본체의
 * 윗줄이고, 아래는 본체의 둥근 아랫부분을 잘라 낸 높이라 화면 바닥에 그대로 붙인다.
 */
export const ART_PX = { width: 3600, height: 1113 }

/**
 * 본체 폭은 그림 높이가 화면 높이의 60% 를 넘지 않는 가장 넓은 폭이되, 화면 폭의 125% 를 넘지 않는다. 화면보다 좁아지면
 * 양옆은 확장 그림이 채운다.
 */
const IMAGE_WIDTH_RATIO_MAX = 1.25
const IMAGE_HEIGHT_CAP_RATIO = 0.6

/** 짧은 변 390 에서의 이름 글자 크기 · 잎 높이 비율 · 잎과 이름 사이 */
const NAME_PX_AT_390 = 44
const LEAF_TO_NAME = 1.17
const GAP_PX_AT_390 = 8

/** 잎 경로의 격자 비율. `splash/leaf.ts` 의 viewBox 와 같다. */
const LEAF_ASPECT = 127 / 130

/** 짧은 변이 390 보다 긴 만큼의 6할만 키운다. 폭을 따르면 가로로 펼친 화면에서 이름이 그림보다 넓어진다. */
const SHORT_SIDE_SCALE_SHARE = 0.6

/**
 * 묶음 아랫변은 그림 상자 윗변보다 그림 높이의 3% 아래. 그림의 보이는 윗끝(깃발)은 상자 윗변에서 6.7% 아래라
 * 겹치지 않는다. 묶음이 상태바 아래로 올라가지는 않는다.
 */
const LOCKUP_OVERLAP_RATIO = 0.03

/** 눈 조각 크기는 그림 비율의 70%. 그림 비율 그대로면 클립아트처럼 커 보인다. */
const SNOW_SCALE = 0.7

/**
 * 눈 조각 일곱. 원본에서 본체와 떨어져 있던 눈송이 다섯과 눈뭉치 둘이다. 크기는 `assets/splash/snow-N.png` 의
 * 픽셀이고 자리는 화면 폭 비율이다. 눈뭉치는 돌지 않는다(`spinMs` 0).
 *
 * `start` 는 처음 그릴 때 이미 내려와 있는 자리다. 내리는 길 전체에 골고루 펼쳐야 한다. 전부 위 밖에서
 * 출발하면 스플래시가 서 있는 2초 남짓 동안 거의 내려오지 못한다.
 */
const SNOW_FLAKES = [
  { sprite: 0, width: 115, height: 126, x: 0.06, fallMs: 14000, start: 0.47, spinMs: 18000, swayMs: 4000 },
  { sprite: 1, width: 96, height: 105, x: 0.76, fallMs: 12000, start: 0.19, spinMs: 22000, swayMs: 3600 },
  { sprite: 2, width: 73, height: 80, x: 0.3, fallMs: 16000, start: 0.75, spinMs: 26000, swayMs: 4400 },
  { sprite: 3, width: 60, height: 66, x: 0.56, fallMs: 13000, start: 0.05, spinMs: 20000, swayMs: 3200 },
  { sprite: 4, width: 56, height: 63, x: 0.9, fallMs: 15000, start: 0.61, spinMs: 24000, swayMs: 3800 },
  { sprite: 5, width: 47, height: 46, x: 0.18, fallMs: 11000, start: 0.89, spinMs: 0, swayMs: 3000 },
  { sprite: 6, width: 46, height: 44, x: 0.66, fallMs: 17000, start: 0.33, spinMs: 0, swayMs: 4200 },
] as const

export interface SplashViewport {
  width: number
  height: number
  /** 상태바 높이. 묶음 자리의 기준선 */
  topInset: number
}

/** 확장 그림의 자리. 화면 바닥에 붙는다 */
export interface SplashImagePlacement {
  width: number
  height: number
  left: number
  /** 확장 그림 가운데의 본체 상자 크기. 묶음 자리와 눈 조각 크기를 이 크기로 잰다 */
  bodyWidth: number
  bodyHeight: number
}

export interface SplashLockupPlacement {
  /** 이름 글자 크기(px). em 상자 높이와 같다 */
  namePx: number
  leafWidth: number
  leafHeight: number
  gap: number
  top: number
  /** 잎과 글자 중 큰 쪽 */
  height: number
}

export interface SplashSnowFlake {
  /** `assets/splash/snow-N.png` 의 N */
  sprite: number
  width: number
  height: number
  left: number
  /** 화면 위 밖에서 아래 밖까지 한 번 내리는 시간 */
  fallMs: number
  /** 처음 그릴 때 이미 내려와 있는 비율. 0 이 `fromY`, 1 이 `toY` */
  startRatio: number
  /** 한 바퀴 도는 시간. 0 이면 돌지 않는다 */
  spinMs: number
  /** 좌우로 한 번 흔들리는 시간 */
  swayMs: number
  /** 떨어지기 시작하는 y. 화면 위 밖 */
  fromY: number
  /** 다 내려간 y. 화면 아래 밖 */
  toY: number
}

export interface SplashLayout {
  image: SplashImagePlacement
  lockup: SplashLockupPlacement
  snow: readonly SplashSnowFlake[]
}

export function splashLayout(viewport: SplashViewport): SplashLayout {
  const cappedWidth = Math.round((viewport.height * IMAGE_HEIGHT_CAP_RATIO * BODY_PX.width) / BODY_PX.height)
  const imageWidth = Math.min(Math.round(viewport.width * IMAGE_WIDTH_RATIO_MAX), cappedWidth)
  const imageHeight = Math.round((imageWidth * BODY_PX.height) / BODY_PX.width)
  const artScale = imageWidth / BODY_PX.width
  const artWidth = Math.round(ART_PX.width * artScale)
  const artHeight = Math.round(ART_PX.height * artScale)
  const image: SplashImagePlacement = {
    width: artWidth,
    height: artHeight,
    left: (viewport.width - artWidth) / 2,
    bodyWidth: imageWidth,
    bodyHeight: imageHeight,
  }
  const imageTop = viewport.height - artHeight

  const shortSide = Math.min(viewport.width, viewport.height)
  const scale = 1 + ((shortSide - 390) / 390) * SHORT_SIDE_SCALE_SHARE
  const namePx = Math.round(NAME_PX_AT_390 * scale)
  const leafHeight = Math.round(namePx * LEAF_TO_NAME)
  const leafWidth = Math.round(leafHeight * LEAF_ASPECT)
  const height = Math.max(namePx, leafHeight)
  const seatedCenter = imageTop - height / 2 + imageHeight * LOCKUP_OVERLAP_RATIO
  const centerY = Math.max(viewport.topInset + height / 2, seatedCenter)
  const lockup: SplashLockupPlacement = {
    namePx,
    leafWidth,
    leafHeight,
    gap: Math.round(GAP_PX_AT_390 * scale),
    top: Math.round(centerY - height / 2),
    height,
  }

  const spriteScale = (imageWidth / BODY_PX.width) * SNOW_SCALE
  const snow = SNOW_FLAKES.map((flake) => {
    const h = Math.round(flake.height * spriteScale)
    return {
      sprite: flake.sprite,
      width: Math.round(flake.width * spriteScale),
      height: h,
      left: Math.round(viewport.width * flake.x),
      fallMs: flake.fallMs,
      startRatio: flake.start,
      spinMs: flake.spinMs,
      swayMs: flake.swayMs,
      fromY: -h,
      toY: viewport.height + h,
    }
  })

  return { image, lockup, snow }
}
