import { installFakePreferences } from './fake-preferences'
import {
  getNoticeSubscribed,
  getNotificationPermissionAsked,
  setNoticeSubscribed,
  setNotificationPermissionAsked,
} from '../notice-settings'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('noticeSubscribed')
  await prefs.remove('notificationPermissionAsked')
})

describe('공지 구독', () => {
  // 기본이 꺼짐인 이유는 켠 사람만 받기 때문이다. 권한을 허용하면 그때 켜진다.
  it('저장된 값이 없으면 꺼짐', async () => {
    await expect(getNoticeSubscribed()).resolves.toBe(false)
  })

  it('켜면 켜진 것을 읽는다', async () => {
    await setNoticeSubscribed(true)
    await expect(getNoticeSubscribed()).resolves.toBe(true)
  })

  it('다시 끄면 꺼진다', async () => {
    await setNoticeSubscribed(true)
    await setNoticeSubscribed(false)
    await expect(getNoticeSubscribed()).resolves.toBe(false)
  })
})

describe('권한을 물은 적 있는가', () => {
  // OS 에 묻지 않고 우리가 기억하는 이유. 안드로이드의 denied 는 거부했다와 아직 안 물었다를
  // 구분해 주지 않는 상태가 있고, 그것을 안 물었다로 읽으면 거부한 사용자에게 계속 팝업이 뜬다.
  it('저장된 값이 없으면 안 물은 것', async () => {
    await expect(getNotificationPermissionAsked()).resolves.toBe(false)
  })

  it('한 번 물었다고 적으면 그대로 남는다', async () => {
    await setNotificationPermissionAsked()
    await expect(getNotificationPermissionAsked()).resolves.toBe(true)
  })

  // 되돌리는 함수를 두지 않는다. 물은 사실은 취소되지 않는다.
  it('되돌리는 길이 없다', () => {
    const asked: unknown = setNotificationPermissionAsked
    expect(typeof asked).toBe('function')
  })
})

describe('실패 전파', () => {
  it('set 이 거부되면 그대로 던진다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setNoticeSubscribed(true)).rejects.toThrow('disk full')
  })
})
