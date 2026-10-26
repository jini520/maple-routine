// 대기 표 전송은 한 번에 한 회차만 돈다. 두 회차가 겹치면 같은 줄을 두 번 보낸다.
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
