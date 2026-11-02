// 2겹 스플래시의 자리 계산. 그림 · 잎과 이름 묶음 · 눈 조각이 화면 크기마다 어디에 오는지 본다.
//
// 값을 그대로 비교하지 않는다. 지키는 것은 관계다. 그림은 폭을 꽉 채우고 아래로 흘리며, 묶음은
// 상태바 아래 남은 높이의 34% 쯤에 오되 그림 윗변을 넘어 내려가지 않고, 넓은 화면이 좁은 화면보다
// 글자와 잎이 크다. 눈 조각은 가로로도 세로 시작 자리로도 화면에 골고루 퍼진다.
import { splashLayout, type SplashViewport } from '../layout'

const PHONE: SplashViewport = { width: 390, height: 844, topInset: 47 }
const FOLD8_COVER: SplashViewport = { width: 447, height: 706, topInset: 24 }
const DUO_COVER: SplashViewport = { width: 466, height: 678, topInset: 0 }
const SE2: SplashViewport = { width: 375, height: 667, topInset: 20 }
const VIEWPORTS = [PHONE, FOLD8_COVER, DUO_COVER, SE2]

describe('splashLayout', () => {
  it('그림은 화면보다 넓고 가운데에 서며 아래로 흘러 나간다', () => {
    for (const viewport of VIEWPORTS) {
      const { image } = splashLayout(viewport)
      expect(image.width).toBeGreaterThan(viewport.width)
      expect(image.left).toBeCloseTo((viewport.width - image.width) / 2, 0)
      expect(image.bottom).toBeLessThan(0)
      // 원본 아래 10% 가 둥글게 좁아진다. 그보다 더 흘려야 모서리에 바탕이 안 비친다.
      expect(-image.bottom).toBeGreaterThan(image.height * 0.1)
    }
  })

  it('묶음은 상태바 아래 남은 높이의 34% 자리에 오고 그림 윗변 아래로는 내려가지 않는다', () => {
    for (const viewport of VIEWPORTS) {
      const { image, lockup } = splashLayout(viewport)
      const imageTop = viewport.height - image.height - image.bottom
      const centerY = lockup.top + lockup.height / 2
      const ratio = (centerY - viewport.topInset) / (viewport.height - viewport.topInset)
      expect(ratio).toBeLessThanOrEqual(0.34 + 0.001)
      expect(lockup.top + lockup.height).toBeLessThanOrEqual(imageTop + image.height * 0.03 + 0.5)
      expect(lockup.top).toBeGreaterThan(viewport.topInset)
    }
    // 그림에 막히지 않는 화면에서는 정확히 34% 다.
    const { lockup } = splashLayout(PHONE)
    const centerY = lockup.top + lockup.height / 2
    expect((centerY - PHONE.topInset) / (PHONE.height - PHONE.topInset)).toBeCloseTo(0.34, 2)
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

  it('눈 조각은 화면 안에 퍼져 있고 그림과 같은 비율로 줄어든다', () => {
    const phone = splashLayout(PHONE)
    const se2 = splashLayout(SE2)
    expect(phone.snow.length).toBeGreaterThanOrEqual(5)
    const lefts = phone.snow.map((flake) => flake.left)
    expect(Math.min(...lefts)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...lefts)).toBeLessThan(PHONE.width)
    expect(new Set(lefts).size).toBe(lefts.length)
    phone.snow.forEach((flake, index) => {
      const smaller = se2.snow[index]
      // 조각이 작아 반올림이 비율을 1% 쯤 흔든다.
      expect(smaller.width / flake.width).toBeCloseTo(se2.image.width / phone.image.width, 1)
      expect(flake.fallMs).toBeGreaterThan(0)
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
