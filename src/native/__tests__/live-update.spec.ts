/**
 * OTA 적용 순서. DB 를 닫고, RN `Modal` 을 다 닫고, 덮고, 다시 시작한다.
 *
 * 모달이 떠 있는 채 다시 시작하면 iOS 에서 그 모달의 투명한 화면이 남아 다시 시작한 앱의 터치를 모두 막는다.
 */
import type { LiveUpdatePort } from '../ports'
import { setLiveUpdatePort } from '../ports'
import { applyLiveUpdate } from '../live-update'

// 팩토리 밖 이름은 `mock` 접두만 끌어올 수 있어, 호출 순서를 담는 배열을 이 이름으로 둔다.
var mockCallOrder: string[] = []

jest.mock('../../storage/sqlite/db', () => ({
  closeBossProfitDb: jest.fn(async () => {
    mockCallOrder.push('close-db')
  }),
}))
jest.mock('../../lib/native-modal-gate', () => ({
  closeNativeModals: jest.fn(async () => {
    mockCallOrder.push('close-modals')
  }),
}))
jest.mock('../splash-screen', () => ({
  showSplashScreen: jest.fn(async () => {
    mockCallOrder.push('cover')
  }),
}))

const { closeNativeModals } = jest.requireMock<{ closeNativeModals: jest.Mock }>('../../lib/native-modal-gate')

function installPort(apply: () => Promise<void>): void {
  setLiveUpdatePort({ apply } as unknown as LiveUpdatePort)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCallOrder.length = 0
})

describe('applyLiveUpdate', () => {
  it('DB 닫기 → 모달 닫기 → 커버 → 다시 시작 순으로 부른다', async () => {
    installPort(async () => {
      mockCallOrder.push('reload')
    })

    await applyLiveUpdate()

    expect(mockCallOrder).toEqual(['close-db', 'close-modals', 'cover', 'reload'])
  })

  it('모달이 다 닫히기 전에는 덮지도 다시 시작하지도 않는다', async () => {
    let finishClosing: () => void = () => {}
    closeNativeModals.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClosing = () => {
            mockCallOrder.push('close-modals')
            resolve()
          }
        }),
    )
    installPort(async () => {
      mockCallOrder.push('reload')
    })

    const applying = applyLiveUpdate()
    await Promise.resolve()
    await Promise.resolve()
    expect(mockCallOrder).toEqual(['close-db'])

    finishClosing()
    await applying

    expect(mockCallOrder).toEqual(['close-db', 'close-modals', 'cover', 'reload'])
  })
})
