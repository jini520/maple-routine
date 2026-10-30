import { fetchHexaMatrix } from '../client'
import type { NexonCredential } from '../../../types/auth'

/** 넥슨에 넘기는 자격. 지금은 API 키 한 종류뿐이다. */
const 자격 = (value: string): NexonCredential => ({ type: 'key', value, accountId: null })

const 원래fetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = 원래fetch
})

function 응답(body: unknown): jest.Mock {
  const mock = jest.fn(async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response)
  globalThis.fetch = mock as unknown as typeof fetch
  return mock
}

it('캐릭터의 헥사 매트릭스를 부르고 코어 줄을 돌려준다', async () => {
  const 코어 = { hexa_core_name: '솔 야누스', hexa_core_level: 23, hexa_core_event_level: 0, hexa_core_type: '공용 코어' }
  const fetchMock = 응답({ date: null, character_hexa_core_equipment: [코어] })

  await expect(fetchHexaMatrix(자격('api-key'), 'ocid 1')).resolves.toEqual([코어])
  expect(String(fetchMock.mock.calls[0]![0])).toContain('/maplestory/v1/character/hexamatrix?ocid=ocid%201')
})

it('코어가 없는 응답은 빈 줄이다', async () => {
  응답({ date: null, character_hexa_core_equipment: null })

  await expect(fetchHexaMatrix(자격('api-key'), 'ocid-1')).resolves.toEqual([])
})
