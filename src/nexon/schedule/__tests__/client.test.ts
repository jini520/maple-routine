import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NexonSchedulerCharacterStateWire } from '../../../types'
import {
  fetchSchedulerCharacterState,
  fetchSchedulerStatesForCharacters,
} from '../client'
import { NexonAuthError } from '../../errors'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

function schedulerFixture(characterName: string): NexonSchedulerCharacterStateWire {
  return {
    date: '2026-07-09T00:00+09:00',
    character_name: characterName,
    world_name: '엘리시움',
    character_level: 293,
    character_class: '렌',
    daily_contents: [],
    weekly_contents: [],
    boss_contents: [],
    weekly_boss_clear_count: 0,
    weekly_boss_clear_limit_count: 0,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchSchedulerCharacterState', () => {
  it('ocid를 쿼리 파라미터로 담아 호출하고 응답을 domain 타입으로 변환한다', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, schedulerFixture('낟낟')))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchSchedulerCharacterState('test-api-key', 'ocid-123')

    expect(result.characterName).toBe('낟낟')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://open.api.nexon.com/maplestory/v1/scheduler/character-state?ocid=ocid-123',
      expect.objectContaining({
        headers: { 'x-nxopen-api-key': 'test-api-key' },
      }),
    )
  })

  it('date가 주어지면 쿼리 파라미터에 date를 함께 담아 호출한다', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, schedulerFixture('낟낟')))
    vi.stubGlobal('fetch', fetchMock)

    await fetchSchedulerCharacterState('test-api-key', 'ocid-123', '2026-06-01')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://open.api.nexon.com/maplestory/v1/scheduler/character-state?ocid=ocid-123&date=2026-06-01',
      expect.objectContaining({
        headers: { 'x-nxopen-api-key': 'test-api-key' },
      }),
    )
  })
})

describe('fetchSchedulerStatesForCharacters', () => {
  it('여러 ocid를 순차적으로 호출한다(동시에 두 개 이상 in-flight 상태가 되지 않는다)', async () => {
    const resolvers: Array<(response: Response) => void> = []
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve)
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const promise = fetchSchedulerStatesForCharacters('test-api-key', ['ocid-1', 'ocid-2', 'ocid-3'])

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(resolvers).toHaveLength(1)
    resolvers[0](jsonResponse(200, schedulerFixture('캐릭터1')))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    resolvers[1](jsonResponse(200, schedulerFixture('캐릭터2')))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    resolvers[2](jsonResponse(200, schedulerFixture('캐릭터3')))

    const results = await promise
    expect(results.map((r) => r.characterName)).toEqual(['캐릭터1', '캐릭터2', '캐릭터3'])
  })

  it('한 캐릭터의 네트워크성 실패는 건너뛰고 나머지 캐릭터 조회를 계속한다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, schedulerFixture('캐릭터1')))
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, schedulerFixture('캐릭터3')))
    vi.stubGlobal('fetch', fetchMock)

    const results = await fetchSchedulerStatesForCharacters('test-api-key', [
      'ocid-1',
      'ocid-2',
      'ocid-3',
    ])

    expect(results.map((r) => r.characterName)).toEqual(['캐릭터1', '캐릭터3'])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('키 무효(401) 실패는 즉시 전파하고 이후 캐릭터는 호출하지 않는다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, schedulerFixture('캐릭터1')))
      .mockResolvedValueOnce(jsonResponse(401, {}))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchSchedulerStatesForCharacters('test-api-key', ['ocid-1', 'ocid-2', 'ocid-3']),
    ).rejects.toThrow(NexonAuthError)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
