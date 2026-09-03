import { StatusBar } from 'react-native'

import type { StatusBarPort } from '../ports'

/**
 * `StatusBarPort` 의 RN 구현.
 *
 * **명암의 방향이 이 파일의 전부다.** 인자 `isDarkTheme` 은 테마가 어두운가 이고, 상태바
 * 글리프는 그 **반대** 명암이어야 읽힌다. 즉 **다크 테마 → 밝은 글리프**다. 뒤집으면 어두운
 * 배경에 어두운 글자가 되어 상태바가 통째로 안 보이는데, 그것은 실기기에서만 드러난다.
 *
 * `'default'` 는 쓰지 않는다. 그 값은 **OS 다크모드 설정**을 따르므로 앱이 고른 테마와 어긋난다
 * (다크모드 기기에서 라이트 테마를 쓰면 밝은 배경에 밝은 글자).
 *
 * 플랫폼 가드가 없는 것은 `setBarStyle` 이 iOS·Android 를 자기가 가르기 때문이다. 이 앱이
 * 빌드하는 타깃도 그 둘뿐이다.
 */
export const rnStatusBarPort: StatusBarPort = {
  // RN 쪽은 동기 API 다. 포트가 Promise 인 것은 브릿지를 거치던 사정이고, 그 차이는 여기서
  // 흡수한다(시그니처는 안 바꾼다).
  async setStyle(isDarkTheme) {
    StatusBar.setBarStyle(isDarkTheme ? 'light-content' : 'dark-content')
  },
}