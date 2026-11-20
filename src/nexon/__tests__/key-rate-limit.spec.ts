// 서비스 단계 키가 한도에 닿아 429 를 받으면 앱이 그 키를 지운다. 그래서 키 하나가 어느 1초에도 상한을 넘지 않아야 한다.
import { KEY_REQUESTS_PER_SECOND, resetKeySlotsForTest, waitForKeySlot } from '../key-rate-limit'

beforeEach(() => {
  jest.useFakeTimers()
  resetKeySlotsForTest()
})

afterEach(() => {
  jest.useRealTimers()
})

/** 풀린 차례를 적으며 기다린다. */
function track(apiKey: string, count: number, released: number[]): void {
  for (let index = 0; index < count; index += 1) {
    void waitForKeySlot(apiKey).then(() => released.push(index))
  }
}

describe('waitForKeySlot', () => {
  it('상한까지는 곧바로 풀고, 넘는 요청은 첫 요청에서 1초가 지나야 푼다', async () => {
    const released: number[] = []
    track('키', KEY_REQUESTS_PER_SECOND + 1, released)

    await jest.advanceTimersByTimeAsync(0)
    expect(released).toHaveLength(KEY_REQUESTS_PER_SECOND)

    await jest.advanceTimersByTimeAsync(999)
    expect(released).toHaveLength(KEY_REQUESTS_PER_SECOND)

    await jest.advanceTimersByTimeAsync(1)
    expect(released).toHaveLength(KEY_REQUESTS_PER_SECOND + 1)
  })

  // 기다리던 요청이 같은 때에 한꺼번에 풀리면 그 1초에 상한을 넘는다.
  it('상한의 세 배를 한꺼번에 불러도 어느 1초에도 상한을 넘지 않는다', async () => {
    const releasedAt: number[] = []
    for (let index = 0; index < KEY_REQUESTS_PER_SECOND * 3; index += 1) {
      void waitForKeySlot('키').then(() => releasedAt.push(Date.now()))
    }

    await jest.advanceTimersByTimeAsync(3_000)

    expect(releasedAt).toHaveLength(KEY_REQUESTS_PER_SECOND * 3)
    for (const start of releasedAt) {
      const inWindow = releasedAt.filter((at) => at >= start && at < start + 1_000)
      expect(inWindow.length).toBeLessThanOrEqual(KEY_REQUESTS_PER_SECOND)
    }
  })

  it('키마다 따로 센다', async () => {
    const first: number[] = []
    const second: number[] = []
    track('키1', KEY_REQUESTS_PER_SECOND, first)
    track('키2', KEY_REQUESTS_PER_SECOND, second)

    await jest.advanceTimersByTimeAsync(0)

    expect(first).toHaveLength(KEY_REQUESTS_PER_SECOND)
    expect(second).toHaveLength(KEY_REQUESTS_PER_SECOND)
  })

  it('1초가 지난 뒤의 요청은 기다리지 않는다', async () => {
    const released: number[] = []
    track('키', KEY_REQUESTS_PER_SECOND, released)
    await jest.advanceTimersByTimeAsync(1_000)

    track('키', 1, released)
    await jest.advanceTimersByTimeAsync(0)

    expect(released).toHaveLength(KEY_REQUESTS_PER_SECOND + 1)
  })
})
