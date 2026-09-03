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

/** 실제 캐릭터(렌)를 축약한 것. 합이 149 다. */
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
  '/maplestory/v1/character/skill': { character_skill: [{ skill_name: '무기 숙련' }] },
} as const

/** 실응답을 그대로 옮긴 설명문(사용자 제공). */
const 챌린저스 = {
  skill_name: '챌린저스',
  skill_description:
    '[마스터 레벨 : 1]\r\n챌린저스 월드에서 사파이어, 다이아몬드, 마스터, 챌린저, 슈퍼챌린저 티어를 달성한 자에게 적용되는 특별한 능력이다.',
}

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
  it('여섯을 부르고 최대 메소 획득량을 낸다', async () => {
    const fetchMock = 정상응답()
    stubGlobal('fetch', fetchMock)

    await expect(fetchMesoRate('api-key', 'ocid-1', null)).resolves.toBe(149)
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('여섯 경로에 ocid 를 실어 보내고 키를 헤더에 단다', async () => {
    const fetchMock = 정상응답()
    stubGlobal('fetch', fetchMock)

    await fetchMesoRate('api-key', 'oc id/1', null)

    const 부른경로 = fetchMock.mock.calls.map(([url]) => String(url))
    for (const path of Object.keys(응답)) {
      // ocid 는 인코딩된다. 슬래시가 든 ocid 가 경로를 갈라 놓으면 안 된다.
      // 스킬만 차수를 함께 싣는다.
      const 기대 = `https://open.api.nexon.com${path}?ocid=oc%20id%2F1`
      expect(부른경로).toContain(
        path.endsWith('/character/skill') ? `${기대}&character_skill_grade=0` : 기대,
      )
    }
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { 'x-nxopen-api-key': 'api-key' } })
  })

  it('챌린저스를 든 캐릭터는 20 이 더 붙는다', async () => {
    stubGlobal(
      'fetch',
      jest.fn(async (url: string) => {
        if (url.includes('/character/skill')) {
          return jsonResponse(200, { character_skill: [챌린저스] })
        }
        const path = Object.keys(응답).find((each) => url.includes(each))!
        return jsonResponse(200, 응답[path as keyof typeof 응답])
      }),
    )

    await expect(fetchMesoRate('api-key', 'ocid-1', null)).resolves.toBe(169)
  })

  it('섀도어면 그리드로 20 이 더 붙는다. 스킬 조회를 안 거친다', async () => {
    const fetchMock = 정상응답()
    stubGlobal('fetch', fetchMock)

    await expect(fetchMesoRate('api-key', 'ocid-1', '섀도어')).resolves.toBe(169)
  })

  it('여섯은 병렬이다. 앞의 응답을 기다리지 않는다', async () => {
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

    await fetchMesoRate('api-key', 'ocid-1', null)
    expect(최대동시).toBe(6)
  })

  it('하나라도 실패하면 던진다. 반쪽짜리 최대치를 내지 않는다', async () => {
    stubGlobal(
      'fetch',
      jest.fn(async (url: string) => {
        if (url.includes('union-artifact')) return jsonResponse(401, {})
        const path = Object.keys(응답).find((each) => url.includes(each))!
        return jsonResponse(200, 응답[path as keyof typeof 응답])
      }),
    )

    await expect(fetchMesoRate('api-key', 'ocid-1', null)).rejects.toBeInstanceOf(NexonAuthError)
  })

  it('스킬 조회가 실패해도 던진다. 챌린저스가 빠진 값은 최대치가 아니다', async () => {
    stubGlobal(
      'fetch',
      jest.fn(async (url: string) => {
        if (url.includes('/character/skill')) return jsonResponse(500, {})
        const path = Object.keys(응답).find((each) => url.includes(each))!
        return jsonResponse(200, 응답[path as keyof typeof 응답])
      }),
    )

    await expect(fetchMesoRate('api-key', 'ocid-1', null)).rejects.toBeInstanceOf(NexonNetworkError)
  })

  it('네트워크가 끊기면 NexonNetworkError 다', async () => {
    stubGlobal('fetch', jest.fn(async () => { throw new TypeError('Network request failed') }))
    await expect(fetchMesoRate('api-key', 'ocid-1', null)).rejects.toBeInstanceOf(NexonNetworkError)
  })

  it('미접속 캐릭터의 축약 응답(빈 몸)에서도 던지지 않고 0 을 낸다', async () => {
    stubGlobal('fetch', jest.fn(async () => jsonResponse(200, {})))
    await expect(fetchMesoRate('api-key', 'ocid-1', null)).resolves.toBe(0)
  })
})
