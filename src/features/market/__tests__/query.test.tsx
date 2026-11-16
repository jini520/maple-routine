jest.mock('../../../server/market', () => ({
  fetchMaspi: jest.fn(),
  fetchMarketItems: jest.fn(),
  fetchMarketItem: jest.fn(),
}))

import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import { marketItemsOptions, maspiOptions } from '../query'

const { fetchMaspi: maspiMock, fetchMarketItems: itemsMock } = jest.requireMock('../../../server/market') as Record<string, jest.Mock>

const MASPI = { date: '2026-11-15', close: 9119, change: 36.7, series: [{ date: '2026-11-15', value: 9119 }] }

beforeEach(() => {
  queryClient.clear()
  jest.clearAllMocks()
})

it('기기에 저장되고, 보는 화면이 포커스될 때마다 다시 묻는다', () => {
  const options = maspiOptions()
  expect(options.queryKey).toEqual(queryKeys.marketMaspi())
  expect(options.meta).toEqual({ persist: true, source: 'server' })
  expect(options.staleTime).toBe(0)
  expect(options.refetchOnWindowFocus).toBe('always')
})

it('가진 응답의 ETag 를 보내고, 304 면 가진 응답을 그대로 쓴다', async () => {
  maspiMock.mockResolvedValueOnce({ kind: 'ok', etag: '"e1"', body: MASPI })
  await queryClient.fetchQuery(maspiOptions())

  maspiMock.mockResolvedValueOnce({ kind: 'not-modified' })
  const again = await queryClient.fetchQuery({ ...maspiOptions(), staleTime: 0 })

  expect(maspiMock).toHaveBeenLastCalledWith('"e1"')
  expect(again).toEqual({ etag: '"e1"', body: MASPI })
})

it('받지 못하면 가진 응답을 지킨다', async () => {
  maspiMock.mockResolvedValueOnce({ kind: 'ok', etag: '"e1"', body: MASPI })
  await queryClient.fetchQuery(maspiOptions())

  maspiMock.mockResolvedValueOnce(null)
  await expect(queryClient.fetchQuery({ ...maspiOptions(), staleTime: 0 })).rejects.toThrow()

  expect(queryClient.getQueryData(queryKeys.marketMaspi())).toEqual({ etag: '"e1"', body: MASPI })
})

it('그 월드의 시세가 없으면(404) 빈 목록으로 본다', async () => {
  itemsMock.mockResolvedValueOnce({ kind: 'missing' })

  const result = await queryClient.fetchQuery(marketItemsOptions('special'))

  expect(itemsMock).toHaveBeenCalledWith('special', null)
  expect(result).toEqual({ etag: null, body: null })
})
