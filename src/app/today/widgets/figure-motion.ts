/**
 * 대표 캐릭터가 무엇을 언제 하는지 정하는 값. 판정과 그리기를 가른다.
 *
 * 무작위를 인자로 받는다. 안에서 `Math.random` 을 부르면 경계값을 테스트로 고를 수 없다.
 */
import { BLINK_EMOTION, PICKABLE_EMOTIONS } from '../../../features/figure-motion/config'
import {
  DEFAULT_EMOTION,
  LOOK_ACTION_FRAMES,
  LOOK_ACTIONS,
  LOOK_EMOTION_FRAMES,
  lookFrameKey,
} from '../../../lib/character-look'
import type { FigureMotion, LookAction, LookEmotion, LookFrame } from '../../../types/figure-motion'

/** 그림 한 칸. `liftPx` 는 땅에서 뜬 높이(화면 px)다. */
export interface FigureStep {
  frame: LookFrame
  liftPx: number
  ms: number
}

/** 깜빡임 한 장의 시간. 빠르게 지나가야 한다 */
export const BLINK_STEP_MS = 50
export const BLINK_GAP_MIN_MS = 2000
export const BLINK_GAP_MAX_MS = 5000
const BLINK_MS = BLINK_STEP_MS * 2

/** 쉬는 동안의 대기 동작 */
const IDLE_ACTION: LookAction = 'A01'
const IDLE_ORDER = [0, 1, 2, 1]
const IDLE_STEP_MS = 450

/** 여러 장인 표정이 다음 장으로 넘어가는 시간 */
const EMOTION_STEP_MS = 380

const JUMP_ACTION: LookAction = 'A06'
const JUMP_LIFTS = [2, 5, 8, 10, 8, 5, 2]
const JUMP_STEP_MS = 70
/** 점프 사이의 바탕 동작. 대기 동작이나 걷기다 */
const JUMP_GROUND: Readonly<Record<'A01' | 'A03', { order: number[]; ms: number }>> = {
  A01: { order: [0, 1, 2, 1], ms: 300 },
  A03: { order: [0, 1, 2, 3, 0, 1, 2, 3], ms: 140 },
}

// 프레임 시간. 넥슨이 시간을 주지 않아 시안에서 고른 값이다.
const STANDING = new Set<LookAction>(['A00', 'A01', 'A35'])
const WALKING = new Set<LookAction>(['A02', 'A03', 'A34'])
const HANGING = new Set<LookAction>(['A05', 'A08', 'A09', 'A38', 'A39', 'A40'])
const BREATHING = new Set<LookAction>(['A10', 'A11'])

interface BodyStep {
  action: LookAction
  frame: number
  liftPx: number
  ms: number
}

function frameIndexes(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index)
}

/** 행동 한 바퀴의 몸 프레임 */
function actionCycle(action: LookAction): BodyStep[] {
  const count = LOOK_ACTION_FRAMES[action]
  const steps = (order: number[], ms: (index: number) => number): BodyStep[] =>
    order.map((frame, index) => ({ action, frame, liftPx: 0, ms: ms(index) }))

  if (count === 1) return steps([0], () => 1000)
  if (STANDING.has(action) && count === 3) return steps(IDLE_ORDER, () => IDLE_STEP_MS)
  if (WALKING.has(action)) return steps(frameIndexes(count), () => 140)
  if (HANGING.has(action)) return steps(frameIndexes(count), () => 260)
  if (BREATHING.has(action)) return steps(frameIndexes(count), () => 300)
  return steps(frameIndexes(count), (index) => (index === count - 1 ? 520 : 150))
}

function groundSteps(base: 'A01' | 'A03'): BodyStep[] {
  const ground = JUMP_GROUND[base]
  return ground.order.map((frame) => ({ action: base, frame, liftPx: 0, ms: ground.ms }))
}

/** 바탕 동작 한 번 뒤에 점프 한 번 */
function jumpCycle(base: 'A01' | 'A03'): BodyStep[] {
  return [
    ...groundSteps(base),
    ...JUMP_LIFTS.map((liftPx) => ({ action: JUMP_ACTION, frame: 0, liftPx, ms: JUMP_STEP_MS })),
  ]
}

/** 한 바퀴를 되풀이해 정확히 `durationMs` 를 채운다 */
function filled(cycle: BodyStep[], durationMs: number): BodyStep[] {
  const steps: BodyStep[] = []
  for (let used = 0, index = 0; used < durationMs; index += 1) {
    const step = cycle[index % cycle.length]
    const ms = Math.min(step.ms, durationMs - used)
    steps.push({ ...step, ms })
    used += ms
  }
  return steps
}

/** 점프는 끝에 한 바퀴가 다 안 들어가면 바탕 동작으로 채운다. 공중에서 끊기면 다음 행동이 튄다 */
function jumpSteps(base: 'A01' | 'A03', durationMs: number): BodyStep[] {
  const cycle = jumpCycle(base)
  const cycleMs = cycle.reduce((sum, step) => sum + step.ms, 0)
  const whole = Math.floor(durationMs / cycleMs)
  const steps = Array.from({ length: whole }, () => cycle).flat()
  return [...steps, ...filled(groundSteps(base), durationMs - whole * cycleMs)]
}

/** 몸 프레임에 표정을 입힌다. 여러 장인 표정은 시간에 따라 다음 장으로 넘어간다 */
function withEmotion(body: BodyStep[], emotion: LookEmotion): FigureStep[] {
  const count = LOOK_EMOTION_FRAMES[emotion]
  let at = 0
  return body.map((step) => {
    const emotionFrame = count > 1 ? Math.floor(at / EMOTION_STEP_MS) % count : 0
    at += step.ms
    return { frame: { action: step.action, frame: step.frame, emotion, emotionFrame }, liftPx: step.liftPx, ms: step.ms }
  })
}

function restSteps(durationMs: number): FigureStep[] {
  const cycle = IDLE_ORDER.map((frame) => ({ action: IDLE_ACTION, frame, liftPx: 0, ms: IDLE_STEP_MS }))
  return withEmotion(filled(cycle, durationMs), DEFAULT_EMOTION)
}

function blinkGap(random: () => number): number {
  return BLINK_GAP_MIN_MS + random() * (BLINK_GAP_MAX_MS - BLINK_GAP_MIN_MS)
}

function blinkFrame(frame: LookFrame, emotionFrame: number): LookFrame {
  return { ...frame, emotion: BLINK_EMOTION, emotionFrame }
}

/**
 * 기본 표정인 칸 사이사이에 깜빡임을 넣는다. 깜빡임은 한 칸 안에 다 들어갈 때만 넣고, 아니면 다음 칸으로 미룬다.
 *
 * 뜬 칸은 넣지 않는다. 점프는 짧게 지나가 깜빡임이 칸 사이로 갈린다.
 */
function withBlinks(steps: FigureStep[], random: () => number): FigureStep[] {
  const out: FigureStep[] = []
  let at = 0
  let next = blinkGap(random)

  for (const step of steps) {
    const end = at + step.ms
    const blinkable = step.frame.emotion === DEFAULT_EMOTION && step.liftPx === 0
    let cursor = at

    while (blinkable && next < end) {
      if (next + BLINK_MS > end) {
        next = end
        break
      }
      if (next > cursor) out.push({ ...step, ms: next - cursor })
      out.push({ ...step, frame: blinkFrame(step.frame, 1), ms: BLINK_STEP_MS })
      out.push({ ...step, frame: blinkFrame(step.frame, 2), ms: BLINK_STEP_MS })
      cursor = next + BLINK_MS
      next = cursor + blinkGap(random)
    }
    if (!blinkable && next < end) next = end
    if (end > cursor) out.push({ ...step, ms: end - cursor })
    at = end
  }

  return out
}

function pick<T>(list: readonly T[], random: () => number): T {
  // `random()` 이 1 을 내도 목록 밖으로 나가지 않게 막는다.
  return list[Math.min(Math.floor(random() * list.length), list.length - 1)]
}

/**
 * 다음 행동과 그 뒤의 쉬는 시간까지 잇는 계획. 고른 행동이 둘 이상이면 같은 행동을 연달아 고르지 않는다.
 *
 * @param motion 그 캐릭터가 고른 값
 * @param last 바로 앞 행동. 처음이면 `null`
 * @param random 0 이상 1 이하의 값을 내는 함수
 */
export function planFigureSteps(
  motion: FigureMotion,
  last: LookAction | null,
  random: () => number,
): { action: LookAction; steps: FigureStep[] } {
  const choices = motion.actions.length > 1 ? motion.actions.filter((action) => action !== last) : motion.actions
  const action = pick(choices, random)
  const emotion = pick(motion.emotions, random)
  const body =
    action === JUMP_ACTION
      ? jumpSteps(random() < 0.5 ? 'A01' : 'A03', motion.durationMs)
      : filled(actionCycle(action), motion.durationMs)
  const steps = withEmotion(body, emotion)

  return {
    action,
    steps: withBlinks(motion.rest ? [...steps, ...restSteps(motion.durationMs)] : steps, random),
  }
}

/** 행동이 쓰는 몸 프레임. 점프는 바탕 동작의 프레임까지다 */
function bodyFramesOf(action: LookAction): { action: LookAction; frame: number }[] {
  const own = (each: LookAction) => frameIndexes(LOOK_ACTION_FRAMES[each]).map((frame) => ({ action: each, frame }))
  return action === JUMP_ACTION ? [{ action, frame: 0 }, ...own('A01'), ...own('A03')] : own(action)
}

function uniqueFrames(frames: LookFrame[]): LookFrame[] {
  return [...new Map(frames.map((frame) => [lookFrameKey(frame), frame])).values()]
}

/**
 * 고른 값의 계획이 쓸 수 있는 그림 전부. 위젯은 이것을 다 받은 뒤에 움직이고, 움직이는 동안 새로 받지 않는다.
 *
 * @param motion 그 캐릭터가 고른 값
 */
export function figureFrames(motion: FigureMotion): LookFrame[] {
  const bodies = motion.actions.flatMap(bodyFramesOf)
  const frames: LookFrame[] = []

  for (const body of bodies) {
    for (const emotion of motion.emotions) {
      for (const emotionFrame of frameIndexes(LOOK_EMOTION_FRAMES[emotion])) frames.push({ ...body, emotion, emotionFrame })
    }
  }
  // 깜빡임은 기본 표정인 칸에만 끼어든다. 쉬는 동안의 대기 동작은 늘 기본 표정이다.
  const blinkBodies = [
    ...(motion.emotions.includes(DEFAULT_EMOTION) ? bodies : []),
    ...(motion.rest ? bodyFramesOf(IDLE_ACTION) : []),
  ]
  for (const body of blinkBodies) {
    frames.push(
      { ...body, emotion: DEFAULT_EMOTION, emotionFrame: 0 },
      { ...body, emotion: BLINK_EMOTION, emotionFrame: 1 },
      { ...body, emotion: BLINK_EMOTION, emotionFrame: 2 },
    )
  }

  return uniqueFrames(frames)
}

/** 표정 칸의 몸. 기본 자세의 첫 장이다 */
const FACE_BODY = { action: 'A00' as LookAction, frame: 0 }

/** 시트의 칸 그림 전부. 조합이 없어 캐릭터마다 일정하고, 시트를 열기 전에 미리 받아 둔다 */
export const SHEET_FRAMES: readonly LookFrame[] = uniqueFrames([
  ...LOOK_ACTIONS.flatMap((action) =>
    frameIndexes(LOOK_ACTION_FRAMES[action]).map((frame) => ({ action, frame, emotion: DEFAULT_EMOTION, emotionFrame: 0 })),
  ),
  ...PICKABLE_EMOTIONS.flatMap((emotion) =>
    frameIndexes(LOOK_EMOTION_FRAMES[emotion]).map((emotionFrame) => ({ ...FACE_BODY, emotion, emotionFrame })),
  ),
  { ...FACE_BODY, emotion: BLINK_EMOTION, emotionFrame: 1 },
  { ...FACE_BODY, emotion: BLINK_EMOTION, emotionFrame: 2 },
])

/**
 * 시트 칸 하나가 되풀이하는 그림. 행동 칸은 기본 표정으로 한 바퀴, 표정 칸은 기본 자세에서 그 표정을 한다.
 *
 * @param code 행동이나 표정 값
 */
export function tileSteps(code: LookAction | LookEmotion): FigureStep[] {
  if (code.startsWith('A')) {
    const action = code as LookAction
    const body = action === JUMP_ACTION ? jumpCycle('A01') : actionCycle(action)
    return withEmotion(body, DEFAULT_EMOTION)
  }
  const emotion = code as LookEmotion
  const face = (emotionFrame: number, ms: number): FigureStep => ({
    frame: { ...FACE_BODY, emotion, emotionFrame },
    liftPx: 0,
    ms,
  })
  if (emotion === DEFAULT_EMOTION) {
    const still = face(0, 2600)
    return [still, { ...still, frame: blinkFrame(still.frame, 1), ms: BLINK_STEP_MS }, { ...still, frame: blinkFrame(still.frame, 2), ms: BLINK_STEP_MS }]
  }
  const count = LOOK_EMOTION_FRAMES[emotion]
  return count === 1 ? [face(0, 1000)] : frameIndexes(count).map((emotionFrame) => face(emotionFrame, EMOTION_STEP_MS))
}
