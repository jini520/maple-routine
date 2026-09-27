import { openBrowserAsync } from 'expo-web-browser'

import type { BrowserPort } from '../ports'

/**
 * `BrowserPort` 의 RN 구현. iOS 는 SFSafariViewController, 안드로이드는 Chrome Custom Tabs 다.
 *
 * `openAuthSessionAsync` 가 아니다. 그쪽은 콜백 URL 을 그 세션에만 돌려주는 인증 전용 창이고,
 * 여기서 여는 것은 읽기만 하는 문서라 돌려받을 것이 없다.
 */
export const rnBrowserPort: BrowserPort = {
  async open(url) {
    await openBrowserAsync(url)
  },
}
