import { installFakePreferences } from './fake-preferences'
import { getBossCatalogCopy, setBossCatalogCopy } from '../bosses'
import type { BossCatalog } from '../../types/boss-catalog'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('bossCatalog')
})

const 표: BossCatalog = {
  updatedAt: '2026-10-15T01:00:00.000Z',
  rules: { weeklyBossSelectionLimit: 12, weeklyCrystalSaleLimit: 90 },
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

describe('보스 표의 기기 사본', () => {
  it('저장된 것이 없으면 null', async () => {
    await expect(getBossCatalogCopy()).resolves.toBeNull()
  })

  it('넣은 것을 읽는다', async () => {
    await setBossCatalogCopy(표)

    await expect(getBossCatalogCopy()).resolves.toEqual(표)
    expect(prefs.set).toHaveBeenCalledWith('bossCatalog', JSON.stringify(표))
  })

  it('깨진 JSON 은 없는 것으로 읽는다', async () => {
    await prefs.set('bossCatalog', '{')

    await expect(getBossCatalogCopy()).resolves.toBeNull()
  })

  // 옛 버전이 다른 모양을 적어 뒀거나 값이 잘렸으면 번들 사본이 낫다. 다음 조회가 다시 채운다.
  it('계약을 어긴 값은 없는 것으로 읽는다', async () => {
    await prefs.set('bossCatalog', JSON.stringify({ ...표, bosses: [] }))

    await expect(getBossCatalogCopy()).resolves.toBeNull()
  })
})
