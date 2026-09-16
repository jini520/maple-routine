// 이 앱의 OS 알림 설정을 여는 길. 플랫폼 분기를 화면에 인라인으로 적으면 두 갈래 중 한쪽만
// 테스트가 볼 수 있다.
import { Linking } from 'react-native'

import { openNotificationSettings } from '../notification-settings-link'

const sendIntent = jest.spyOn(Linking, 'sendIntent')
const openSettings = jest.spyOn(Linking, 'openSettings')

beforeEach(() => {
  sendIntent.mockReset().mockResolvedValue(undefined)
  openSettings.mockReset().mockResolvedValue(undefined)
})

// `openSettings()` 는 안드로이드에서 `애플리케이션 정보` 까지만 간다. 알림은 거기서 한 번 더
// 눌러야 나온다(Z Flip3 실기기 확인).
describe('안드로이드', () => {
  it('알림 설정 인텐트로 곧장 간다', async () => {
    await openNotificationSettings('android')

    expect(sendIntent).toHaveBeenCalledWith('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: 'com.mapleroutine.app' },
    ])
    expect(openSettings).not.toHaveBeenCalled()
  })
})

// iOS 에는 앱별 알림 설정으로 바로 가는 공개 경로가 없다. 앱 설정 페이지에 `알림` 이 있다.
describe('iOS', () => {
  it('앱 설정 페이지를 연다', async () => {
    await openNotificationSettings('ios')

    expect(openSettings).toHaveBeenCalledTimes(1)
    expect(sendIntent).not.toHaveBeenCalled()
  })
})

// `sendIntent` 는 안드로이드에만 있다. 나머지 플랫폼에서 그것을 부르면 죽는다.
describe('나머지 플랫폼', () => {
  it('iOS 와 같은 길로 간다', async () => {
    await openNotificationSettings('web')

    expect(openSettings).toHaveBeenCalledTimes(1)
    expect(sendIntent).not.toHaveBeenCalled()
  })
})
