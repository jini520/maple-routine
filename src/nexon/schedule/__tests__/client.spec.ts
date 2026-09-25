import type { NexonSchedulerCharacterStateWire } from '../../../types'
import { fetchSchedulerCharacterState } from '../client'
import type { ScheduleNameResolvers } from '../normalize'
import type { NexonCredential } from '../../../types/auth'

/** 넥슨에 넘기는 자격. 지금은 API 키 한 종류뿐이다. */
const 자격 = (value: string): NexonCredential => ({ kind: 'apiKey', value })

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

/** 어떤 이름도 key 로 못 찾는 resolver. 호출 경로만 보는 사례에 넘긴다. */
const NO_KEYS: ScheduleNameResolvers = { bossKey: () => null, contentKey: () => null, worldKey: () => null }

afterEach(() => {
  unstubAllGlobals()
})

describe('fetchSchedulerCharacterState', () => {
  it('ocid를 쿼리 파라미터로 담아 호출하고 응답을 domain 타입으로 변환한다', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(200, schedulerFixture('낟낟')))
    stubGlobal('fetch', fetchMock)

    const result = await fetchSchedulerCharacterState(자격('test-api-key'), 'ocid-123', NO_KEYS)

    expect(result.characterName).toBe('낟낟')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://open.api.nexon.com/maplestory/v1/scheduler/character-state?ocid=ocid-123',
      expect.objectContaining({
        headers: { 'x-nxopen-api-key': 'test-api-key' },
      }),
    )
  })

  // nexon/ 은 보스 표도 컨텐츠 표도 모른다. 넘겨받은 함수로 key 를 채운다.
  it('넘긴 resolver 로 보스 항목과 컨텐츠 항목의 key 를 채운다', async () => {
    const wire: NexonSchedulerCharacterStateWire = {
      ...schedulerFixture('낟낟'),
      daily_contents: [
        { content_name: '몬스터파크', type: 'contents', registration_flag: 'true', now_count: 1, max_count: 14, quest_state: null },
      ],
      boss_contents: [
        { content_name: '루시드', difficulty: 'hard', cycle: 'bossWeekly', registration_flag: 'true', complete_flag: 'false' },
      ],
    }
    stubGlobal('fetch', jest.fn(async () => jsonResponse(200, wire)))

    const result = await fetchSchedulerCharacterState(자격('test-api-key'), 'ocid-123', {
      bossKey: (name) => (name === '루시드' ? 'lucid' : null),
      contentKey: (name) => (name === '몬스터파크' ? 'monster_park' : null),
      worldKey: (name) => (name === '엘리시움' ? 'elysium' : null),
    })

    expect(result.bossContents).toEqual([
      expect.objectContaining({ bossKey: 'lucid', apiName: '루시드', difficulty: 'hard' }),
    ])
    expect(result.dailyContents).toEqual([expect.objectContaining({ contentKey: 'monster_park', apiName: '몬스터파크' })])
    expect(result.worldKey).toBe('elysium')
  })

  it('date가 주어지면 쿼리 파라미터에 date를 함께 담아 호출한다', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(200, schedulerFixture('낟낟')))
    stubGlobal('fetch', fetchMock)

    await fetchSchedulerCharacterState(자격('test-api-key'), 'ocid-123', NO_KEYS, '2026-06-01')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://open.api.nexon.com/maplestory/v1/scheduler/character-state?ocid=ocid-123&date=2026-06-01',
      expect.objectContaining({
        headers: { 'x-nxopen-api-key': 'test-api-key' },
      }),
    )
  })
})
