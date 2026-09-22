// 기록을 여러 건 쓰는 반복은 끝날 때 판 알림을 한 번 보낸다. 쓰기마다 알리면 수익·지출 탭의 첫 수집에서
// 판을 구독하는 화면이 수백 번 다시 그려진다.
import { batchRecordWrites, notifyAfterBatch } from '../record-revision-batch'

describe('batchRecordWrites', () => {
  it('반복 밖에서는 곧바로 알린다', () => {
    const notify = jest.fn()

    notifyAfterBatch(notify)

    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('반복 안에서는 끝날 때 한 번 알린다', async () => {
    const notify = jest.fn()

    await batchRecordWrites(async () => {
      notifyAfterBatch(notify)
      await Promise.resolve()
      notifyAfterBatch(notify)
      expect(notify).not.toHaveBeenCalled()
    })

    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('반복이 돌려준 값을 그대로 돌려준다', async () => {
    await expect(batchRecordWrites(async () => 3)).resolves.toBe(3)
  })

  // 수익·지출 탭의 회차는 오늘 기록과 지난 기간 기록을 나란히 돌린다.
  it('겹친 반복은 마지막 반복이 끝날 때 알린다', async () => {
    const notify = jest.fn()
    let finishFirst: () => void = () => {}

    const first = batchRecordWrites(
      () =>
        new Promise<void>((resolve) => {
          notifyAfterBatch(notify)
          finishFirst = resolve
        }),
    )
    await batchRecordWrites(async () => {
      notifyAfterBatch(notify)
    })
    expect(notify).not.toHaveBeenCalled()

    finishFirst()
    await first

    expect(notify).toHaveBeenCalledTimes(1)
  })

  // 던지기 전에 쓴 기록이 있을 수 있다.
  it('반복이 던져도 알리고 던진 것을 그대로 던진다', async () => {
    const notify = jest.fn()

    await expect(
      batchRecordWrites(async () => {
        notifyAfterBatch(notify)
        throw new Error('database is locked')
      }),
    ).rejects.toThrow('database is locked')

    expect(notify).toHaveBeenCalledTimes(1)
  })
})
