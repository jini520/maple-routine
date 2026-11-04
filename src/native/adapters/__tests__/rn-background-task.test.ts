// 백그라운드 태스크 어댑터. 등록 · 해제가 OS 상태를 먼저 보고, 몸통이 던져도 OS 에는 결과로 답한다.
jest.mock('expo-background-task', () => ({
  getStatusAsync: jest.fn(async () => 2),
  registerTaskAsync: jest.fn(async () => undefined),
  unregisterTaskAsync: jest.fn(async () => undefined),
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  BackgroundTaskResult: { Success: 1, Failed: 2 },
}))
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
}))

import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'

import { BACKGROUND_REFRESH_TASK, defineBackgroundRefreshTask, rnBackgroundTaskPort } from '../rn-background-task'

const mocked = <T>(value: T): jest.Mock => value as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('register', () => {
  it('쓸 수 있으면 그 간격으로 건다', async () => {
    await rnBackgroundTaskPort.register(120)

    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(BACKGROUND_REFRESH_TASK, { minimumInterval: 120 })
  })

  // 저전력 모드 · 백그라운드 새로고침 꺼짐. 등록이 던지므로 부르지 않는다. 예약은 서 있다.
  it('제한된 기기에서는 걸지 않는다', async () => {
    mocked(BackgroundTask.getStatusAsync).mockResolvedValueOnce(BackgroundTask.BackgroundTaskStatus.Restricted)

    await rnBackgroundTaskPort.register(120)

    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled()
  })
})

describe('unregister', () => {
  it('걸려 있을 때만 푼다', async () => {
    await rnBackgroundTaskPort.unregister()
    expect(BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled()

    mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValueOnce(true)
    await rnBackgroundTaskPort.unregister()
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(BACKGROUND_REFRESH_TASK)
  })
})

describe('defineBackgroundRefreshTask', () => {
  const executor = (): (() => Promise<number>) => mocked(TaskManager.defineTask).mock.calls[0]![1] as () => Promise<number>

  it('같은 이름으로 정의하고 몸통이 끝나면 성공으로 답한다', async () => {
    const handler = jest.fn(async () => undefined)
    defineBackgroundRefreshTask(handler)

    expect(mocked(TaskManager.defineTask).mock.calls[0]![0]).toBe(BACKGROUND_REFRESH_TASK)
    await expect(executor()()).resolves.toBe(BackgroundTask.BackgroundTaskResult.Success)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  // 던진 채 두면 OS 가 비정상 종료로 세어 다음 기회를 늦춘다.
  it('몸통이 던지면 실패로 답한다', async () => {
    defineBackgroundRefreshTask(async () => {
      throw new Error('회차 실패')
    })

    await expect(executor()()).resolves.toBe(BackgroundTask.BackgroundTaskResult.Failed)
  })
})
