/**
 * **만드는 쪽과 레지스트리가 같은 집합인가.**
 *
 * 종류를 레지스트리에 안 더하면 대기 표에 줄은 쌓이고 조용히 안 나간다. 고리가 모르는 `record_type` 를
 * 버리게 해 두었지만, 그러면 **버리는 것이 정상 동작처럼 보여** 빠뜨린 것을 알아낼 길이 없다.
 * 그래서 줄을 만드는 자리가 쓰는 이름이 전부 이 표에 있는지 여기서 본다.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SYNC_HANDLERS } from '../registry'
import { DROP_PRICE_RECORD_TYPE } from '../drop-price-sync'
import { sweepServerSync } from '../sweep'
import type { SyncQueueEntry } from '../../../storage/server-sync-queue'

const SYNC_DIR = join(__dirname, '..')

describe('전송 종류 레지스트리', () => {
  it('`enqueueServerSync` 에 넘기는 이름이 전부 표에 있다', () => {
    // 상수 이름으로 넘기는 것이 규약이다. 문자열을 손으로 적으면 오타가 **안 나감** 으로 조용히
    // 실패하고, 그 오타는 타입 검사에 안 걸린다.
    const kinds = new Set(Object.keys(SYNC_HANDLERS))
    const constants = new Map<string, string>([
      ['DROP_PRICE_RECORD_TYPE', DROP_PRICE_RECORD_TYPE],
    ])

    const callers: { file: string; argument: string }[] = []
    for (const name of readdirSync(SYNC_DIR)) {
      if (!name.endsWith('.ts')) continue
      const source = readFileSync(join(SYNC_DIR, name), 'utf8')
      for (const match of source.matchAll(/enqueueServerSync\(\s*([A-Za-z_'"][^,]*)/g)) {
        callers.push({ file: name, argument: match[1].trim() })
      }
    }

    expect(callers.length).toBeGreaterThan(0)
    for (const one of callers) {
      const resolved = constants.get(one.argument)
      expect(resolved).toBeDefined()
      expect(kinds.has(resolved as string)).toBe(true)
    }
  })

  it('줄을 만드는 자리가 이 디렉터리 밖에 없다', () => {
    // 밖에서 부르면 위 검사가 못 본다. 어댑터는 `storage/` 에 있고 그것을 부르는 것은 이 기능뿐이다.
    const root = join(__dirname, '..', '..', '..')
    const hits: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(path)
          continue
        }
        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
        if (path.includes(join('storage', 'server-sync-queue.ts'))) continue
        if (path.includes(join('features', 'server-sync'))) continue
        if (readFileSync(path, 'utf8').includes('enqueueServerSync(')) hits.push(path)
      }
    }
    walk(root)

    expect(hits).toEqual([])
  })
})

// 옛 앱은 보스 처치 · 가계부 기록 · 강화 합계도 대기 표에 넣었다. 그 줄이 남아 있으면 업데이트 뒤에도 서버로 나가거나,
// 지우지 않으면 영원히 쌓인다. 실제 레지스트리로 훑어 원본을 읽지도 보내지도 않고 지우는지 본다.
describe('보내지 않게 된 종류의 남은 줄', () => {
  it('원본을 읽지도 서버에 보내지도 않고 줄을 지운다', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('보내면 안 된다'))
    const entries: SyncQueueEntry[] = ['boss-clear', 'cashbook-entry', 'enhancement-total'].map((recordType, i) => ({
      id: `q-${i}`,
      recordType,
      recordId: `r-${i}`,
      attempts: 0,
      lastError: null,
      createdAt: '2026-10-26T00:00:00.000Z',
    }))
    const removed: string[] = []
    const counted: string[] = []

    const result = await sweepServerSync({
      identity: async () => ({ 'x-api-key-hash': 'h' }),
      list: async () => entries,
      countAttempt: async (recordId) => {
        counted.push(recordId)
      },
      remove: async (recordId) => {
        removed.push(recordId)
      },
      handlers: SYNC_HANDLERS,
    })

    expect(result).toEqual({ sent: 0, rejected: 0, offline: 0, dropped: 3 })
    expect(removed).toEqual(['r-0', 'r-1', 'r-2'])
    expect(counted).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
