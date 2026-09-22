/**
 * 기록 판 알림을 반복 단위로 모으는 자리. 기록을 여러 건 쓰는 반복이 끝날 때 구독자를 한 번 부른다.
 *
 * 쓰기마다 알리면 수익·지출 탭의 첫 수집에서 판을 구독하는 화면이 수백 번 다시 그려진다.
 *
 * @see docs/features/boss-profit.md `판 갈이는 stamp 하나`
 */

let openBatches = 0
const pending = new Set<() => void>()

/** 판 알림. 반복 밖이면 곧바로, 반복 안이면 마지막 반복이 끝날 때 한 번 부른다. */
export function notifyAfterBatch(notify: () => void): void {
  if (openBatches === 0) {
    notify()
    return
  }
  pending.add(notify)
}

/**
 * 기록을 여러 건 쓰는 반복. 안에서 오른 판은 겹친 반복까지 다 끝날 때 한 번 알린다.
 * 던져도 알린다. 던지기 전에 쓴 기록이 있을 수 있다.
 *
 * @example
 * return batchRecordWrites(() => recordEachRow(params))
 */
export async function batchRecordWrites<T>(write: () => Promise<T>): Promise<T> {
  openBatches += 1
  try {
    return await write()
  } finally {
    openBatches -= 1
    if (openBatches === 0) {
      const notifies = [...pending]
      pending.clear()
      for (const notify of notifies) notify()
    }
  }
}
