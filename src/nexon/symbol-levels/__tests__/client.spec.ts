import { fetchSymbolEquipment } from '../client'

const 원래fetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = 원래fetch
})

function 응답(body: unknown): jest.Mock {
  const mock = jest.fn(async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response)
  globalThis.fetch = mock as unknown as typeof fetch
  return mock
}

it('캐릭터의 심볼 장비를 부르고 심볼 줄을 돌려준다', async () => {
  const fetchMock = 응답({ symbol: [{ symbol_name: '아케인심볼 : 소멸의 여로', symbol_level: 20 }] })

  await expect(fetchSymbolEquipment('api-key', 'ocid 1')).resolves.toEqual([
    { symbol_name: '아케인심볼 : 소멸의 여로', symbol_level: 20 },
  ])
  expect(String(fetchMock.mock.calls[0]![0])).toContain('/maplestory/v1/character/symbol-equipment?ocid=ocid%201')
})

it('미접속 캐릭터의 축약 응답은 빈 줄이다', async () => {
  응답({})

  await expect(fetchSymbolEquipment('api-key', 'ocid-1')).resolves.toEqual([])
})
