import { installFakePreferences } from './fake-preferences'
import { createQueryPersister, removeLegacyBossCatalogCopy } from '../query-persister'

let prefs: ReturnType<typeof installFakePreferences>

beforeEach(() => {
  prefs = installFakePreferences()
})

describe('createQueryPersister', () => {
  it('queryCache 키의 사본을 읽는다. 없으면 undefined 다', async () => {
    const persister = createQueryPersister()

    await expect(persister.restoreClient()).resolves.toBeUndefined()

    await prefs.set('queryCache', JSON.stringify({ buster: 'v', timestamp: 1, clientState: { queries: [], mutations: [] } }))
    await expect(persister.restoreClient()).resolves.toEqual({
      buster: 'v',
      timestamp: 1,
      clientState: { queries: [], mutations: [] },
    })
  })

  it('지우기는 그 키 하나를 지운다', async () => {
    await prefs.set('queryCache', '{}')

    await createQueryPersister().removeClient()

    expect(prefs.remove).toHaveBeenCalledWith('queryCache')
    await expect(prefs.get('queryCache')).resolves.toBeNull()
  })
})

describe('removeLegacyBossCatalogCopy', () => {
  it('옛 보스 표 사본 키를 지운다', async () => {
    await prefs.set('bossCatalog', '{}')

    await removeLegacyBossCatalogCopy()

    await expect(prefs.get('bossCatalog')).resolves.toBeNull()
  })
})
