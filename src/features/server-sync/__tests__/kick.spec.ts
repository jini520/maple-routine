// 회차는 한 번에 하나만 돈다. 올리기가 붙으면 두 회차가 겹칠 때 같은 줄을 두 번 보낸다.
import { kickServerSync } from '../kick'

jest.mock('../run', () => ({ runServerSync: jest.fn() }))
const { runServerSync } = jest.requireMock('../run') as { runServerSync: jest.Mock }

it('도는 중에 다시 깨우면 겹쳐 돌지 않고, 끝난 뒤 한 번 더 돈다', async () => {
  let release: () => void = () => {}
  runServerSync.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve))).mockResolvedValue(null)

  const first = kickServerSync()
  void kickServerSync()
  void kickServerSync()
  expect(runServerSync).toHaveBeenCalledTimes(1)

  release()
  await first

  expect(runServerSync).toHaveBeenCalledTimes(2)
})
