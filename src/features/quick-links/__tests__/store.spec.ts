// 빠른 이동 구성이 저장소를 거쳐 다시 켜도 남는가. 저장이 실패하거나 깨진 값이 남으면 위젯이 기본 구성으로 선다.
import { installFakePreferences, type FakePreferences } from '../../../storage/__tests__/fake-preferences'
import { STORAGE_KEYS } from '../../../storage/keys'
import { DEFAULT_QUICK_LINKS } from '../config'
import { useQuickLinksStore } from '../store'

let prefs: FakePreferences

beforeEach(() => {
  prefs = installFakePreferences()
  useQuickLinksStore.setState({ config: DEFAULT_QUICK_LINKS })
})

describe('restoreFromStorage', () => {
  it('저장된 구성을 올린다', async () => {
    await prefs.set(STORAGE_KEYS.quickLinks, JSON.stringify({ rows: 2, ids: ['boss', 'cashbook'] }))

    await useQuickLinksStore.getState().restoreFromStorage()

    expect(useQuickLinksStore.getState().config).toEqual({ rows: 2, ids: ['boss', 'cashbook'] })
  })

  it.each([null, '{깨진', JSON.stringify({ rows: 1, ids: [] })])('저장된 값이 %p 이면 기본 구성이다', async (stored) => {
    if (stored !== null) await prefs.set(STORAGE_KEYS.quickLinks, stored)
    useQuickLinksStore.setState({ config: { rows: 2, ids: ['boss'] } })

    await useQuickLinksStore.getState().restoreFromStorage()

    expect(useQuickLinksStore.getState().config).toEqual(DEFAULT_QUICK_LINKS)
  })
})

describe('save', () => {
  it('저장하고 위젯이 읽는 값도 바꾼다', async () => {
    await useQuickLinksStore.getState().save({ rows: 1, ids: ['notices', 'boss'] })

    expect(JSON.parse((await prefs.get(STORAGE_KEYS.quickLinks)) ?? 'null')).toEqual({ rows: 1, ids: ['notices', 'boss'] })
    expect(useQuickLinksStore.getState().config).toEqual({ rows: 1, ids: ['notices', 'boss'] })
  })
})
