import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  impactAsync,
  performAndroidHapticsAsync,
} from 'expo-haptics'
import { Platform } from 'react-native'

import type { HapticsPort } from '../ports'

/**
 * `HapticsPort` 의 RN 구현. 두 플랫폼이 서로 다른 API 를 쓴다.
 *
 * 안드로이드에서 `impactAsync` 를 쓰지 않는다. 그쪽 구현이 `Vibrator` 로 **흉내 낸 것**이라
 * `VIBRATE` 권한을 먹고 진동 모터를 그냥 돌리며, 사용자가 시스템 설정에서 촉각 피드백을 꺼도
 * 울린다. `performAndroidHapticsAsync` 는 `View.performHapticFeedback` 직결이라 그 설정을
 * 따르고 권한도 필요 없다(expo-haptics 자신의 문서가 이 자리에 그것을 권한다).
 *
 * `Virtual_Key` 는 안드로이드가 **화면 위의 키를 눌렀다**에 쓰는 상수다. API 30+ 를 요구하는
 * 다른 상수들과 달리 API 5 부터 있어 이 앱이 받는 기기 전부에 닿는다.
 */
export const rnHapticsPort: HapticsPort = {
  async tap() {
    if (Platform.OS === 'android') {
      await performAndroidHapticsAsync(AndroidHaptics.Virtual_Key)
      return
    }

    await impactAsync(ImpactFeedbackStyle.Light)
  },
}
