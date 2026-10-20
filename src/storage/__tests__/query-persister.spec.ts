import { installFakePreferences } from './fake-preferences'
import { removeLegacyBossCatalogCopy } from '../query-persister'

let prefs: ReturnType<typeof installFakePreferences>

beforeEach(() => {
  prefs = installFakePreferences()
})

describe('removeLegacyBossCatalogCopy', () => {
  it('옛 보스 표 사본 키를 지운다', async () => {
    await prefs.set('bossCatalog', '{}')

    await removeLegacyBossCatalogCopy()

    await expect(prefs.get('bossCatalog')).resolves.toBeNull()
  })
})
