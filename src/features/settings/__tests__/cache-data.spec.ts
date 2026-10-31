/**
 * 데이터 삭제 뒤 다시 띄우는 순서와, 실패를 다시 띄운 앱이 알리는지 본다.
 *
 * 커버를 먼저 올린 뒤 매달릴 수 있는 닫기를 돌면, 닫기가 응답하지 않는 동안 사용자가 터치도 안 되는 주황 화면에 갇힌다.
 */
import { waitFor } from '../../../__tests__/wait-for'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import type { CacheDataSelection } from '../../../storage/cache-data'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import { useToastStore } from '../../toast/store'
import { clearCacheDataAndReload, loadCacheDataCounts, showPendingCacheClearNotice } from '../cache-data'

// 팩토리 밖 이름은 `mock` 접두만 끌어올 수 있어, 호출 순서를 담는 배열과 목을 이름으로 잇는다.
var mockCallOrder: string[] = []

jest.mock('../../../storage/cache-data', () => ({
  clearCacheData: jest.fn(async () => {}),
  getCacheDataCounts: jest.fn(),
}))
jest.mock('../../query/persist', () => ({
  ...jest.requireActual('../../query/persist'),
  stopQueryPersist: jest.fn(() => {
    mockCallOrder.push('stop')
  }),
}))
jest.mock('../../../storage/sqlite/db', () => ({
  closeBossProfitDb: jest.fn(async () => {
    mockCallOrder.push('close')
  }),
}))
jest.mock('../../../native/splash-screen', () => ({
  showSplashScreen: jest.fn(async () => {
    mockCallOrder.push('cover')
  }),
}))

const { clearCacheData, getCacheDataCounts } = jest.requireMock<{ clearCacheData: jest.Mock; getCacheDataCounts: jest.Mock }>(
  '../../../storage/cache-data',
)
const { stopQueryPersist } = jest.requireMock<{ stopQueryPersist: jest.Mock }>('../../query/persist')
const { closeBossProfitDb } = jest.requireMock<{ closeBossProfitDb: jest.Mock }>('../../../storage/sqlite/db')
const { showSplashScreen } = jest.requireMock<{ showSplashScreen: jest.Mock }>('../../../native/splash-screen')

const CASHBOOK: CacheDataSelection = { manual: false, boss: false, cashbook: true, enhancement: false, cache: false }
const CACHE: CacheDataSelection = { ...CASHBOOK, cashbook: false, cache: true }

beforeEach(() => {
  jest.clearAllMocks()
  mockCallOrder.length = 0
  installFakePreferences()
  useToastStore.setState({ toasts: [], queue: [] })
  queryClient.clear()
})

describe('loadCacheDataCounts', () => {
  // 저장된 쿼리는 표의 한 행에 JSON 으로 들어 있어 저장소가 셀 수 없다.
  it('캐시 건수에 저장되는 쿼리 수를 더한다. 저장하지 않는 쿼리는 안 센다', async () => {
    getCacheDataCounts.mockResolvedValue({
      manualCharacters: 0,
      bossClears: 0,
      bossDrops: 0,
      cashbookEntries: 0,
      enhancementDays: 0,
      cacheEntries: 3,
    })
    queryClient.setQueryData(queryKeys.mesoRate('ocid-1'), 149)
    queryClient.setQueryData(queryKeys.eventWorldNames(), [])
    queryClient.setQueryData(queryKeys.trackedOcids(), ['ocid-1'])

    expect((await loadCacheDataCounts()).cacheEntries).toBe(5)
  })
})

describe('clearCacheDataAndReload', () => {
  // 다시 띄우면 지금 화면이 사라진다. 실패는 표시로 넘겨 다시 띄운 앱이 한 번만 알린다.
  it('삭제가 실패하면 다시 띄운 뒤 오류 토스트를 한 번 띄운다', async () => {
    clearCacheData.mockRejectedValueOnce(new Error('disk'))

    await clearCacheDataAndReload(CASHBOOK, jest.fn())
    await showPendingCacheClearNotice()
    await showPendingCacheClearNotice()

    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(['데이터를 일부만 삭제했습니다'])
  })

  it('삭제가 성공하면 아무것도 알리지 않는다', async () => {
    await clearCacheDataAndReload(CASHBOOK, jest.fn())
    await showPendingCacheClearNotice()

    expect(useToastStore.getState().toasts).toEqual([])
  })

  // 메모리의 쿼리 캐시가 살아 있어 저장기를 그대로 두면 방금 지운 표를 다시 쓰고, 닫은 DB 를 다시 연다.
  it('캐시를 고르면 지우기 전에 저장기를 멈춘다', async () => {
    clearCacheData.mockImplementationOnce(async () => {
      mockCallOrder.push('clear')
    })

    await clearCacheDataAndReload(CACHE, jest.fn())

    expect(mockCallOrder.slice(0, 2)).toEqual(['stop', 'clear'])
  })

  it('캐시를 안 고르면 저장기를 멈추지 않는다', async () => {
    await clearCacheDataAndReload(CASHBOOK, jest.fn())

    expect(stopQueryPersist).not.toHaveBeenCalled()
  })

  it('닫기 → 커버 → 리로드 순으로 부른다', async () => {
    await clearCacheDataAndReload(CASHBOOK, () => {
      mockCallOrder.push('reload')
    })

    expect(mockCallOrder).toEqual(['close', 'cover', 'reload'])
  })

  // 닫기가 매달리는 동안 화면이 가려져 있지 않아야 한다. 커버는 리로드 직전에만 올라간다.
  it('닫기가 끝나기 전에는 커버를 올리지 않는다', async () => {
    let finishClose: () => void = () => {}
    closeBossProfitDb.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = () => {
            mockCallOrder.push('close')
            resolve()
          }
        }),
    )
    const reload = jest.fn(() => {
      mockCallOrder.push('reload')
    })

    const pending = clearCacheDataAndReload(CASHBOOK, reload)
    await waitFor(() => {
      expect(closeBossProfitDb).toHaveBeenCalled()
    })

    expect(showSplashScreen).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()

    finishClose()
    await pending

    expect(mockCallOrder).toEqual(['close', 'cover', 'reload'])
  })

  // 커버는 화면 장치일 뿐이라, 그것이 실패했다고 리로드를 막으면 안 된다.
  it('커버 표시가 실패해도 리로드한다', async () => {
    showSplashScreen.mockRejectedValueOnce(new Error('splash failed'))
    const reload = jest.fn(() => {
      mockCallOrder.push('reload')
    })

    await clearCacheDataAndReload(CASHBOOK, reload)

    expect(reload).toHaveBeenCalledOnce()
    expect(mockCallOrder).toEqual(['close', 'reload'])
  })
})
