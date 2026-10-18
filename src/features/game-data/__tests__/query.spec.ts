jest.mock('../../../server/game-data', () => ({
  __esModule: true,
  fetchGameData: jest.fn(),
}))

import { act, renderHook, waitFor } from '@testing-library/react-native'

import { BUNDLED_BOSS_CATALOG, getBossCatalog } from '../../../lib/boss/catalog'
import { worldsTable } from '../../../lib/world/worlds'
import { BUNDLED_GAME_DATA } from '../../../lib/game-data/sections'
import { fetchGameData } from '../../../server/game-data'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import type { BossCatalog } from '../../../types/boss-catalog'
import { GAME_DATA_SECTIONS, type GameDataResponse } from '../../../types/game-data'
import { __resetGameDataForTest, gameDataQueryOptions, hydrateGameData, queryClient, useGameTable } from '../query'

const fetchRemote = jest.mocked(fetchGameData)

function 보스표(updatedAt: string, selectionLimit = 12): BossCatalog {
  return {
    updatedAt,
    rules: { weeklyBossSelectionLimit: selectionLimit, weeklyCrystalSaleLimit: 90, defaultMaxPartySize: 6 },
    bosses: [
      {
        key: 'lotus',
        name: '스우',
        alias: '스우',
        cycle: 'weekly',
        portraitSlug: 'lotus',
        difficulties: [{ difficulty: 'normal', requiredLevel: 190 }],
      },
    ],
  }
}

/** 칸 열셋 중 넘긴 것만 값인 응답. */
function 응답(received: Partial<GameDataResponse>): GameDataResponse {
  const base = Object.fromEntries(GAME_DATA_SECTIONS.map((section) => [section, null])) as GameDataResponse
  return { ...base, ...received }
}

const 새표 = 보스표('2026-10-15T00:00:00.000Z', 10)

/** persister 가 쓰기를 1초에 한 번으로 묶는다. 저장을 보려면 그만큼 기다린다. */
const 저장될때까지 = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1_100))

let prefs: ReturnType<typeof installFakePreferences>

beforeEach(() => {
  prefs = installFakePreferences()
  jest.clearAllMocks()
  fetchRemote.mockResolvedValue(null)
  __resetGameDataForTest()
})

afterAll(() => {
  __resetGameDataForTest()
})

describe('hydrateGameData', () => {
  it('사본도 서버도 없으면 번들 그대로다', async () => {
    await hydrateGameData()

    expect(getBossCatalog()).toBe(BUNDLED_BOSS_CATALOG)
    expect(queryClient.getQueryData(gameDataQueryOptions.queryKey)).toEqual(BUNDLED_GAME_DATA)
  })

  it('응답의 칸으로 표를 덮는다. null 인 칸은 들고 있던 표 그대로다', async () => {
    fetchRemote.mockResolvedValue(응답({ bosses: 새표 }))

    await hydrateGameData()

    // 구조 공유가 바뀐 칸을 새 객체로 베끼므로 같은 객체가 아니라 같은 값이다.
    expect(getBossCatalog()).toEqual(새표)
    expect(worldsTable.get()).toBe(BUNDLED_GAME_DATA.worlds)
  })

  it('옛 보스 표 사본 키를 지운다', async () => {
    await prefs.set('bossCatalog', '{}')

    await hydrateGameData()

    await expect(prefs.get('bossCatalog')).resolves.toBeNull()
  })

  // 번들은 서버에서 받은 적이 없다. 받은 것만 저장해야 사본이 늘 서버 값이다. persister 는 빈 봉투는 쓴다.
  it('받은 값을 queryCache 사본에 저장하고, 번들만 있을 때는 쿼리를 저장하지 않는다', async () => {
    await hydrateGameData()
    await 저장될때까지()
    const empty = JSON.parse((await prefs.get('queryCache')) ?? '{"clientState":{"queries":[]}}') as {
      clientState: { queries: unknown[] }
    }
    expect(empty.clientState.queries).toEqual([])

    fetchRemote.mockResolvedValue(응답({ bosses: 새표 }))
    await hydrateGameData()
    await 저장될때까지()

    const saved = await prefs.get('queryCache')
    expect(saved).not.toBeNull()
    expect(saved).toContain('2026-10-15T00:00:00.000Z')
  })

  it('기기 사본이 있으면 그것으로 세운다. 서버를 못 받아도 그대로다', async () => {
    fetchRemote.mockResolvedValue(응답({ bosses: 새표 }))
    await hydrateGameData()
    await 저장될때까지()
    __resetGameDataForTest()
    fetchRemote.mockResolvedValue(null)

    await hydrateGameData()

    expect(getBossCatalog()).toEqual(새표)
    expect(worldsTable.get()).toEqual(BUNDLED_GAME_DATA.worlds)
  })

  // 계약이 바뀐 옛 사본은 읽을 수 없다. 통째로 버리고 번들이 선 뒤 서버가 덮는다.
  it('계약 판이 다른 사본은 버린다', async () => {
    fetchRemote.mockResolvedValue(응답({ bosses: 새표 }))
    await hydrateGameData()
    await 저장될때까지()
    const saved = JSON.parse((await prefs.get('queryCache')) as string) as { buster: string }
    await prefs.set('queryCache', JSON.stringify({ ...saved, buster: '옛 계약' }))
    __resetGameDataForTest()
    fetchRemote.mockResolvedValue(null)

    await hydrateGameData()

    expect(getBossCatalog()).toBe(BUNDLED_BOSS_CATALOG)
    expect(prefs.remove).toHaveBeenCalledWith('queryCache')
  })

  it('저장소가 던져도 서버 응답은 쓴다', async () => {
    prefs.get.mockRejectedValue(new Error('storage'))
    prefs.set.mockRejectedValue(new Error('storage'))
    prefs.remove.mockRejectedValue(new Error('storage'))
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchRemote.mockResolvedValue(응답({ bosses: 새표 }))

    await expect(hydrateGameData()).resolves.toBeUndefined()

    expect(getBossCatalog()).toEqual(새표)
  })
})

describe('useGameTable', () => {
  it('처음에는 번들이고 쿼리가 바뀌면 그 칸으로 다시 그린다', async () => {
    const { result } = await renderHook(() => useGameTable('bosses'))
    expect(result.current).toBe(BUNDLED_BOSS_CATALOG)

    await act(async () => {
      queryClient.setQueryData(gameDataQueryOptions.queryKey, { ...BUNDLED_GAME_DATA, bosses: 새표 })
    })

    await waitFor(() => expect(result.current).toEqual(새표))
  })

  // 응답은 통째로 와도 안 바뀐 칸은 같은 참조다. 그 칸을 구독한 화면은 다시 그릴 일이 없다.
  it('안 바뀐 칸을 구독한 훅은 다시 그리지 않는다', async () => {
    let renders = 0
    const { result } = await renderHook(() => {
      renders += 1
      return useGameTable('worlds')
    })
    const before = renders

    await act(async () => {
      queryClient.setQueryData(gameDataQueryOptions.queryKey, { ...BUNDLED_GAME_DATA, bosses: 새표 })
    })
    await waitFor(() => expect(queryClient.getQueryData(gameDataQueryOptions.queryKey)?.bosses).toEqual(새표))

    expect(result.current).toBe(BUNDLED_GAME_DATA.worlds)
    expect(renders).toBe(before)
  })
})
