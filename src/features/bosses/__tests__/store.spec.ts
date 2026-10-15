jest.mock('../../../server/bosses', () => ({
  __esModule: true,
  fetchBossCatalog: jest.fn(),
}))

import { fetchBossCatalog } from '../../../server/bosses'
import { BUNDLED_BOSS_CATALOG, getBossCatalog, setBossCatalog } from '../../../lib/boss/catalog'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import type { BossCatalog } from '../../../types/boss-catalog'
import { hydrateBossCatalog, useBossCatalogStore } from '../store'

const fetchCatalog = jest.mocked(fetchBossCatalog)

function 표(updatedAt: string, selectionLimit = 12): BossCatalog {
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

const 사본 = 표('2026-10-01T00:00:00.000Z')
const 새표 = 표('2026-10-15T00:00:00.000Z', 10)

let prefs: ReturnType<typeof installFakePreferences>

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('bossCatalog')
  jest.clearAllMocks()
  fetchCatalog.mockResolvedValue(null)
  setBossCatalog(BUNDLED_BOSS_CATALOG)
})

afterAll(() => {
  setBossCatalog(BUNDLED_BOSS_CATALOG)
})

describe('hydrateBossCatalog', () => {
  it('사본도 서버도 없으면 번들 그대로다', async () => {
    await hydrateBossCatalog()

    expect(getBossCatalog()).toBe(BUNDLED_BOSS_CATALOG)
  })

  it('기기 사본이 있으면 그것으로 세운다. 서버를 못 받아도 그대로다', async () => {
    await prefs.set('bossCatalog', JSON.stringify(사본))

    await hydrateBossCatalog()

    expect(getBossCatalog()).toEqual(사본)
  })

  it('서버의 updatedAt 이 사본과 다르면 서버 응답으로 덮고 사본도 바꾼다', async () => {
    await prefs.set('bossCatalog', JSON.stringify(사본))
    fetchCatalog.mockResolvedValue(새표)

    await hydrateBossCatalog()

    expect(getBossCatalog()).toBe(새표)
    expect(prefs.set).toHaveBeenLastCalledWith('bossCatalog', JSON.stringify(새표))
  })

  it('사본이 없고 서버만 있으면 서버 응답으로 덮는다', async () => {
    fetchCatalog.mockResolvedValue(새표)

    await hydrateBossCatalog()

    expect(getBossCatalog()).toBe(새표)
    expect(prefs.set).toHaveBeenCalledWith('bossCatalog', JSON.stringify(새표))
  })

  // 같은 시각이면 같은 표다. 사본을 다시 쓰면 켤 때마다 저장이 한 번 더 일어난다.
  it('서버의 updatedAt 이 사본과 같으면 사본 그대로이고 다시 저장하지 않는다', async () => {
    await prefs.set('bossCatalog', JSON.stringify(사본))
    prefs.set.mockClear()
    fetchCatalog.mockResolvedValue(표(사본.updatedAt as string, 7))

    await hydrateBossCatalog()

    expect(getBossCatalog()).toEqual(사본)
    expect(prefs.set).not.toHaveBeenCalled()
  })

  it('저장소가 던져도 서버 응답은 쓴다', async () => {
    prefs.get.mockRejectedValue(new Error('storage'))
    prefs.set.mockRejectedValue(new Error('storage'))
    fetchCatalog.mockResolvedValue(새표)

    await expect(hydrateBossCatalog()).resolves.toBeUndefined()

    expect(getBossCatalog()).toBe(새표)
  })
})

describe('useBossCatalogStore', () => {
  it('표가 바뀌면 스토어가 따라간다', async () => {
    fetchCatalog.mockResolvedValue(새표)

    await hydrateBossCatalog()

    expect(useBossCatalogStore.getState().catalog).toBe(새표)
  })

  it('처음에는 번들이다', () => {
    expect(useBossCatalogStore.getState().catalog).toBe(BUNDLED_BOSS_CATALOG)
  })
})
