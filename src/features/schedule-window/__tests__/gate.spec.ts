// 첫 진입이 캐릭터 6명 × 14일 = 84건이다. 한꺼번에 쏘면 429 가 오고, 그 날짜는 원장에 안 적혀
// 다음 방문에 다시 부른다. 죽지는 않지만 첫 진입이 계속 안 채워진다.
import { mapWithLimit } from '../gate'

describe('mapWithLimit', () => {
  it('결과는 입력 순서 그대로다', async () => {
    const out = await mapWithLimit([1, 2, 3, 4, 5], 2, async (n) => n * 2)

    expect(out).toEqual([2, 4, 6, 8, 10])
  })

  it('동시에 도는 것이 상한을 넘지 않는다', async () => {
    let running = 0
    let peak = 0
    const release: (() => void)[] = []

    const done = mapWithLimit(Array.from({ length: 9 }, (_, i) => i), 3, async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise<void>((resolve) => release.push(resolve))
      running -= 1
    })

    // 대기 중인 것을 하나씩 풀어 준다. 상한을 넘겨 시작한 적이 있으면 peak 이 말한다.
    for (let i = 0; i < 9; i += 1) {
      await Promise.resolve()
      release.shift()?.()
      await Promise.resolve()
    }
    await done

    expect(peak).toBeLessThanOrEqual(3)
  })

  it('빈 입력은 아무것도 안 부른다', async () => {
    const task = jest.fn()

    expect(await mapWithLimit([], 3, task)).toEqual([])
    expect(task).not.toHaveBeenCalled()
  })

  // 한 날짜가 실패해도 나머지 날짜는 계속 나가야 한다. 실패는 부르는 쪽이 값으로 받는다.
  it('하나가 던져도 나머지를 멈추지 않는다', async () => {
    const out = await mapWithLimit([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom')
      return n
    })

    expect(out).toEqual([1, undefined, 3])
  })
})
