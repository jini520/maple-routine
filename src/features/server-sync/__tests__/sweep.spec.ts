/**
 * 못 보낸 것을 다시 보내는 고리.
 *
 * 여기서 막는 사고는 둘이다. **오프라인이 시도 횟수를 태우는 것**(그러면 비행기 모드로 앱을
 * 다섯 번 켠 사용자가 그동안 쌓인 것을 전부 잃는다)과 **레지스트리에 없는 종류의 줄이 영원히
 * 쌓이는 것**이다.
 */
import { sweepServerSync, type SweepDeps, type SyncHandler } from '../sweep'
import { MAX_SYNC_ATTEMPTS, type SyncQueueEntry } from '../../../storage/server-sync-queue'
import type { SendResult } from '../../../server/drop-price'

const HEADERS = { 'x-api-key-hash': 'a'.repeat(64) }

function entry(over: Partial<SyncQueueEntry> = {}): SyncQueueEntry {
  return {
    id: 'queue-1',
    kind: 'drop-price',
    recordId: 'record-1',
    attempts: 0,
    lastError: null,
    createdAt: '2026-10-09T00:00:00.000Z',
    ...over,
  }
}

interface Spy {
  deps: SweepDeps
  counted: { recordId: string; lastError: string }[]
  removed: string[]
  sentValues: unknown[]
  readIds: string[]
}

function spy(options: {
  entries?: SyncQueueEntry[]
  identity?: Record<string, string> | null
  value?: unknown
  result?: SendResult
}): Spy {
  const counted: { recordId: string; lastError: string }[] = []
  const removed: string[] = []
  const sentValues: unknown[] = []
  const readIds: string[] = []

  const handler: SyncHandler<unknown> = {
    read: async (recordId) => {
      readIds.push(recordId)
      return options.value ?? null
    },
    send: async (_headers, _recordId, value) => {
      sentValues.push(value)
      return options.result ?? { outcome: 'sent' }
    },
  }

  return {
    counted,
    removed,
    sentValues,
    readIds,
    deps: {
      identity: async () => (options.identity === undefined ? HEADERS : options.identity),
      list: async () => options.entries ?? [entry()],
      countAttempt: async (recordId, lastError) => {
        counted.push({ recordId, lastError })
      },
      remove: async (recordId) => {
        removed.push(recordId)
      },
      handlers: { 'drop-price': handler },
    },
  }
}

describe('서버 전송 대기 표 훑기', () => {
  it('표가 비면 신원도 안 읽는다', async () => {
    let asked = false
    const one = spy({ entries: [] })
    const result = await sweepServerSync({
      ...one.deps,
      identity: async () => {
        asked = true
        return HEADERS
      },
    })

    expect(result).toEqual({ sent: 0, rejected: 0, offline: 0, dropped: 0 })
    expect(asked).toBe(false)
  })

  it('보냈으면 줄을 지운다', async () => {
    const one = spy({ value: { priceMeso: 1 } })
    const result = await sweepServerSync(one.deps)

    expect(result.sent).toBe(1)
    expect(one.removed).toEqual(['record-1'])
    expect(one.readIds).toEqual(['record-1'])
    expect(one.sentValues).toEqual([{ priceMeso: 1 }])
  })

  it('원본이 없으면 삭제로 보낸다. 작업 종류를 칸으로 안 적는다', async () => {
    const one = spy({ value: null })
    await sweepServerSync(one.deps)

    expect(one.sentValues).toEqual([null])
    expect(one.removed).toEqual(['record-1'])
  })

  it('응답이 안 왔으면 횟수를 안 올리고 줄을 남긴다', async () => {
    // 올리면 비행기 모드로 앱을 다섯 번 켠 사용자가 그동안 쌓인 것을 전부 잃는다.
    const one = spy({ result: { outcome: 'no-response' } })
    const result = await sweepServerSync(one.deps)

    expect(result).toEqual({ sent: 0, rejected: 0, offline: 1, dropped: 0 })
    expect(one.counted).toEqual([])
    expect(one.removed).toEqual([])
  })

  it('응답이 왔고 거절이면 횟수를 올린다', async () => {
    const one = spy({ result: { outcome: 'rejected', status: 500 } })
    const result = await sweepServerSync(one.deps)

    expect(result.rejected).toBe(1)
    expect(one.counted).toEqual([{ recordId: 'record-1', lastError: 'HTTP 500' }])
    expect(one.removed).toEqual([])
  })

  it('마지막 기회를 쓰면 줄을 버린다', async () => {
    const one = spy({
      entries: [entry({ attempts: MAX_SYNC_ATTEMPTS - 1 })],
      result: { outcome: 'rejected', status: 400 },
    })
    const result = await sweepServerSync(one.deps)

    expect(result.dropped).toBe(1)
    expect(one.removed).toEqual(['record-1'])
    // 버리면서 횟수를 더 적지 않는다. 지워질 줄에 적는 것이라 아무 뜻이 없다.
    expect(one.counted).toEqual([])
  })

  it('거절을 다섯 번 받기 전에는 안 버린다', async () => {
    const one = spy({
      entries: [entry({ attempts: MAX_SYNC_ATTEMPTS - 2 })],
      result: { outcome: 'rejected', status: 400 },
    })
    const result = await sweepServerSync(one.deps)

    expect(result.dropped).toBe(0)
    expect(one.removed).toEqual([])
  })

  it('밝힐 수단이 없으면 아무것도 안 한다. 횟수도 안 올린다', async () => {
    // 키를 지웠거나 로그인 전인 상태다. 요청의 잘못이 아니다.
    const one = spy({ identity: null })
    const result = await sweepServerSync(one.deps)

    expect(result).toEqual({ sent: 0, rejected: 0, offline: 0, dropped: 0 })
    expect(one.counted).toEqual([])
    expect(one.removed).toEqual([])
    expect(one.readIds).toEqual([])
  })

  it('레지스트리에 없는 종류는 버린다', async () => {
    // 두면 그 종류의 줄이 영원히 쌓이고 조용히 안 나간다.
    const one = spy({ entries: [entry({ kind: '아직-없는-종류' })] })
    const result = await sweepServerSync(one.deps)

    expect(result.dropped).toBe(1)
    expect(one.removed).toEqual(['record-1'])
    expect(one.readIds).toEqual([])
  })

  it('줄 여럿을 하나가 실패해도 끝까지 돈다', async () => {
    const counted: string[] = []
    const removed: string[] = []
    const one = spy({})
    const result = await sweepServerSync({
      ...one.deps,
      list: async () => [
        entry({ id: 'q1', recordId: 'r1' }),
        entry({ id: 'q2', recordId: 'r2' }),
        entry({ id: 'q3', recordId: 'r3' }),
      ],
      countAttempt: async (recordId) => {
        counted.push(recordId)
      },
      remove: async (recordId) => {
        removed.push(recordId)
      },
      handlers: {
        'drop-price': {
          read: async () => ({ priceMeso: 1 }),
          send: async (_headers, recordId) =>
            recordId === 'r2' ? { outcome: 'rejected', status: 503 } : { outcome: 'sent' },
        },
      },
    })

    expect(result).toEqual({ sent: 2, rejected: 1, offline: 0, dropped: 0 })
    expect(removed).toEqual(['r1', 'r3'])
    expect(counted).toEqual(['r2'])
  })
})
