import { openAuthSessionAsync, openBrowserAsync } from 'expo-web-browser'

import type { BrowserPort } from '../ports'

/**
 * `BrowserPort` 의 RN 구현. iOS 는 SFSafariViewController, 안드로이드는 Chrome Custom Tabs 다.
 *
 * `open` 은 읽기만 하는 문서라 돌려받을 것이 없다. `openAuthSession` 은 `openAuthSessionAsync` 라
 * iOS 에서는 ASWebAuthenticationSession 이고, 콜백 URL 이 그 세션에만 돌아온다.
 */
export const rnBrowserPort: BrowserPort = {
  async open(url) {
    await openBrowserAsync(url)
  },
  async openAuthSession(url, redirectUrl) {
    const result = await openAuthSessionAsync(url, redirectUrl)
    // `cancel`·`dismiss` 는 사용자가 창을 닫은 것이라 돌아온 주소가 없다.
    return result.type === 'success' ? result.url : null
  },
}
