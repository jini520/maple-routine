jest.mock('../../../server/manual-completion', () => ({
  __esModule: true,
  fetchManualCompletionBosses: jest.fn(),
}))

import { fetchManualCompletionBosses } from '../../../server/manual-completion'
import { getCurrentBossProfitPeriod } from '../../../lib/boss/boss-profit-period'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import type { ManualCompletionBoss } from '../../../types/manual-completion'
import { useManualCompletionStore } from '../store'

const fetchBosses = jest.mocked(fetchManualCompletionBosses)

const 검마: ManualCompletionBoss = { boss: 'black_mage', from: '2026-09-01' }
const 이번주 = getCurrentBossProfitPeriod('weekly', new Date()).periodKey

let prefs: ReturnType<typeof installFakePreferences>

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('dismissedManualCompletion')
  jest.clearAllMocks()
  fetchBosses.mockResolvedValue([])
  useManualCompletionStore.setState({ bosses: null, dismissedWeek: null, visible: false })
})

describe('refresh', () => {
  it('열린 보스가 있으면 줄이 선다', async () => {
    fetchBosses.mockResolvedValue([검마])

    await useManualCompletionStore.getState().refresh()

    expect(useManualCompletionStore.getState().bosses).toEqual([검마])
    expect(useManualCompletionStore.getState().visible).toBe(true)
  })

  it('열린 보스가 없으면 안 선다', async () => {
    await useManualCompletionStore.getState().refresh()

    expect(useManualCompletionStore.getState().visible).toBe(false)
  })

  // 못 받은 것과 **아무것도 안 열림** 은 다른 사실이지만 화면이 하는 일은 같다. 안 세운다.
  it('서버를 못 받으면 목록을 모르는 채로 둔다', async () => {
    fetchBosses.mockResolvedValue([검마])
    await useManualCompletionStore.getState().refresh()

    fetchBosses.mockResolvedValue(null)
    await useManualCompletionStore.getState().refresh()

    expect(useManualCompletionStore.getState().bosses).toBeNull()
    expect(useManualCompletionStore.getState().visible).toBe(false)
  })

  it('겹쳐 불러도 서버는 한 번만 부른다', async () => {
    fetchBosses.mockResolvedValue([검마])

    await Promise.all([
      useManualCompletionStore.getState().refresh(),
      useManualCompletionStore.getState().refresh(),
    ])

    expect(fetchBosses).toHaveBeenCalledTimes(1)
  })
})

describe('dismiss', () => {
  it('닫으면 그 주 동안 안 선다', async () => {
    fetchBosses.mockResolvedValue([검마])
    await useManualCompletionStore.getState().refresh()

    await useManualCompletionStore.getState().dismiss()
    expect(useManualCompletionStore.getState().visible).toBe(false)

    await useManualCompletionStore.getState().refresh()
    expect(useManualCompletionStore.getState().visible).toBe(false)
  })

  it('주가 바뀌면 다시 선다', async () => {
    fetchBosses.mockResolvedValue([검마])
    await useManualCompletionStore.getState().refresh()
    await useManualCompletionStore.getState().dismiss()

    // 지난 주에 닫아 둔 기기를 흉내 낸다. 진실은 기기에 적힌 값이라 스토어가 아니라 저장소를 바꾼다.
    await prefs.set('dismissedManualCompletion', '1999-01-07')
    await useManualCompletionStore.getState().refresh()

    expect(useManualCompletionStore.getState().visible).toBe(true)
  })

  it('닫은 주는 기기에 그 주의 주간 기간 키로 적힌다', async () => {
    fetchBosses.mockResolvedValue([검마])
    await useManualCompletionStore.getState().refresh()

    await useManualCompletionStore.getState().dismiss()

    expect(prefs.set).toHaveBeenCalledWith('dismissedManualCompletion', 이번주)
  })

  // 목록이 없으면 닫을 줄도 없다. 빈 값을 적으면 다음 주 판정이 그 값에 걸린다.
  it('줄이 안 서 있으면 아무것도 안 적는다', async () => {
    await useManualCompletionStore.getState().dismiss()

    expect(prefs.set).not.toHaveBeenCalled()
  })
})
