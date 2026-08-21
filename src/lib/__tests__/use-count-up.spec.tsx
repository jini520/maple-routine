/** @jest-environment jsdom */
import { act, cleanup, render, screen } from '@testing-library/react'
import { COUNT_UP_DURATION_MS, clearCountUpMemory, easeOutExpo, useCountUp } from '../use-count-up'

// vitest 의 `vi.stubGlobal` 짝. jest 에는 없어서 여기서 최소한으로 만든다 — 원래 값을 기억해 두고
// `unstubAllGlobals()` 가 되돌린다 ([[ADR-157]]).
const 원래전역: Record<string, unknown> = {}

function stubGlobal(name: string, value: unknown): void {
  if (!(name in 원래전역)) 원래전역[name] = (globalThis as Record<string, unknown>)[name]
  ;(globalThis as Record<string, unknown>)[name] = value
}

function unstubAllGlobals(): void {
  for (const [name, value] of Object.entries(원래전역)) {
    ;(globalThis as Record<string, unknown>)[name] = value
  }
}

function Probe(props: { identity: string; value: number }): React.JSX.Element {
  const displayed = useCountUp(props.identity, props.value)
  return <span data-testid="value">{displayed}</span>
}

function displayed(): number {
  return Number(screen.getByTestId('value').textContent)
}

/**
 * rAF 을 수동으로 굴린다 — 실제 시간 대신 프레임을 우리가 준다. **취소도 실제로 동작해야 한다**:
 * no-op 이면 재조준·identity 교체로 버려진 tween 이 계속 돌아 다음 단언의 값을 오염시킨다.
 */
let now = 0
let frames = new Map<number, (time: number) => void>()
let nextFrameId = 0

function advance(ms: number): void {
  now += ms
  const pending = [...frames.values()]
  frames.clear()
  act(() => {
    for (const frame of pending) frame(now)
  })
}

beforeEach(() => {
  now = 0
  frames = new Map()
  nextFrameId = 0
  clearCountUpMemory()
  stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
    nextFrameId += 1
    frames.set(nextFrameId, callback)
    return nextFrameId
  })
  stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id)
  })
  jest.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  cleanup()
  unstubAllGlobals()
  jest.restoreAllMocks()
})

describe('easeOutExpo', () => {
  it('빠르게 출발해 점점 느려진다 — 절반을 10% 지점에서 지난다', async () => {
    expect(easeOutExpo(0)).toBe(0)
    expect(easeOutExpo(1)).toBe(1)
    expect(easeOutExpo(0.1)).toBeCloseTo(0.5, 2)
    // 전반부가 후반부보다 훨씬 많이 간다는 것이 이 곡선의 요구다.
    expect(easeOutExpo(0.5) - easeOutExpo(0)).toBeGreaterThan(easeOutExpo(1) - easeOutExpo(0.5))
  })
})

describe('useCountUp', () => {
  it('기억이 없으면 첫 렌더는 굴리지 않고 목표를 그대로 그린다', async () => {
    render(<Probe identity="a" value={1000} />)
    expect(displayed()).toBe(1000)
    expect(frames.size).toBe(0)
  })

  it('값이 바뀌면 이전 값에서 목표까지 굴러가고 마지막에 정확히 목표에 닿는다', async () => {
    const { rerender } = render(<Probe identity="a" value={1000} />)
    rerender(<Probe identity="a" value={2000} />)

    advance(0)
    expect(displayed()).toBe(1000)

    advance(COUNT_UP_DURATION_MS / 2)
    expect(displayed()).toBeGreaterThan(1000)
    expect(displayed()).toBeLessThan(2000)

    advance(COUNT_UP_DURATION_MS)
    // 부동소수 오차로 목표를 스치지 않도록 마지막 프레임은 목표를 그대로 쓴다.
    expect(displayed()).toBe(2000)
  })

  it('줄어드는 방향도 굴러간다', async () => {
    const { rerender } = render(<Probe identity="a" value={2000} />)
    rerender(<Probe identity="a" value={1000} />)

    advance(COUNT_UP_DURATION_MS / 2)
    expect(displayed()).toBeLessThan(2000)
    expect(displayed()).toBeGreaterThan(1000)

    advance(COUNT_UP_DURATION_MS)
    expect(displayed()).toBe(1000)
  })

  // ADR-087 결정 7 — 스테퍼 연타. 진행 중이던 tween 을 처음부터 다시 돌리면 숫자가 뒤로 튄다.
  it('굴러가는 도중 목표가 또 바뀌면 지금 그려진 값에서 재조준한다', async () => {
    const { rerender } = render(<Probe identity="a" value={0} />)
    rerender(<Probe identity="a" value={1000} />)

    advance(0)
    advance(COUNT_UP_DURATION_MS / 2)
    const midway = displayed()
    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(1000)

    rerender(<Probe identity="a" value={2000} />)
    advance(0)
    // 재조준 직후 값은 그 자리 그대로여야 한다 — 0이나 1000으로 튀지 않는다.
    expect(displayed()).toBe(midway)

    advance(COUNT_UP_DURATION_MS)
    expect(displayed()).toBe(2000)
  })

  // ADR-087 결정 8 — 마운트도 값 변경과 똑같이 다룬다.
  it('같은 identity 로 다시 마운트했는데 값이 달라졌으면 직전 표시값에서 굴러간다', async () => {
    const first = render(<Probe identity="a" value={1000} />)
    advance(COUNT_UP_DURATION_MS)
    first.unmount()

    render(<Probe identity="a" value={3000} />)
    advance(0)
    expect(displayed()).toBe(1000)

    advance(COUNT_UP_DURATION_MS)
    expect(displayed()).toBe(3000)
  })

  it('다시 마운트했는데 값이 같으면 굴리지 않는다', async () => {
    const first = render(<Probe identity="a" value={1000} />)
    first.unmount()

    render(<Probe identity="a" value={1000} />)
    expect(displayed()).toBe(1000)
    expect(frames.size).toBe(0)
  })

  // 기간 이동은 "같은 값이 변한 것"이 아니라 "다른 값을 보게 된 것"이다.
  it('identity 가 다르면 기억이 없어 굴리지 않는다', async () => {
    const first = render(<Probe identity="total|weekly|2026-07-30" value={1000} />)
    first.unmount()

    render(<Probe identity="total|weekly|2026-07-23" value={9000} />)
    expect(displayed()).toBe(9000)
    expect(frames.size).toBe(0)
  })

  it('굴러가는 도중에 떠났다 돌아오면 그 자리에서 이어진다', async () => {
    const first = render(<Probe identity="a" value={0} />)
    first.rerender(<Probe identity="a" value={1000} />)
    advance(0)
    advance(COUNT_UP_DURATION_MS / 2)
    const midway = displayed()
    first.unmount()

    render(<Probe identity="a" value={1000} />)
    advance(0)
    expect(displayed()).toBe(midway)

    advance(COUNT_UP_DURATION_MS)
    expect(displayed()).toBe(1000)
  })

  it('서로 다른 identity 는 기억을 섞지 않는다', async () => {
    const a = render(<Probe identity="a" value={100} />)
    a.unmount()
    const b = render(<Probe identity="b" value={500} />)
    b.unmount()

    render(<Probe identity="a" value={300} />)
    advance(0)
    expect(displayed()).toBe(100)
  })

  // [[ADR-087]] 정정 1 — 언마운트 없이 identity 만 바뀌는 자리가 있다(총 수익 헤드라인은 기간이
  // 바뀌어도 재마운트되지 않는다). 마운트 때만 기억을 읽으면 그 자리는 옛 identity 의 값에서
  // 굴러가 버린다 — identity 변경은 값 변경이 아니라 "다른 값을 보게 된 것"이므로 리셋이다.
  it('살아 있는 인스턴스에서 identity 가 바뀌면 굴리지 않고 목표로 리셋한다', async () => {
    const view = render(<Probe identity="character|weekly|2026-07-30" value={1000} />)
    advance(COUNT_UP_DURATION_MS)

    view.rerender(<Probe identity="character|weekly|2026-07-23" value={9000} />)
    expect(displayed()).toBe(9000)
    expect(frames.size).toBe(0)
  })

  it('identity 가 바뀌면 굴러가던 tween 도 멈추고 새 목표로 리셋한다', async () => {
    const view = render(<Probe identity="a" value={0} />)
    view.rerender(<Probe identity="a" value={1000} />)
    advance(COUNT_UP_DURATION_MS / 2)
    expect(displayed()).toBeLessThan(1000)

    view.rerender(<Probe identity="b" value={7000} />)
    expect(displayed()).toBe(7000)
    expect(frames.size).toBe(0)
  })

  // 리셋한 값이 그 identity 의 기억이 된다 — 되돌아왔을 때 여기서 이어져야 한다.
  it('identity 를 되돌리면 리셋 당시 값이 아니라 그 identity 의 기억에서 굴러간다', async () => {
    const view = render(<Probe identity="a" value={1000} />)
    advance(COUNT_UP_DURATION_MS)

    view.rerender(<Probe identity="b" value={9000} />)
    view.rerender(<Probe identity="a" value={4000} />)
    advance(0)
    expect(displayed()).toBe(1000)

    advance(COUNT_UP_DURATION_MS)
    expect(displayed()).toBe(4000)
  })
})
