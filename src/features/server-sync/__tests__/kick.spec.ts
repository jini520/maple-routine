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
