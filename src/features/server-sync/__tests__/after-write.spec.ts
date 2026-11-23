// 기록을 저장하면 곧바로 회차를 깨운다. 쓰기가 몰리면 한 번으로 모아, 네트워크가 되면 입력 직후에 올라가게 한다.
import { batchRecordWrites } from '../../../storage/record-revision-batch'
import { noteRecordsWritten } from '../../../storage/server-sync-queue'
import { startServerSyncAfterWrites } from '../after-write'

jest.mock('../kick', () => ({ kickServerSync: jest.fn(async () => undefined) }))
const { kickServerSync } = jest.requireMock('../kick') as { kickServerSync: jest.Mock }

let stop: () => void = () => {}

afterEach(() => {
  stop()
  kickServerSync.mockClear()
})

/** 마이크로태스크 큐를 비운다. 깨우기는 같은 작업 안의 알림을 모아 한 번 부른다. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

it('기록을 쓰면 회차를 깨우고, 같은 작업 안의 여러 쓰기와 반복 쓰기 안의 쓰기는 한 번으로 모은다', async () => {
  stop = startServerSyncAfterWrites()

  noteRecordsWritten()
  noteRecordsWritten()
  await flush()
  expect(kickServerSync).toHaveBeenCalledTimes(1)

  await batchRecordWrites(async () => {
    noteRecordsWritten()
    await flush()
    expect(kickServerSync).toHaveBeenCalledTimes(1)
    noteRecordsWritten()
  })
  await flush()
  expect(kickServerSync).toHaveBeenCalledTimes(2)
})

it('떼면 더 깨우지 않는다', async () => {
  startServerSyncAfterWrites()()

  noteRecordsWritten()
  await flush()

  expect(kickServerSync).not.toHaveBeenCalled()
})
