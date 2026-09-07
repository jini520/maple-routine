// 알림 권한을 언제 묻는가. **캐릭터를 고른 직후, 한 번도 안 물었을 때만.**
//
// iOS 는 한 번 거부하면 다시 못 묻는다. 그래서 이 한 번을 어디에 쓰느냐가 결정이고,
// 이 파일이 그 규칙을 지킨다. 두 번 뜨는 것도 안 되고, 캐릭터도 안 고른 사람에게 뜨는 것도
// 안 된다.
jest.mock('../../../native/notifications', () => ({
  __esModule: true,
  requestNotificationPermission: jest.fn(),
}))

import { requestNotificationPermission } from '../../../native/notifications'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getNotificationPermissionAsked } from '../../../storage/notice-settings'
import { askNotificationPermissionOnce } from '../permission-gate'
import { useNoticeStore } from '../store'

const request = jest.mocked(requestNotificationPermission)
const setSubscribed = jest.fn().mockResolvedValue(undefined)

beforeEach(async () => {
  const prefs = installFakePreferences()
  await prefs.remove('noticeSubscribed')
  await prefs.remove('notificationPermissionAsked')
  jest.clearAllMocks()
  request.mockResolvedValue(true)
  setSubscribed.mockResolvedValue(undefined)
  useNoticeStore.setState({ subscribed: false, setSubscribed })
})

describe('한 번만 묻는다', () => {
  it('처음이면 묻는다', async () => {
    await askNotificationPermissionOnce()

    expect(request).toHaveBeenCalledTimes(1)
  })

  it('두 번째는 안 묻는다', async () => {
    await askNotificationPermissionOnce()
    await askNotificationPermissionOnce()

    expect(request).toHaveBeenCalledTimes(1)
  })

  // 거부해도 물은 것이다. iOS 는 두 번째 팝업을 아예 안 띄우므로 다시 부르면 조용히 실패한다.
  it('거부했어도 다시 안 묻는다', async () => {
    request.mockResolvedValue(false)
    await askNotificationPermissionOnce()
    jest.clearAllMocks()

    await askNotificationPermissionOnce()

    expect(request).not.toHaveBeenCalled()
  })

  // **묻기 전에 적는다.** OS 팝업은 뜨는 순간 소모되므로, 그 뒤에 무슨 일이 나든 물은 것이다.
  // 뒤에 적으면 앱이 그 사이에 죽었을 때 다시 물으려 하고 그때는 팝업이 안 뜬다.
  it('요청이 던져도 물은 것으로 남는다', async () => {
    request.mockRejectedValue(new Error('native'))

    await askNotificationPermissionOnce()

    await expect(getNotificationPermissionAsked()).resolves.toBe(true)
  })
})

describe('허용하면 구독까지 켠다', () => {
  it('허용이면 켠다', async () => {
    await askNotificationPermissionOnce()

    expect(setSubscribed).toHaveBeenCalledWith(true)
  })

  it('거부면 안 켠다', async () => {
    request.mockResolvedValue(false)

    await askNotificationPermissionOnce()

    expect(setSubscribed).not.toHaveBeenCalled()
  })

  // 권한은 받았는데 토픽 구독이 실패할 수 있다. 그래도 여기서 던지면 캐릭터 저장 흐름이 깨진다.
  it('구독이 실패해도 던지지 않는다', async () => {
    setSubscribed.mockRejectedValue(new Error('network'))

    await expect(askNotificationPermissionOnce()).resolves.toBeUndefined()
  })
})
