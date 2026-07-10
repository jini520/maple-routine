import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NexonCharacterListResponse } from '../../../types'
import { fetchCharacterList } from '../client'
import { NexonAuthError, NexonNetworkError, NexonRateLimitError } from '../../errors'

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
  vi.unstubAllGlobals()
})

describe('fetchCharacterList', () => {
  it('정상 응답을 MapleAccount[]로 변환해 반환한다', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, characterListFixture))
    vi.stubGlobal('fetch', fetchMock)

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

describe('에러 처리', () => {
  it('401 응답이면 NexonAuthError를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, {})))
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonAuthError)
  })

  it('403 응답이면 NexonAuthError를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(403, {})))
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonAuthError)
  })

  it('429 응답이면 NexonRateLimitError를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(429, { error: { name: 'OPENAPI00007' } })))
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonRateLimitError)
  })

  it('5xx 응답이면 NexonNetworkError를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(500, {})))
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonNetworkError)
  })

  it('fetch 자체가 reject되면(네트워크 없음/타임아웃) NexonNetworkError를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonNetworkError)
  })

  it('응답이 JSON이 아니면(WAF/CDN 차단 페이지 등) NexonNetworkError를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => brokenJsonResponse(200)))
    await expect(fetchCharacterList('test-api-key')).rejects.toThrow(NexonNetworkError)
  })
})
