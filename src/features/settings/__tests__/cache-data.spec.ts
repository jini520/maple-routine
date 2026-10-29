/**
 * 데이터 삭제 뒤 다시 띄우는 순서와, 실패를 다시 띄운 앱이 알리는지 본다.
 *
 * 커버를 먼저 올린 뒤 매달릴 수 있는 닫기를 돌면, 닫기가 응답하지 않는 동안 사용자가 터치도 안 되는 주황 화면에 갇힌다.
 */
import { waitFor } from '../../../__tests__/wait-for'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import type { CacheDataSelection } from '../../../storage/cache-data'
import { useToastStore } from '../../toast/store'
import { clearCacheDataAndReload, showPendingCacheClearNotice } from '../cache-data'

// 팩토리 밖 이름은 `mock` 접두만 끌어올 수 있어, 호출 순서를 담는 배열과 목을 이름으로 잇는다.
var mockCallOrder: string[] = []

jest.mock('../../../storage/cache-data', () => ({
  clearCacheData: jest.fn(async () => {}),
  getCacheDataCounts: jest.fn(),
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

const { clearCacheData } = jest.requireMock<{ clearCacheData: jest.Mock }>('../../../storage/cache-data')
const { closeBossProfitDb } = jest.requireMock<{ closeBossProfitDb: jest.Mock }>('../../../storage/sqlite/db')
const { showSplashScreen } = jest.requireMock<{ showSplashScreen: jest.Mock }>('../../../native/splash-screen')

const CASHBOOK: CacheDataSelection = { manual: false, boss: false, cashbook: true, enhancement: false }

beforeEach(() => {
  jest.clearAllMocks()
  mockCallOrder.length = 0
  installFakePreferences()
  useToastStore.setState({ toasts: [], queue: [] })
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
