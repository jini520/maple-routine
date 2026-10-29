import { getCornerRadiusSync } from 'expo-screen-corner-radius'

import type { ScreenCornersPort } from '../ports'

/**
 * `ScreenCornersPort` 의 RN 구현. iOS 는 기기 모델별 표에서, 안드로이드 12+ 는 `RoundedCorner` 로 읽는다.
 *
 * 표에 없는 새 아이폰은 같은 자리의 직전 계열 값이다. 라이브러리에 없는 동작이라 `patches/` 로 넣었다.
 */
export const rnScreenCornersPort: ScreenCornersPort = {
  radius() {
    return getCornerRadiusSync() ?? null
  },
}
