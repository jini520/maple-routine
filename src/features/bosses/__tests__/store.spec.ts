import { BUNDLED_BOSS_CATALOG, getBossCatalog, setBossCatalog } from '../../../lib/boss/catalog'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import type { BossCatalog } from '../../../types/boss-catalog'
import { applyBossCatalog, loadBossCatalogCopy, useBossCatalogStore } from '../store'

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
  setBossCatalog(BUNDLED_BOSS_CATALOG)
})

afterAll(() => {
  setBossCatalog(BUNDLED_BOSS_CATALOG)
})

describe('loadBossCatalogCopy', () => {
  it('사본이 없으면 번들 그대로다', async () => {
    await loadBossCatalogCopy()

    expect(getBossCatalog()).toBe(BUNDLED_BOSS_CATALOG)
  })

  it('기기 사본이 있으면 그것으로 세운다', async () => {
    await prefs.set('bossCatalog', JSON.stringify(사본))

    await loadBossCatalogCopy()

    expect(getBossCatalog()).toEqual(사본)
  })

  it('저장소가 던져도 번들 그대로이고 던지지 않는다', async () => {
    prefs.get.mockRejectedValue(new Error('storage'))

    await expect(loadBossCatalogCopy()).resolves.toBeUndefined()

    expect(getBossCatalog()).toBe(BUNDLED_BOSS_CATALOG)
  })
})

describe('applyBossCatalog', () => {
  it('updatedAt 이 지금 표와 다르면 덮고 사본도 바꾼다', async () => {
    setBossCatalog(사본)

    await applyBossCatalog(새표)

    expect(getBossCatalog()).toBe(새표)
    expect(prefs.set).toHaveBeenLastCalledWith('bossCatalog', JSON.stringify(새표))
  })

  // 같은 시각이면 같은 표다. 사본을 다시 쓰면 켤 때마다 저장이 한 번 더 일어난다.
  it('updatedAt 이 같으면 그대로이고 저장하지 않는다', async () => {
    setBossCatalog(사본)

    await applyBossCatalog(표(사본.updatedAt as string, 7))

    expect(getBossCatalog()).toBe(사본)
    expect(prefs.set).not.toHaveBeenCalled()
  })

  it('저장소가 던져도 표는 덮는다', async () => {
    prefs.set.mockRejectedValue(new Error('storage'))

    await expect(applyBossCatalog(새표)).resolves.toBeUndefined()

    expect(getBossCatalog()).toBe(새표)
  })
})

describe('useBossCatalogStore', () => {
  it('표가 바뀌면 스토어가 따라간다', async () => {
    await applyBossCatalog(새표)

    expect(useBossCatalogStore.getState().catalog).toBe(새표)
  })

  it('처음에는 번들이다', () => {
    expect(useBossCatalogStore.getState().catalog).toBe(BUNDLED_BOSS_CATALOG)
  })
})
