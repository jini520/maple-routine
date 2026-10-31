// 대표 캐릭터가 무엇을 언제 하는가. 무작위는 밖에서 받아 값으로 확인한다.
import {
  FIGURE_ACTIONS,
  FIGURE_REST_MAX_MS,
  FIGURE_REST_MIN_MS,
  figureActionSteps,
  figureRestSteps,
  planFigureSteps,
  type FigureAction,
} from '../figure-motion'

/** 정해진 수열을 돌려주는 무작위 */
function 수열(values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[index % values.length]
    index += 1
    return value
  }
}

function 합(steps: { ms: number }[]): number {
  return steps.reduce((sum, step) => sum + step.ms, 0)
}

describe('동작 고르기', () => {
  it('같은 동작을 연달아 고르지 않는다', () => {
    const random = 수열([0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99, 0.2, 0.6])
    let last: FigureAction | null = null

    for (let turn = 0; turn < 200; turn += 1) {
      const plan = planFigureSteps(last, random)
      expect(plan.action).not.toBe(last)
      last = plan.action
    }
  })

  it('다섯 동작이 모두 나온다', () => {
    const random = 수열([0, 0.21, 0.42, 0.63, 0.84, 0.99, 0.5, 0.33, 0.77])
    const seen = new Set<FigureAction>()
    let last: FigureAction | null = null

    for (let turn = 0; turn < 200; turn += 1) {
      const plan = planFigureSteps(last, random)
      seen.add(plan.action)
      last = plan.action
    }

    expect([...seen].sort()).toEqual([...FIGURE_ACTIONS].sort())
  })
})

describe('동작 사이', () => {
  it.each([
    ['가장 짧을 때', 0, FIGURE_REST_MIN_MS],
    ['가장 길 때', 1, FIGURE_REST_MAX_MS],
  ])('%s 도 정한 범위 안이다', (_이름, random, 기대) => {
    expect(합(figureRestSteps(() => random))).toBe(기대)
  })

  it('대기 프레임만 나온다', () => {
    figureRestSteps(() => 0.5).forEach((step) => {
      expect(step.frame.startsWith('idle')).toBe(true)
      expect(step.liftPx).toBe(0)
    })
  })

  it('동작 뒤에 대기가 이어진다', () => {
    const { steps } = planFigureSteps(null, () => 0)

    expect(steps[steps.length - 1].frame.startsWith('idle')).toBe(true)
  })
})

describe('동작의 모양', () => {
  it('휘두르기는 세 프레임을 차례로 지난다', () => {
    expect(figureActionSteps('swing').map((step) => step.frame)).toEqual(['swing0', 'swing1', 'swing2'])
  })

  it('걷기는 네 프레임을 돌아 끝에서 끊기지 않는다', () => {
    const frames = figureActionSteps('walk').map((step) => step.frame)

    expect(new Set(frames)).toEqual(new Set(['walk0', 'walk1', 'walk2', 'walk3']))
    expect(frames[frames.length - 1]).toBe('walk3')
  })

  // 땅에서 시작해 땅으로 돌아와야 대기 프레임으로 넘어갈 때 안 튄다.
  it('점프는 올랐다가 시작한 높이로 내려온다', () => {
    const lifts = figureActionSteps('jump').map((step) => step.liftPx)

    expect(Math.max(...lifts)).toBeGreaterThan(lifts[0])
    expect(lifts[lifts.length - 1]).toBe(lifts[0])
  })
})
