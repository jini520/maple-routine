// 대표 캐릭터가 무엇을 언제 하는가. 무작위는 밖에서 받아 값으로 확인한다.
import { lookFrameKey, type LookAction } from '../../../../lib/character-look'
import type { FigureMotion } from '../../../../types/figure-motion'
import {
  BLINK_GAP_MAX_MS,
  BLINK_GAP_MIN_MS,
  BLINK_STEP_MS,
  SHEET_FRAMES,
  figureFrames,
  planFigureSteps,
  type FigureStep,
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

function 고름(motion: Partial<FigureMotion>): FigureMotion {
  return { actions: ['A03'], emotions: ['E02'], durationMs: 5000, rest: false, ...motion }
}

/** 차례로 이어지는 계획 여럿 */
function 계획들(motion: FigureMotion, random: () => number, count = 60): { action: LookAction; steps: FigureStep[] }[] {
  const plans = []
  let last: LookAction | null = null
  for (let turn = 0; turn < count; turn += 1) {
    const plan = planFigureSteps(motion, last, random)
    plans.push(plan)
    last = plan.action
  }
  return plans
}

const 흩어진무작위 = 수열([0, 0.21, 0.42, 0.63, 0.84, 0.99, 0.5, 0.33, 0.77, 0.12])

describe('행동 고르기', () => {
  it('고른 행동만 나온다', () => {
    const motion = 고름({ actions: ['A03', 'A24', 'A11'] })

    계획들(motion, 흩어진무작위).forEach((plan) => {
      expect(motion.actions).toContain(plan.action)
    })
  })

  it('둘 이상 고르면 같은 행동을 연달아 고르지 않는다', () => {
    const plans = 계획들(고름({ actions: ['A03', 'A24'] }), 흩어진무작위)

    plans.slice(1).forEach((plan, index) => {
      expect(plan.action).not.toBe(plans[index].action)
    })
  })

  it('하나만 고르면 그것만 되풀이한다', () => {
    계획들(고름({ actions: ['A24'] }), 흩어진무작위).forEach((plan) => {
      expect(plan.action).toBe('A24')
    })
  })

  it('고른 표정만 붙는다. 깜빡임은 기본 표정 사이에만 끼어든다', () => {
    const motion = 고름({ actions: ['A03', 'A24'], emotions: ['E02', 'E17'] })

    계획들(motion, 흩어진무작위).forEach((plan) => {
      plan.steps.forEach((step) => {
        expect(['E02', 'E17']).toContain(step.frame.emotion)
      })
    })
  })
})

describe('동작 시간과 쉬는 시간', () => {
  it.each([3000, 5000, 10000, 20000] as const)('행동 하나가 동작 시간 %i ms 동안 이어진다', (durationMs) => {
    const plan = planFigureSteps(고름({ actions: ['A24'], durationMs }), null, () => 0.5)

    expect(합(plan.steps)).toBe(durationMs)
    // 한 바퀴만 하고 넘기면 너무 짧다(사용자 지정). 찌르기 한 바퀴는 1초도 안 된다.
    expect(plan.steps.length).toBeGreaterThan(2)
  })

  it('쉬는 시간을 켜면 행동 뒤에 동작 시간만큼 대기 동작을 한다', () => {
    const plan = planFigureSteps(고름({ actions: ['A24'], rest: true }), null, () => 0.5)
    const 뒤 = plan.steps.slice(plan.steps.findIndex((step) => step.frame.action === 'A01'))

    expect(합(plan.steps)).toBe(10000)
    expect(합(뒤)).toBe(5000)
    뒤.forEach((step) => {
      expect(step.frame.action).toBe('A01')
      expect(['E00', 'E06']).toContain(step.frame.emotion)
    })
  })

  it('쉬는 시간을 끄면 대기 동작이 끼지 않는다', () => {
    const plan = planFigureSteps(고름({ actions: ['A24'] }), null, () => 0.5)

    expect(plan.steps.every((step) => step.frame.action === 'A24')).toBe(true)
  })
})

describe('점프', () => {
  function 점프(random: () => number): FigureStep[] {
    return planFigureSteps(고름({ actions: ['A06'], emotions: ['E02'] }), null, random).steps
  }

  // 점프 그림 한 장만 되풀이하면 공중에서만 튄다. 서기나 걷기 사이에 끼운다(사용자 지정).
  it('바닥에서 시작해 바탕 동작과 점프를 번갈아 한다', () => {
    const steps = 점프(() => 0)

    expect(steps[0].liftPx).toBe(0)
    expect(steps[0].frame.action).not.toBe('A06')
    expect(steps.some((step) => step.frame.action === 'A06' && step.liftPx > 0)).toBe(true)
  })

  it('바탕은 점프 행동마다 서기나 걷기 하나로 정한다', () => {
    const 바탕 = (steps: FigureStep[]): Set<LookAction> =>
      new Set(steps.filter((step) => step.frame.action !== 'A06').map((step) => step.frame.action))

    expect(바탕(점프(() => 0))).toEqual(new Set(['A01']))
    expect(바탕(점프(() => 0.99))).toEqual(new Set(['A03']))
  })

  // 땅에서 올라 땅으로 돌아와야 바탕 동작으로 넘어갈 때 안 튄다.
  it('뜬 칸 다음 바탕 동작은 땅에 있다', () => {
    const steps = 점프(() => 0)

    steps.forEach((step, index) => {
      if (step.frame.action !== 'A06') expect(step.liftPx).toBe(0)
      if (index > 0 && step.frame.action !== 'A06' && steps[index - 1].frame.action === 'A06') {
        expect(steps[index - 1].liftPx).toBeLessThan(5)
      }
    })
  })
})

describe('깜빡임', () => {
  function 깜빡임시작(steps: FigureStep[]): number[] {
    const starts: number[] = []
    let at = 0
    steps.forEach((step) => {
      if (step.frame.emotion === 'E06' && step.frame.emotionFrame === 1) starts.push(at)
      at += step.ms
    })
    return starts
  }

  it('기본 표정이면 눈을 감은 장과 반쯤 뜬 장을 빠르게 잇는다', () => {
    const steps = planFigureSteps(고름({ actions: ['A00'], emotions: ['E00'], durationMs: 20000 }), null, () => 0.5).steps

    steps.forEach((step, index) => {
      if (step.frame.emotion !== 'E06' || step.frame.emotionFrame !== 1) return
      const next = steps[index + 1]
      expect(step.ms).toBe(BLINK_STEP_MS)
      expect(next.frame).toEqual({ ...step.frame, emotionFrame: 2 })
      expect(next.ms).toBeLessThanOrEqual(BLINK_STEP_MS)
    })
    expect(깜빡임시작(steps).length).toBeGreaterThan(1)
  })

  it.each([
    ['가장 짧을 때', 0, BLINK_GAP_MIN_MS],
    ['가장 길 때', 0.999, BLINK_GAP_MAX_MS],
  ])('%s 도 2~5초 간격이다', (_이름, random, 기대) => {
    const steps = planFigureSteps(고름({ actions: ['A00'], emotions: ['E00'], durationMs: 20000 }), null, () => random).steps
    const starts = 깜빡임시작(steps)

    starts.slice(1).forEach((start, index) => {
      const 간격 = start - starts[index] - 2 * BLINK_STEP_MS
      expect(Math.abs(간격 - 기대)).toBeLessThan(500)
    })
  })

  it('다른 표정으로 하는 행동에는 깜빡임이 없다', () => {
    const steps = planFigureSteps(고름({ actions: ['A03'], emotions: ['E02'], durationMs: 20000 }), null, () => 0.5).steps

    expect(steps.some((step) => step.frame.emotion === 'E06')).toBe(false)
  })

  it('뜬 칸에서는 깜빡이지 않는다', () => {
    const steps = planFigureSteps(고름({ actions: ['A06'], emotions: ['E00'], durationMs: 20000 }), null, () => 0).steps

    steps
      .filter((step) => step.frame.emotion === 'E06')
      .forEach((step) => {
        expect(step.liftPx).toBe(0)
      })
  })
})

describe('여러 장인 표정', () => {
  it('행동하는 동안 표정의 다음 장으로 넘어간다', () => {
    const steps = planFigureSteps(고름({ actions: ['A00'], emotions: ['E17'] }), null, () => 0.5).steps

    expect(new Set(steps.map((step) => step.frame.emotionFrame))).toEqual(new Set([0, 1]))
  })
})

describe('받아 둘 그림', () => {
  const 고른것들: FigureMotion[] = [
    고름({}),
    고름({ actions: ['A00'], emotions: ['E00'] }),
    고름({ actions: ['A06', 'A31', 'A16'], emotions: ['E00', 'E17', 'E08', 'E24', 'E07'], rest: true }),
    고름({ actions: ['A06', 'A24'], emotions: ['E00', 'E02'], durationMs: 20000, rest: true }),
  ]

  // 위젯은 움직이는 동안 그림을 새로 받지 않는다. 계획이 낼 수 있는 그림은 전부 미리 받아 둔 목록에 있어야 한다.
  it.each(고른것들.map((motion) => [motion.actions.join(','), motion]))('%s 의 계획이 쓰는 그림은 모두 목록에 있다', (_이름, motion) => {
    const 목록 = new Set(figureFrames(motion).map(lookFrameKey))

    for (const seed of [0, 0.3, 0.6, 0.99]) {
      계획들(motion, 수열([seed, 0.5, 0.1, 0.9, 0.7]), 20).forEach((plan) => {
        plan.steps.forEach((step) => {
          expect(목록.has(lookFrameKey(step.frame))).toBe(true)
        })
      })
    }
  })

  // 행동 3개 · 표정 5개로 막는 까닭이다. 넥슨은 조합마다 그림을 따로 준다.
  it('가장 많이 골라도 수백 장 안쪽이다', () => {
    expect(figureFrames(고른것들[2]).length).toBeLessThan(250)
  })

  it('시트의 칸 그림은 행동 42개의 모든 장과 깜빡임을 뺀 표정 24개를 든다', () => {
    const 행동 = new Set(SHEET_FRAMES.filter((frame) => frame.emotion === 'E00').map((frame) => frame.action))
    const 표정 = new Set(SHEET_FRAMES.map((frame) => frame.emotion))

    expect(행동.size).toBe(42)
    expect(표정.size).toBe(25)
    // 깜빡임은 `기본` 칸이 깜빡일 두 장뿐이다.
    expect(SHEET_FRAMES.filter((frame) => frame.emotion === 'E06').map((frame) => frame.emotionFrame).sort()).toEqual([1, 2])
  })
})
