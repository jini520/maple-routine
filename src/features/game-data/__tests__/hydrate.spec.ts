jest.mock('../../../server/game-data', () => ({
  __esModule: true,
  fetchGameData: jest.fn(),
}))

import { fetchGameData } from '../../../server/game-data'
import { BUNDLED_BOSS_CATALOG, getBossCatalog, setBossCatalog } from '../../../lib/boss/catalog'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import type { BossCatalog } from '../../../types/boss-catalog'
import { hydrateGameData } from '../hydrate'

const fetchRemote = jest.mocked(fetchGameData)

function 보스표(updatedAt: string, selectionLimit = 12): BossCatalog {
  return {
    updatedAt,
    rules: { weeklyBossSelectionLimit: selectionLimit, weeklyCrystalSaleLimit: 90 },
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

const 사본 = 보스표('2026-10-01T00:00:00.000Z')
const 새표 = 보스표('2026-10-15T00:00:00.000Z', 10)

let prefs: ReturnType<typeof installFakePreferences>

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('bossCatalog')
  jest.clearAllMocks()
  fetchRemote.mockResolvedValue(null)
  setBossCatalog(BUNDLED_BOSS_CATALOG)
})

afterAll(() => {
  setBossCatalog(BUNDLED_BOSS_CATALOG)
})

describe('hydrateGameData', () => {
  it('사본도 서버도 없으면 번들 그대로다', async () => {
    await hydrateGameData()

    expect(getBossCatalog()).toBe(BUNDLED_BOSS_CATALOG)
  })

  it('기기 사본이 있으면 그것으로 세운다. 서버를 못 받아도 그대로다', async () => {
    await prefs.set('bossCatalog', JSON.stringify(사본))

    await hydrateGameData()

    expect(getBossCatalog()).toEqual(사본)
  })

  it('서버를 한 번만 부른다', async () => {
    await hydrateGameData()

    expect(fetchRemote).toHaveBeenCalledTimes(1)
  })

  it('bosses 칸의 updatedAt 이 사본과 다르면 그 칸으로 덮고 사본도 바꾼다', async () => {
    await prefs.set('bossCatalog', JSON.stringify(사본))
    fetchRemote.mockResolvedValue({ bosses: 새표 })

    await hydrateGameData()

    expect(getBossCatalog()).toBe(새표)
    expect(prefs.set).toHaveBeenLastCalledWith('bossCatalog', JSON.stringify(새표))
  })

  // 칸 하나가 계약을 어기거나 서버가 아직 안 넣은 표다. 그 칸만 건너뛴다.
  it('bosses 칸이 null 이면 들고 있던 표 그대로다', async () => {
    await prefs.set('bossCatalog', JSON.stringify(사본))
    prefs.set.mockClear()
    fetchRemote.mockResolvedValue({ bosses: null })

    await hydrateGameData()

    expect(getBossCatalog()).toEqual(사본)
    expect(prefs.set).not.toHaveBeenCalled()
  })

  // 같은 시각이면 같은 표다. 사본을 다시 쓰면 켤 때마다 저장이 한 번 더 일어난다.
  it('updatedAt 이 사본과 같으면 사본 그대로이고 다시 저장하지 않는다', async () => {
    await prefs.set('bossCatalog', JSON.stringify(사본))
    prefs.set.mockClear()
    fetchRemote.mockResolvedValue({ bosses: 보스표(사본.updatedAt as string, 7) })

    await hydrateGameData()

    expect(getBossCatalog()).toEqual(사본)
    expect(prefs.set).not.toHaveBeenCalled()
  })

  it('저장소가 던져도 서버 응답은 쓴다', async () => {
    prefs.get.mockRejectedValue(new Error('storage'))
    prefs.set.mockRejectedValue(new Error('storage'))
    fetchRemote.mockResolvedValue({ bosses: 새표 })

    await expect(hydrateGameData()).resolves.toBeUndefined()

    expect(getBossCatalog()).toBe(새표)
  })
})
