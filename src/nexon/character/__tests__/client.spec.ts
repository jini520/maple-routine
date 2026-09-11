import type { NexonCharacterBasicResponse, NexonCharacterListResponse } from '../../../types'
import { fetchCharacterBasic, fetchCharacterList } from '../client'
import {
  NexonAuthError,
  NexonNetworkError,
  NexonNoCharacterError,
  NexonRateLimitError,
} from '../../errors'

// 전역을 잠시 갈아 끼우는 도우미. 원래 값을 기억해 두고
// `unstubAllGlobals` 가 되돌린다.
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
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

function brokenJsonResponse(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0')
    },
  } as unknown as Response
}

const characterListFixture: NexonCharacterListResponse = {
  account_list: [
    {
      account_id: 'da9b2f2...',
      character_list: [
        {
          ocid: '50119a0...',
          character_name: '내옆에최성일',
          world_name: '베라',
          character_class: '아크메이지(썬,콜)',
          character_level: 211,
        },
      ],
    },
  ],
}

afterEach(() => {
  unstubAllGlobals()
})

describe('fetchCharacterList', () => {
  it('정상 응답을 MapleAccount[]로 변환해 반환한다', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(200, characterListFixture))
    stubGlobal('fetch', fetchMock)

    const result = await fetchCharacterList('test-api-key')

    expect(result).toEqual([
      {
        accountId: 'da9b2f2...',
        characters: [
          {
            ocid: '50119a0...',
            name: '내옆에최성일',
            world: '베라',
            jobClass: '아크메이지(썬,콜)',
            level: 211,
          },
        ],
      },
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      'https://open.api.nexon.com/maplestory/v1/character/list',
      expect.objectContaining({
        headers: { 'x-nxopen-api-key': 'test-api-key' },
      }),
    )
  })
})

const characterBasicFixture: NexonCharacterBasicResponse = {
  character_name: '낟낟',
  character_level: 293,
  character_image: 'https://open.api.nexon.com/static/maplestory/character/look/abc?wmotion=W02',
  access_flag: 'true',
}

describe('fetchCharacterBasic', () => {
  it('ocid를 쿼리로 붙여 호출하고 정상 응답을 CharacterBasicProfile로 변환해 반환한다', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(200, characterBasicFixture))
    stubGlobal('fetch', fetchMock)

    const result = await fetchCharacterBasic('test-api-key', 'ocid-1')

    expect(result).toEqual({
      name: '낟낟',
      level: 293,
      imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/abc?wmotion=W02',
      accessFlag: true,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://open.api.nexon.com/maplestory/v1/character/basic?ocid=ocid-1',
      expect.objectContaining({
        headers: { 'x-nxopen-api-key': 'test-api-key' },
      }),
    )
  })

  it('401 응답이면 NexonAuthError를 던진다', async () => {
    stubGlobal('fetch', jest.fn(async () => jsonResponse(401, {})))
    await expect(fetchCharacterBasic('test-api-key', 'ocid-1')).rejects.toThrow(NexonAuthError)
  })

  it('429 응답이면 NexonRateLimitError를 던진다', async () => {
    stubGlobal('fetch', jest.fn(async () => jsonResponse(429, { error: { name: 'OPENAPI00007' } })))
    await expect(fetchCharacterBasic('test-api-key', 'ocid-1')).rejects.toThrow(NexonRateLimitError)
  })

  // 월드 이전으로 남겨진 ocid 의 실제 응답이다(실측 2026-09-11). 400 이 아니라 200 이고
  // 본문의 전 필드가 null 이다. 이것을 프로필로 정규화하면 이름 없는 캐릭터가 캐시에 심긴다.
  it('200 인데 character_name 이 null 이면 NexonNoCharacterError를 던진다', async () => {
    const strandedPayload = {
      date: null,
      character_name: null,
      world_name: null,
      character_gender: null,
      character_class: null,
      character_class_level: null,
      character_level: null,
      character_exp: null,
      character_exp_rate: null,
      character_guild_name: null,
      character_image: null,
      character_date_create: null,
      access_flag: null,
      liberation_quest_clear: null,
    }
    stubGlobal('fetch', jest.fn(async () => jsonResponse(200, strandedPayload)))

    await expect(fetchCharacterBasic('test-api-key', 'ocid-1')).rejects.toThrow(
      NexonNoCharacterError,
    )
  })

  // 정규화가 먼저 돌면 `character_exp_rate: null` 에서 `null.trim()` 이 터지고, 그 TypeError 는
  // `toScheduleSyncError` 가 `network`(재시도하면 풀린다)로 접는다. 실제로는 영영 안 풀린다.
  it('그 응답에서 TypeError 가 새지 않는다', async () => {
    stubGlobal(
      'fetch',
      jest.fn(async () => jsonResponse(200, { character_name: null, character_exp_rate: null })),
    )

    await expect(fetchCharacterBasic('test-api-key', 'ocid-1')).rejects.not.toBeInstanceOf(TypeError)
  })
})

describe('에러 처리', () => {
  it('401 응답이면 NexonAuthError를 던진다', async () => {
    stubGlobal('fetch', jest.fn(async () => jsonResponse(401, {})))
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonAuthError)
  })

  it('403 응답이면 NexonAuthError를 던진다', async () => {
    stubGlobal('fetch', jest.fn(async () => jsonResponse(403, {})))
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonAuthError)
  })

  it('429 응답이면 NexonRateLimitError를 던진다', async () => {
    stubGlobal('fetch', jest.fn(async () => jsonResponse(429, { error: { name: 'OPENAPI00007' } })))
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonRateLimitError)
  })

  it('5xx 응답이면 NexonNetworkError를 던진다', async () => {
    stubGlobal('fetch', jest.fn(async () => jsonResponse(500, {})))
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonNetworkError)
  })

  it('fetch 자체가 reject되면(네트워크 없음/타임아웃) NexonNetworkError를 던진다', async () => {
    stubGlobal('fetch', jest.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonNetworkError)
  })

  it('응답이 JSON이 아니면(WAF/CDN 차단 페이지 등) NexonNetworkError를 던진다', async () => {
    stubGlobal('fetch', jest.fn(async () => brokenJsonResponse(200)))
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonNetworkError)
  })
})
