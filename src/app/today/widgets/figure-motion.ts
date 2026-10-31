/**
 * 대표 캐릭터가 무엇을 언제 하는지 정하는 값. 판정과 그리기를 가른다.
 *
 * 무작위를 인자로 받는다. 안에서 `Math.random` 을 부르면 경계값을 테스트로 고를 수 없다.
 */
import type { LookFrame } from '../../../lib/character-look'

export const FIGURE_ACTIONS = ['swing', 'walk', 'laugh', 'wink', 'jump'] as const
export type FigureAction = (typeof FIGURE_ACTIONS)[number]

/** 프레임 한 칸. `liftPx` 는 땅에서 뜬 높이(화면 px)다. */
export interface FigureStep {
  frame: LookFrame
  liftPx: number
  ms: number
}

/** 동작 사이의 대기 시간. 짧으면 위젯을 읽는 동안 시선을 빼앗는다. */
export const FIGURE_REST_MIN_MS = 4000
export const FIGURE_REST_MAX_MS = 7000

/** 대기 프레임 한 칸의 시간. 넥슨이 시간을 안 주어 눈으로 고른 값이다. */
const IDLE_STEP_MS = 450
const IDLE_ORDER: LookFrame[] = ['idle0', 'idle1', 'idle2', 'idle1']

const WALK_STEP_MS = 140
const WALK_ORDER: LookFrame[] = ['walk0', 'walk1', 'walk2', 'walk3']
const WALK_CYCLES = 4

const JUMP_LIFTS = [2, 5, 8, 10, 8, 5, 2]
const JUMP_STEP_MS = 70

/**
 * 한 동작의 프레임들.
 *
 * @param action 동작 이름
 */
export function figureActionSteps(action: FigureAction): FigureStep[] {
  switch (action) {
    case 'swing':
      return [
        { frame: 'swing0', liftPx: 0, ms: 130 },
        { frame: 'swing1', liftPx: 0, ms: 130 },
        { frame: 'swing2', liftPx: 0, ms: 220 },
      ]
    case 'walk':
      return Array.from({ length: WALK_CYCLES * WALK_ORDER.length }, (_, index) => ({
        frame: WALK_ORDER[index % WALK_ORDER.length],
        liftPx: 0,
        ms: WALK_STEP_MS,
      }))
    case 'laugh':
      return [{ frame: 'laugh', liftPx: 0, ms: 1300 }]
    case 'wink':
      return [{ frame: 'wink', liftPx: 0, ms: 800 }]
    case 'jump':
      return JUMP_LIFTS.map((liftPx) => ({ frame: 'jump', liftPx, ms: JUMP_STEP_MS }))
  }
}

/**
 * 동작 사이의 대기 프레임들. 합이 `FIGURE_REST_MIN_MS` ~ `FIGURE_REST_MAX_MS` 다.
 *
 * @param random 0 이상 1 이하의 값을 내는 함수
 */
export function figureRestSteps(random: () => number): FigureStep[] {
  const restMs = FIGURE_REST_MIN_MS + random() * (FIGURE_REST_MAX_MS - FIGURE_REST_MIN_MS)
  const steps: FigureStep[] = []

  for (let used = 0; used < restMs; used += IDLE_STEP_MS) {
    steps.push({
      frame: IDLE_ORDER[steps.length % IDLE_ORDER.length],
      liftPx: 0,
      ms: Math.min(IDLE_STEP_MS, restMs - used),
    })
  }

  return steps
}

/**
 * 다음 동작과 그 뒤의 대기까지 잇는 계획. 같은 동작을 연달아 고르지 않는다.
 *
 * @param last 바로 앞 동작. 처음이면 `null`
 * @param random 0 이상 1 이하의 값을 내는 함수
 */
export function planFigureSteps(
  last: FigureAction | null,
  random: () => number,
): { action: FigureAction; steps: FigureStep[] } {
  const choices = FIGURE_ACTIONS.filter((action) => action !== last)
  // `random()` 이 1 을 내도 목록 밖으로 나가지 않게 막는다.
  const action = choices[Math.min(Math.floor(random() * choices.length), choices.length - 1)]

  return { action, steps: [...figureActionSteps(action), ...figureRestSteps(random)] }
}
