import { QueryClient } from '@tanstack/react-query'

import { queryClient } from '../client'
import { queryKeys } from '../keys'
import { QUERY_CACHE_BUSTER, createQueryPersistOptions, shouldPersistQuery } from '../persist'

jest.mock('../../../storage/query-cache', () => ({
  getQueryCache: jest.fn(),
  setQueryCache: jest.fn(),
  removeQueryCache: jest.fn(),
}))
const storage = jest.requireMock('../../../storage/query-cache') as Record<string, jest.Mock>

describe('shouldPersistQuery', () => {
  it('meta.persist 가 참이고 성공한 쿼리만 저장한다', () => {
    const client = new QueryClient()
    client.setQueryData(['schedule', 'a'], { v: 1 })
    const persisted = client.getQueryCache().find({ queryKey: ['schedule', 'a'] })!
    persisted.setOptions({ queryKey: ['schedule', 'a'], meta: { persist: true } })
    client.setQueryData(['tracked-ocids'], ['a'])
    const notPersisted = client.getQueryCache().find({ queryKey: ['tracked-ocids'] })!

    expect(shouldPersistQuery(persisted)).toBe(true)
    expect(shouldPersistQuery(notPersisted)).toBe(false)
  })
})

// `meta` 는 옵저버가 붙거나 `fetchQuery` 가 돌 때 쿼리에 실린다. 둘 다 없는 쿼리는 저장기가 조용히 건너뛴다.
describe('화면이 구독하지 않는 쿼리', () => {
  it.each([
    ['메소 획득량', queryKeys.mesoRate('ocid-1'), 0],
    ['이벤트 월드 이름', queryKeys.eventWorldNames(), []],
  ])('%s 은 `setQueryData` 로만 넣어도 저장 대상이다', (_name, queryKey, value) => {
    queryClient.setQueryData(queryKey, value)

    expect(shouldPersistQuery(queryClient.getQueryCache().find({ queryKey })!)).toBe(true)
  })
})

describe('createQueryPersistOptions', () => {
  it('저장소 어댑터는 storage/query-cache 를 부르고 판이 다르면 버린다', async () => {
    const options = createQueryPersistOptions()
    expect(options.buster).toBe(QUERY_CACHE_BUSTER)
    expect(options.maxAge).toBe(Number.POSITIVE_INFINITY)

    storage.getQueryCache.mockResolvedValue(null)
    storage.removeQueryCache.mockResolvedValue(undefined)
    await options.persister.restoreClient()
    expect(storage.getQueryCache).toHaveBeenCalledWith('query-cache')

    await options.persister.removeClient()
    expect(storage.removeQueryCache).toHaveBeenCalledWith('query-cache')
  })
})
