/**
 * 더보기 배너 줄이 넘어가는 모습의 값. 판정과 그리기를 가른다.
 *
 * 위치 · 겹치는 순서 · 막 · 점이 전부 스크롤 위치 하나에서 나온다. 함수들이 `'worklet'` 인 것은 `useAnimatedStyle` 안에서
 * 불리기 때문이다. 지시어가 없으면 매 프레임 JS 스레드를 깨운다.
 *
 * 칸 번호(page)는 양끝 사본을 포함한 스크롤 칸이다. 넘기기를 시작할 때 서 있던 칸이 이전 배너(base)이고 넘기는 쪽 옆 칸이
 * 새 배너(target)다. 어느 쪽으로 넘기든 새 배너가 위다.
 */

/** 이전 배너가 밀리는 빠르기. 새 배너(스크롤)를 1 로 볼 때다. */
export const OLD_BANNER_SPEED = 0.4

/** 끝까지 넘겨도 이전 배너에 남는 진하기. */
const OLD_BANNER_FLOOR = 0.3

/** 새 배너가 들어올 때의 진하기. */
const NEW_BANNER_START = 0.3

/** 새 배너가 다 진해지는 넘긴 정도. 도착한 뒤에 진해지면 멈춘 그림이 뒤늦게 바뀐다. */
const NEW_BANNER_SOLID_AT = 0.6

/** 점 폭. 점 사이 간격도 같다. */
export const BANNER_DOT_SIZE = 6

/** 이전 배너의 진하기. 앞쪽에서 빨리 옅어진다(반쯤 넘겼을 때 0.39). */
export function oldBannerOpacity(d: number): number {
  'worklet'
  return OLD_BANNER_FLOOR + (1 - OLD_BANNER_FLOOR) * Math.pow(1 - d, 3)
}

/** 새 배너의 진하기. */
export function newBannerOpacity(d: number): number {
  'worklet'
  return NEW_BANNER_START + (1 - NEW_BANNER_START) * Math.min(1, d / NEW_BANNER_SOLID_AT)
}

export interface BannerStep {
  base: number
  target: number
  /** base 에서 넘긴 정도(0~1). */
  d: number
  /** 1 앞으로 · -1 거꾸로 · 0 멈춤. */
  direction: 1 | -1 | 0
}

/**
 * 스크롤 위치에서 이전 · 새 배너를 고르는 함수.
 *
 * @param page 스크롤 위치 ÷ 칸 폭
 * @param base 넘기기를 시작할 때 서 있던 칸
 * @param pageCount 사본을 포함한 칸 수
 */
export function bannerStep(page: number, base: number, pageCount: number): BannerStep {
  'worklet'
  const last = Math.max(0, pageCount - 1)
  const q = Math.min(last, Math.max(0, page))
  // 한 칸을 넘게 지나가면 지나온 칸을 base 로 옮긴다. 안 옮기면 d 가 1 을 넘는다.
  let from = Math.min(last, Math.max(0, base))
  if (q > from + 1) from = Math.floor(q)
  if (q < from - 1) from = Math.ceil(q)
  const t = q - from
  if (t === 0) return { base: from, target: from, d: 0, direction: 0 }
  return { base: from, target: t > 0 ? from + 1 : from - 1, d: Math.abs(t), direction: t > 0 ? 1 : -1 }
}

export interface BannerSlideFrame {
  visible: boolean
  zIndex: number
  translateX: number
  /** 배경색 막의 불투명도. 배너를 투명하게 하면 겹친 곳이 포개져 진해지므로 막으로 옅게 한다. */
  veil: number
}

/**
 * 칸 하나의 모습.
 *
 * @param index 이 칸의 번호
 * @param step `bannerStep` 의 결과
 * @param width 칸 폭(px)
 */
export function bannerSlideFrame(index: number, step: BannerStep, width: number): BannerSlideFrame {
  'worklet'
  if (index === step.base) {
    // 스크롤은 모든 칸을 같이 옮기므로 이전 배너만 되밀어 느리게 보이게 한다.
    const t = step.direction * step.d
    return { visible: true, zIndex: 1, translateX: t * (1 - OLD_BANNER_SPEED) * width, veil: 1 - oldBannerOpacity(step.d) }
  }
  if (index === step.target) {
    return { visible: true, zIndex: 2, translateX: 0, veil: 1 - newBannerOpacity(step.d) }
  }
  // 이전 배너가 옅어질 때 그 아래 칸이 비치지 않게 숨긴다.
  return { visible: false, zIndex: 0, translateX: 0, veil: 0 }
}

/** 스크롤 칸 수. 배너가 둘 이상이면 끝과 처음을 잇는 사본이 양끝에 하나씩 붙는다. */
export function loopPageCount(bannerCount: number): number {
  'worklet'
  return bannerCount > 1 ? bannerCount + 2 : bannerCount
}

/** 스크롤 칸 번호의 실제 배너 번호. 첫 칸은 마지막 사본, 끝 칸은 첫 사본이다. */
export function realBannerIndex(page: number, bannerCount: number): number {
  'worklet'
  if (bannerCount <= 1) return 0
  return (((page - 1) % bannerCount) + bannerCount) % bannerCount
}

/** 멈춘 칸이 사본이면 같은 그림의 실제 칸. 멈춘 상태라 옮겨도 화면이 그대로다. */
export function settledLoopPage(page: number, bannerCount: number): number {
  'worklet'
  if (bannerCount <= 1) return page
  if (page <= 0) return bannerCount
  if (page >= bannerCount + 1) return 1
  return page
}

/**
 * 점 D 의 주황 표시. 앞쪽이 먼저 늘어 옆 점에 닿고(d 0~0.5) 뒤쪽이 따라온다(d 0.5~1).
 *
 * @param from 이전 배너의 점 번호
 * @param to 새 배너의 점 번호. 마지막에서 처음으로 가면 점 줄 끝에서 끝까지 늘어난다
 * @returns 첫 점 왼쪽 끝을 0 으로 한 자리와 폭(px)
 */
export function wormBar(from: number, to: number, d: number): { left: number; width: number } {
  'worklet'
  const step = BANNER_DOT_SIZE * 2
  const a = from * step
  const b = to * step
  const head = a + (b - a) * Math.min(1, d * 2)
  const tail = a + (b - a) * Math.max(0, d * 2 - 1)
  const left = Math.min(head, tail)
  return { left, width: Math.max(head, tail) - left + BANNER_DOT_SIZE }
}
