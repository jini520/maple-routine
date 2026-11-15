// 2겹 스플래시의 자리 계산. 그림 · 잎과 이름 묶음 · 눈 조각이 화면 크기마다 어디에 오는지 본다.
//
// 값을 그대로 비교하지 않는다. 지키는 것은 관계다. 본체는 화면 높이의 6할과 폭의 125% 중 작은 쪽까지 크고,
// 그보다 좁은 화면은 확장 그림이 양옆을 채운다. 묶음은 그림 윗변에 앉되 깃발과 상태바에 닿지 않고, 짧은 변이
// 긴 화면이 글자와 잎이 크다. 눈 조각은 가로로도 세로 시작 자리로도 화면에 골고루 퍼진다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ART_PX, BODY_PX, splashLayout, type SplashViewport } from '../layout'

const PHONE: SplashViewport = { width: 390, height: 844, topInset: 47 }
const FOLD8_COVER: SplashViewport = { width: 447, height: 706, topInset: 24 }
const DUO_COVER: SplashViewport = { width: 466, height: 678, topInset: 0 }
const SE2: SplashViewport = { width: 375, height: 667, topInset: 20 }
const DUO_INNER_LANDSCAPE: SplashViewport = { width: 951, height: 669, topInset: 0 }
const FOLD8_INNER_LANDSCAPE: SplashViewport = { width: 930, height: 702, topInset: 24 }
const IPAD_LANDSCAPE: SplashViewport = { width: 1194, height: 834, topInset: 24 }
const VIEWPORTS = [PHONE, FOLD8_COVER, DUO_COVER, SE2, DUO_INNER_LANDSCAPE, FOLD8_INNER_LANDSCAPE, IPAD_LANDSCAPE]

/** 본체의 보이는 윗끝(깃발) 자리. 알파 마스크로 잰 값이다 */
const FLAG_TOP_RATIO = 0.067

/** 확장 그림의 윗변. 확장 그림은 본체의 윗줄부터 시작하므로 본체 상자의 윗변이기도 하다 */
function imageTopOf(viewport: SplashViewport): number {
  return viewport.height - splashLayout(viewport).image.height
}

/** PNG 머리의 IHDR 에서 픽셀 크기를 읽는다 */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(join(__dirname, '../../../../assets/splash', file))
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('splashLayout', () => {
  it('계산에 쓰는 크기가 그림 파일의 픽셀 크기와 같다', () => {
    // 그림만 바꾸고 값을 안 고치면 본체가 확장 그림 가운데에서 어긋나고 바닥 자리도 틀어진다.
    expect(pngSize('body-wide.png')).toEqual(ART_PX)
    expect(pngSize('body.png')).toEqual(BODY_PX)
  })

  it('본체는 화면 높이의 6할과 화면 폭의 125% 중 작은 쪽까지 크다', () => {
    for (const viewport of VIEWPORTS) {
      const { image } = splashLayout(viewport)
      expect(image.bodyHeight).toBeLessThanOrEqual(viewport.height * 0.6 + 0.5)
      expect(image.bodyWidth).toBeLessThanOrEqual(viewport.width * 1.25 + 0.5)
      const heightBound = Math.abs(image.bodyHeight - viewport.height * 0.6) <= 1
      const widthBound = Math.abs(image.bodyWidth - viewport.width * 1.25) <= 1
      expect(heightBound || widthBound).toBe(true)
    }
    // 높은 바형 폰은 폭 125% 에 걸려 그대로다. 나머지는 높이 6할에 걸린다. 넓은 화면에서 본체가 화면보다 좁아지는 것이 정상이다.
    expect(splashLayout(PHONE).image.bodyWidth).toBe(Math.round(PHONE.width * 1.25))
    for (const viewport of [DUO_COVER, DUO_INNER_LANDSCAPE, IPAD_LANDSCAPE]) {
      expect(splashLayout(viewport).image.bodyWidth).toBeLessThan(viewport.width)
    }
  })

  it('확장 그림은 화면 폭을 덮고, 본체는 확장 그림 가운데에 온다', () => {
    for (const viewport of VIEWPORTS) {
      const { image } = splashLayout(viewport)
      expect(image.left).toBeLessThanOrEqual(0)
      expect(image.left + image.width).toBeGreaterThanOrEqual(viewport.width)
      expect(image.left + image.width / 2).toBeCloseTo(viewport.width / 2, 0)
      // 확장 그림은 본체와 같은 배율로 깐다. 배율이 다르면 가운데의 원본 픽셀이 본체 상자와 어긋난다.
      expect(image.width / image.bodyWidth).toBeCloseTo(ART_PX.width / BODY_PX.width, 2)
      expect(image.height / image.bodyHeight).toBeCloseTo(ART_PX.height / BODY_PX.height, 2)
    }
  })

  it('확장 그림은 본체 아래를 잘라 낸 높이라, 바닥에 붙여도 모서리가 비지 않고 슬라임은 남는다', () => {
    // 본체 아래 4% 는 둥글어 모서리에 바탕이 비친다(알파 마스크 측정). 슬라임은 아래 16% 에 있어 8% 넘게 자르면 얼굴이 잘린다.
    const cut = 1 - ART_PX.height / BODY_PX.height
    expect(cut).toBeGreaterThanOrEqual(0.045)
    expect(cut).toBeLessThan(0.08)
  })

  it('묶음은 그림 윗변에 앉고, 깃발과 상태바에는 닿지 않는다', () => {
    for (const viewport of VIEWPORTS) {
      const { image, lockup } = splashLayout(viewport)
      const imageTop = imageTopOf(viewport)
      const bottom = lockup.top + lockup.height
      expect(bottom).toBeGreaterThan(imageTop)
      expect(bottom).toBeLessThan(imageTop + image.bodyHeight * FLAG_TOP_RATIO)
      expect(lockup.top).toBeGreaterThanOrEqual(viewport.topInset)
    }
    // 화면이 달라도 그림 윗변에서 같은 비율만큼 내려온다.
    const overlaps = VIEWPORTS.map((viewport) => {
      const { image, lockup } = splashLayout(viewport)
      return (lockup.top + lockup.height - imageTopOf(viewport)) / image.bodyHeight
    })
    for (const overlap of overlaps) expect(overlap).toBeCloseTo(overlaps[0], 2)
  })

  it('짧은 변이 긴 화면이 글자와 잎이 조금 크고, 잎은 글자보다 크다', () => {
    const ordered = [SE2, PHONE, FOLD8_COVER, DUO_COVER, DUO_INNER_LANDSCAPE, FOLD8_INNER_LANDSCAPE, IPAD_LANDSCAPE]
    const sizes = ordered.map((viewport) => splashLayout(viewport).lockup.namePx)
    for (let index = 1; index < sizes.length; index += 1) {
      expect(sizes[index]).toBeGreaterThanOrEqual(sizes[index - 1])
    }
    // 조금이다. 짧은 변이 늘어난 비율보다 글자가 덜 커진다.
    const phone = splashLayout(PHONE).lockup
    const ipad = splashLayout(IPAD_LANDSCAPE).lockup
    expect(ipad.namePx / phone.namePx).toBeLessThan(IPAD_LANDSCAPE.height / PHONE.width)
    for (const viewport of VIEWPORTS) {
      const { lockup } = splashLayout(viewport)
      expect(lockup.leafHeight).toBeGreaterThan(lockup.namePx)
      expect(lockup.gap).toBeGreaterThan(0)
    }
  })

  it('화면을 돌려도 글자와 잎의 크기가 같다', () => {
    // 화면 폭을 따르면 가로로 펼친 화면에서 이름이 그림보다 넓어진다.
    const portrait = splashLayout({ width: 669, height: 951, topInset: 82 }).lockup
    const landscape = splashLayout(DUO_INNER_LANDSCAPE).lockup
    expect(landscape.namePx).toBe(portrait.namePx)
    expect(landscape.leafHeight).toBe(portrait.leafHeight)
  })

  it('눈 조각은 화면 안에 퍼져 있고 그림 비율보다 작게, 그림과 함께 줄어든다', () => {
    const phone = splashLayout(PHONE)
    const se2 = splashLayout(SE2)
    expect(phone.snow.length).toBeGreaterThanOrEqual(5)
    const lefts = phone.snow.map((flake) => flake.left)
    expect(Math.min(...lefts)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...lefts)).toBeLessThan(PHONE.width)
    expect(new Set(lefts).size).toBe(lefts.length)
    const illustrationScale = phone.image.bodyWidth / BODY_PX.width
    phone.snow.forEach((flake, index) => {
      const smaller = se2.snow[index]
      // 조각이 작아 반올림이 비율을 1% 쯤 흔든다.
      expect(smaller.width / flake.width).toBeCloseTo(se2.image.bodyWidth / phone.image.bodyWidth, 1)
      expect(flake.fallMs).toBeGreaterThan(0)
      // 그림에서 뗀 크기 그대로면 클립아트처럼 커 보인다. 가장 큰 조각(115px)도 그림 비율보다 작다.
      expect(flake.width).toBeLessThan(115 * illustrationScale * 0.9)
    })
  })

  it('눈 조각의 시작 자리는 내리는 길 위에 골고루 펼쳐져 있다', () => {
    const { snow } = splashLayout(PHONE)
    const starts = snow.map((flake) => flake.startRatio).sort((a, b) => a - b)
    // 스플래시가 서 있는 2초 남짓 동안 보여야 하므로 화면 위 밖에만 몰려 있으면 안 된다.
    expect(starts[0]).toBeLessThan(0.15)
    expect(starts[starts.length - 1]).toBeGreaterThan(0.8)
    expect(new Set(starts).size).toBe(starts.length)
    const gaps = starts.slice(1).map((start, index) => start - starts[index])
    // 골고루다. 가장 넓은 틈이 가장 좁은 틈의 두 배를 넘지 않는다.
    expect(Math.max(...gaps)).toBeLessThanOrEqual(Math.min(...gaps) * 2)
    for (const flake of snow) {
      expect(flake.startRatio).toBeGreaterThanOrEqual(0)
      expect(flake.startRatio).toBeLessThan(1)
    }
  })
})
