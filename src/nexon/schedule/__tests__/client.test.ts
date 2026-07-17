import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NexonSchedulerCharacterStateWire } from '../../../types'
import { fetchSchedulerCharacterState } from '../client'

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
