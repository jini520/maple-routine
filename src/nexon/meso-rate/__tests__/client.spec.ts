import { fetchMesoRate } from '../client'
import { NexonAuthError, NexonNetworkError } from '../../errors'

const 원래전역: Record<string, unknown> = {}

function stubGlobal(name: string, value: unknown): void {
  if (!(name in 원래전역)) 원래전역[name] = (globalThis as Record<string, unknown>)[name]
  ;(globalThis as Record<string, unknown>)[name] = value
}

function unstubAllGlobals(): void {
  for (const [name, value] of Object.entries(원래전역)) {
    ;(globalThis as Record<string, unknown>)[name] = value
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

/** 실측 캐릭터(렌)를 축약한 것 — 합이 149 다([[ADR-177]]). */
const 응답 = {
  '/maplestory/v1/character/item-equipment': {
    item_equipment: [
      { potential_option_1: '메소 획득량 +20%', potential_option_2: '메소 획득량 +20%' },
      { potential_option_1: '메소 획득량 +20%', potential_option_2: '메소 획득량 +20%' },
      { potential_option_1: '메소 획득량 +20%' },
    ],
  },
  '/maplestory/v1/character/ability': { ability_info: [{ ability_value: '메소 획득량 20% 증가' }] },
  '/maplestory/v1/character/symbol-equipment': {
    symbol: [{ symbol_meso_rate: '0%' }, { symbol_meso_rate: '13%' }],
  },
  '/maplestory/v1/user/union-raider': { union_raider_stat: ['메소 획득량 4% 증가'] },
  '/maplestory/v1/user/union-artifact': { union_artifact_effect: [{ name: '메소 획득량 12% 증가' }] },
} as const

function 정상응답(): jest.Mock {
  return jest.fn(async (url: string) => {
    const path = Object.keys(응답).find((each) => url.includes(each))
    if (path === undefined) throw new Error(`예상 못 한 호출: ${url}`)
    return jsonResponse(200, 응답[path as keyof typeof 응답])
  })
}

afterEach(() => {
  unstubAllGlobals()
  jest.restoreAllMocks()
})

describe('fetchMesoRate', () => {
  it('다섯을 부르고 최대 메소 획득량을 낸다', async () => {
    const fetchMock = 정상응답()
    stubGlobal('fetch', fetchMock)

    await expect(fetchMesoRate('api-key', 'ocid-1')).resolves.toBe(149)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('다섯 경로에 ocid 를 실어 보내고 키를 헤더에 단다', async () => {
    const fetchMock = 정상응답()
    stubGlobal('fetch', fetchMock)

    await fetchMesoRate('api-key', 'oc id/1')

    const 부른경로 = fetchMock.mock.calls.map(([url]) => String(url))
    for (const path of Object.keys(응답)) {
      // ocid 는 인코딩된다 — 슬래시가 든 ocid 가 경로를 갈라 놓으면 안 된다.
      expect(부른경로).toContain(`https://open.api.nexon.com${path}?ocid=oc%20id%2F1`)
    }
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { 'x-nxopen-api-key': 'api-key' } })
  })

  it('다섯은 병렬이다 — 앞의 응답을 기다리지 않는다', async () => {
    let 동시 = 0
    let 최대동시 = 0
    stubGlobal(
      'fetch',
      jest.fn(async (url: string) => {
        동시 += 1
        최대동시 = Math.max(최대동시, 동시)
        await Promise.resolve()
        동시 -= 1
        const path = Object.keys(응답).find((each) => url.includes(each))!
        return jsonResponse(200, 응답[path as keyof typeof 응답])
      }),
    )

    await fetchMesoRate('api-key', 'ocid-1')
    expect(최대동시).toBe(5)
  })

  it('하나라도 실패하면 던진다 — 반쪽짜리 최대치를 내지 않는다', async () => {
    stubGlobal(
      'fetch',
      jest.fn(async (url: string) => {
        if (url.includes('union-artifact')) return jsonResponse(401, {})
        const path = Object.keys(응답).find((each) => url.includes(each))!
        return jsonResponse(200, 응답[path as keyof typeof 응답])
      }),
    )

    await expect(fetchMesoRate('api-key', 'ocid-1')).rejects.toBeInstanceOf(NexonAuthError)
  })

  it('네트워크가 끊기면 NexonNetworkError 다', async () => {
    stubGlobal('fetch', jest.fn(async () => { throw new TypeError('Network request failed') }))
    await expect(fetchMesoRate('api-key', 'ocid-1')).rejects.toBeInstanceOf(NexonNetworkError)
  })

  it('미접속 캐릭터의 축약 응답(빈 몸)에서도 던지지 않고 0 을 낸다', async () => {
    stubGlobal('fetch', jest.fn(async () => jsonResponse(200, {})))
    await expect(fetchMesoRate('api-key', 'ocid-1')).resolves.toBe(0)
  })
})
