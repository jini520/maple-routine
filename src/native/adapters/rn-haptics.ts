import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  impactAsync,
  performAndroidHapticsAsync,
  selectionAsync,
} from 'expo-haptics'
import { Platform } from 'react-native'

import type { HapticsPort } from '../ports'

/**
 * `HapticsPort` 의 RN 구현. 두 플랫폼이 서로 다른 API 를 쓴다.
 *
 * 안드로이드에서 `impactAsync`·`selectionAsync` 를 쓰지 않는다. 그쪽 구현이 `Vibrator` 로
 * **흉내 낸 것**이라 `VIBRATE` 권한을 먹고 진동 모터를 그냥 돌리며, 사용자가 시스템 설정에서
 * 촉각 피드백을 꺼도 울린다. `performAndroidHapticsAsync` 는 `View.performHapticFeedback`
 * 직결이라 그 설정을 따르고 권한도 필요 없다(expo-haptics 자신의 문서가 이 자리에 그것을 권한다).
 *
 * 안드로이드 상수 둘은 **API 레벨을 안 탄다**. `Virtual_Key`(화면 위의 키를 눌렀다)와
 * `Clock_Tick`(끊긴 값 사이를 옮긴다)은 expo-haptics 가 리플렉션 폴백에 적어 둔 넷 안에 있다.
 * 이름이 더 맞는 `Segment_Tick` 은 API 34+ 라 그 아래 기기에서 거절되고, 거절은 호출부가
 * 삼키므로 두드림이 아예 안 난다.
 */
export const rnHapticsPort: HapticsPort = {
  async tap() {
    if (Platform.OS === 'android') {
      await performAndroidHapticsAsync(AndroidHaptics.Virtual_Key)
      return
    }

    await impactAsync(ImpactFeedbackStyle.Light)
  },

  async select() {
    if (Platform.OS === 'android') {
      await performAndroidHapticsAsync(AndroidHaptics.Clock_Tick)
      return
    }

    await selectionAsync()
  },
}
