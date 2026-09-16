/**
 * 이 앱의 OS 알림 설정을 여는 길.
 *
 * 플랫폼 분기를 화면에 인라인으로 적지 않고 여기 두는 이유는 두 갈래를 다 재기 위해서다.
 * `store-review-link.ts` 도 같은 이유로 갈라져 있다.
 *
 * 패키지 이름을 상수로 적는다. 런타임에 읽으려면 의존을 하나 들여야 하는데, 그러면 지문이
 * 바뀌어 이미 스토어에 나간 바이너리가 OTA 를 못 받는다.
 *
 * @param platform `Platform.OS`. 화면이 넘긴다
 */
import { Linking } from 'react-native'

/** 안드로이드 인텐트 엑스트라가 요구하는 값. `app.json` 의 `android.package` 와 같아야 한다. */
const PACKAGE = 'com.mapleroutine.app'

export function openNotificationSettings(platform: string): Promise<void> {
  // 안드로이드에서 `openSettings()` 는 `애플리케이션 정보` 까지만 간다(Z Flip3 실기기 확인).
  // 알림은 거기서 한 번 더 눌러야 나와서, 버튼 이름이 말하는 곳과 실제로 가는 곳이 어긋난다.
  if (platform === 'android') {
    return Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: PACKAGE },
    ])
  }

  // iOS 에는 앱별 알림 설정으로 바로 가는 공개 경로가 없다. 앱 설정 페이지에 `알림` 이 있다.
  return Linking.openSettings()
}
