/**
 * 키가 있던 기기의 부계정 기록을 이 기기에서만 지우는 `기록 삭제`.
 *
 * 여기서 막는 사고는 둘이다. 올리지 못한 기록의 원본을 지워 올리기가 지우기를 보내 서버와 다른 기기의 기록까지 지우는 것, 지운 기록을 다음
 * 받기가 다시 넣어 흐린 기록이 돌아오는 것이다.
 */
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import type { ServerSyncSkippedMapleIds } from '../../../storage/server-sync-skipped'
import { discardKeyLostMapleId, type DiscardDeps } from '../discard'

function setup(queue: { recordType: string; recordId: string; mapleId: string }[]) {
  const events: string[] = []
  let skipped: ServerSyncSkippedMapleIds = { other: 'unknown' }
  const deps: DiscardDeps = {
    sync: jest.fn(async () => {
      events.push('sync')
    }),
    queue: jest.fn(async () => queue),
    ownerOf: jest.fn(async (_table: string, recordId: string) => {
      const entry = queue.find((one) => one.recordId === recordId)
      return entry === undefined ? { kind: 'unknown' as const } : { kind: 'mapleId' as const, mapleId: entry.mapleId }
    }),
    clear: jest.fn(async (mapleId: string) => {
      events.push(`clear ${mapleId}`)
    }),
    getSkipped: jest.fn(async () => skipped),
    setSkipped: jest.fn(async (next: ServerSyncSkippedMapleIds) => {
      skipped = next
    }),
    afterRecordsChanged: jest.fn(),
  }
  return { deps, events, skipped: () => skipped }
}

it('동기화를 돌린 뒤 그 메이플 ID 의 기록을 비우고, 받기가 다시 넣지 않게 지웠다고 적는다', async () => {
  const { deps, events, skipped } = setup([{ recordType: 'cashbookEntries', recordId: 'e-1', mapleId: 'maple-other' }])

  await expect(discardKeyLostMapleId('maple-lost', deps)).resolves.toBe('discarded')

  expect(events).toEqual(['sync', 'clear maple-lost'])
  expect(skipped()).toEqual({ other: 'unknown', [nexonIdHashHex('maple-lost')]: 'discarded' })
  expect(deps.afterRecordsChanged).toHaveBeenCalled()
})

it('올리지 못한 그 메이플 ID 의 기록이 남으면 아무것도 지우지 않는다', async () => {
  const { deps, events, skipped } = setup([{ recordType: 'cashbookEntries', recordId: 'e-1', mapleId: 'maple-lost' }])

  await expect(discardKeyLostMapleId('maple-lost', deps)).resolves.toBe('pending')

  expect(events).toEqual(['sync'])
  expect(skipped()).toEqual({ other: 'unknown' })
})
