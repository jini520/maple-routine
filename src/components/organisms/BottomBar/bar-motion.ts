/**
 * 하단바를 누르고 끄는 동안의 판정. 손가락 자리에서 알약이 갈 칸, 끌기 여부, 손을 뗄 때 고를 칸을 정하는 순수 함수와
 * 그 움직임에 쓰는 스프링 값.
 *
 * 함수는 제스처 워크릿(UI 스레드)에서 불리므로 모두 `'worklet'` 이다. 그리기와 공유값은 `BottomBar` 가 맡는다.
 * 좌표는 칸이 늘어선 방향 하나(가로 바는 x, 세로 막대는 y)다.
 */

/** 처음 누른 자리에서 이만큼 넘게 움직여야 끌기다. 그 안의 떨림은 누름이다. */
export const DRAG_THRESHOLD = 3

/** 시스템 탭 바를 녹화해 맞춘 스프링. mass 1. */
export const TRAVEL_SPRING = { stiffness: 410, damping: 36, mass: 1 }
/** 누를 때 바 부풀기 · ← 누름. */
export const LIFT_SPRING = { stiffness: 470, damping: 28, mass: 1 }
/** 알약 들림. */
export const HOLD_SPRING = { stiffness: 900, damping: 50, mass: 1 }
/** 떼고 돌아오기. */
export const RELEASE_SPRING = { stiffness: 520, damping: 30, mass: 1 }
/** 칸 수가 바뀔 때 바 폭과 자리. */
export const RESIZE_SPRING = { stiffness: 362, damping: 38, mass: 1 }

/** 누르는 동안 바가 부푸는 배율. */
export const BAR_PRESS_SCALE = 0.035
/** 들린 알약의 가로 · 세로 배율. */
export const HOLD_GROW_W = 0.26
export const HOLD_GROW_H = 0.34

/**
 * 옆 칸으로 갈 때 알약 모양의 키프레임(값, ms). 세로가 먼저 커지고 도착 때 가로로 퍼졌다 출렁인다.
 * 시스템 녹화의 폭 · 높이 비를 시각별로 옮긴 값이다.
 */
export const TRAVEL_SHAPE_H: readonly (readonly [number, number])[] = [
  [0.446, 135],
  [0.1, 115],
  [0.013, 85],
  [0.12, 180],
  [0, 355],
]
export const TRAVEL_SHAPE_W: readonly (readonly [number, number])[] = [
  [0.05, 50],
  [0.013, 70],
  [0.29, 150],
  [-0.094, 230],
  [0, 370],
]

/** 한 행의 칸 자리. */
export interface Slots {
  /** 행 시작에서 첫 칸 가운데까지. */
  first: number
  /** 칸 가운데 사이 거리. */
  spacing: number
  /** 항목 수. 하위가 셋인 행은 네 칸 격자여도 3 이다(빈 넷째 칸에는 앉지 않는다). */
  count: number
}

/** 누른 뒤 손을 뗄 때까지 들고 다니는 상태. */
export interface PressState {
  /** 누른 칸. 누르고 있지 않으면 −1. */
  index: number
  /** 하위 행으로 넘어갈 칸을 눌러 알약을 움직이지 않은 상태. 끌기 시작하면 풀린다. */
  quiet: boolean
  dragging: boolean
  /** 끌기를 시작한 순간 알약 가운데와 손가락의 거리. 끄는 동안 이 거리를 지켜 알약이 손가락 쪽으로 튀지 않는다. */
  dragOffset: number
}

export const IDLE_PRESS: PressState = { index: -1, quiet: false, dragging: false, dragOffset: 0 }

/** 그 자리에서 가장 가까운 칸. */
export function slotAt(pos: number, slots: Slots): number {
  'worklet'
  if (slots.spacing <= 0) return 0
  return Math.max(0, Math.min(slots.count - 1, Math.round((pos - slots.first) / slots.spacing)))
}

export function slotCenter(index: number, slots: Slots): number {
  'worklet'
  return slots.first + index * slots.spacing
}

export interface PressBegin {
  press: PressState
  /** 알약이 출발할 자리. 움직이지 않으면 null. */
  pillTarget: number | null
  /** 지금 칸이 아닌 칸으로 출발하는가(이동 중 모양 변화를 건다). */
  travel: boolean
  /** 렌즈를 띄우는가. 알약을 움직이지 않는 누름은 띄우지 않는다. */
  lens: boolean
}

/**
 * 손이 닿은 순간. 알약은 누른 칸으로 바로 출발한다.
 *
 * 하위가 있는 그룹 칸(`opensRow[index] === 1`)은 곧 사라질 행이다. 그 칸으로 알약을 보내지 않고, 손을 떼면 행이 통째로 바뀐다.
 *
 * @param opensRow 칸마다 누르면 하위 행으로 넘어가는지(1)
 */
export function beginPress(pos: number, slots: Slots, opensRow: readonly number[], activeIndex: number): PressBegin {
  'worklet'
  const index = slotAt(pos, slots)
  if (opensRow[index] === 1) {
    return { press: { index, quiet: true, dragging: false, dragOffset: 0 }, pillTarget: null, travel: false, lens: false }
  }
  return {
    press: { index, quiet: false, dragging: false, dragOffset: 0 },
    pillTarget: slotCenter(index, slots),
    travel: index !== activeIndex,
    lens: true,
  }
}

export interface PressMove {
  press: PressState
  /** 알약을 둘 자리. 끌기 전이면 null(누를 때 보낸 스프링을 그대로 둔다). */
  pillPos: number | null
  /** 이 움직임에서 끌기가 시작됐는가. */
  startedDrag: boolean
  /** 조용한 누름에서 끌기로 넘어가 이제 렌즈를 띄우는가. */
  startedLens: boolean
}

/**
 * 손가락이 움직임. 처음 자리에서 `DRAG_THRESHOLD` 를 넘으면 끌기이고, 그 뒤 알약은 손가락이 움직인 만큼만 따라간다.
 *
 * @param translation 처음 누른 자리에서 움직인 거리
 * @param pillPos 지금 알약 가운데
 */
export function movePress(press: PressState, pos: number, translation: number, pillPos: number, slots: Slots): PressMove {
  'worklet'
  let next = press
  let startedDrag = false
  let startedLens = false
  if (!press.dragging && Math.abs(translation) > DRAG_THRESHOLD) {
    next = { index: press.index, quiet: false, dragging: true, dragOffset: pillPos - pos }
    startedDrag = true
    startedLens = press.quiet
  }
  if (!next.dragging) return { press: next, pillPos: null, startedDrag, startedLens }
  const min = slotCenter(0, slots)
  const max = slotCenter(slots.count - 1, slots)
  return { press: next, pillPos: Math.max(min, Math.min(max, pos + next.dragOffset)), startedDrag, startedLens }
}

export interface PressEnd {
  /** 손을 뗀 칸. 이 칸으로 이동하고, 하위가 있는 그룹이면 행이 바뀐다. 누르고 있지 않았으면 −1. */
  commitIndex: number
  /** 알약이 앉을 자리. 조용한 누름이면 null(알약은 움직이지 않고 행이 바뀐다). */
  pillTarget: number | null
}

/**
 * 손을 뗀 순간. 끌었으면 알약이 있는 자리에서 가장 가까운 칸, 아니면 누른 칸을 고른다.
 *
 * @param pillPos 지금 알약 가운데
 */
export function endPress(press: PressState, pillPos: number, slots: Slots): PressEnd {
  'worklet'
  if (press.index < 0) return { commitIndex: -1, pillTarget: null }
  if (press.quiet) return { commitIndex: press.index, pillTarget: null }
  const index = press.dragging ? slotAt(pillPos, slots) : press.index
  return { commitIndex: index, pillTarget: slotCenter(index, slots) }
}

/**
 * 화면 이동을 다음 프레임으로 미루는 함수. 같은 틱에 바 행 갱신과 화면 마운트가 한 커밋에 묶이면, JS 가 새 화면을 그리는
 * 동안(실기기 100~190ms) 행 전환의 첫 프레임도 함께 기다린다.
 */
export function deferNavigation(run: () => void): void {
  requestAnimationFrame(run)
}

/**
 * 렌즈의 휨 세기(0 ~ 1). 알약을 움직이는 누름이면 손을 뗄 때까지 1 이다.
 *
 * 끈 거리나 속도로 세기를 정하면 끌다 멈추는 순간 번짐이 가라앉아 렌즈가 출렁여 보인다. 제자리 누름 · 끌기 · 끌다 멈춤의
 * 모양이 같아야 한다.
 */
export function lensStrength(press: PressState): number {
  'worklet'
  return press.index >= 0 && !press.quiet ? 1 : 0
}
