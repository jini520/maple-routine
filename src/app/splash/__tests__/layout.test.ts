// 2겹 스플래시의 자리 계산. 그림 · 잎과 이름 묶음 · 눈 조각이 화면 크기마다 어디에 오는지 본다.
//
// 값을 그대로 비교하지 않는다. 지키는 것은 관계다. 그림은 폭을 넘게 채우되 높은 화면에서만 더 넓고,
// 아래로 흘리며, 묶음은 그림 윗변에 앉되 깃발과 상태바에 닿지 않고, 넓은 화면이 좁은 화면보다 글자와
// 잎이 크다. 눈 조각은 가로로도 세로 시작 자리로도 화면에 골고루 퍼진다.
import { splashLayout, type SplashViewport } from '../layout'

const PHONE: SplashViewport = { width: 390, height: 844, topInset: 47 }
const FOLD8_COVER: SplashViewport = { width: 447, height: 706, topInset: 24 }
const DUO_COVER: SplashViewport = { width: 466, height: 678, topInset: 0 }
const SE2: SplashViewport = { width: 375, height: 667, topInset: 20 }
const VIEWPORTS = [PHONE, FOLD8_COVER, DUO_COVER, SE2]

/** `assets/splash/body.png` 의 픽셀 크기와 알파 마스크로 잰 보이는 윗끝(깃발) 자리 */
const BODY_PX = { width: 1145, height: 1178 }
const FLAG_TOP_RATIO = 0.067

function imageTopOf(viewport: SplashViewport): number {
  const { image } = splashLayout(viewport)
  return viewport.height - image.height - image.bottom
}

describe('splashLayout', () => {
  it('그림은 화면 폭의 110 ~ 125% 이고, 화면 높이의 6할을 넘는 것은 110% 바닥에 걸린 낮은 화면뿐이다', () => {
    for (const viewport of VIEWPORTS) {
      const { image } = splashLayout(viewport)
      expect(image.width).toBeGreaterThanOrEqual(viewport.width * 1.1 - 0.5)
      expect(image.width).toBeLessThanOrEqual(viewport.width * 1.25 + 0.5)
      expect(image.left).toBeCloseTo((viewport.width - image.width) / 2, 0)
      if (image.height > viewport.height * 0.6 + 0.5) {
        expect(image.width).toBeCloseTo(viewport.width * 1.1, 0)
      }
    }
    // 높은 화면은 폭을 끝까지 쓴다. 낮은 화면은 바닥에 걸린다.
    expect(splashLayout(PHONE).image.width).toBe(Math.round(PHONE.width * 1.25))
    expect(splashLayout(DUO_COVER).image.width).toBe(Math.round(DUO_COVER.width * 1.1))
  })

  it('그림은 아래로 흘러 나가되 슬라임이 잘릴 만큼은 아니다', () => {
    for (const viewport of VIEWPORTS) {
      const { image } = splashLayout(viewport)
      expect(image.bottom).toBeLessThan(0)
      // 아래 4% 는 둥글어 모서리에 바탕이 비친다(알파 마스크 측정). 슬라임은 아래 16% 에 있어 8% 넘게 흘리면 얼굴이 잘린다.
      expect(-image.bottom).toBeGreaterThanOrEqual(image.height * 0.045)
      expect(-image.bottom).toBeLessThan(image.height * 0.08)
    }
  })

  it('묶음은 그림 윗변에 앉고, 깃발과 상태바에는 닿지 않는다', () => {
    for (const viewport of VIEWPORTS) {
      const { image, lockup } = splashLayout(viewport)
      const imageTop = imageTopOf(viewport)
      const bottom = lockup.top + lockup.height
      expect(bottom).toBeGreaterThan(imageTop)
      expect(bottom).toBeLessThan(imageTop + image.height * FLAG_TOP_RATIO)
      expect(lockup.top).toBeGreaterThanOrEqual(viewport.topInset)
    }
    // 화면이 달라도 그림 윗변에서 같은 비율만큼 내려온다.
    const overlaps = VIEWPORTS.map((viewport) => {
      const { image, lockup } = splashLayout(viewport)
      return (lockup.top + lockup.height - imageTopOf(viewport)) / image.height
    })
    for (const overlap of overlaps) expect(overlap).toBeCloseTo(overlaps[0], 2)
  })

  it('넓은 화면이 좁은 화면보다 글자와 잎이 조금 크고, 잎은 글자보다 크다', () => {
    const phone = splashLayout(PHONE).lockup
    const fold = splashLayout(FOLD8_COVER).lockup
    const duo = splashLayout(DUO_COVER).lockup
    const se2 = splashLayout(SE2).lockup
    expect(se2.namePx).toBeLessThan(phone.namePx)
    expect(phone.namePx).toBeLessThan(fold.namePx)
    expect(fold.namePx).toBeLessThan(duo.namePx)
    // 조금이다. 폭이 2할 넓어져도 글자는 2할 미만으로 커진다.
    expect(duo.namePx / phone.namePx).toBeLessThan(DUO_COVER.width / PHONE.width)
    for (const lockup of [phone, fold, duo, se2]) {
      expect(lockup.leafHeight).toBeGreaterThan(lockup.namePx)
      expect(lockup.gap).toBeGreaterThan(0)
    }
  })

  it('눈 조각은 화면 안에 퍼져 있고 그림 비율보다 작게, 그림과 함께 줄어든다', () => {
    const phone = splashLayout(PHONE)
    const se2 = splashLayout(SE2)
    expect(phone.snow.length).toBeGreaterThanOrEqual(5)
    const lefts = phone.snow.map((flake) => flake.left)
    expect(Math.min(...lefts)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...lefts)).toBeLessThan(PHONE.width)
    expect(new Set(lefts).size).toBe(lefts.length)
    const illustrationScale = phone.image.width / BODY_PX.width
    phone.snow.forEach((flake, index) => {
      const smaller = se2.snow[index]
      // 조각이 작아 반올림이 비율을 1% 쯤 흔든다.
      expect(smaller.width / flake.width).toBeCloseTo(se2.image.width / phone.image.width, 1)
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
