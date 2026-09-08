import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

import { rnHapticsPort } from '../rn-haptics'

/**
 * 이 파일이 지키는 것은 **플랫폼마다 다른 API 를 부른다** 하나다.
 *
 * 안드로이드에서 `impactAsync` 를 쓰면 조용히 나쁜 쪽으로 동작한다. 그쪽 구현이 `Vibrator` 로
 * 흉내 낸 것이라 `VIBRATE` 권한을 먹고, 사용자가 시스템 촉각 피드백을 꺼도 진동 모터가 돈다.
 * 눈으로는 둘 다 진동해서 실기기에서도 못 가른다.
 */
function setPlatform(os: string): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true })
}

const originalPlatform = Platform.OS

describe('rnHapticsPort', () => {
  afterEach(() => {
    setPlatform(originalPlatform)
    jest.restoreAllMocks()
  })

  it('iOS 는 가벼운 충돌을 낸다', async () => {
    setPlatform('ios')
    const impact = jest.spyOn(Haptics, 'impactAsync').mockResolvedValue()

    await rnHapticsPort.tap()

    expect(impact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
  })

  it('안드로이드는 화면 위의 키를 눌렀다 를 낸다', async () => {
    setPlatform('android')
    const impact = jest.spyOn(Haptics, 'impactAsync').mockResolvedValue()
    const android = jest.spyOn(Haptics, 'performAndroidHapticsAsync').mockResolvedValue()

    await rnHapticsPort.tap()

    expect(android).toHaveBeenCalledWith(Haptics.AndroidHaptics.Virtual_Key)
    expect(impact).not.toHaveBeenCalled()
  })
})
