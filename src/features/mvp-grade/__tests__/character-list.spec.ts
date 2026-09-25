jest.mock('../../../nexon/character', () => ({ fetchCharacterList: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ recordCharacterAccounts: jest.fn() }))

import { fetchCharacterList } from '../../../nexon/character'
import { recordCharacterAccounts } from '../../../storage/character-accounts'
import { fetchAndRecordCharacterList } from '../character-list'
import type { NexonCredential } from '../../../types/auth'

/** 넥슨에 넘기는 자격. 지금은 API 키 한 종류뿐이다. */
const 자격 = (value: string): NexonCredential => ({ kind: 'apiKey', value })

const fetchMock = fetchCharacterList as jest.Mock
const recordMock = recordCharacterAccounts as jest.Mock

const ACCOUNTS = [
  { accountId: 'A', characters: [{ ocid: 'x', name: '루디', world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 }] },
]

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(ACCOUNTS)
  recordMock.mockReset().mockResolvedValue(undefined)
})

describe('fetchAndRecordCharacterList', () => {
  it('받은 목록을 그대로 돌려주고 소속을 KST 오늘 날짜로 적는다', async () => {
    // 2026-09-22 23:30 UTC 는 KST 로 9월 23일이다
    const accounts = await fetchAndRecordCharacterList(자격('key'), new Date('2026-09-22T23:30:00Z'))

    expect(accounts).toBe(ACCOUNTS)
    expect(fetchMock).toHaveBeenCalledWith(자격('key'), expect.any(Function))
    expect(recordMock).toHaveBeenCalledWith(ACCOUNTS, '2026-09-23')
  })

  it('소속을 못 적어도 목록은 받는다', async () => {
    recordMock.mockRejectedValue(new Error('db'))

    await expect(fetchAndRecordCharacterList(자격('key'), new Date('2026-09-22T00:00:00Z'))).resolves.toBe(ACCOUNTS)
  })

  it('목록을 못 받으면 그 실패를 그대로 던지고 아무것도 안 적는다', async () => {
    fetchMock.mockRejectedValue(new Error('network'))

    await expect(fetchAndRecordCharacterList(자격('key'))).rejects.toThrow('network')
    expect(recordMock).not.toHaveBeenCalled()
  })
})

describe('통과 지점', () => {
  // 한 자리라도 목록을 직접 부르면 그 자리만 쓰는 사용자의 소속 기록이 빈다.
  it('`nexon/` 밖에서 `fetchCharacterList` 를 직접 부르는 자리는 이 모듈 하나다', () => {
    const { readFileSync, readdirSync, statSync } = jest.requireActual<typeof import('node:fs')>('node:fs')
    const path = jest.requireActual<typeof import('node:path')>('node:path')
    const src = path.resolve(__dirname, '../../..')
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : files(full)
        return /\.tsx?$/.test(entry) ? [full] : []
      })
    const callers = files(src)
      .filter((file) => !path.relative(src, file).startsWith('nexon'))
      .filter((file) => /\bfetchCharacterList\(/.test(readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')))
      .map((file) => path.relative(src, file))

    expect(callers).toEqual([path.join('features', 'mvp-grade', 'character-list.ts')])
  })
})
