// 회차는 한 번에 하나만 돈다. 올리기가 붙으면 두 회차가 겹칠 때 같은 줄을 두 번 보낸다.
import { holdServerSync, kickServerSync } from '../kick'

jest.mock('../run', () => ({ runServerSync: jest.fn() }))
const { runServerSync } = jest.requireMock('../run') as { runServerSync: jest.Mock }

/** 끝내라고 할 때까지 도는 동기화 한 번과 그것을 끝내는 함수. */
function pendingRun(): () => void {
  let finish: () => void = () => {}
  runServerSync.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))
  return () => finish()
}

beforeEach(() => {
  runServerSync.mockReset()
  runServerSync.mockResolvedValue(undefined)
})

it('도는 중에 다시 깨우면 겹쳐 돌지 않고, 끝난 뒤 한 번 더 돈다', async () => {
  const finish = pendingRun()

  const first = kickServerSync()
  void kickServerSync()
  void kickServerSync()
  expect(runServerSync).toHaveBeenCalledTimes(1)

  finish()
  await first

  expect(runServerSync).toHaveBeenCalledTimes(2)
})

// 도는 회차는 깨우기 전의 대기 표를 읽었을 수 있다. 로그아웃은 누른 뒤의 대기 표를 올린 회차를 기다려야 한다.
it('깨운 동기화는 깨운 뒤에 시작한 회차가 끝나야 끝난다', async () => {
  const finishFirst = pendingRun()
  const finishSecond = pendingRun()
  void kickServerSync()
  let done = false

  const later = kickServerSync().then(() => {
    done = true
  })
  finishFirst()
  await new Promise((resolve) => setImmediate(resolve))
  expect(runServerSync).toHaveBeenCalledTimes(2)
  expect(done).toBe(false)

  finishSecond()
  await later
  expect(done).toBe(true)
})

// 회차가 끝나 갈 때 깨운 것을 잃으면, 그 깨우기는 돌지 않은 채 끝난 것으로 답한다.
it.each([0, 1, 2, 3, 4, 5])('회차가 끝나는 사이(%i 틱 뒤)에 깨워도 한 번 더 돌고 그 회차가 끝나야 끝난다', async (ticks) => {
  const finish = pendingRun()
  void kickServerSync()

  finish()
  for (let tick = 0; tick < ticks; tick += 1) await Promise.resolve()
  await kickServerSync()

  expect(runServerSync).toHaveBeenCalledTimes(2)
})

// 데이터 삭제가 서버를 부르는 사이에 올리기가 돌면 지운 기록을 서버에 다시 올린다.
describe('멈추기', () => {
  it('도는 동기화가 끝난 뒤에 멈춘다', async () => {
    const finish = pendingRun()
    void kickServerSync()
    let held = false

    const holding = holdServerSync().then((release) => {
      held = true
      return release
    })
    await Promise.resolve()
    expect(held).toBe(false)

    finish()
    const release = await holding
    expect(held).toBe(true)
    release()
  })

  it('멈춘 동안 깨운 동기화는 돌지 않다가 풀면 한 번 돈다', async () => {
    const release = await holdServerSync()

    void kickServerSync()
    void kickServerSync()
    expect(runServerSync).not.toHaveBeenCalled()

    release()
    // 다시 멈추기는 푼 뒤에 돈 동기화가 끝나기를 기다린다.
    const releaseAgain = await holdServerSync()
    releaseAgain()

    expect(runServerSync).toHaveBeenCalledTimes(1)
  })

  it('멈춘 동안 깨우지 않았으면 풀어도 돌지 않는다', async () => {
    const release = await holdServerSync()

    release()
    await Promise.resolve()

    expect(runServerSync).not.toHaveBeenCalled()
  })
})
