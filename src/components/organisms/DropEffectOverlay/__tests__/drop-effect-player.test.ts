// 드랍 연출 재생 순서 — **웹판에는 없던 안전망**이다.
//
// 웹은 이 로직이 `useEffect` 안의 클로저 + DOM 변이와 한 덩어리라 단위로 검사할 수 없었고, 그래서
// `DropEffectOverlay.test.tsx` 머리에 *"재생을 보는 아홉은 여기 없다"* 고 적혀 있었다. 상태 전이를
// 순수 함수로 떼어내면서 그 아홉 중 **화면 없이 검사할 수 있는 것들**이 여기로 왔다.
//
// 여기서 못 보는 것은 그대로 남는다 — 프레임이 **같아 보이는가**, origin 정합이 눈에 맞는가,
//  의 1.5배가 적당한가. 그것들은 실기기에서 사람이 본다.
import {
  DROP_EFFECT_FPS,
  DROP_START_FRAME,
  MAX_TICK_MS,
  advanceDropEffect,
  createDropEffectState,
  requestDropEffectClose,
  rendersDifferently,
  type DropEffectFrameCounts,
} from '../drop-effect-player'

/** 웹 원본과 같은 프레임 수(ScreenEff 16 · pre 8 · loop 24 · end 7). */
const COUNTS: DropEffectFrameCounts = { screen: 16, pre: 8, loop: 24, end: 7 }

const MS = (fps: number, frames: number): number => (1000 / fps) * frames

/** `dt` 를 잘게 나눠 흘려보낸다 — 한 번에 큰 값을 주면 `MAX_TICK_MS` 가 잘라낸다(실제 루프와 같다). */
function run(
  state: ReturnType<typeof createDropEffectState>,
  totalMs: number,
  counts = COUNTS,
): ReturnType<typeof createDropEffectState> {
  let next = state
  let left = totalMs
  while (left > 0) {
    const step = Math.min(left, 16)
    next = advanceDropEffect(next, step, counts)
    left -= step
  }
  return next
}

describe(' — 아이템은 8프레임 시점에 뜬다', () => {
  it('처음에는 기둥도 아이템도 없다', () => {
    const s = createDropEffectState()

    expect(s.pillarPhase).toBeNull()
    expect(s.itemVisible).toBe(false)
  })

  it('8프레임 직전까지는 안 뜬다', () => {
    const s = run(createDropEffectState(), MS(DROP_EFFECT_FPS.screen, DROP_START_FRAME) - 20)

    expect(s.itemVisible).toBe(false)
    expect(s.pillarPhase).toBeNull()
  })

  it('8프레임을 지나면 기둥(pre)과 아이템이 함께 뜬다', () => {
    const s = run(createDropEffectState(), MS(DROP_EFFECT_FPS.screen, DROP_START_FRAME) + 20)

    expect(s.itemVisible).toBe(true)
    expect(s.pillarPhase).toBe('pre')
  })
})

describe('DropEff — pre 1회 뒤 loop 무한', () => {
  it('pre 가 끝나면 loop 로 넘어간다', () => {
    const start = MS(DROP_EFFECT_FPS.screen, DROP_START_FRAME) + 20
    const s = run(createDropEffectState(), start + MS(DROP_EFFECT_FPS.pre, COUNTS.pre) + 20)

    expect(s.pillarPhase).toBe('loop')
  })

  // 무한 반복이 요점이다 — 한 바퀴 뒤에도 계속 loop 이고 인덱스가 범위 안에 있다.
  it('loop 는 끝나지 않고 인덱스가 되돌아온다', () => {
    const start = MS(DROP_EFFECT_FPS.screen, DROP_START_FRAME) + 20
    const s = run(
      createDropEffectState(),
      start + MS(DROP_EFFECT_FPS.pre, COUNTS.pre) + MS(DROP_EFFECT_FPS.loop, COUNTS.loop * 2) + 20,
    )

    expect(s.pillarPhase).toBe('loop')
    expect(s.pillarIndex).toBeGreaterThanOrEqual(0)
    expect(s.pillarIndex).toBeLessThan(COUNTS.loop)
    expect(s.finished).toBe(false)
  })
})

describe('ScreenEff — 1회 재생 뒤 사라진다', () => {
  it('16프레임을 지나면 더 그리지 않는다', () => {
    const s = run(createDropEffectState(), MS(DROP_EFFECT_FPS.screen, COUNTS.screen) + 50)

    expect(s.screenDone).toBe(true)
  })

  it('재생 중에는 인덱스가 범위를 벗어나지 않는다', () => {
    let s = createDropEffectState()
    for (let i = 0; i < 200; i++) {
      s = advanceDropEffect(s, 16, COUNTS)
      expect(s.screenIndex).toBeLessThan(COUNTS.screen)
    }
  })
})

describe('닫기 — end 를 한 번 재생하고 끝난다', () => {
  it('탭하면 end 로 넘어가되 아직 안 끝난다', () => {
    const closing = requestDropEffectClose(createDropEffectState(), COUNTS)

    expect(closing.closing).toBe(true)
    expect(closing.pillarPhase).toBe('end')
    expect(closing.finished).toBe(false)
  })

  it('end 를 다 재생하면 끝난다', () => {
    const closing = requestDropEffectClose(createDropEffectState(), COUNTS)
    const s = run(closing, MS(DROP_EFFECT_FPS.end, COUNTS.end) + 50)

    expect(s.finished).toBe(true)
  })

  // 웹의 **두 번 탭하면 건너뛴다**(`if (st.closing) finish()`).
  it('닫는 중에 또 요청하면 곧바로 끝낸다', () => {
    const once = requestDropEffectClose(createDropEffectState(), COUNTS)
    const twice = requestDropEffectClose(once, COUNTS)

    expect(twice.finished).toBe(true)
  })

  it('end 프레임이 없으면 재생 없이 곧바로 끝낸다', () => {
    const s = requestDropEffectClose(createDropEffectState(), { ...COUNTS, end: 0 })

    expect(s.finished).toBe(true)
  })
})

describe('에셋이 비어도 멈추지 않는다', () => {
  // 웹도 `frames.loop.length === 0` 이면 연출 없이 닫기만 가능하게 뒀다. 무한 루프로 앱을 세우는
  // 것이 최악이라, 프레임 0 인 단계를 만나도 빠져나오는지 본다.
  it('기둥 프레임이 하나도 없으면 기둥을 켜지 않는다', () => {
    const s = run(createDropEffectState(), 2000, { screen: 16, pre: 0, loop: 0, end: 7 })

    expect(s.pillarPhase).toBeNull()
    expect(s.finished).toBe(false)
  })

  it('ScreenEff 가 없으면 기둥을 곧바로 켠다 — 트리거가 영영 안 오는 것을 막는다', () => {
    const s = advanceDropEffect(createDropEffectState(), 16, { ...COUNTS, screen: 0 })

    expect(s.screenDone).toBe(true)
    expect(s.itemVisible).toBe(true)
  })
})

// 백그라운드에서 돌아왔을 때 한 tick 이 수백 프레임을 삼키면 연출이 순간이동한다(웹과 같은 방어).
describe('큰 dt 는 잘라낸다', () => {
  it(`한 번에 ${MAX_TICK_MS}ms 를 넘겨 진행하지 않는다`, () => {
    const huge = advanceDropEffect(createDropEffectState(), 100_000, COUNTS)
    const clamped = advanceDropEffect(createDropEffectState(), MAX_TICK_MS, COUNTS)

    expect(huge.screenIndex).toBe(clamped.screenIndex)
  })
})

// ★ 회귀 가드 — 누적 시간만 바뀐 tick 은 **다시 그릴 것 없음** 이어야 한다.
describe('rendersDifferently', () => {
  it('누적 시간만 흐른 tick 은 다시 그리지 않는다', () => {
    const a = createDropEffectState()
    const b = advanceDropEffect(a, 5, { screen: 16, pre: 8, loop: 24, end: 7 })
    expect(b.screenAcc).toBeGreaterThan(a.screenAcc)
    expect(rendersDifferently(a, b)).toBe(false)
  })

  it('프레임이 넘어가면 다시 그린다', () => {
    const a = createDropEffectState()
    const b = advanceDropEffect(a, 60, { screen: 16, pre: 8, loop: 24, end: 7 })
    expect(b.screenIndex).toBe(1)
    expect(rendersDifferently(a, b)).toBe(true)
  })
})
