import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterScheduleSync } from '../../schedule-sync/schedule-sync'
import type { DailyContent, WeeklyContent } from '../../../types'

const { syncSchedulesMock } = vi.hoisted(() => ({
  syncSchedulesMock: vi.fn(),
}))

vi.mock('../../schedule-sync/schedule-sync', () => ({
  syncSchedules: syncSchedulesMock,
}))

import { useContentSchedulerStore } from '../store'

function dailyContent(name: string): DailyContent {
  return { name, isRegistered: true, nowCount: 1, maxCount: 3 }
}

function weeklyContent(name: string): WeeklyContent {
  return { name, kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 3 }
}

function syncResult(overrides: Partial<CharacterScheduleSync> = {}): CharacterScheduleSync {
  return {
    ocid: 'ocid-1',
    characterName: '캐릭터-ocid-1',
    state: {
      asOf: '2026-07-09T00:00+09:00',
      characterName: '캐릭터-ocid-1',
      world: '베라',
      level: 200,
      jobClass: '렌',
      dailyContents: [dailyContent('몬스터파크')],
      weeklyContents: [weeklyContent('에픽 던전 : 악몽선경')],
      bossContents: [],
      weeklyBossClearCount: 0,
      weeklyBossClearLimitCount: 0,
    },
    syncedAt: '2026-07-11T00:00:00.000Z',
    isStale: false,
    error: null,
    ...overrides,
  }
}

beforeEach(() => {
  useContentSchedulerStore.setState({ status: 'idle', characters: [], error: null })
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('useContentSchedulerStore', () => {
  it('초기 상태는 idle이고 캐릭터가 비어있다', () => {
    const state = useContentSchedulerStore.getState()
    expect(state.status).toBe('idle')
    expect(state.characters).toEqual([])
    expect(state.error).toBeNull()
  })

  it('refresh([])는 syncSchedules를 호출하지 않고 곧바로 loaded/빈 배열 상태가 된다', async () => {
    await useContentSchedulerStore.getState().refresh([])

    const state = useContentSchedulerStore.getState()
    expect(syncSchedulesMock).not.toHaveBeenCalled()
    expect(state.status).toBe('loaded')
    expect(state.characters).toEqual([])
    expect(state.error).toBeNull()
  })

  it('refresh(ocids)는 syncSchedules(ocids)를 정확히 그 인자로 호출한다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()])

    await useContentSchedulerStore.getState().refresh(['ocid-1'])

    expect(syncSchedulesMock).toHaveBeenCalledWith(['ocid-1'])
  })

  it('모든 캐릭터가 성공하면 status: loaded이고 dailyContents·weeklyContents가 하나의 상태에서 동시에 반영된다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-1', characterName: '캐릭터1' })])

    await useContentSchedulerStore.getState().refresh(['ocid-1'])

    const state = useContentSchedulerStore.getState()
    expect(state.status).toBe('loaded')
    expect(state.error).toBeNull()
    expect(state.characters).toEqual([
      {
        ocid: 'ocid-1',
        characterName: '캐릭터1',
        dailyContents: [dailyContent('몬스터파크')],
        weeklyContents: [weeklyContent('에픽 던전 : 악몽선경')],
        isStale: false,
        syncedAt: '2026-07-11T00:00:00.000Z',
        error: null,
      },
    ])
  })

  it('state가 null인 캐릭터는 dailyContents·weeklyContents를 빈 배열로 채운다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({ state: null, syncedAt: null, isStale: true, error: { kind: 'network' } }),
    ])

    await useContentSchedulerStore.getState().refresh(['ocid-1'])

    const state = useContentSchedulerStore.getState()
    expect(state.status).toBe('loaded')
    expect(state.characters).toEqual([
      {
        ocid: 'ocid-1',
        characterName: '캐릭터-ocid-1',
        dailyContents: [],
        weeklyContents: [],
        isStale: true,
        syncedAt: null,
        error: { kind: 'network' },
      },
    ])
  })

  it('일부 캐릭터만 에러/isStale이 있어도 전체 status는 loaded로 유지되고 그 캐릭터에만 에러가 반영된다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({ ocid: 'ocid-1', characterName: '캐릭터1' }),
      syncResult({
        ocid: 'ocid-2',
        characterName: '캐릭터2',
        state: null,
        syncedAt: null,
        isStale: true,
        error: { kind: 'invalidApiKey' },
      }),
    ])

    await useContentSchedulerStore.getState().refresh(['ocid-1', 'ocid-2'])

    const state = useContentSchedulerStore.getState()
    expect(state.status).toBe('loaded')
    expect(state.error).toBeNull()
    expect(state.characters[0].isStale).toBe(false)
    expect(state.characters[0].error).toBeNull()
    expect(state.characters[1].isStale).toBe(true)
    expect(state.characters[1].error).toEqual({ kind: 'invalidApiKey' })
  })

  it('syncSchedules() 자체가 throw하면 status: error가 되고 characters는 비어있는 상태를 유지한다', async () => {
    syncSchedulesMock.mockRejectedValue(new Error('온보딩이 완료되지 않았습니다'))

    await useContentSchedulerStore.getState().refresh(['ocid-1'])

    const state = useContentSchedulerStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toEqual({ kind: 'network' })
    expect(state.characters).toEqual([])
  })

  it('refresh 시작 시 status를 loading으로 바꾼다', async () => {
    let resolveSync: (value: CharacterScheduleSync[]) => void = () => {}
    syncSchedulesMock.mockImplementation(
      () =>
        new Promise<CharacterScheduleSync[]>((resolve) => {
          resolveSync = resolve
        }),
    )

    const promise = useContentSchedulerStore.getState().refresh(['ocid-1'])

    await vi.waitFor(() => expect(useContentSchedulerStore.getState().status).toBe('loading'))
    resolveSync([])
    await promise

    expect(useContentSchedulerStore.getState().status).toBe('loaded')
  })
})
