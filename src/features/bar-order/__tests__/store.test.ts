// 고른 순서가 저장소를 거쳐 다시 켜도 남는가. 저장이 실패하면 바가 다시 켰을 때 되돌아갈 순서를 보여 주면 안 된다.
import { installFakePreferences, type FakePreferences } from '../../../storage/__tests__/fake-preferences'
import { DEFAULT_BAR_ORDER, type BarOrder } from '../../../navigation/bar-groups'
import { useBarOrderStore } from '../store'

const MOVED: BarOrder = { ...DEFAULT_BAR_ORDER, groups: ['today', 'utility', 'ledger', 'schedule', 'settings'] }

let prefs: FakePreferences

beforeEach(() => {
  prefs = installFakePreferences()
  useBarOrderStore.setState({ order: DEFAULT_BAR_ORDER })
})

it('저장한 순서가 다시 켜도 남는다', async () => {
  await useBarOrderStore.getState().save(MOVED)
  useBarOrderStore.setState({ order: DEFAULT_BAR_ORDER })

  await useBarOrderStore.getState().restoreFromStorage()

  expect(useBarOrderStore.getState().order).toEqual(MOVED)
})

it('저장이 실패하면 순서를 바꾸지 않는다', async () => {
  prefs.set.mockRejectedValueOnce(new Error('저장 실패'))

  await expect(useBarOrderStore.getState().save(MOVED)).rejects.toThrow('저장 실패')

  expect(useBarOrderStore.getState().order).toEqual(DEFAULT_BAR_ORDER)
})
