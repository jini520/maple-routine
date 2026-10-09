/**
 * **만드는 쪽과 레지스트리가 같은 집합인가.**
 *
 * 종류를 레지스트리에 안 더하면 대기 표에 줄은 쌓이고 조용히 안 나간다. 고리가 모르는 `kind` 를
 * 버리게 해 두었지만, 그러면 **버리는 것이 정상 동작처럼 보여** 빠뜨린 것을 알아낼 길이 없다.
 * 그래서 줄을 만드는 자리가 쓰는 이름이 전부 이 표에 있는지 여기서 본다.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SYNC_HANDLERS } from '../registry'
import { DROP_PRICE_KIND } from '../drop-price-sync'

const SYNC_DIR = join(__dirname, '..')

describe('전송 종류 레지스트리', () => {
  it('지금 있는 종류는 드롭 가격 하나다', () => {
    expect(Object.keys(SYNC_HANDLERS)).toEqual([DROP_PRICE_KIND])
  })

  it('표의 종류마다 함수 둘이 다 있다', () => {
    for (const [kind, handler] of Object.entries(SYNC_HANDLERS)) {
      expect(typeof handler.read).toBe('function')
      expect(typeof handler.send).toBe('function')
      // `kind` 가 빈 문자열이면 대기 표의 칸이 비어 고리가 못 찾는다.
      expect(kind).not.toBe('')
    }
  })

  it('`enqueueServerSync` 에 넘기는 이름이 전부 표에 있다', () => {
    // 상수 이름으로 넘기는 것이 규약이다. 문자열을 손으로 적으면 오타가 «안 나감» 으로 조용히
    // 실패하고, 그 오타는 타입 검사에 안 걸린다.
    const kinds = new Set(Object.keys(SYNC_HANDLERS))
    const constants = new Map<string, string>([['DROP_PRICE_KIND', DROP_PRICE_KIND]])

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
