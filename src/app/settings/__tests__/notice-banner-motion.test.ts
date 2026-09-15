// 더보기 배너 줄이 넘어가는 모습의 값. 사용자가 시안에서 정한 값이다(2026-09-16).
//
// 넘기기를 시작할 때 서 있던 칸이 이전 배너(base)이고 넘기는 쪽 옆 칸이 새 배너(target)다. d 는 base 에서 넘긴 정도(0~1)다.
import {
  bannerSlideFrame,
  bannerStep,
  loopPageCount,
  newBannerOpacity,
  oldBannerOpacity,
  realBannerIndex,
  settledLoopPage,
  wormBar,
} from '../notice-banner-motion'

describe('진하기', () => {
  // 앞쪽에서 빨리 옅어지고 끝까지 넘겨도 30% 는 남는다.
  it('이전 배너는 1 에서 0.3 으로 빨리 옅어진다', () => {
    expect(oldBannerOpacity(0)).toBe(1)
    expect(oldBannerOpacity(0.5)).toBeCloseTo(0.3875)
    expect(oldBannerOpacity(1)).toBeCloseTo(0.3)
  })

  // 도착한 뒤에 진해지면 멈춘 그림이 뒤늦게 바뀐다.
  it('새 배너는 0.3 으로 들어와 60% 넘겼을 때 이미 1 이다', () => {
    expect(newBannerOpacity(0)).toBeCloseTo(0.3)
    expect(newBannerOpacity(0.3)).toBeCloseTo(0.65)
    expect(newBannerOpacity(0.6)).toBe(1)
    expect(newBannerOpacity(1)).toBe(1)
  })
})

describe('bannerStep', () => {
  it('앞으로 넘기면 옆 칸이 새 배너다', () => {
    expect(bannerStep(2.25, 2, 8)).toEqual({ base: 2, target: 3, d: 0.25, direction: 1 })
  })

  it('거꾸로 넘기면 앞 칸이 새 배너다', () => {
    expect(bannerStep(1.6, 2, 8)).toMatchObject({ base: 2, target: 1, direction: -1 })
    expect(bannerStep(1.6, 2, 8).d).toBeCloseTo(0.4)
  })

  it('멈춰 있으면 새 배너가 없다', () => {
    expect(bannerStep(3, 3, 8)).toEqual({ base: 3, target: 3, d: 0, direction: 0 })
  })

  // 한 번에 한 칸을 넘게 지나가면 지나온 칸을 base 로 옮긴다. 안 옮기면 d 가 1 을 넘는다.
  it('한 칸을 넘게 지나가면 base 를 옮긴다', () => {
    expect(bannerStep(4.5, 2, 8)).toMatchObject({ base: 4, target: 5 })
    expect(bannerStep(0.5, 3, 8)).toMatchObject({ base: 1, target: 0 })
  })

  it('스크롤이 끝을 넘어도 칸 안으로 자른다', () => {
    expect(bannerStep(-0.2, 0, 8)).toEqual({ base: 0, target: 0, d: 0, direction: 0 })
    expect(bannerStep(7.4, 7, 8)).toEqual({ base: 7, target: 7, d: 0, direction: 0 })
  })
})

describe('bannerSlideFrame', () => {
  const step = bannerStep(2.5, 2, 8)

  // 스크롤은 모든 칸을 같이 옮긴다. 이전 배너만 되밀어 새 배너의 40% 빠르기로 보이게 한다.
  it('이전 배너는 아래에서 느리게 밀리고 옅어진다', () => {
    const frame = bannerSlideFrame(2, step, 360)
    expect(frame.visible).toBe(true)
    expect(frame.zIndex).toBe(1)
    expect(frame.translateX).toBeCloseTo(0.5 * 0.6 * 360)
    expect(frame.veil).toBeCloseTo(1 - oldBannerOpacity(0.5))
  })

  it('새 배너는 위에서 스크롤을 따라오고 막이 걷힌다', () => {
    const frame = bannerSlideFrame(3, step, 360)
    expect(frame).toMatchObject({ visible: true, zIndex: 2, translateX: 0 })
    expect(frame.veil).toBeCloseTo(1 - newBannerOpacity(0.5))
  })

  it('거꾸로 넘길 때도 새 배너가 위다', () => {
    const back = bannerStep(1.7, 2, 8)
    expect(bannerSlideFrame(1, back, 360).zIndex).toBe(2)
    expect(bannerSlideFrame(2, back, 360).zIndex).toBe(1)
    expect(bannerSlideFrame(2, back, 360).translateX).toBeCloseTo(-0.3 * 0.6 * 360)
  })

  // 이전 배너가 옅어질 때 그 아래 칸이 비치면 안 된다.
  it('둘 말고는 숨긴다', () => {
    expect(bannerSlideFrame(1, step, 360).visible).toBe(false)
    expect(bannerSlideFrame(4, step, 360).visible).toBe(false)
  })

  it('멈춰 있으면 서 있는 칸 하나만 막 없이 보인다', () => {
    const rest = bannerStep(2, 2, 8)
    expect(bannerSlideFrame(2, rest, 360)).toEqual({ visible: true, zIndex: 1, translateX: 0, veil: 0 })
    expect(bannerSlideFrame(3, rest, 360).visible).toBe(false)
  })
})

describe('마지막과 처음 잇기', () => {
  // 양끝에 사본을 하나씩 둔다. [마지막 사본, 배너들, 첫 사본]
  it('배너가 둘 이상이면 칸이 둘 는다 · 하나면 그대로다', () => {
    expect(loopPageCount(6)).toBe(8)
    expect(loopPageCount(1)).toBe(1)
    expect(loopPageCount(0)).toBe(0)
  })

  it('칸 번호를 실제 배너 번호로 바꾼다', () => {
    expect([0, 1, 2, 6, 7].map((page) => realBannerIndex(page, 6))).toEqual([5, 0, 1, 5, 0])
    expect(realBannerIndex(0, 1)).toBe(0)
  })

  // 사본 칸에 멈추면 같은 그림의 실제 칸으로 옮긴다. 멈춘 상태라 화면은 그대로다.
  it('사본 칸에 멈추면 실제 칸 번호를 준다', () => {
    expect(settledLoopPage(7, 6)).toBe(1)
    expect(settledLoopPage(0, 6)).toBe(6)
    expect(settledLoopPage(3, 6)).toBe(3)
    expect(settledLoopPage(0, 1)).toBe(0)
  })
})

describe('wormBar', () => {
  // 점 폭 6 · 간격 6 이라 점 하나가 12 다. 앞쪽이 먼저 늘어 옆 점에 닿고 뒤쪽이 따라온다.
  it('앞으로 넘기면 오른쪽 끝이 먼저 간다', () => {
    expect(wormBar(2, 3, 0)).toEqual({ left: 24, width: 6 })
    expect(wormBar(2, 3, 0.25)).toEqual({ left: 24, width: 12 })
    expect(wormBar(2, 3, 0.5)).toEqual({ left: 24, width: 18 })
    expect(wormBar(2, 3, 0.75)).toEqual({ left: 30, width: 12 })
    expect(wormBar(2, 3, 1)).toEqual({ left: 36, width: 6 })
  })

  it('거꾸로 넘기면 왼쪽 끝이 먼저 간다', () => {
    expect(wormBar(2, 1, 0.5)).toEqual({ left: 12, width: 18 })
    expect(wormBar(2, 1, 0.75)).toEqual({ left: 12, width: 12 })
  })

  it('마지막에서 처음으로 가면 마지막 점에서 첫 점까지 늘었다 줄어든다', () => {
    expect(wormBar(5, 0, 0.5)).toEqual({ left: 0, width: 66 })
    expect(wormBar(5, 0, 1)).toEqual({ left: 0, width: 6 })
  })
})
