// 화면 스택 전환의 상수와 순수 계산([[ADR-120]]). 값을 여기 모으는 이유는 **실기기 확인 뒤
// 확정**하기로 한 수치들이라(결정 12) 한 곳에서 고쳐야 하기 때문이다.
//
// **진행률(progress)의 뜻은 하나다** — `0` 은 오버레이가 다 들어와 화면을 덮은 상태,
// `1` 은 화면 밖 오른쪽(= 오버레이가 없는 상태)이다. 들어오는 연출은 1→0, 나가는 연출은 0→1,
// 스와이프는 손가락 위치가 그대로 이 값이다. 세 가지가 같은 축을 쓰므로 중간에 서로 이어받을 수 있다
// (끌다 놓으면 그 자리에서 정착 애니메이션이 시작된다).

export const STACK_TRANSITION_MS = 340
export const STACK_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

/** 아래 화면(탭 레이어)이 밀려나는 정도. iOS 패럴랙스 비율. */
export const STACK_BELOW_SHIFT_PERCENT = 30

/** 아래 화면을 덮는 스크림의 최대 불투명도. 두 층을 구분하되 아래가 읽히는 정도. */
export const STACK_SCRIM_OPACITY = 0.12

/** 가장자리 스와이프 백이 시작되는 왼쪽 띠의 폭. */
export const STACK_EDGE_ZONE_PX = 28

/** 이만큼 끌고 놓으면 pop. 그 전에 놓으면 원위치. */
export const STACK_POP_DISTANCE_RATIO = 0.35

/** 거리와 무관하게 pop 시키는 튕김 속도(px/ms). */
export const STACK_POP_VELOCITY = 0.4

/** 손을 뗀 뒤 정착 애니메이션의 하한. 이보다 짧으면 뚝 끊겨 보인다. */
export const STACK_MIN_SETTLE_MS = 120

/** 세로 이동이 이만큼 앞서면 스크롤로 판정하고 제스처를 포기한다. */
export const STACK_GESTURE_SLOP_PX = 6

export type StackDirection = 'push' | 'pop' | 'replace'

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

/**
 * 오버레이의 `transform`. **값이 0이면 `undefined` 를 돌려준다** — `translateX(0)` 을 남기지 않는
 * 것이 [[ADR-120]] 결정 7 이다(걸려 있는 동안 containing block 이 되어 `fixed`·중첩 sticky 후손의
 * 기준을 바꾼다, [[ADR-073]] 결정 3).
 */
export function resolveStackTransform(progress: number): string | undefined {
  const clamped = clamp01(progress)
  if (clamped === 0) return undefined
  return `translateX(${clamped * 100}%)`
}

/**
 * 어떤 층에서 볼 때 **바로 위 층의 진행률**. 스택이 2단 이상이 될 수 있어 필요하다
 * (`/settings` → `/settings/about` → `/settings/about/privacy`).
 *
 * 움직이는 것은 언제나 최상단 하나뿐이므로, 각 층이 알아야 할 것은 셋 중 하나다:
 *   · 내가 최상단이다 → 위에 아무것도 없다(`1`)
 *   · 내 바로 위가 최상단이다 → 그 진행률이 곧 내가 밀리는 정도
 *   · 그보다 아래다 → 위가 다 덮고 있다(`0`), 더 밀리지 않는다
 *
 * 탭 레이어는 `index: -1` 로 묻는다 — 오버레이가 하나도 없으면 `1` 이 나와 `transform` 이 없다.
 */
export function resolveLayerAboveProgress(index: number, depth: number, topProgress: number): number {
  if (index >= depth - 1) return 1
  if (index === depth - 2) return topProgress
  return 0
}

/**
 * 스택의 `index` 번째 오버레이가 걸 `transform`. 최상단이면 자기가 들어오고 나가는 값이고,
 * 아래면 위에 밀려나는 값이다 — 둘 다 `translateX` 라 한 요소에 동시에 걸릴 일이 없다.
 *
 * **`index >= depth` 는 "아직 등록되지 않았다"이고, 그때는 화면 밖이다.** `StackScreen` 은 마운트
 * effect 에서 `open()` 을 부르므로 **그 컴포넌트의 첫 렌더는 자기가 세어지기 전에 돈다.** 이 갈래가
 * 없으면 그 프레임에 `transform` 이 없어 오버레이가 **제자리에 통째로 한 번 그려지고**, 그다음
 * effect 가 돌며 밖으로 튀었다가 들어온다 — 실기기에서 "화면이 다 그려진 뒤에 애니메이션이 시작"
 * 으로 관측된 결함이다(2026-08-09, 보스 수익 → 히스토리에서 가장 크게 보였다).
 *
 * effect 를 `useLayoutEffect` 로 바꿔 페인트 전에 등록하는 처방도 있지만, 그건 **타이밍에 기대는**
 * 해법이다. 첫 렌더가 스스로 옳은 값을 내는 편이 낫다.
 */
export function resolveLayerTransform(index: number, depth: number, topProgress: number): string | undefined {
  if (index >= depth) return resolveStackTransform(1)
  if (index === depth - 1) return resolveStackTransform(topProgress)
  return resolveBelowTransform(resolveLayerAboveProgress(index, depth, topProgress))
}

/**
 * 아래 화면의 `transform`. 진행률이 1이면(= 위에 아무것도 없으면) `undefined` 다 —
 * 앱 시간의 대부분이 이 상태이고, 그동안 탭 화면에는 `transform` 이 존재하지 않는다.
 */
export function resolveBelowTransform(progress: number): string | undefined {
  const clamped = clamp01(progress)
  if (clamped === 1) return undefined
  return `translateX(${-STACK_BELOW_SHIFT_PERCENT * (1 - clamped)}%)`
}

/** 아래 화면을 덮는 스크림의 불투명도. 오버레이가 다 들어왔을 때 최대다. */
export function resolveScrimOpacity(progress: number): number {
  return STACK_SCRIM_OPACITY * (1 - clamp01(progress))
}

/**
 * 손을 뗐을 때 pop 할 것인가. **거리와 속도 둘 중 하나만 넘으면 된다** — 짧게 튕기는 것도,
 * 느리게 끝까지 끄는 것도 둘 다 "돌아가겠다"는 뜻이다.
 */
export function shouldPopOnRelease(progress: number, velocity: number): boolean {
  return velocity >= STACK_POP_VELOCITY || clamp01(progress) >= STACK_POP_DISTANCE_RATIO
}

/**
 * 손을 뗀 뒤 정착 애니메이션의 시간. **남은 거리에 비례해 줄인다** — 다 끌어놓고 전체 시간을
 * 다시 기다리면 제스처가 손가락에서 떨어져 나간 것처럼 느껴진다.
 */
export function resolveSettleMs(progress: number, willPop: boolean, fullMs = STACK_TRANSITION_MS): number {
  if (fullMs === 0) return 0
  const clamped = clamp01(progress)
  const remaining = willPop ? 1 - clamped : clamped
  return Math.max(STACK_MIN_SETTLE_MS, Math.round(fullMs * remaining))
}

/**
 * 이 기기에서 전환에 쓸 시간. `prefers-reduced-motion: reduce` 면 0이다 — **구조는 그대로 두고
 * 시간만 없앤다**([[ADR-120]] 결정 7). 오버레이도 스와이프 백도 그대로 있고, 움직임만 즉시 끝난다.
 */
export function resolveTransitionMs(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return STACK_TRANSITION_MS
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : STACK_TRANSITION_MS
}

function toSegments(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '')
}

/**
 * 두 경로 사이의 이동이 스택의 어느 방향인가([[ADR-120]] 결정 9-b).
 *
 * **세그먼트 단위로 접두사인지 묻는다** — 문자열 `startsWith` 로 물으면 `/boss` 와 `/boss-profit`
 * 처럼 이름이 겹치는 형제가 부모·자식으로 오판된다.
 *
 * `replace` 는 스택 이동이 아닌 전부다(탭 이동·온보딩 리다이렉트). 연출 없이 즉시 교체한다.
 */
/**
 * 경로가 속한 **탭**([[ADR-120]] 결정 13). 하위 페이지 청크를 어느 탭에서 미리 받을지 고르는 데 쓴다 —
 * `/settings/about/privacy` 도 `/settings` 탭에 속한다.
 */
export function resolveTabPath(pathname: string): string {
  const [first] = toSegments(pathname)
  return first === undefined ? '/' : `/${first}`
}

/**
 * 한 단계 위 경로. 딥링크로 하위 페이지에 직접 들어와 되돌아갈 히스토리 항목이 없을 때
 * `navigate(-1)` 대신 갈 곳이다([[ADR-120]] 결정 9).
 */
export function resolveParentPath(pathname: string): string {
  const segments = toSegments(pathname)
  if (segments.length <= 1) return '/'
  return `/${segments.slice(0, -1).join('/')}`
}

export function resolveStackDirection(from: string, to: string): StackDirection {
  const fromSegments = toSegments(from)
  const toSegments_ = toSegments(to)

  const isPrefix = (shorter: string[], longer: string[]): boolean =>
    shorter.length < longer.length && shorter.every((segment, index) => segment === longer[index])

  if (isPrefix(toSegments_, fromSegments)) return 'pop'
  if (isPrefix(fromSegments, toSegments_)) return 'push'
  return 'replace'
}
